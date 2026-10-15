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
// d'adresse qu'Express accepte aussi (casse, barre finale) sont relayées à Node.

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

use crate::AppState;
use crate::auth::CurrentUser;
use crate::error::{ApiResult, AppError};
use crate::js;
use crate::modules::deliveries;
use crate::request::JsonBody;
use crate::schema::{DeliveriesRow, SuppliersRow};
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
        // Toute autre méthode sur ces adresses : la route inconnue de Node
        .route("/api/ext/v1/stores", get(ext_stores).fallback(ext_unknown))
        .route("/api/ext/v1/suppliers", get(ext_suppliers).fallback(ext_unknown))
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

// ---------- /api/ext/v1 : clé d'API ----------

/// requireApiKey : clé de l'environnement, puis clé enregistrée ; sans clé
/// valable, 503 si aucune clé n'est active, 401 sinon
async fn require_api_key(state: &AppState, headers: &HeaderMap) -> Result<(), AppError> {
    let failed = |error: sqlx::Error| {
        tracing::error!(%error, "[EXT-API] vérification de la clé");
        error_body(
            StatusCode::INTERNAL_SERVER_ERROR,
            "Erreur lors de la vérification de la clé d'API",
        )
    };
    if let Some(key) = extract_api_key(headers) {
        if is_env_api_key(&key) || verify_stored_api_key(&state.db, &key).await.map_err(failed)? {
            return Ok(());
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
    let headers = request.headers().clone();
    if let Err(error) = JsonBody::from_request(request, &state).await {
        return error.into_response();
    }
    match require_api_key(&state, &headers).await {
        Ok(()) => error_body(StatusCode::NOT_FOUND, "Route inconnue").into_response(),
        Err(error) => error.into_response(),
    }
}

async fn ext_stores(State(state): State<AppState>, headers: HeaderMap) -> ApiResult {
    require_api_key(&state, &headers).await?;
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
        .map(|(id, name)| json!({ "id": id, "name": name }))
        .collect();
    Ok(Json(out).into_response())
}

async fn ext_suppliers(State(state): State<AppState>, headers: HeaderMap) -> ApiResult {
    require_api_key(&state, &headers).await?;
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
    let out: Vec<Value> = suppliers
        .into_iter()
        .map(|supplier| {
            json!({
                "id": supplier.id,
                "name": supplier.name,
                "code": supplier.codefou,
                "paymentMethod": supplier.payment_method,
                "automaticReconciliation": supplier.automatic_reconciliation == Some(true),
            })
        })
        .collect();
    Ok(Json(out).into_response())
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
    headers: HeaderMap,
    RawQuery(raw): RawQuery,
) -> ApiResult {
    require_api_key(&state, &headers).await?;
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
    let stores = match filters.store_id {
        Some(id) => vec![crate::db::js_int4(id).ok_or_else(failed)?],
        None => Vec::new(),
    };
    let mut rows = deliveries::get_deliveries(&state.db, &stores, Some("delivered"))
        .await
        .map_err(|error| {
            tracing::error!(%error, "[EXT-API] deliveries");
            failed()
        })?;
    rows.retain(|delivery| filters.keeps(&delivery.item.row));
    // De la plus récente à la plus ancienne, puis par identifiant décroissant
    rows.sort_by(|a, b| {
        sort_key(&b.item.row)
            .cmp(&sort_key(&a.item.row))
            .then(b.item.row.id.cmp(&a.item.row.id))
    });
    let page_size = filters.limit.unwrap_or(DEFAULT_LIMIT).min(MAX_LIMIT);
    let start = if filters.offset >= rows.len() as f64 {
        rows.len()
    } else {
        filters.offset as usize
    };
    let end = start.saturating_add(page_size as usize).min(rows.len());
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

/// Identifiant d'adresse (parseIntParam) : 400 s'il n'est pas un entier positif
fn delivery_id(raw: &str) -> Result<f64, AppError> {
    parse_int_param(&Param::One(raw.to_string()))
        .ok()
        .flatten()
        .ok_or_else(|| error_body(StatusCode::BAD_REQUEST, "Identifiant invalide"))
}

async fn ext_delivery(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> ApiResult {
    require_api_key(&state, &headers).await?;
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
        .ok_or_else(|| error_body(StatusCode::NOT_FOUND, "Livraison introuvable"))?;
    Ok(Json(detail_json(&delivery)).into_response())
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
    headers: HeaderMap,
    Path(id): Path<String>,
    JsonBody(body): JsonBody,
) -> ApiResult {
    require_api_key(&state, &headers).await?;
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
}
