// API externe de rapprochement (server/externalApi.ts, server/externalApiKeys.ts) :
// - /api/ext/v1/* (clé d'API, hors session) : magasins, fournisseurs, livraisons
//   livrées (filtres et pagination en mémoire, comme Node), écriture de la facture
//   d'une livraison ; toute autre adresse sous le préfixe : 404 JSON ;
// - gestion des clés depuis Paramètres > API externe (/api/external-api/keys,
//   session admin) et outils de clés d'API partagés.
//
// Une clé « lf_… » n'est montrée qu'une fois, à sa création : seuls son empreinte
// SHA-256 et un préfixe lisible sont stockés (table external_api_keys). Les clés
// de la variable d'environnement EXTERNAL_API_KEYS restent acceptées.
//
// Comme Node, qui les enregistre avant son middleware /api, les réponses sous
// /api/ext/v1 n'ont pas d'en-tête Cache-Control (voir http.rs). Les variantes
// d'adresse qu'Express accepte aussi (casse, barre finale) passent par express_routes.rs.

use axum::extract::{FromRequest, Path, RawQuery, Request, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::{any, delete, get};
use axum::{Json, Router};
use base64::Engine;
use chrono::NaiveDateTime;
use rand::RngCore;
use serde::Serialize;
use serde_json::{Map, Value, json};
use sha2::{Digest, Sha256};
use sqlx::{FromRow, PgPool};
use std::collections::HashMap;

use crate::AppState;
use crate::auth::CurrentUser;
use crate::error::{ApiResult, AppError};
use crate::js;
use crate::modules::deliveries;
use crate::request::JsonBody;
use crate::schema::{DeliveriesRow, OrdersRow, SuppliersRow};
use crate::services::dates;
use crate::services::nocodb::array_index;

/// Préfixe des adresses de l'API externe
pub const EXTERNAL_API_PREFIX: &str = "/api/ext/v1";
const KEY_PREFIX: &str = "lf_";
/// Partie lisible gardée en base : « lf_ » + 7 caractères
const DISPLAY_PREFIX_LENGTH: usize = 10;
/// last_used_at n'est réécrit qu'une fois par minute au plus, par clé
const LAST_USED_THROTTLE_SECONDS: i64 = 60;

/// Taille de page de GET /deliveries : par défaut, et au plus
const DEFAULT_LIMIT: f64 = 100.0;
const MAX_LIMIT: f64 = 500.0;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/external-api/keys", get(list_keys).post(create_key))
        .route("/api/external-api/keys/{id}", delete(revoke_key))
        .route("/api/external-api/keys/{id}/logs", get(key_logs))
        // Toute autre méthode sur ces adresses : la route inconnue de Node
        .route("/api/ext/v1/stores", get(ext_stores).fallback(ext_unknown))
        .route("/api/ext/v1/suppliers", get(ext_suppliers).fallback(ext_unknown))
        .route(
            "/api/ext/v1/suppliers/{id}",
            get(ext_supplier).fallback(ext_unknown),
        )
        .route("/api/ext/v1/orders", get(ext_orders).fallback(ext_unknown))
        .route("/api/ext/v1/orders/{id}", get(ext_order).fallback(ext_unknown))
        .route("/api/ext/v1/calendar", get(ext_calendar).fallback(ext_unknown))
        .route(
            "/api/ext/v1/deliveries",
            get(ext_deliveries).fallback(ext_unknown),
        )
        .route(
            "/api/ext/v1/deliveries/{id}",
            get(ext_delivery).patch(ext_update_delivery).fallback(ext_unknown),
        )
        .route(EXTERNAL_API_PREFIX, any(ext_unknown))
        .route("/api/ext/v1/", any(ext_unknown))
        .route("/api/ext/v1/{*rest}", any(ext_unknown))
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
    /// « read » (lecture seule) ou « write » (lecture + écriture de la facture)
    pub access: String,
    /// Magasins autorisés ; null : tous
    #[serde(rename = "storeIds")]
    pub group_ids: Option<Vec<i32>>,
    #[serde(rename = "expiresAt", serialize_with = "crate::json::ts_opt")]
    pub expires_at: Option<NaiveDateTime>,
}

const PUBLIC_COLUMNS: &str =
    "id, name, key_prefix, created_by, created_at, last_used_at, revoked_at, access, group_ids, expires_at";

/// Droits d'une clé
pub const ACCESS_READ: &str = "read";
pub const ACCESS_WRITE: &str = "write";

/// Réglages d'une nouvelle clé (droits, magasins, expiration)
#[derive(Debug, Clone, PartialEq)]
pub struct KeySettings {
    pub access: String,
    pub group_ids: Option<Vec<i32>>,
    pub expires_at: Option<NaiveDateTime>,
}

