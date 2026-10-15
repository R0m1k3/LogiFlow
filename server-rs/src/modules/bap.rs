// Bon à payer (BAP) : configuration du webhook n8n (/api/webhook-bap-config, test
// compris) et envoi d'un PDF au webhook (/api/bap/send-webhook), réservés à l'admin
// (server/routes.ts). Les appels sortants reprennent les messages d'erreur de
// node-fetch, que le serveur Node utilise pour ces adresses.
//
// Non repris : la configuration par défaut renvoyée par Node quand la table
// webhook_bap_config n'existe pas (code 42P01) ; la table existe partout.

use std::sync::LazyLock;
use std::time::Duration;

use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::routing::{get, post};
use axum::{Json, Router};
use serde_json::{Value, json};

use crate::AppState;
use crate::auth::CurrentUser;
use crate::db::{self, Table};
use crate::error::{ApiResult, AppError};
use crate::js;
use crate::request::JsonBody;
use crate::schema::WebhookBapConfigRow;
use crate::services::nocodb::{database_message, truthy};
use crate::zod::Object;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/webhook-bap-config", get(get_config).post(save_config))
        .route("/api/webhook-bap-config/test", post(test_webhook))
        .route("/api/bap/send-webhook", post(send_webhook))
}

/// Délai maximal du test du webhook et de l'envoi d'un BAP
const TEST_TIMEOUT: Duration = Duration::from_secs(10);
const SEND_TIMEOUT: Duration = Duration::from_secs(60);

static CLIENT: LazyLock<reqwest::Client> = LazyLock::new(|| {
    reqwest::Client::builder()
        .no_proxy()
        .build()
        .expect("client HTTP des webhooks")
});

/// insertWebhookBapConfigSchema
fn insert_schema() -> Object {
    WebhookBapConfigRow::insert_schema().omit(&["id", "createdAt", "updatedAt"])
}

fn error_body(status: StatusCode, error: &str) -> AppError {
    AppError::with_body(status, json!({ "error": error }))
}

/// Erreur 500 de Node : { error, details }
fn server_error(error: &str, details: &str) -> AppError {
    AppError::with_body(
        StatusCode::INTERNAL_SERVER_ERROR,
        json!({ "error": error, "details": details }),
    )
}

fn admin_only(user: &CurrentUser) -> Result<(), AppError> {
    if user.is_admin() {
        Ok(())
    } else {
        Err(error_body(
            StatusCode::FORBIDDEN,
            "Accès refusé - Admin uniquement",
        ))
    }
}

/// storage.getWebhookBapConfig : la première ligne, sans ordre (comme Node)
async fn load_config(db: &sqlx::PgPool) -> Result<Option<WebhookBapConfigRow>, sqlx::Error> {
    sqlx::query_as(&WebhookBapConfigRow::select("LIMIT 1"))
        .fetch_optional(db)
        .await
}

async fn get_config(State(state): State<AppState>, user: CurrentUser) -> ApiResult {
    admin_only(&user)?;
    let config = load_config(&state.db)
        .await
        .map_err(|error| server_error("Erreur serveur", &database_message(&error)))?;
    Ok(Json(config).into_response())
}

async fn save_config(
    State(state): State<AppState>,
    user: CurrentUser,
    JsonBody(body): JsonBody,
) -> ApiResult {
    admin_only(&user)?;
    // Erreur de validation en 500, avec le message de ZodError (les problèmes en JSON indenté)
    let data = insert_schema().parse(&body).map_err(|issues| {
        let details = serde_json::to_string_pretty(&issues).unwrap_or_default();
        server_error("Erreur serveur", &details)
    })?;
    let database_error = |error: sqlx::Error| server_error("Erreur serveur", &database_message(&error));
    let config = match load_config(&state.db).await.map_err(database_error)? {
        Some(existing) => db::update_by_id::<WebhookBapConfigRow>(&state.db, existing.id, &data, true)
            .await
            .map_err(database_error)?
            .ok_or_else(|| {
                server_error(
                    "Erreur serveur",
                    "Cannot read properties of undefined (reading 'id')",
                )
            })?,
        None => db::insert::<WebhookBapConfigRow>(&state.db, &data)
            .await
            .map_err(database_error)?,
    };
    tracing::info!(
        id = config.id,
        name = config.name,
        active = config.is_active,
        "configuration du webhook BAP sauvegardée"
    );
    Ok(Json(config).into_response())
}

