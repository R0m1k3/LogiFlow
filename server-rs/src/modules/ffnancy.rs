// Relais ffnancy : /api/ffnancy/* (server/routes.ts, « Proxy API ffnancy »).
// Le navigateur ne peut pas appeler https://api.ffnancy.fr (CORS) : le serveur
// relaie la recherche d'articles et les mouvements d'entrée, avec les seuls
// paramètres autorisés (renseignés, dans l'ordre de la liste).
//
// Comme Node (node-fetch) : en-têtes Accept « */* » et User-Agent « node-fetch »,
// sans mandataire ; réponse en erreur : son code et { error: 'API ffnancy error' } ;
// réponse illisible ou injoignable : 500. Le JSON reçu est relu puis réécrit
// comme JSON.parse / JSON.stringify (nombres au format de JavaScript, clés
// numériques en tête), mot de passe SMTP masqué comme toute réponse /api.
//
// Écarts sans effet sur la réponse : pas d'Accept-Encoding (le client HTTP ne
// décompresse pas), et un délai maximal de 30 s (node-fetch n'en a pas).

use std::sync::LazyLock;
use std::time::Duration;

use axum::Router;
use axum::http::{HeaderValue, StatusCode, header};
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use serde_json::{Value, json};

use crate::AppState;
use crate::auth::CurrentUser;
use crate::error::{ApiResult, AppError};
use crate::js;
use crate::json::strip_smtp_password;
use crate::request::JsQuery;
use crate::services::nocodb::array_index;

const FFNANCY_API: &str = "https://api.ffnancy.fr/api";
const ARTICLE_PARAMS: [&str; 7] = ["search", "codein", "ean", "codefou", "actif", "page", "limit"];
const ENTRY_PARAMS: [&str; 6] = ["artNoId", "dateDebut", "dateFin", "site", "page", "limit"];
const TIMEOUT: Duration = Duration::from_secs(30);

static CLIENT: LazyLock<reqwest::Client> = LazyLock::new(|| {
    reqwest::Client::builder()
        .no_proxy()
        .user_agent("node-fetch")
        .timeout(TIMEOUT)
        .build()
        .expect("client HTTP ffnancy")
});

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/ffnancy/articles", get(articles))
        .route("/api/ffnancy/mouvements/entrees", get(entries))
}

/// Adresse relayée : `${base}/${chemin}?${new URLSearchParams(autorisés renseignés)}`
pub fn relay_url(path: &str, allowed: &[&str], query: &JsQuery) -> String {
    let mut params = form_urlencoded::Serializer::new(String::new());
    for key in allowed {
        if let Some(value) = query.truthy(key) {
            params.append_pair(key, value);
        }
    }
    format!("{FFNANCY_API}/{path}?{}", params.finish())
}

async fn articles(_user: CurrentUser, query: JsQuery) -> ApiResult {
    relay(relay_url("articles", &ARTICLE_PARAMS, &query)).await
}

async fn entries(_user: CurrentUser, query: JsQuery) -> ApiResult {
    relay(relay_url("mouvements/entrees", &ENTRY_PARAMS, &query)).await
}

fn error_body(status: StatusCode, error: &str) -> AppError {
    AppError::with_body(status, json!({ "error": error }))
}

/// GET de l'adresse : code d'erreur relayé, ou le JSON reçu réécrit comme Node
async fn relay(url: String) -> ApiResult {
    let unreachable = |error: &dyn std::fmt::Display| {
        tracing::warn!(%error, "appel ffnancy");
        error_body(StatusCode::INTERNAL_SERVER_ERROR, "Failed to reach API ffnancy")
    };
    let response = CLIENT
        .get(&url)
        .header(header::ACCEPT, "*/*")
        .send()
        .await
        .map_err(|error| unreachable(&error))?;
    let status = response.status();
    if !status.is_success() {
        return Err(error_body(status, "API ffnancy error"));
    }
    let text = response.text().await.map_err(|error| unreachable(&error))?;
    // TextDecoder de node-fetch : marque d'ordre des octets retirée
    let value: Value = serde_json::from_str(text.strip_prefix('\u{feff}').unwrap_or(&text))
        .map_err(|error| unreachable(&error))?;
    Ok(json_response(js_stringify(&strip_smtp_password(value))))
}