impl Default for KeySettings {
    /// Sans réglage : tous les droits, comme les clés créées avant leur ajout
    fn default() -> Self {
        Self {
            access: ACCESS_WRITE.to_string(),
            group_ids: None,
            expires_at: None,
        }
    }
}

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
    settings: &KeySettings,
) -> Result<(String, PublicApiKey), sqlx::Error> {
    let key = generate_api_key();
    let row = sqlx::query_as(&format!(
        "INSERT INTO external_api_keys (name, key_prefix, key_hash, created_by, access, group_ids, expires_at) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING {PUBLIC_COLUMNS}"
    ))
    .bind(name)
    .bind(&key[..DISPLAY_PREFIX_LENGTH])
    .bind(hash_api_key(&key))
    .bind(created_by)
    .bind(&settings.access)
    .bind(&settings.group_ids)
    .bind(settings.expires_at)
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

/// Clé ni révoquée ni expirée ($1 : maintenant)
const ACTIVE_KEY: &str = "revoked_at IS NULL AND (expires_at IS NULL OR expires_at > $1::timestamp)";

/// countActiveApiKeys : clés ni révoquées ni expirées
pub async fn count_active_api_keys(db: &PgPool) -> Result<i64, sqlx::Error> {
    let (count,): (i64,) = sqlx::query_as(&format!(
        "SELECT count(*) FROM external_api_keys WHERE {ACTIVE_KEY}"
    ))
    .bind(crate::modules::now_iso())
    .fetch_one(db)
    .await?;
    Ok(count)
}

/// Clé enregistrée lue pour une requête : id, dernière utilisation, droits, magasins
type StoredKey = (i32, Option<NaiveDateTime>, String, Option<Vec<i32>>);

/// verifyStoredApiKey : droits de la clé si elle est active. Sa date de dernière
/// utilisation est mise à jour au plus une fois par minute, sans attendre ni faire échouer
pub async fn verify_stored_api_key(db: &PgPool, key: &str) -> Result<Option<ApiAccess>, sqlx::Error> {
    let row: Option<StoredKey> = sqlx::query_as(&format!(
        "SELECT id, last_used_at, access, group_ids FROM external_api_keys WHERE {ACTIVE_KEY} AND key_hash = $2 LIMIT 1"
    ))
    .bind(crate::modules::now_iso())
    .bind(hash_api_key(key))
    .fetch_optional(db)
    .await?;
    let Some((id, last_used_at, access, group_ids)) = row else {
        return Ok(None);
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
    Ok(Some(ApiAccess {
        key_id: Some(id),
        write: access == ACCESS_WRITE,
        stores: group_ids,
    }))
}

// ---------- Droits d'une requête ----------

/// Droits de la clé reçue : écriture, magasins autorisés (None : tous)
#[derive(Debug, Clone, PartialEq)]
pub struct ApiAccess {
    /// Clé enregistrée (None : clé de l'environnement, tous les droits)
    pub key_id: Option<i32>,
    pub write: bool,
    pub stores: Option<Vec<i32>>,
}

impl ApiAccess {
    /// Clé de l'environnement : tous les droits
    pub fn full() -> Self {
        Self {
            key_id: None,
            write: true,
            stores: None,
        }
    }

    pub fn allows_store(&self, store_id: i32) -> bool {
        self.stores
            .as_ref()
            .is_none_or(|stores| stores.contains(&store_id))
    }

    /// Magasins à lire pour un filtre storeId éventuel : Some(vide) pour tous,
    /// None quand le magasin demandé n'est pas autorisé
    pub fn stores_for(&self, requested: Option<i32>) -> Option<Vec<i32>> {
        match (requested, &self.stores) {
            (Some(id), _) => self.allows_store(id).then(|| vec![id]),
            (None, None) => Some(Vec::new()),
            (None, Some(stores)) => Some(stores.clone()),
        }
    }
}

/// Requête reçue sous /api/ext/v1 : en-têtes, méthode et adresse (pour le journal)
pub struct ExtRequest {
    headers: HeaderMap,
    method: String,
    target: String,
}

impl ExtRequest {
    fn from_parts(parts: &axum::http::request::Parts) -> Self {
        Self {
            headers: parts.headers.clone(),
            method: parts.method.to_string(),
            target: parts
                .uri
                .path_and_query()
                .map_or_else(|| parts.uri.path().to_string(), |target| target.to_string()),
        }
    }
}

impl<S: Send + Sync> axum::extract::FromRequestParts<S> for ExtRequest {
    type Rejection = std::convert::Infallible;

    async fn from_request_parts(
        parts: &mut axum::http::request::Parts,
        _state: &S,
    ) -> Result<Self, Self::Rejection> {
        Ok(Self::from_parts(parts))
    }
}

/// Lignes du journal gardées : 90 jours
const LOG_RETENTION_DAYS: i64 = 90;

/// Journal d'un appel fait avec une clé enregistrée, écrit sans attendre ni faire échouer.
/// Les entrées de plus de 90 jours sont purgées de temps en temps (1 appel sur 100)
fn log_call(state: &AppState, access: &ApiAccess, request: &ExtRequest, outcome: &str) {
    let Some(key_id) = access.key_id else {
        return;
    };
    let db = state.db.clone();
    let method = request.method.clone();
    let path: String = request.target.chars().take(500).collect();
    let outcome = outcome.to_string();
    let purge = rand::random::<u8>() < 3;
    tokio::spawn(async move {
        let result = sqlx::query(
            "INSERT INTO external_api_key_logs (key_id, method, path, outcome, created_at) VALUES ($1, $2, $3, $4, $5::timestamp)",
        )
        .bind(key_id)
        .bind(method)
        .bind(path)
        .bind(outcome)
        .bind(crate::modules::now_iso())
        .execute(&db)
        .await;
        if let Err(error) = result {
            tracing::error!(%error, "[EXT-API] journal");
        }
        if purge {
            let limit = chrono::Utc::now().naive_utc() - chrono::Duration::days(LOG_RETENTION_DAYS);
            let _ = sqlx::query("DELETE FROM external_api_key_logs WHERE created_at < $1")
                .bind(limit)
                .execute(&db)
                .await;
        }
    });
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

/// Réglages facultatifs de POST /keys :
/// - access : « read » ou « write » (absent : « write », comme avant leur ajout) ;
/// - storeIds : identifiants de magasins (absent, null ou vide : tous) ;
/// - expiresAt : AAAA-MM-JJ, dernier jour de validité (absent ou null : jamais)
fn parse_key_settings(body: &Value, today: chrono::NaiveDate) -> Result<KeySettings, String> {
    let mut settings = KeySettings::default();
    let Some(object) = body.as_object() else {
        return Ok(settings);
    };
    match object.get("access") {
        None | Some(Value::Null) => {}
        Some(Value::String(access)) if access == ACCESS_READ || access == ACCESS_WRITE => {
            settings.access = access.clone();
        }
        Some(_) => return Err("access : « read » ou « write » attendu".to_string()),
    }
    match object.get("storeIds") {
        None | Some(Value::Null) => {}
        Some(Value::Array(ids)) => {
            let mut stores = Vec::new();
            for id in ids {
                let store = id
                    .as_i64()
                    .filter(|id| *id > 0)
                    .and_then(|id| i32::try_from(id).ok())
                    .ok_or_else(|| "storeIds : identifiants de magasins entiers attendus".to_string())?;
                if !stores.contains(&store) {
                    stores.push(store);
                }
            }
            stores.sort_unstable();
            settings.group_ids = (!stores.is_empty()).then_some(stores);
        }
        Some(_) => return Err("storeIds : tableau d'identifiants attendu".to_string()),
    }
    match object.get("expiresAt") {
        None | Some(Value::Null) => {}
        Some(Value::String(day)) if day.is_empty() => {}
        Some(Value::String(day)) => {
            let day = chrono::NaiveDate::parse_from_str(day, "%Y-%m-%d")
                .ok()
                .filter(|_| is_iso_day(day))
                .ok_or_else(|| "expiresAt : format attendu AAAA-MM-JJ".to_string())?;
            if day < today {
                return Err("expiresAt : la date est déjà passée".to_string());
            }
            // Valable tout le dernier jour (UTC)
            settings.expires_at = day.succ_opt().and_then(|next| next.and_hms_opt(0, 0, 0));
        }
        Some(_) => return Err("expiresAt : format attendu AAAA-MM-JJ".to_string()),
    }
    Ok(settings)
}

async fn create_key(State(state): State<AppState>, user: CurrentUser, JsonBody(body): JsonBody) -> ApiResult {
    require_admin(&user)?;
    let name = parse_key_name(&body).map_err(|message| error_body(StatusCode::BAD_REQUEST, &message))?;
    let settings = parse_key_settings(&body, chrono::Utc::now().date_naive())
        .map_err(|message| error_body(StatusCode::BAD_REQUEST, &message))?;
    if let Some(stores) = &settings.group_ids {
        let (known,): (i64,) = sqlx::query_as("SELECT count(*) FROM groups WHERE id = ANY($1)")
            .bind(stores)
            .fetch_one(&state.db)
            .await
            .map_err(|error| {
                tracing::error!(%error, "[EXT-API] create key");
                error_body(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Erreur lors de la création de la clé d'API",
                )
            })?;
        if known != stores.len() as i64 {
            return Err(error_body(StatusCode::BAD_REQUEST, "storeIds : magasin inconnu"));
        }
    }
    let (key, api_key) = create_api_key(&state.db, &name, Some(user.id()), &settings)
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

/// Entrée du journal d'une clé
#[derive(Debug, Serialize, FromRow)]
struct KeyLog {
    id: i64,
    method: String,
    path: String,
    outcome: String,
    #[serde(rename = "createdAt", serialize_with = "crate::json::ts_opt")]
    created_at: Option<NaiveDateTime>,
}

/// Nombre d'entrées rendues par GET /keys/:id/logs
const KEY_LOG_LIMIT: i64 = 200;

/// Journal d'une clé : ses 200 derniers appels, du plus récent au plus ancien
async fn key_logs(State(state): State<AppState>, user: CurrentUser, Path(id): Path<String>) -> ApiResult {
    require_admin(&user)?;
    let id = js::to_number(&Value::String(id));
    let id = crate::db::js_int4(id)
        .filter(|id| *id > 0)
        .ok_or_else(|| error_body(StatusCode::BAD_REQUEST, "Identifiant invalide"))?;
    let logs: Vec<KeyLog> = sqlx::query_as(
        "SELECT id, method, path, outcome, created_at FROM external_api_key_logs WHERE key_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2",
    )
    .bind(id)
    .bind(KEY_LOG_LIMIT)
    .fetch_all(&state.db)
    .await
    .map_err(|error| {
        tracing::error!(%error, "[EXT-API] key logs");
        error_body(
            StatusCode::INTERNAL_SERVER_ERROR,
            "Erreur lors de la lecture du journal de la clé",
        )
    })?;
    Ok(Json(json!({ "logs": logs })).into_response())
}

// ---------- /api/ext/v1 : clé d'API ----------

/// requireApiKey : clé de l'environnement, puis clé enregistrée ; sans clé
/// valable, 503 si aucune clé n'est active, 401 sinon
async fn require_api_key(state: &AppState, request: &ExtRequest) -> Result<ApiAccess, AppError> {
    authorize(state, request, false).await
}

/// Comme require_api_key, pour une écriture : 403 (noté au journal) avec une clé
/// en lecture seule
async fn require_write_key(state: &AppState, request: &ExtRequest) -> Result<ApiAccess, AppError> {
    authorize(state, request, true).await
}

async fn authorize(state: &AppState, request: &ExtRequest, write: bool) -> Result<ApiAccess, AppError> {
    let headers = &request.headers;
    let failed = |error: sqlx::Error| {
        tracing::error!(%error, "[EXT-API] vérification de la clé");
        error_body(
            StatusCode::INTERNAL_SERVER_ERROR,
            "Erreur lors de la vérification de la clé d'API",
        )
    };
    if let Some(key) = extract_api_key(headers) {
        if is_env_api_key(&key) {
            return Ok(ApiAccess::full());
        }
        if let Some(access) = verify_stored_api_key(&state.db, &key).await.map_err(failed)? {
            if write && !access.write {
                log_call(state, &access, request, "refusé : clé en lecture seule");
                return Err(error_body(
                    StatusCode::FORBIDDEN,
                    "Clé d'API en lecture seule : écriture non autorisée",
                ));
            }
            log_call(state, &access, request, "ok");
            return Ok(access);
        }
    }
    if count_env_api_keys() == 0 && count_active_api_keys(&state.db).await.map_err(failed)? == 0 {
        return Err(error_body(
            StatusCode::SERVICE_UNAVAILABLE,
            "API externe désactivée : aucune clé d'API active (Paramètres > API externe)",
        ));
    }
    tracing::warn!("[EXT-API] clé d'API invalide ou absente");
    Err(error_body(
        StatusCode::UNAUTHORIZED,
        "Clé d'API invalide ou absente",
    ))
}

/// Toute autre adresse sous le préfixe : clé d'API, puis 404 JSON. Le corps est
/// lu d'abord, comme express.json() (JSON illisible : 400)
async fn ext_unknown(State(state): State<AppState>, request: Request) -> Response {
    // Variante d'une route existante (casse, « / » final) : servie comme Express
    let request = match crate::express_routes::redispatch(request).await {
        Ok(response) => return response,
        Err(request) => request,
    };
    let (parts, body) = request.into_parts();
    let ext = ExtRequest::from_parts(&parts);
    if let Err(error) = JsonBody::from_request(Request::from_parts(parts, body), &state).await {
        return error.into_response();
    }
    match require_api_key(&state, &ext).await {
        Ok(_) => error_body(StatusCode::NOT_FOUND, "Route inconnue").into_response(),
        Err(error) => error.into_response(),
    }
}

async fn ext_stores(State(state): State<AppState>, request: ExtRequest) -> ApiResult {
    let access = require_api_key(&state, &request).await?;
    // storage.getGroups : par nom
    let groups: Vec<(i32, String)> = sqlx::query_as("SELECT id, name FROM groups ORDER BY name")
        .fetch_all(&state.db)
        .await
        .map_err(|error| {
            tracing::error!(%error, "[EXT-API] stores");
            error_body(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Erreur lors de la lecture des magasins",
            )
        })?;
    let out: Vec<Value> = groups
        .into_iter()
        .filter(|(id, _)| access.allows_store(*id))
        .map(|(id, name)| json!({ "id": id, "name": name }))
        .collect();
    Ok(Json(out).into_response())
}

async fn ext_suppliers(State(state): State<AppState>, request: ExtRequest) -> ApiResult {
    require_api_key(&state, &request).await?;
    // storage.getSuppliers : par nom
    let suppliers: Vec<SuppliersRow> =
        sqlx::query_as(&<SuppliersRow as crate::db::Table>::select("ORDER BY name"))
            .fetch_all(&state.db)
            .await
            .map_err(|error| {
                tracing::error!(%error, "[EXT-API] suppliers");
                error_body(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Erreur lors de la lecture des fournisseurs",
                )
            })?;
    let out: Vec<Value> = suppliers.iter().map(api_supplier).collect();
    Ok(Json(out).into_response())
}

/// Fiche fournisseur : champs du rapprochement, puis coordonnées et contrôles
fn api_supplier(supplier: &SuppliersRow) -> Value {
    json!({
        "id": supplier.id,
        "name": supplier.name,
        "code": supplier.codefou,
        "paymentMethod": supplier.payment_method,
        "automaticReconciliation": supplier.automatic_reconciliation == Some(true),
        "email": supplier.email,
        "contact": supplier.contact,
        "phone": supplier.phone,
        "hasDlc": supplier.has_dlc == Some(true),
        "requiresControl": supplier.requires_control == Some(true),
        "updatedAt": iso_datetime(&supplier.updated_at),
    })
}

/// Identifiant d'adresse en entier PostgreSQL : 400 s'il n'est pas un entier
/// positif, 404 (`missing`) s'il dépasse les entiers de PostgreSQL
fn path_id(raw: &str, missing: &str) -> Result<i32, AppError> {
    let id = delivery_id(raw)?;
    crate::db::js_int4(id).ok_or_else(|| error_body(StatusCode::NOT_FOUND, missing))
}

async fn ext_supplier(
    State(state): State<AppState>,
    request: ExtRequest,
    Path(id): Path<String>,
) -> ApiResult {
    require_api_key(&state, &request).await?;
    let id = path_id(&id, "Fournisseur introuvable")?;
    let supplier = crate::db::find_by_id::<SuppliersRow>(&state.db, id)
        .await
        .map_err(|error| {
            tracing::error!(%error, "[EXT-API] supplier");
            error_body(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Erreur lors de la lecture du fournisseur",
            )
        })?
        .ok_or_else(|| error_body(StatusCode::NOT_FOUND, "Fournisseur introuvable"))?;
    Ok(Json(api_supplier(&supplier)).into_response())
}

/// Montant décimal lu en base, en nombre (toNumber : Number(texte))
fn amount_number(amount: &Option<rust_decimal::Decimal>) -> Value {
    amount
        .map(|amount| js::to_number(&Value::String(amount.to_string())))
        .filter(|number| number.is_finite())
        .map_or(Value::Null, js::number_value)
}

/// Jour d'une date (toIsoDate) et instant d'un horodatage (toIsoDateTime)
fn iso_day(date: &chrono::NaiveDate) -> String {
    date.format("%Y-%m-%d").to_string()
}

fn iso_datetime(value: &Option<NaiveDateTime>) -> Option<String> {
    value.as_ref().map(crate::json::format_ts)
}

/// Date retenue pour les bornes from / to : jour de livraison, sinon jour prévu
fn delivery_day(row: &DeliveriesRow) -> String {
    iso_datetime(&row.delivered_date)
        .map(|instant| instant[..10].to_string())
        .unwrap_or_else(|| iso_day(&row.scheduled_date))
}

/// Clé de tri : instant de livraison, sinon jour prévu
fn sort_key(row: &DeliveriesRow) -> String {
    iso_datetime(&row.delivered_date).unwrap_or_else(|| iso_day(&row.scheduled_date))
}

/// toApiDelivery : champs utiles au rapprochement
fn api_delivery(row: &DeliveriesRow, supplier: Option<&SuppliersRow>, store_name: Option<&str>) -> Value {
    json!({
        "id": row.id,
        "storeId": row.group_id,
        "storeName": store_name,
        "supplierId": row.supplier_id,
        "supplierName": supplier.map(|supplier| &supplier.name),
        "supplierCode": supplier.and_then(|supplier| supplier.codefou.as_ref()),
        "automaticReconciliation": supplier.and_then(|supplier| supplier.automatic_reconciliation) == Some(true),
        "status": row.status,
        "scheduledDate": iso_day(&row.scheduled_date),
        "deliveredDate": iso_datetime(&row.delivered_date),
        "blNumber": row.bl_number,
        "blAmount": amount_number(&row.bl_amount),
        "invoiceReference": row.invoice_reference,
        "invoiceAmount": amount_number(&row.invoice_amount),
        "invoiceAmountTTC": amount_number(&row.invoice_amount_ttc),
        "dueDate": row.due_date.as_ref().map(|date| iso_day(&date.date())),
        "reconciled": row.reconciled == Some(true),
        "validatedAt": iso_datetime(&row.validated_at),
        "updatedAt": iso_datetime(&row.updated_at),
        "orderId": row.order_id,
        "quantity": row.quantity,
        "unit": row.unit,
        "notes": row.notes,
        "controlValidated": row.control_validated == Some(true),
        "controlValidatedBy": row.control_validated_by,
        "controlValidatedAt": iso_datetime(&row.control_validated_at),
        "createdBy": row.created_by,
        "createdAt": iso_datetime(&row.created_at),
    })
}

fn detail_json(delivery: &deliveries::DeliveryDetail) -> Value {
    api_delivery(
        &delivery.row,
        delivery.supplier.as_ref(),
        delivery.group.as_ref().map(|group| group.name.as_str()),
    )
}

/// Paramètre de req.query : absent, une valeur, ou un tableau (paramètre répété)
#[derive(Debug, Clone, PartialEq)]
enum Param {
    Absent,
    One(String),
    Many,
}

impl Param {
    /// undefined pour absent ou "", sinon la valeur
    fn given(&self) -> Option<Option<&str>> {
        match self {
            Param::Absent => None,
            Param::One(text) if text.is_empty() => None,
            Param::One(text) => Some(Some(text)),
            Param::Many => Some(None),
        }
    }
}

/// req.query lu comme qs : un paramètre répété devient un tableau
fn query_params(raw: Option<&str>) -> Map<String, Value> {
    let mut params = Map::new();
    for (key, value) in form_urlencoded::parse(raw.unwrap_or("").as_bytes()) {
        let key = key.into_owned();
        match params.get_mut(&key) {
            Some(Value::Array(values)) => values.push(Value::String(value.into_owned())),
            Some(existing) => {
                *existing = Value::Array(vec![existing.take(), Value::String(value.into_owned())])
            }
            None => {
                params.insert(key, Value::String(value.into_owned()));
            }
        }
    }
    params
}

fn param(params: &Map<String, Value>, name: &str) -> Param {
    match params.get(name) {
        None => Param::Absent,
        Some(Value::String(text)) => Param::One(text.clone()),
        Some(_) => Param::Many,
    }
}

/// parseIntParam : entier strictement positif ; Err si invalide
fn parse_int_param(value: &Param) -> Result<Option<f64>, ()> {
    match value.given() {
        None => Ok(None),
        Some(Some(text)) => {
            let number = js::to_number(&Value::String(text.to_string()));
            if number.is_finite() && number.fract() == 0.0 && number > 0.0 {
                Ok(Some(number))
            } else {
                Err(())
            }
        }
        // Number(tableau de plusieurs valeurs) : NaN
        Some(None) => Err(()),
    }
}

/// parseBoolParam : "true" ou "false"
fn parse_bool_param(value: &Param) -> Result<Option<bool>, ()> {
    match value.given() {
        None => Ok(None),
        Some(Some("true")) => Ok(Some(true)),
        Some(Some("false")) => Ok(Some(false)),
        Some(_) => Err(()),
    }
}

/// /^\d{4}-\d{2}-\d{2}$/
fn is_iso_day(text: &str) -> bool {
    let bytes = text.as_bytes();
    bytes.len() == 10
        && bytes.iter().enumerate().all(|(index, byte)| match index {
            4 | 7 => *byte == b'-',
            _ => byte.is_ascii_digit(),
        })
}

/// parseDateParam : AAAA-MM-JJ
fn parse_date_param(value: &Param) -> Result<Option<String>, ()> {
    match value.given() {
        None => Ok(None),
        Some(Some(text)) if is_iso_day(text) => Ok(Some(text.to_string())),
        Some(_) => Err(()),
    }
}

/// Filtres de GET /deliveries
#[derive(Debug, Default)]
struct DeliveryFilters {
    store_id: Option<f64>,
    supplier_id: Option<f64>,
    reconciled: Option<bool>,
    has_bl: Option<bool>,
    has_invoice: Option<bool>,
    from: Option<String>,
    to: Option<String>,
    limit: Option<f64>,
    offset: f64,
    bl_number: String,
    /// Statut lu : None pour tous (status=all) ; « delivered » par défaut
    status: Option<String>,
    control_validated: Option<bool>,
}

/// Statut demandé (status) : absent ou vide, la valeur par défaut ; « all » : tous ;
/// sinon un mot en minuscules (pending, planned, delivered, cancelled…)
fn parse_status_param(value: &Param, default: Option<&str>) -> Result<Option<String>, ()> {
    match value.given() {
        None => Ok(default.map(str::to_string)),
        Some(Some("all")) => Ok(None),
        Some(Some(text))
            if text.len() <= 30 && text.bytes().all(|byte| byte.is_ascii_lowercase() || byte == b'_') =>
        {
            Ok(Some(text.to_string()))
        }
        Some(_) => Err(()),
    }
}

/// Paramètres lus comme Node ; Err : noms des paramètres invalides, dans l'ordre de Node
fn delivery_filters(params: &Map<String, Value>) -> Result<DeliveryFilters, Vec<&'static str>> {
    let mut invalid = Vec::new();
    let mut check = |name: &'static str, ok: bool| {
        if !ok {
            invalid.push(name);
        }
    };
    let store_id = parse_int_param(&param(params, "storeId"));
    check("storeId", store_id.is_ok());
    let supplier_id = parse_int_param(&param(params, "supplierId"));
    check("supplierId", supplier_id.is_ok());
    let reconciled = parse_bool_param(&param(params, "reconciled"));
    check("reconciled", reconciled.is_ok());
    let has_bl = parse_bool_param(&param(params, "hasBl"));
    check("hasBl", has_bl.is_ok());
    let has_invoice = parse_bool_param(&param(params, "hasInvoice"));
    check("hasInvoice", has_invoice.is_ok());
    let from = parse_date_param(&param(params, "from"));
    check("from", from.is_ok());
    let to = parse_date_param(&param(params, "to"));
    check("to", to.is_ok());
    let limit = parse_int_param(&param(params, "limit"));
    check("limit", limit.is_ok());
    let status = parse_status_param(&param(params, "status"), Some("delivered"));
    check("status", status.is_ok());
    let control_validated = parse_bool_param(&param(params, "controlValidated"));
    check("controlValidated", control_validated.is_ok());
    // offset : Number(valeur), 0 si absent ou vide ; entier positif ou nul
    let offset = match params.get("offset") {
        None => 0.0,
        Some(Value::String(text)) if text.is_empty() => 0.0,
        Some(value) => js::to_number(value),
    };
    check(
        "offset",
        offset.is_finite() && offset.fract() == 0.0 && offset >= 0.0,
    );
    if !invalid.is_empty() {
        return Err(invalid);
    }
    let bl_number = match params.get("blNumber") {
        Some(Value::String(text)) => js::trim(text).to_lowercase(),
        _ => String::new(),
    };
    Ok(DeliveryFilters {
        store_id: store_id.unwrap_or_default(),
        supplier_id: supplier_id.unwrap_or_default(),
        reconciled: reconciled.unwrap_or_default(),
        has_bl: has_bl.unwrap_or_default(),
        has_invoice: has_invoice.unwrap_or_default(),
        from: from.unwrap_or_default(),
        to: to.unwrap_or_default(),
        limit: limit.unwrap_or_default(),
        offset,
        bl_number,
        status: status.unwrap_or_default(),
        control_validated: control_validated.unwrap_or_default(),
    })
}

/// Texte non vide après trim (`!!valeur?.trim()`)
fn has_text(value: &Option<String>) -> bool {
    value.as_deref().is_some_and(|text| !js::trim(text).is_empty())
}

impl DeliveryFilters {
    fn keeps(&self, row: &DeliveriesRow) -> bool {
        if self
            .supplier_id
            .is_some_and(|id| f64::from(row.supplier_id) != id)
        {
            return false;
        }
        if self
            .reconciled
            .is_some_and(|wanted| (row.reconciled == Some(true)) != wanted)
        {
            return false;
        }
        if self
            .has_bl
            .is_some_and(|wanted| has_text(&row.bl_number) != wanted)
        {
            return false;
        }
        if self
            .has_invoice
            .is_some_and(|wanted| has_text(&row.invoice_reference) != wanted)
        {
            return false;
        }
        if self
            .control_validated
            .is_some_and(|wanted| (row.control_validated == Some(true)) != wanted)
        {
            return false;
        }
        if !self.bl_number.is_empty()
            && js::trim(row.bl_number.as_deref().unwrap_or("")).to_lowercase() != self.bl_number
        {
            return false;
        }
        if self.from.is_some() || self.to.is_some() {
            let day = delivery_day(row);
            if self.from.as_ref().is_some_and(|from| day < *from) {
                return false;
            }
            if self.to.as_ref().is_some_and(|to| day > *to) {
                return false;
            }
        }
        true
    }
}

async fn ext_deliveries(
    State(state): State<AppState>,
    request: ExtRequest,
    RawQuery(raw): RawQuery,
) -> ApiResult {
    let access = require_api_key(&state, &request).await?;
    let filters = delivery_filters(&query_params(raw.as_deref())).map_err(|invalid| {
        error_body(
            StatusCode::BAD_REQUEST,
            &format!("Paramètre(s) invalide(s) : {}", invalid.join(", ")),
        )
    })?;
    let failed = || {
        error_body(
            StatusCode::INTERNAL_SERVER_ERROR,
            "Erreur lors de la lecture des livraisons",
        )
    };
    // Magasin hors des entiers de PostgreSQL : erreur de la requête
    let requested = match filters.store_id {
        Some(id) => Some(crate::db::js_int4(id).ok_or_else(failed)?),
        None => None,
    };
    // Magasin non autorisé pour la clé : liste vide
    let mut rows = match access.stores_for(requested) {
        None => Vec::new(),
        Some(stores) => deliveries::get_deliveries(&state.db, &stores, filters.status.as_deref())
            .await
            .map_err(|error| {
                tracing::error!(%error, "[EXT-API] deliveries");
                failed()
            })?,
    };
    rows.retain(|delivery| filters.keeps(&delivery.item.row));
    // De la plus récente à la plus ancienne, puis par identifiant décroissant
    rows.sort_by(|a, b| {
        sort_key(&b.item.row)
            .cmp(&sort_key(&a.item.row))
            .then(b.item.row.id.cmp(&a.item.row.id))
    });
    let (page_size, start, end) = page(rows.len(), filters.limit, filters.offset);
    let items: Vec<Value> = rows[start..end]
        .iter()
        .map(|delivery| {
            let item = &delivery.item;
            api_delivery(
                &item.row,
                item.supplier.as_ref(),
                item.group.as_ref().map(|group| group.name.as_str()),
            )
        })
        .collect();
    Ok(Json(json!({
        "total": rows.len(),
        "limit": js::number_value(page_size),
        "offset": js::number_value(filters.offset),
        "items": items,
    }))
    .into_response())
}

/// Page demandée (limit, offset) d'une liste de `len` éléments : taille, début, fin
fn page(len: usize, limit: Option<f64>, offset: f64) -> (f64, usize, usize) {
    let page_size = limit.unwrap_or(DEFAULT_LIMIT).min(MAX_LIMIT);
    let start = if offset >= len as f64 {
        len
    } else {
        offset as usize
    };
    let end = start.saturating_add(page_size as usize).min(len);
    (page_size, start, end)
}

/// Identifiant d'adresse (parseIntParam) : 400 s'il n'est pas un entier positif
fn delivery_id(raw: &str) -> Result<f64, AppError> {
    parse_int_param(&Param::One(raw.to_string()))
        .ok()
        .flatten()
        .ok_or_else(|| error_body(StatusCode::BAD_REQUEST, "Identifiant invalide"))
}

async fn ext_delivery(
    State(state): State<AppState>,
    request: ExtRequest,
    Path(id): Path<String>,
) -> ApiResult {
    let access = require_api_key(&state, &request).await?;
    let id = delivery_id(&id)?;
    let failed = || {
        error_body(
            StatusCode::INTERNAL_SERVER_ERROR,
            "Erreur lors de la lecture de la livraison",
        )
    };
    let id = crate::db::js_int4(id).ok_or_else(failed)?;
    let delivery = deliveries::get_delivery(&state.db, id)
        .await
        .map_err(|error| {
            tracing::error!(%error, "[EXT-API] delivery");
            failed()
        })?
        .filter(|delivery| access.allows_store(delivery.row.group_id))
        .ok_or_else(|| error_body(StatusCode::NOT_FOUND, "Livraison introuvable"))?;
    let mut out = detail_json(&delivery);
    // Commande liée (même magasin), en résumé
    if let Some(order_id) = delivery.row.order_id.filter(|id| *id != 0) {
        let order = crate::db::find_by_id::<OrdersRow>(&state.db, order_id)
            .await
            .map_err(|error| {
                tracing::error!(%error, "[EXT-API] delivery order");
                failed()
            })?
            .filter(|order| order.group_id == delivery.row.group_id);
        out["order"] = order.as_ref().map_or(Value::Null, order_summary);
    } else {
        out["order"] = Value::Null;
    }
    Ok(Json(out).into_response())
}

// ---------- Commandes et calendrier ----------

/// Résumé d'une commande (sans ses livraisons)
fn order_summary(order: &OrdersRow) -> Value {
    json!({
        "id": order.id,
        "storeId": order.group_id,
        "supplierId": order.supplier_id,
        "plannedDate": iso_day(&order.planned_date),
        "quantity": order.quantity,
        "unit": order.unit,
        "status": order.status,
        "notes": order.notes,
    })
}

/// Fournisseurs et noms de magasins des lignes lues
struct Relations {
    suppliers: HashMap<i32, SuppliersRow>,
    stores: HashMap<i32, String>,
}

impl Relations {
    async fn load(db: &PgPool, supplier_ids: &[i32], store_ids: &[i32]) -> Result<Self, sqlx::Error> {
        let suppliers = crate::db::find_by_ids::<SuppliersRow>(db, supplier_ids)
            .await?
            .into_iter()
            .map(|supplier| (supplier.id, supplier))
            .collect();
        let stores: Vec<(i32, String)> = sqlx::query_as("SELECT id, name FROM groups WHERE id = ANY($1)")
            .bind(store_ids)
            .fetch_all(db)
            .await?;
        Ok(Self {
            suppliers,
            stores: stores.into_iter().collect(),
        })
    }

    fn delivery(&self, row: &DeliveriesRow) -> Value {
        api_delivery(
            row,
            self.suppliers.get(&row.supplier_id),
            self.stores.get(&row.group_id).map(String::as_str),
        )
    }

    /// Commande avec son magasin, son fournisseur et ses livraisons (résumées)
    fn order(&self, order: &OrdersRow, deliveries: &[DeliveriesRow]) -> Value {
        let supplier = self.suppliers.get(&order.supplier_id);
        let mut out = order_summary(order);
        out["storeName"] = json!(self.stores.get(&order.group_id));
        out["supplierName"] = json!(supplier.map(|supplier| &supplier.name));
        out["supplierCode"] = json!(supplier.and_then(|supplier| supplier.codefou.as_ref()));
        out["createdBy"] = json!(order.created_by);
        out["createdAt"] = json!(iso_datetime(&order.created_at));
        out["updatedAt"] = json!(iso_datetime(&order.updated_at));
        out["deliveries"] = deliveries
            .iter()
            .filter(|delivery| delivery.order_id == Some(order.id))
            .map(|delivery| {
                json!({
                    "id": delivery.id,
                    "status": delivery.status,
                    "scheduledDate": iso_day(&delivery.scheduled_date),
                    "deliveredDate": iso_datetime(&delivery.delivered_date),
                    "blNumber": delivery.bl_number,
                })
            })
            .collect();
        out
    }
}

/// Livraisons des commandes données (même magasin que la commande)
async fn deliveries_of_orders(db: &PgPool, orders: &[OrdersRow]) -> Result<Vec<DeliveriesRow>, sqlx::Error> {
    if orders.is_empty() {
        return Ok(Vec::new());
    }
    let ids: Vec<i32> = orders.iter().map(|order| order.id).collect();
    let rows: Vec<DeliveriesRow> = sqlx::query_as(&<DeliveriesRow as crate::db::Table>::select(
        "WHERE order_id = ANY($1) ORDER BY scheduled_date, id",
    ))
    .bind(&ids)
    .fetch_all(db)
    .await?;
    let stores: HashMap<i32, i32> = orders.iter().map(|order| (order.id, order.group_id)).collect();
    Ok(rows
        .into_iter()
        .filter(|row| row.order_id.and_then(|id| stores.get(&id)) == Some(&row.group_id))
        .collect())
}

/// Commandes et leurs relations, en JSON
async fn orders_json(db: &PgPool, orders: &[OrdersRow]) -> Result<Vec<Value>, sqlx::Error> {
    let deliveries = deliveries_of_orders(db, orders).await?;
    let supplier_ids: Vec<i32> = orders.iter().map(|order| order.supplier_id).collect();
    let store_ids: Vec<i32> = orders.iter().map(|order| order.group_id).collect();
    let relations = Relations::load(db, &supplier_ids, &store_ids).await?;
    Ok(orders
        .iter()
        .map(|order| relations.order(order, &deliveries))
        .collect())
}

/// Filtres de GET /orders et GET /calendar
#[derive(Debug, Default)]
struct OrderFilters {
    store_id: Option<f64>,
    supplier_id: Option<f64>,
    status: Option<String>,
    from: Option<String>,
    to: Option<String>,
    limit: Option<f64>,
    offset: f64,
}

/// Err : noms des paramètres invalides
fn order_filters(params: &Map<String, Value>) -> Result<OrderFilters, Vec<&'static str>> {
    let mut invalid = Vec::new();
    let mut check = |name: &'static str, ok: bool| {
        if !ok {
            invalid.push(name);
        }
    };
    let store_id = parse_int_param(&param(params, "storeId"));
    check("storeId", store_id.is_ok());
    let supplier_id = parse_int_param(&param(params, "supplierId"));
    check("supplierId", supplier_id.is_ok());
    let status = parse_status_param(&param(params, "status"), None);
    check("status", status.is_ok());
    let from = parse_date_param(&param(params, "from"));
    check("from", from.is_ok());
    let to = parse_date_param(&param(params, "to"));
    check("to", to.is_ok());
    let limit = parse_int_param(&param(params, "limit"));
    check("limit", limit.is_ok());
    let offset = match params.get("offset") {
        None => 0.0,
        Some(Value::String(text)) if text.is_empty() => 0.0,
        Some(value) => js::to_number(value),
    };
    check(
        "offset",
        offset.is_finite() && offset.fract() == 0.0 && offset >= 0.0,
    );
    if !invalid.is_empty() {
        return Err(invalid);
    }
    Ok(OrderFilters {
        store_id: store_id.unwrap_or_default(),
        supplier_id: supplier_id.unwrap_or_default(),
        status: status.unwrap_or_default(),
        from: from.unwrap_or_default(),
        to: to.unwrap_or_default(),
        limit: limit.unwrap_or_default(),
        offset,
    })
}