// ---------- Appels sortants, au comportement de node-fetch ----------

/// Échec d'un appel : `aborted` pour un délai dépassé (AbortError)
struct FetchError {
    aborted: bool,
    message: String,
}

impl FetchError {
    fn new(message: String) -> Self {
        Self {
            aborted: false,
            message,
        }
    }
}

/// Cause d'un échec réseau telle que Node la décrit (connect ECONNREFUSED…)
async fn network_reason(url: &reqwest::Url, error: &reqwest::Error) -> String {
    let host = url
        .host_str()
        .unwrap_or_default()
        .trim_matches(['[', ']'])
        .to_string();
    let port = url.port_or_known_default().unwrap_or(80);
    let mut source: Option<&(dyn std::error::Error + 'static)> = Some(error);
    while let Some(current) = source {
        if let Some(io) = current.downcast_ref::<std::io::Error>() {
            if io.kind() == std::io::ErrorKind::ConnectionRefused {
                // Adresse réellement jointe : celle que le nom désigne
                let address = tokio::net::lookup_host((host.as_str(), port))
                    .await
                    .ok()
                    .and_then(|mut addresses| addresses.next())
                    .map_or_else(|| host.clone(), |address| address.ip().to_string());
                return format!("connect ECONNREFUSED {address}:{port}");
            }
        }
        let text = current.to_string();
        if text.contains("dns error") || text.contains("failed to lookup address") {
            return format!("getaddrinfo ENOTFOUND {host}");
        }
        source = current.source();
    }
    error.to_string()
}

/// fetch(url, { method: 'POST', body: JSON }) de node-fetch : statut et corps de la
/// réponse, ou l'erreur que node-fetch lèverait
async fn post_json(
    raw_url: &str,
    body: &Value,
    timeout: Duration,
) -> Result<(StatusCode, String), FetchError> {
    let url = reqwest::Url::parse(raw_url).map_err(|_| FetchError::new("Invalid URL".to_string()))?;
    if !matches!(url.scheme(), "http" | "https") {
        return Err(FetchError::new(format!(
            "node-fetch cannot load {raw_url}. URL scheme \"{}\" is not supported.",
            url.scheme()
        )));
    }
    let response = CLIENT
        .post(url.clone())
        .header("Content-Type", "application/json")
        .body(body.to_string())
        .timeout(timeout)
        .send()
        .await;
    let response = match response {
        Ok(response) => response,
        Err(error) if error.is_timeout() => {
            return Err(FetchError {
                aborted: true,
                message: "The operation was aborted.".to_string(),
            });
        }
        Err(error) => {
            let reason = network_reason(&url, &error).await;
            return Err(FetchError::new(format!(
                "request to {url} failed, reason: {reason}"
            )));
        }
    };
    let status = response.status();
    let text = response
        .text()
        .await
        .map_err(|error| FetchError::new(error.to_string()))?;
    Ok((status, text))
}

/// response.statusText
fn status_text(status: StatusCode) -> &'static str {
    status.canonical_reason().unwrap_or_default()
}

/// texte.substring(0, 200), en unités UTF-16
fn first_200_units(text: &str) -> String {
    let units: Vec<u16> = text.encode_utf16().take(200).collect();
    String::from_utf16_lossy(&units)
}

async fn test_webhook(
    State(_state): State<AppState>,
    user: CurrentUser,
    JsonBody(body): JsonBody,
) -> ApiResult {
    admin_only(&user)?;
    let Some(webhook_url) = body.get("webhookUrl").filter(|url| truthy(url)) else {
        return Err(error_body(StatusCode::BAD_REQUEST, "URL webhook requise"));
    };
    let payload = json!({
        "test": true,
        "timestamp": crate::modules::now_iso(),
        "message": "Test de connectivité depuis LogiFlow",
    });
    match post_json(&js::to_js_string(webhook_url), &payload, TEST_TIMEOUT).await {
        Ok((status, text)) if status.is_success() => Ok(Json(json!({
            "success": true,
            "status": status.as_u16(),
            "message": "Webhook accessible",
            "response": first_200_units(&text),
        }))
        .into_response()),
        Ok((status, _)) => {
            let message = format!("HTTP {}: {}", status.as_u16(), status_text(status));
            Err(server_error(&message, &message))
        }
        Err(error) if error.aborted => {
            Err(server_error("Timeout - Le webhook ne répond pas", &error.message))
        }
        Err(error) => Err(server_error(&error.message, &error.message)),
    }
}