fn json_response(body: String) -> Response {
    let mut response = body.into_response();
    response.headers_mut().insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static("application/json; charset=utf-8"),
    );
    response
}

/// JSON.stringify d'une valeur lue par JSON.parse : nombres au format de
/// JavaScript (10.0 → 10, 1e21 → 1e+21), clés « indices de tableau » en tête
/// par ordre croissant
pub fn js_stringify(value: &Value) -> String {
    let mut out = String::new();
    write_js(value, &mut out);
    out
}

fn write_js(value: &Value, out: &mut String) {
    match value {
        Value::Null => out.push_str("null"),
        Value::Bool(flag) => out.push_str(if *flag { "true" } else { "false" }),
        Value::Number(number) => {
            let number = number.as_f64().unwrap_or(f64::NAN);
            if number.is_finite() {
                out.push_str(&js::number_string(number));
            } else {
                out.push_str("null");
            }
        }
        Value::String(text) => out.push_str(&Value::String(text.clone()).to_string()),
        Value::Array(items) => {
            out.push('[');
            for (index, item) in items.iter().enumerate() {
                if index > 0 {
                    out.push(',');
                }
                write_js(item, out);
            }
            out.push(']');
        }
        Value::Object(fields) => {
            let (mut indexes, others): (Vec<&String>, Vec<&String>) =
                fields.keys().partition(|key| array_index(key).is_some());
            indexes.sort_by_key(|key| array_index(key));
            out.push('{');
            for (position, key) in indexes.into_iter().chain(others).enumerate() {
                if position > 0 {
                    out.push(',');
                }
                out.push_str(&Value::String(key.clone()).to_string());
                out.push(':');
                write_js(&fields[key.as_str()], out);
            }
            out.push('}');
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    fn query(pairs: &[(&str, &str)]) -> JsQuery {
        JsQuery(
            pairs
                .iter()
                .map(|(key, value)| (key.to_string(), value.to_string()))
                .collect::<HashMap<_, _>>(),
        )
    }

    #[test]
    fn parametres_autorises_dans_l_ordre_de_la_liste() {
        // Valeurs de `${new URLSearchParams(…)}` dans Node
        let q = query(&[
            ("limit", "1"),
            ("ean", "3245678901234"),
            ("groupId", "1"),
            ("search", "pot de fleur & co/é*"),
            ("codein", ""),
        ]);
        assert_eq!(
            relay_url("articles", &ARTICLE_PARAMS, &q),
            "https://api.ffnancy.fr/api/articles?search=pot+de+fleur+%26+co%2F%C3%A9*&ean=3245678901234&limit=1"
        );
        let q = query(&[
            ("dateDebut", "2000-01-01"),
            ("artNoId", "42"),
            ("limit", "1"),
            ("ean", "x"),
        ]);
        assert_eq!(
            relay_url("mouvements/entrees", &ENTRY_PARAMS, &q),
            "https://api.ffnancy.fr/api/mouvements/entrees?artNoId=42&dateDebut=2000-01-01&limit=1"
        );
    }

    #[test]
    fn sans_parametre() {
        assert_eq!(
            relay_url("articles", &ARTICLE_PARAMS, &query(&[])),
            "https://api.ffnancy.fr/api/articles?"
        );
    }

    #[test]
    fn json_reecrit_comme_javascript() {
        // JSON.stringify(JSON.parse(texte)) dans Node
        let parsed: Value = serde_json::from_str(
            r#"{"b":1.0,"10":"x","a":[1e21,0.00001,12345678901234567890,-0.0,"é\u001f"],"2":{"z":true,"0":null},"b":2.50}"#,
        )
        .unwrap();
        assert_eq!(
            js_stringify(&parsed),
            r#"{"2":{"0":null,"z":true},"10":"x","b":2.5,"a":[1e+21,0.00001,12345678901234567000,0,"é\u001f"]}"#
        );
    }

    #[test]
    fn mot_de_passe_smtp_masque() {
        let value = json!({ "group": { "smtpPassword": "secret" } });
        assert_eq!(
            js_stringify(&strip_smtp_password(value)),
            r#"{"group":{"smtpPasswordSet":true}}"#
        );
    }
}