fn invalid_params(invalid: Vec<&'static str>) -> AppError {
    error_body(
        StatusCode::BAD_REQUEST,
        &format!("Paramètre(s) invalide(s) : {}", invalid.join(", ")),
    )
}

/// Magasins lus pour la clé et le filtre storeId : None si rien n'est visible,
/// Some(vide) pour tous. Identifiant hors des entiers de PostgreSQL : rien de visible
fn visible_stores(access: &ApiAccess, store_id: Option<f64>) -> Option<Vec<i32>> {
    let requested = match store_id {
        Some(id) => Some(crate::db::js_int4(id)?),
        None => None,
    };
    access.stores_for(requested)
}

/// Commandes filtrées : magasins, fournisseur, statut, date prévue dans [from, to]
async fn find_orders(
    db: &PgPool,
    stores: &[i32],
    filters: &OrderFilters,
) -> Result<Vec<OrdersRow>, sqlx::Error> {
    let mut sql =
        sqlx::QueryBuilder::<sqlx::Postgres>::new(<OrdersRow as crate::db::Table>::select("WHERE TRUE"));
    if !stores.is_empty() {
        sql.push(" AND group_id = ANY(")
            .push_bind(stores.to_vec())
            .push(")");
    }
    if let Some(id) = filters.supplier_id {
        // Fournisseur hors des entiers de PostgreSQL : aucune commande
        match crate::db::js_int4(id) {
            Some(id) => sql.push(" AND supplier_id = ").push_bind(id),
            None => sql.push(" AND FALSE"),
        };
    }
    if let Some(status) = &filters.status {
        sql.push(" AND status = ").push_bind(status.clone());
    }
    if let Some(from) = &filters.from {
        sql.push(" AND planned_date >= ")
            .push_bind(from.clone())
            .push("::date");
    }
    if let Some(to) = &filters.to {
        sql.push(" AND planned_date <= ")
            .push_bind(to.clone())
            .push("::date");
    }
    sql.push(" ORDER BY planned_date DESC, id DESC");
    sql.build_query_as().fetch_all(db).await
}

