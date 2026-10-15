// API externe de rapprochement (server/externalApi.ts, server/externalApiKeys.ts) :
// pour l'instant la gestion des clés depuis Paramètres > API externe
// (/api/external-api/keys, session admin), et les outils de clés d'API partagés.
// Les adresses /api/ext/v1/* (clé d'API) restent servies par Node.
//
// Une clé « lf_… » n'est montrée qu'une fois, à sa création : seuls son empreinte
// SHA-256 et un préfixe lisible sont stockés (table external_api_keys). Les clés
// de la variable d'environnement EXTERNAL_API_KEYS restent acceptées.

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::routing::{delete, get};
use axum::{Json, Router};
use base64::Engine;
use chrono::NaiveDateTime;
use rand::RngCore;
use serde::Serialize;
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use sqlx::{FromRow, PgPool};

use crate::AppState;
use crate::auth::CurrentUser;
use crate::error::{ApiResult, AppError};
use crate::js;
use crate::request::JsonBody;

/// Préfixe des adresses de l'API externe
pub const EXTERNAL_API_PREFIX: &str = "/api/ext/v1";
const KEY_PREFIX: &str = "lf_";
/// Partie lisible gardée en base : « lf_ » + 7 caractères
const DISPLAY_PREFIX_LENGTH: usize = 10;
/// last_used_at n'est réécrit qu'une fois par minute au plus, par clé
const LAST_USED_THROTTLE_SECONDS: i64 = 60;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/external-api/keys", get(list_keys).post(create_key))
        .route("/api/external-api/keys/{id}", delete(revoke_key))
}

// ---------- Clés d'API (server/externalApiKeys.ts) ----------

/// Clé telle que l'interface la voit (PublicApiKey) : tout sauf l'empreinte
#[derive(Debug, Clone, Serialize, FromRow)]
pub struct PublicApiKey {
    pub id: i32,
    pub name: String,
    #[serde(rename = "keyPrefix")]
    pub key_prefix: String,
    #[serde(rename = "createdBy")]
    pub created_by: Option<String>,
    #[serde(rename = "createdAt", serialize_with = "crate::json::ts_opt")]
    pub created_at: Option<NaiveDateTime>,
    #[serde(rename = "lastUsedAt", serialize_with = "crate::json::ts_opt")]
    pub last_used_at: Option<NaiveDateTime>,
    #[serde(rename = "revokedAt", serialize_with = "crate::json::ts_opt")]
    pub revoked_at: Option<NaiveDateTime>,
}

const PUBLIC_COLUMNS: &str = "id, name, key_prefix, created_by, created_at, last_used_at, revoked_at";