/// Buffer.from(pdfBase64, 'base64').length, ou None si Node lève une TypeError
fn decoded_length(value: &Value) -> Option<usize> {
    match value {
        Value::String(text) => Some(js::buffer_from_base64(text).len()),
        Value::Array(items) => Some(items.len()),
        Value::Object(object) => match object.get("length") {
            Some(Value::Number(length)) => Some(length.as_f64().map_or(0, |n| n.max(0.0) as usize)),
            Some(_) => Some(0),
            None => match (object.get("type"), object.get("data")) {
                (Some(Value::String(kind)), Some(Value::Array(data))) if kind == "Buffer" => Some(data.len()),
                _ => None,
            },
        },
        _ => None,
    }
}

async fn send_webhook(
    State(state): State<AppState>,
    user: CurrentUser,
    JsonBody(body): JsonBody,
) -> ApiResult {
    admin_only(&user)?;
    let field = |name: &str| body.get(name).filter(|value| truthy(value));
    let (Some(pdf_base64), Some(file_name), Some(recipient)) =
        (field("pdfBase64"), field("fileName"), field("recipient"))
    else {
        return Err(error_body(
            StatusCode::BAD_REQUEST,
            "Données manquantes: pdfBase64, fileName ou recipient",
        ));
    };
    if !matches!(recipient.as_str(), Some("Laurie" | "Jeremy")) {
        return Err(error_body(StatusCode::BAD_REQUEST, "Destinataire invalide"));
    }
    let Some(file_name_text) = file_name.as_str() else {
        let message = "fileName.toLowerCase is not a function";
        return Err(server_error(message, message));
    };
    if !file_name_text.to_lowercase().ends_with(".pdf") {
        return Err(error_body(StatusCode::BAD_REQUEST, "Le fichier doit être un PDF"));
    }
    let Some(file_size) = decoded_length(pdf_base64) else {
        return Err(error_body(StatusCode::BAD_REQUEST, "Format base64 invalide"));
    };

    let config = load_config(&state.db).await.map_err(|error| {
        let message = database_message(&error);
        server_error(&message, &message)
    })?;
    let Some(config) = config.filter(|config| config.is_active) else {
        return Err(error_body(
            StatusCode::INTERNAL_SERVER_ERROR,
            "Configuration webhook BAP non disponible",
        ));
    };
    let payload = json!({
        "recipient": recipient,
        "fileName": file_name,
        "fileSize": file_size,
        "pdfBase64": pdf_base64,
        "contentType": "application/pdf",
    });
    tracing::info!(
        recipient = recipient.as_str(),
        file_size,
        "envoi du BAP au webhook"
    );
    match post_json(&config.webhook_url, &payload, SEND_TIMEOUT).await {
        Ok((status, text)) if status.is_success() => Ok(Json(json!({
            "success": true,
            "message": "Fichier envoyé avec succès",
            "webhookResponse": text,
        }))
        .into_response()),
        Ok((status, _)) => {
            let message = format!("Erreur webhook: {} {}", status.as_u16(), status_text(status));
            Err(server_error(&message, &message))
        }
        Err(error) if error.aborted => Err(server_error(
            "Timeout - Le traitement a pris trop de temps",
            &error.message,
        )),
        Err(error) => Err(server_error(&error.message, &error.message)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn taille_du_pdf_comme_buffer_from() {
        assert_eq!(decoded_length(&json!("JVBERi0xLjQ=")), Some(8));
        assert_eq!(decoded_length(&json!([1, 2, 3])), Some(3));
        assert_eq!(decoded_length(&json!({ "length": 5 })), Some(5));
        assert_eq!(decoded_length(&json!({ "length": "x" })), Some(0));
        assert_eq!(
            decoded_length(&json!({ "type": "Buffer", "data": [1, 2] })),
            Some(2)
        );
        assert_eq!(decoded_length(&json!({})), None);
        assert_eq!(decoded_length(&json!(12)), None);
    }

    #[test]
    fn extrait_de_reponse_en_unites_utf16() {
        assert_eq!(first_200_units(&"é".repeat(250)).chars().count(), 200);
    }
}