async fn ext_orders(
    State(state): State<AppState>,
    request: ExtRequest,
    RawQuery(raw): RawQuery,
) -> ApiResult {
    let access = require_api_key(&state, &request).await?;
    let filters = order_filters(&query_params(raw.as_deref())).map_err(invalid_params)?;
    let failed = |error: sqlx::Error| {
        tracing::error!(%error, "[EXT-API] orders");
        error_body(
            StatusCode::INTERNAL_SERVER_ERROR,
            "Erreur lors de la lecture des commandes",
        )
    };
    let orders = match visible_stores(&access, filters.store_id) {
        None => Vec::new(),
        Some(stores) => find_orders(&state.db, &stores, &filters).await.map_err(failed)?,
    };
    let (page_size, start, end) = page(orders.len(), filters.limit, filters.offset);
    let items = orders_json(&state.db, &orders[start..end])
        .await
        .map_err(failed)?;
    Ok(Json(json!({
        "total": orders.len(),
        "limit": js::number_value(page_size),
        "offset": js::number_value(filters.offset),
        "items": items,
    }))
    .into_response())
}

async fn ext_order(State(state): State<AppState>, request: ExtRequest, Path(id): Path<String>) -> ApiResult {
    let access = require_api_key(&state, &request).await?;
    let id = path_id(&id, "Commande introuvable")?;
    let failed = |error: sqlx::Error| {
        tracing::error!(%error, "[EXT-API] order");
        error_body(
            StatusCode::INTERNAL_SERVER_ERROR,
            "Erreur lors de la lecture de la commande",
        )
    };
    let order = crate::db::find_by_id::<OrdersRow>(&state.db, id)
        .await
        .map_err(failed)?
        .filter(|order| access.allows_store(order.group_id))
        .ok_or_else(|| error_body(StatusCode::NOT_FOUND, "Commande introuvable"))?;
    let mut items = orders_json(&state.db, std::slice::from_ref(&order))
        .await
        .map_err(failed)?;
    Ok(Json(items.pop().unwrap_or(Value::Null)).into_response())
}