/// hashApiKey : empreinte SHA-256 en hexadécimal
pub fn hash_api_key(key: &str) -> String {
    Sha256::digest(key.as_bytes())
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

/// Nouvelle clé : « lf_ » + 24 octets aléatoires en base64url sans remplissage
pub fn generate_api_key() -> String {
    let mut bytes = [0u8; 24];
    rand::thread_rng().fill_bytes(&mut bytes);
    format!(
        "{KEY_PREFIX}{}",
        base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(bytes)
    )
}

/// Clés de la variable d'environnement EXTERNAL_API_KEYS (séparées par des
/// virgules), relues à chaque appel comme Node
pub fn env_api_keys() -> Vec<String> {
    std::env::var("EXTERNAL_API_KEYS")
        .unwrap_or_default()
        .split(',')
        .map(|key| js::trim(key).to_string())
        .filter(|key| !key.is_empty())
        .collect()
}

/// countEnvApiKeys
pub fn count_env_api_keys() -> usize {
    std::env::var("EXTERNAL_API_KEYS")
        .unwrap_or_default()
        .split(',')
        .filter(|key| !js::trim(key).is_empty())
        .count()
}

/// listApiKeys : de la plus récente à la plus ancienne
pub async fn list_api_keys(db: &PgPool) -> Result<Vec<PublicApiKey>, sqlx::Error> {
    sqlx::query_as(&format!(
        "SELECT {PUBLIC_COLUMNS} FROM external_api_keys ORDER BY created_at DESC"
    ))
    .fetch_all(db)
    .await
}

/// createApiKey : rend la clé en clair (seule fois où elle est lisible) et sa ligne
pub async fn create_api_key(
    db: &PgPool,
    name: &str,
    created_by: Option<&str>,
) -> Result<(String, PublicApiKey), sqlx::Error> {
    let key = generate_api_key();
    let row = sqlx::query_as(&format!(
        "INSERT INTO external_api_keys (name, key_prefix, key_hash, created_by) VALUES ($1, $2, $3, $4) RETURNING {PUBLIC_COLUMNS}"
    ))
    .bind(name)
    .bind(&key[..DISPLAY_PREFIX_LENGTH])
    .bind(hash_api_key(&key))
    .bind(created_by)
    .fetch_one(db)
    .await?;
    Ok((key, row))
}

/// revokeApiKey : false si la clé n'existe pas ou était déjà révoquée. L'identifiant
/// est envoyé en texte, comme node-pg (hors limites : erreur SQL)
pub async fn revoke_api_key(db: &PgPool, id: &str) -> Result<bool, sqlx::Error> {
    let revoked: Option<(i32,)> = sqlx::query_as(
        "UPDATE external_api_keys SET revoked_at = $2::timestamp WHERE id = $1::int4 AND revoked_at IS NULL RETURNING id",
    )
    .bind(id)
    .bind(crate::modules::now_iso())
    .fetch_optional(db)
    .await?;
    Ok(revoked.is_some())
}

/// countActiveApiKeys : clés non révoquées
pub async fn count_active_api_keys(db: &PgPool) -> Result<i64, sqlx::Error> {
    let (count,): (i64,) = sqlx::query_as("SELECT count(*) FROM external_api_keys WHERE revoked_at IS NULL")
        .fetch_one(db)
        .await?;
    Ok(count)
}

/// verifyStoredApiKey : la clé est-elle active ? Sa date de dernière utilisation
/// est mise à jour au plus une fois par minute, sans attendre ni faire échouer
pub async fn verify_stored_api_key(db: &PgPool, key: &str) -> Result<bool, sqlx::Error> {
    let row: Option<(i32, Option<NaiveDateTime>)> = sqlx::query_as(
        "SELECT id, last_used_at FROM external_api_keys WHERE key_hash = $1 AND revoked_at IS NULL LIMIT 1",
    )
    .bind(hash_api_key(key))
    .fetch_optional(db)
    .await?;
    let Some((id, last_used_at)) = row else {
        return Ok(false);
    };
    let stale = last_used_at.is_none_or(|last| {
        (chrono::Utc::now().naive_utc() - last).num_seconds() > LAST_USED_THROTTLE_SECONDS
    });
    if stale {
        let db = db.clone();
        tokio::spawn(async move {
            let result =
                sqlx::query("UPDATE external_api_keys SET last_used_at = $2::timestamp WHERE id = $1")
                    .bind(id)
                    .bind(crate::modules::now_iso())
                    .execute(&db)
                    .await;
            if let Err(error) = result {
                tracing::error!(%error, "[EXT-API] last_used_at");
            }
        });
    }
    Ok(true)
}

/// Clé reçue dans « X-API-Key » ou « Authorization: Bearer <clé> » (extractKey)
pub fn extract_api_key(headers: &axum::http::HeaderMap) -> Option<String> {
    let header = |name| headers.get(name).and_then(|value| value.to_str().ok());
    if let Some(key) = header("x-api-key").map(js::trim).filter(|key| !key.is_empty()) {
        return Some(key.to_string());
    }
    let authorization = header("authorization")?;
    let token = authorization
        .get(..7)
        .filter(|scheme| scheme.eq_ignore_ascii_case("bearer "))
        .map(|_| js::trim(&authorization[7..]))?;
    (!token.is_empty()).then(|| token.to_string())
}

/// La clé est-elle une clé de l'environnement ? Comparaison à temps constant des empreintes
pub fn is_env_api_key(key: &str) -> bool {
    use subtle::ConstantTimeEq;
    let provided = Sha256::digest(key.as_bytes());
    env_api_keys()
        .iter()
        .any(|env_key| bool::from(Sha256::digest(env_key.as_bytes()).ct_eq(&provided)))
}

// ---------- Gestion des clés depuis Paramètres (session admin) ----------

/// requireAdmin (server/permissions.ts)
fn require_admin(user: &CurrentUser) -> Result<(), AppError> {
    if user.is_admin() {
        Ok(())
    } else {
        Err(AppError::with_body(
            StatusCode::FORBIDDEN,
            json!({
                "message": "Accès réservé aux administrateurs",
                "required": "admin role",
                "userRole": user.role(),
            }),
        ))
    }
}

fn error_body(status: StatusCode, error: &str) -> AppError {
    AppError::with_body(status, json!({ "error": error }))
}

async fn list_keys(State(state): State<AppState>, user: CurrentUser) -> ApiResult {
    require_admin(&user)?;
    let keys = list_api_keys(&state.db).await.map_err(|error| {
        tracing::error!(%error, "[EXT-API] list keys");
        error_body(
            StatusCode::INTERNAL_SERVER_ERROR,
            "Erreur lors de la lecture des clés d'API",
        )
    })?;
    Ok(Json(json!({
        "basePath": EXTERNAL_API_PREFIX,
        "envKeyCount": count_env_api_keys(),
        "keys": keys,
    }))
    .into_response())
}

/// Type reçu selon zod, pour « Expected string, received … »
fn zod_type(value: &Value) -> &'static str {
    match value {
        Value::Null => "null",
        Value::Bool(_) => "boolean",
        Value::Number(_) => "number",
        Value::String(_) => "string",
        Value::Array(_) => "array",
        Value::Object(_) => "object",
    }
}