/// Période la plus longue de GET /calendar, en jours
const MAX_CALENDAR_DAYS: i64 = 366;

/// GET /calendar?from=&to= : commandes prévues et livraisons (prévues ou livrées)
/// de la période, de la plus ancienne à la plus récente
async fn ext_calendar(
    State(state): State<AppState>,
    request: ExtRequest,
    RawQuery(raw): RawQuery,
) -> ApiResult {
    let access = require_api_key(&state, &request).await?;
    let filters = order_filters(&query_params(raw.as_deref())).map_err(invalid_params)?;
    let (Some(from), Some(to)) = (filters.from.clone(), filters.to.clone()) else {
        return Err(error_body(
            StatusCode::BAD_REQUEST,
            "Paramètres from et to (AAAA-MM-JJ) obligatoires",
        ));
    };
    let day = |text: &str| chrono::NaiveDate::parse_from_str(text, "%Y-%m-%d").ok();
    let span = match (day(&from), day(&to)) {
        (Some(start), Some(end)) => (end - start).num_days(),
        _ => return Err(invalid_params(vec!["from", "to"])),
    };
    if !(0..MAX_CALENDAR_DAYS).contains(&span) {
        return Err(error_body(
            StatusCode::BAD_REQUEST,
            "Période invalide : to doit suivre from, sur 366 jours au plus",
        ));
    }
    let failed = |error: sqlx::Error| {
        tracing::error!(%error, "[EXT-API] calendar");
        error_body(
            StatusCode::INTERNAL_SERVER_ERROR,
            "Erreur lors de la lecture du calendrier",
        )
    };
    // Pas de pagination ; le statut filtre les commandes et les livraisons
    let delivery_status = filters.status.clone();
    let Some(stores) = visible_stores(&access, filters.store_id) else {
        return Ok(Json(json!({ "from": from, "to": to, "orders": [], "deliveries": [] })).into_response());
    };
    let mut orders = find_orders(&state.db, &stores, &filters).await.map_err(failed)?;
    orders.reverse();
    let orders = orders_json(&state.db, &orders).await.map_err(failed)?;

    let mut sql = sqlx::QueryBuilder::<sqlx::Postgres>::new(<DeliveriesRow as crate::db::Table>::select(
        "WHERE ((scheduled_date >= ",
    ));
    sql.push_bind(from.clone())
        .push("::date AND scheduled_date <= ")
        .push_bind(to.clone())
        .push("::date) OR (delivered_date >= ")
        .push_bind(from.clone())
        .push("::date AND delivered_date < ")
        .push_bind(to.clone())
        .push("::date + 1))");
    if !stores.is_empty() {
        sql.push(" AND group_id = ANY(")
            .push_bind(stores.clone())
            .push(")");
    }
    if let Some(id) = filters.supplier_id {
        match crate::db::js_int4(id) {
            Some(id) => sql.push(" AND supplier_id = ").push_bind(id),
            None => sql.push(" AND FALSE"),
        };
    }
    if let Some(status) = &delivery_status {
        sql.push(" AND status = ").push_bind(status.clone());
    }
    sql.push(" ORDER BY COALESCE(delivered_date::date, scheduled_date), id");
    let rows: Vec<DeliveriesRow> = sql.build_query_as().fetch_all(&state.db).await.map_err(failed)?;
    let supplier_ids: Vec<i32> = rows.iter().map(|row| row.supplier_id).collect();
    let store_ids: Vec<i32> = rows.iter().map(|row| row.group_id).collect();
    let relations = Relations::load(&state.db, &supplier_ids, &store_ids)
        .await
        .map_err(failed)?;
    let deliveries: Vec<Value> = rows.iter().map(|row| relations.delivery(row)).collect();
    Ok(Json(json!({ "from": from, "to": to, "orders": orders, "deliveries": deliveries })).into_response())
}

/// Champ du corps : absent, null, ou une valeur
type Change<T> = Option<Option<T>>;

/// Corps validé de PATCH /deliveries/:id (updateInvoiceSchema)
#[derive(Debug, Default, PartialEq)]
struct InvoiceUpdate {
    invoice_reference: Change<String>,
    invoice_amount: Change<String>,
    invoice_amount_ttc: Change<String>,
    due_date: Change<String>,
    reconciled: Option<bool>,
}

/// Problème de validation : { field, message }
type Issue = (String, String);

/// number.toFixed(2) de JavaScript : valeur binaire exacte arrondie au plus
/// proche, l'égalité vers le haut ; « - » pour tout nombre négatif (-0 exclu).
/// Valable pour |nombre| < 1e21
fn to_fixed_2(number: f64) -> String {
    // Développement décimal exact (une fraction de double a au plus 1074 chiffres)
    let exact = format!("{:.1100}", number.abs());
    let (integer, fraction) = exact.split_once('.').unwrap_or((&exact, "000"));
    let mut cents: u128 =
        integer.parse::<u128>().unwrap_or(0) * 100 + fraction[..2].parse::<u128>().unwrap_or(0);
    if fraction.as_bytes()[2] >= b'5' {
        cents += 1;
    }
    let sign = if number < 0.0 { "-" } else { "" };
    format!("{sign}{}.{:02}", cents / 100, cents % 100)
}

/// Caractère retiré par /[\s ]/g (blancs de JavaScript)
fn is_js_space(c: char) -> bool {
    let mut buffer = [0u8; 4];
    js::trim(c.encode_utf8(&mut buffer)).is_empty()
}

/// amountSchema : nombre, ou texte « 1234.56 », « 1234,56 », « 1 234,56 » ;
/// rendu en texte à deux décimales, ou null. Err(true) : type refusé (le
/// schéma s'arrête), Err(false) : « Montant invalide »
fn parse_amount(value: &Value) -> Result<Option<String>, bool> {
    let number = match value {
        Value::Null => return Ok(None),
        Value::Number(number) => number.as_f64().unwrap_or(f64::NAN),
        Value::String(text) => {
            let raw: String = text.chars().filter(|c| !is_js_space(*c)).collect();
            let raw = raw.replacen(',', ".", 1);
            if raw.is_empty() {
                return Ok(None);
            }
            js::to_number(&Value::String(raw))
        }
        _ => return Err(true),
    };
    if !number.is_finite() || number.abs() >= 1e8 {
        return Err(false);
    }
    Ok(Some(to_fixed_2(number)))
}

/// Clés d'un objet JavaScript dans leur ordre d'énumération : indices de tableau
/// croissants, puis les autres dans l'ordre d'insertion
fn js_key_order(object: &Map<String, Value>) -> Vec<&str> {
    let (mut indexes, others): (Vec<&str>, Vec<&str>) = object
        .keys()
        .map(String::as_str)
        .partition(|key| array_index(key).is_some());
    indexes.sort_by_key(|key| array_index(key));
    indexes.into_iter().chain(others).collect()
}

const INVOICE_KEYS: [&str; 5] = [
    "invoiceReference",
    "invoiceAmount",
    "invoiceAmountTTC",
    "dueDate",
    "reconciled",
];