/// z.object({ name: z.string().trim().min(1, "Nom requis").max(100) }) : le nom
/// sans blancs autour, ou le message du premier problème
fn parse_key_name(body: &Value) -> Result<String, String> {
    let Some(object) = body.as_object() else {
        return Err(format!("Expected object, received {}", zod_type(body)));
    };
    match object.get("name") {
        None => Err("Required".to_string()),
        Some(Value::String(name)) => {
            let name = js::trim(name);
            if js::length(name) < 1 {
                Err("Nom requis".to_string())
            } else if js::length(name) > 100 {
                Err("String must contain at most 100 character(s)".to_string())
            } else {
                Ok(name.to_string())
            }
        }
        Some(other) => Err(format!("Expected string, received {}", zod_type(other))),
    }
}

async fn create_key(State(state): State<AppState>, user: CurrentUser, JsonBody(body): JsonBody) -> ApiResult {
    require_admin(&user)?;
    let name = parse_key_name(&body).map_err(|message| error_body(StatusCode::BAD_REQUEST, &message))?;
    let (key, api_key) = create_api_key(&state.db, &name, Some(user.id()))
        .await
        .map_err(|error| {
            tracing::error!(%error, "[EXT-API] create key");
            error_body(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Erreur lors de la création de la clé d'API",
            )
        })?;
    tracing::info!(name, by = user.user.username, "[EXT-API] clé créée");
    Ok((
        StatusCode::CREATED,
        Json(json!({ "key": key, "apiKey": api_key })),
    )
        .into_response())
}

async fn revoke_key(State(state): State<AppState>, user: CurrentUser, Path(id): Path<String>) -> ApiResult {
    require_admin(&user)?;
    // Number(id) : entier strictement positif
    let id = js::to_number(&Value::String(id));
    if id.fract() != 0.0 || !id.is_finite() || id <= 0.0 {
        return Err(error_body(StatusCode::BAD_REQUEST, "Identifiant invalide"));
    }
    let revoked = revoke_api_key(&state.db, &js::number_to_string(id))
        .await
        .map_err(|error| {
            tracing::error!(%error, "[EXT-API] revoke key");
            error_body(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Erreur lors de la révocation de la clé d'API",
            )
        })?;
    if !revoked {
        return Err(error_body(
            StatusCode::NOT_FOUND,
            "Clé introuvable ou déjà révoquée",
        ));
    }
    tracing::info!(id, by = user.user.username, "[EXT-API] clé révoquée");
    Ok(Json(json!({ "success": true })).into_response())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empreinte_comme_node() {
        // createHash('sha256').update(clé).digest('hex') dans Node 22
        assert_eq!(
            hash_api_key("lf_banc_cle_de_test_0123456789"),
            "e88dfa10d39cb50b09adfd4bedafd2abb41e16c3f8dc2f7df8695719d3a8a3f4"
        );
        assert_eq!(
            hash_api_key("lf_cle_revoquee"),
            "42e7a01ed97247a07de4b835551e6664128ba513452c94161b4a34e2e616ebab"
        );
        let key = generate_api_key();
        assert!(key.starts_with("lf_"));
        assert_eq!(key.len(), 35);
    }

    #[test]
    fn nom_de_cle_comme_zod() {
        assert_eq!(
            parse_key_name(&json!({ "name": "  Outil  " })),
            Ok("Outil".to_string())
        );
        assert_eq!(parse_key_name(&json!({})), Err("Required".to_string()));
        assert_eq!(
            parse_key_name(&json!({ "name": "   " })),
            Err("Nom requis".to_string())
        );
        assert_eq!(
            parse_key_name(&json!({ "name": 3 })),
            Err("Expected string, received number".to_string())
        );
        assert_eq!(
            parse_key_name(&json!({ "name": "x".repeat(101) })),
            Err("String must contain at most 100 character(s)".to_string())
        );
        assert_eq!(
            parse_key_name(&json!([])),
            Err("Expected object, received array".to_string())
        );
    }

    #[test]
    fn cle_dans_les_en_tetes() {
        let mut headers = axum::http::HeaderMap::new();
        headers.insert("authorization", "Bearer  lf_abc ".parse().unwrap());
        assert_eq!(extract_api_key(&headers).as_deref(), Some("lf_abc"));
        headers.insert("x-api-key", " lf_x ".parse().unwrap());
        assert_eq!(extract_api_key(&headers).as_deref(), Some("lf_x"));
    }
}