/// updateInvoiceSchema.safeParse : mêmes contrôles et messages que zod, dans le
/// même ordre (champs, clés inconnues, puis « au moins un champ » si aucun type
/// n'est refusé)
fn parse_invoice_update(body: &Value) -> Result<InvoiceUpdate, Vec<Issue>> {
    let Some(object) = body.as_object() else {
        return Err(vec![(
            String::new(),
            format!("Expected object, received {}", zod_type(body)),
        )]);
    };
    let mut issues: Vec<Issue> = Vec::new();
    let mut aborted = false;
    let mut update = InvoiceUpdate::default();
    let mut issue = |field: &str, message: String| issues.push((field.to_string(), message));

    match object.get("invoiceReference") {
        None => {}
        Some(Value::Null) => update.invoice_reference = Some(None),
        Some(Value::String(text)) => {
            let trimmed = js::trim(text);
            if js::length(trimmed) > 100 {
                issue(
                    "invoiceReference",
                    "String must contain at most 100 character(s)".into(),
                );
            }
            update.invoice_reference = Some(Some(trimmed.to_string()));
        }
        Some(other) => {
            aborted = true;
            issue(
                "invoiceReference",
                format!("Expected string, received {}", zod_type(other)),
            );
        }
    }
    for (key, slot) in [
        ("invoiceAmount", &mut update.invoice_amount),
        ("invoiceAmountTTC", &mut update.invoice_amount_ttc),
    ] {
        let Some(value) = object.get(key) else {
            continue;
        };
        match parse_amount(value) {
            Ok(amount) => *slot = Some(amount),
            Err(type_refused) => {
                aborted |= type_refused;
                issue(
                    key,
                    if type_refused {
                        "Invalid input"
                    } else {
                        "Montant invalide"
                    }
                    .into(),
                );
            }
        }
    }
    match object.get("dueDate") {
        None => {}
        Some(Value::Null) => update.due_date = Some(None),
        Some(Value::String(text)) => {
            if !is_iso_day(text) {
                issue("dueDate", "Format attendu : YYYY-MM-DD".into());
            }
            update.due_date = Some(Some(text.clone()));
        }
        Some(other) => {
            aborted = true;
            issue(
                "dueDate",
                format!("Expected string, received {}", zod_type(other)),
            );
        }
    }
    match object.get("reconciled") {
        None => {}
        Some(Value::Bool(flag)) => update.reconciled = Some(*flag),
        Some(other) => {
            aborted = true;
            issue(
                "reconciled",
                format!("Expected boolean, received {}", zod_type(other)),
            );
        }
    }
    // .strict()
    let unknown: Vec<String> = js_key_order(object)
        .into_iter()
        .filter(|key| !INVOICE_KEYS.contains(key))
        .map(|key| format!("'{key}'"))
        .collect();
    if !unknown.is_empty() {
        issue(
            "",
            format!("Unrecognized key(s) in object: {}", unknown.join(", ")),
        );
    }
    // .refine() : au moins un champ du schéma (sauf si un type a été refusé)
    if !aborted && !INVOICE_KEYS.iter().any(|key| object.contains_key(*key)) {
        issue("", "Aucun champ à mettre à jour".into());
    }
    if issues.is_empty() {
        Ok(update)
    } else {
        Err(issues)
    }
}

async fn ext_update_delivery(
    State(state): State<AppState>,
    request: ExtRequest,
    Path(id): Path<String>,
    JsonBody(body): JsonBody,
) -> ApiResult {
    let access = require_write_key(&state, &request).await?;
    let id = delivery_id(&id)?;
    let body = parse_invoice_update(&body).map_err(|issues| {
        let details: Vec<Value> = issues
            .into_iter()
            .map(|(field, message)| json!({ "field": field, "message": message }))
            .collect();
        AppError::with_body(
            StatusCode::BAD_REQUEST,
            json!({ "error": "Corps de requête invalide", "details": details }),
        )
    })?;
    let failed = |error: &dyn std::fmt::Display| {
        tracing::error!(%error, "[EXT-API] update delivery");
        error_body(
            StatusCode::INTERNAL_SERVER_ERROR,
            "Erreur lors de la mise à jour de la livraison",
        )
    };
    let id = crate::db::js_int4(id).ok_or_else(|| failed(&"identifiant hors limites"))?;
    let delivery = deliveries::get_delivery(&state.db, id)
        .await
        .map_err(|error| failed(&error))?
        .filter(|delivery| access.allows_store(delivery.row.group_id))
        .ok_or_else(|| error_body(StatusCode::NOT_FOUND, "Livraison introuvable"))?;
    if delivery.row.status != "delivered" {
        return Err(error_body(
            StatusCode::CONFLICT,
            "Seules les livraisons livrées peuvent être rapprochées",
        ));
    }
    // Livraison rapprochée figée, sauf fournisseur en rapprochement automatique
    let touches_invoice = body.invoice_reference.is_some()
        || body.invoice_amount.is_some()
        || body.invoice_amount_ttc.is_some()
        || body.due_date.is_some();
    let automatic = delivery
        .supplier
        .as_ref()
        .and_then(|supplier| supplier.automatic_reconciliation)
        == Some(true);
    if delivery.row.reconciled == Some(true)
        && !automatic
        && touches_invoice
        && body.reconciled != Some(false)
    {
        return Err(error_body(
            StatusCode::CONFLICT,
            "Livraison déjà rapprochée : envoyer reconciled: false pour la dévalider avant de modifier la facture",
        ));
    }

    let text = |value: Option<String>| value.map_or(Value::Null, Value::String);
    let mut update = Map::new();
    let reference = body
        .invoice_reference
        .map(|reference| reference.filter(|text| !text.is_empty()));
    if let Some(reference) = &reference {
        update.insert("invoiceReference".into(), text(reference.clone()));
    }
    if let Some(amount) = body.invoice_amount {
        update.insert("invoiceAmount".into(), text(amount));
    }
    if let Some(amount) = body.invoice_amount_ttc {
        update.insert("invoiceAmountTTC".into(), text(amount));
    }
    match (body.due_date, &reference) {
        // new Date(AAAA-MM-JJ) ; une date impossible fait échouer l'écriture
        (Some(Some(day)), _) => {
            let date = dates::parse_js_date(&day).ok_or_else(|| failed(&"échéance illisible"))?;
            update.insert("dueDate".into(), Value::String(js::iso(&date)));
        }
        (Some(None), _) => {
            update.insert("dueDate".into(), Value::Null);
        }
        // Échéance non fournie : reprise de NocoDB si la référence change, ou vidée avec elle
        (None, Some(reference)) if *reference != delivery.row.invoice_reference => {
            let due_date = match reference {
                Some(reference) => deliveries::due_date_from_nocodb(
                    &state,
                    reference,
                    delivery.row.group_id,
                    delivery.row.reconciled == Some(true),
                )
                .await
                .map_err(|_| failed(&"échéance de NocoDB illisible"))?,
                None => Value::Null,
            };
            update.insert("dueDate".into(), due_date);
        }
        (None, _) => {}
    }
    if let Some(reconciled) = body.reconciled {
        update.insert("reconciled".into(), Value::Bool(reconciled));
        update.insert(
            "validatedAt".into(),
            if reconciled {
                Value::String(crate::modules::now_iso())
            } else {
                Value::Null
            },
        );
    }
    crate::db::update_by_id::<DeliveriesRow>(&state.db, id, &update, true)
        .await
        .map_err(|error| failed(&error))?;
    tracing::info!(id, "[EXT-API] livraison mise à jour");
    let updated = deliveries::get_delivery(&state.db, id)
        .await
        .map_err(|error| failed(&error))?
        .ok_or_else(|| failed(&"livraison disparue"))?;
    Ok(Json(detail_json(&updated)).into_response())
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

    #[test]
    fn routes_sans_conflit() {
        let _ = Router::<AppState>::new().merge(routes());
    }

    #[test]
    fn to_fixed_comme_javascript() {
        // (n).toFixed(2) dans Node 22
        for (number, expected) in [
            (1234.5, "1234.50"),
            (-45.9, "-45.90"),
            (1.005, "1.00"),
            (1.125, "1.13"),
            (0.045, "0.04"),
            (8.345, "8.35"),
            (12.345, "12.35"),
            (1234.565, "1234.57"),
            (99999999.995, "100000000.00"),
            (-0.0, "0.00"),
            (-1e-7, "-0.00"),
            (-0.005, "-0.01"),
            (1e-7, "0.00"),
        ] {
            assert_eq!(to_fixed_2(number), expected, "{number}");
        }
    }

    #[test]
    fn montants_francais() {
        assert_eq!(parse_amount(&json!(" 1 234,565 ")), Ok(Some("1234.57".into())));
        assert_eq!(parse_amount(&json!("1\u{202f}234,5")), Ok(Some("1234.50".into())));
        assert_eq!(parse_amount(&json!(1500.6)), Ok(Some("1500.60".into())));
        assert_eq!(parse_amount(&json!("0x10")), Ok(Some("16.00".into())));
        assert_eq!(parse_amount(&json!("  ")), Ok(None));
        assert_eq!(parse_amount(&json!(null)), Ok(None));
        assert_eq!(parse_amount(&json!("1.234,56")), Err(false));
        assert_eq!(parse_amount(&json!("1e9")), Err(false));
        assert_eq!(parse_amount(&json!("Infinity")), Err(false));
        assert_eq!(parse_amount(&json!(true)), Err(true));
    }

    fn details(body: Value) -> Value {
        match parse_invoice_update(&body) {
            Ok(update) => json!(format!("{update:?}")),
            Err(issues) => Value::Array(
                issues
                    .into_iter()
                    .map(|(field, message)| json!({ "field": field, "message": message }))
                    .collect(),
            ),
        }
    }

    #[test]
    fn corps_de_facture_comme_zod() {
        // updateInvoiceSchema.safeParse(corps) dans Node
        assert_eq!(
            details(json!({})),
            json!([{ "field": "", "message": "Aucun champ à mettre à jour" }])
        );
        assert_eq!(
            details(json!([])),
            json!([{ "field": "", "message": "Expected object, received array" }])
        );
        assert_eq!(
            details(serde_json::from_str(r#"{"foo":1,"2":3,"bar":2}"#).unwrap()),
            json!([
                { "field": "", "message": "Unrecognized key(s) in object: '2', 'foo', 'bar'" },
                { "field": "", "message": "Aucun champ à mettre à jour" }
            ])
        );
        assert_eq!(
            details(json!({ "invoiceReference": 5, "foo": 1 })),
            json!([
                { "field": "invoiceReference", "message": "Expected string, received number" },
                { "field": "", "message": "Unrecognized key(s) in object: 'foo'" }
            ])
        );
        assert_eq!(
            details(
                json!({ "invoiceReference": "x".repeat(101), "invoiceAmount": "abc", "dueDate": "15/10/2026", "zzz": 1 })
            ),
            json!([
                { "field": "invoiceReference", "message": "String must contain at most 100 character(s)" },
                { "field": "invoiceAmount", "message": "Montant invalide" },
                { "field": "dueDate", "message": "Format attendu : YYYY-MM-DD" },
                { "field": "", "message": "Unrecognized key(s) in object: 'zzz'" }
            ])
        );
        assert_eq!(
            details(json!({ "invoiceAmount": true, "invoiceAmountTTC": "1e9" })),
            json!([
                { "field": "invoiceAmount", "message": "Invalid input" },
                { "field": "invoiceAmountTTC", "message": "Montant invalide" }
            ])
        );
        assert_eq!(
            details(json!({ "reconciled": null })),
            json!([{ "field": "reconciled", "message": "Expected boolean, received null" }])
        );
        assert_eq!(
            parse_invoice_update(&json!({
                "invoiceAmount": " 1 234,565 ", "invoiceAmountTTC": 1500.6, "invoiceReference": "  FAC-1  ", "dueDate": null
            })),
            Ok(InvoiceUpdate {
                invoice_reference: Some(Some("FAC-1".into())),
                invoice_amount: Some(Some("1234.57".into())),
                invoice_amount_ttc: Some(Some("1500.60".into())),
                due_date: Some(None),
                reconciled: None,
            })
        );
    }

    fn filters(query: &str) -> Result<DeliveryFilters, Vec<&'static str>> {
        delivery_filters(&query_params(Some(query)))
    }

    #[test]
    fn parametres_de_la_liste() {
        let ok = filters("storeId=1&supplierId=0x2&reconciled=false&hasBl=&from=2026-10-01&limit=1e3&offset=5&blNumber=%20BL-1002%20").unwrap();
        assert_eq!(ok.store_id, Some(1.0));
        assert_eq!(ok.supplier_id, Some(2.0));
        assert_eq!(ok.reconciled, Some(false));
        assert_eq!(ok.has_bl, None);
        assert_eq!(ok.from.as_deref(), Some("2026-10-01"));
        assert_eq!(ok.limit, Some(1000.0));
        assert_eq!(ok.offset, 5.0);
        assert_eq!(ok.bl_number, "bl-1002");
        assert_eq!(
            filters(
                "storeId=0&supplierId=1.5&reconciled=yes&hasInvoice=1&from=2026-1-1&to=x&limit=-1&offset=-1"
            )
            .unwrap_err(),
            [
                "storeId",
                "supplierId",
                "reconciled",
                "hasInvoice",
                "from",
                "to",
                "limit",
                "offset"
            ]
        );
        // Paramètre répété : tableau (invalide, ou ignoré pour blNumber)
        assert_eq!(filters("storeId=1&storeId=1").unwrap_err(), ["storeId"]);
        assert_eq!(filters("blNumber=a&blNumber=b").unwrap().bl_number, "");
        assert_eq!(filters("offset=").unwrap().offset, 0.0);
    }

    #[test]
    fn echeance_lue_comme_new_date() {
        // new Date('2026-02-30').toISOString() dans Node
        assert_eq!(
            dates::parse_js_date("2026-02-30")
                .map(|date| js::iso(&date))
                .as_deref(),
            Some("2026-03-02T00:00:00.000Z")
        );
        assert!(dates::parse_js_date("2026-13-45").is_none());
    }

    #[test]
    fn statut_et_controle_des_livraisons() {
        // Sans statut : les livraisons livrées, comme avant
        assert_eq!(filters("").unwrap().status.as_deref(), Some("delivered"));
        assert_eq!(filters("status=").unwrap().status.as_deref(), Some("delivered"));
        assert_eq!(filters("status=all").unwrap().status, None);
        assert_eq!(
            filters("status=planned").unwrap().status.as_deref(),
            Some("planned")
        );
        assert_eq!(
            filters("controlValidated=true").unwrap().control_validated,
            Some(true)
        );
        assert_eq!(
            filters("status=Planned&controlValidated=oui").unwrap_err(),
            ["status", "controlValidated"]
        );
        assert_eq!(filters("status=a&status=b").unwrap_err(), ["status"]);
    }

    #[test]
    fn filtres_des_commandes() {
        let ok = order_filters(&query_params(Some(
            "storeId=2&status=pending&from=2026-11-01&to=2026-11-30&limit=10",
        )))
        .unwrap();
        assert_eq!(ok.store_id, Some(2.0));
        assert_eq!(ok.status.as_deref(), Some("pending"));
        assert_eq!(ok.to.as_deref(), Some("2026-11-30"));
        assert_eq!(ok.limit, Some(10.0));
        // Sans statut : toutes les commandes
        assert_eq!(order_filters(&query_params(None)).unwrap().status, None);
        assert_eq!(
            order_filters(&query_params(Some(
                "supplierId=x&status=ALL&from=1/11/2026&offset=1.5"
            )))
            .unwrap_err(),
            ["supplierId", "status", "from", "offset"]
        );
    }

    #[test]
    fn pagination() {
        assert_eq!(page(10, None, 0.0), (100.0, 0, 10));
        assert_eq!(page(10, Some(3.0), 8.0), (3.0, 8, 10));
        assert_eq!(page(10, Some(1000.0), 20.0), (500.0, 10, 10));
    }

    #[test]
    fn magasins_visibles_par_une_cle() {
        let full = ApiAccess::full();
        assert!(full.write && full.allows_store(7));
        assert_eq!(full.stores_for(None), Some(vec![]));
        assert_eq!(full.stores_for(Some(3)), Some(vec![3]));
        let limited = ApiAccess {
            key_id: Some(1),
            write: false,
            stores: Some(vec![1, 2]),
        };
        assert!(limited.allows_store(2) && !limited.allows_store(3));
        assert_eq!(limited.stores_for(None), Some(vec![1, 2]));
        assert_eq!(limited.stores_for(Some(2)), Some(vec![2]));
        assert_eq!(limited.stores_for(Some(3)), None);
        // Identifiant hors des entiers de PostgreSQL : rien de visible
        assert_eq!(visible_stores(&full, Some(1e12)), None);
        assert_eq!(visible_stores(&limited, None), Some(vec![1, 2]));
    }

    #[test]
    fn reglages_d_une_nouvelle_cle() {
        let today = chrono::NaiveDate::from_ymd_opt(2026, 11, 11).unwrap();
        let parse = |body: Value| parse_key_settings(&body, today);
        // Sans réglage : tous les droits (clés créées avant leur ajout)
        assert_eq!(parse(json!({ "name": "n8n" })), Ok(KeySettings::default()));
        assert_eq!(KeySettings::default().access, ACCESS_WRITE);
        let settings = parse(json!({
            "name": "Agent factures",
            "access": "read",
            "storeIds": [2, 1, 2],
            "expiresAt": "2026-12-31"
        }))
        .unwrap();
        assert_eq!(settings.access, ACCESS_READ);
        assert_eq!(settings.group_ids, Some(vec![1, 2]));
        // Valable jusqu'à la fin du 31 décembre
        assert_eq!(
            settings.expires_at,
            chrono::NaiveDate::from_ymd_opt(2027, 1, 1)
                .unwrap()
                .and_hms_opt(0, 0, 0)
        );
        assert_eq!(
            parse(json!({ "storeIds": [], "expiresAt": "" })),
            Ok(KeySettings::default())
        );
        assert!(
            parse(json!({ "expiresAt": "2026-11-11" }))
                .unwrap()
                .expires_at
                .is_some()
        );
        assert!(parse(json!({ "access": "admin" })).is_err());
        assert!(parse(json!({ "storeIds": [0] })).is_err());
        assert!(parse(json!({ "storeIds": ["1"] })).is_err());
        assert!(parse(json!({ "storeIds": 1 })).is_err());
        assert!(parse(json!({ "expiresAt": "2026-11-10" })).is_err());
        assert!(parse(json!({ "expiresAt": "31/12/2026" })).is_err());
        assert!(parse(json!({ "expiresAt": "2026-02-30" })).is_err());
    }
}
