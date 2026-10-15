// Configuration NocoDB : /api/nocodb-config (server/routes.ts, « NocoDB Configuration
// routes »). Le jeton API est chiffré en base et rendu en clair dans les réponses,
// comme Node (storage.decryptNocodbConfig).
//
// Défaut de Node reproduit : GET /api/nocodb-config/active rend la configuration
// active, jeton API en clair compris, à tout compte connecté (les autres adresses
// sont réservées à l'admin).

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::routing::{get, put};
use axum::{Json, Router};
use serde_json::{Value, json};

use crate::AppState;
use crate::auth::CurrentUser;
use crate::db::{self, Table};
use crate::error::{ApiResult, AppError, json_or_empty};
use crate::request::{JsonBody, int_id};
use crate::schema::NocodbConfigRow;
use crate::services::nocodb;
use crate::zod::{Object, Parsed};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/nocodb-config", get(list).post(create))
        .route("/api/nocodb-config/active", get(active))
        .route("/api/nocodb-config/{id}", put(update).delete(remove))
}

/// insertNocodbConfigSchema
fn insert_schema() -> Object {
    NocodbConfigRow::insert_schema().omit(&["id", "createdAt", "updatedAt"])
}

fn admin_only(user: &CurrentUser) -> Result<(), AppError> {
    if user.is_admin() {
        Ok(())
    } else {
        Err(AppError::forbidden(
            "Accès refusé. Seuls les administrateurs peuvent gérer les configurations NocoDB.",
        ))
    }
}

/// Erreur 500 de ces adresses : { error } au lieu de { message }
fn failure(message: &str) -> AppError {
    AppError::with_body(StatusCode::INTERNAL_SERVER_ERROR, json!({ "error": message }))
}

/// encryptSecret(apiToken) || '' : le jeton n'est jamais écrit en clair
fn encrypt_token(data: &mut Parsed, encryption_key: &str) {
    if let Some(Value::String(token)) = data.get("apiToken") {
        let sealed = crate::crypto::encrypt(token, encryption_key);
        data.insert("apiToken".into(), Value::String(sealed));
    }
}

async fn list(State(state): State<AppState>, user: CurrentUser) -> ApiResult {
    admin_only(&user)?;
    let configs: Vec<NocodbConfigRow> = sqlx::query_as(&NocodbConfigRow::select("ORDER BY created_at DESC"))
        .fetch_all(&state.db)
        .await
        .map_err(|error| {
            tracing::error!(%error, "lecture des configurations NocoDB");
            failure("Failed to fetch configurations")
        })?;
    let key = &state.config.encryption_key;
    let configs: Vec<NocodbConfigRow> = configs
        .into_iter()
        .map(|config| nocodb::decrypt_config(config, key))
        .collect();
    Ok(Json(configs).into_response())
}

async fn create(State(state): State<AppState>, user: CurrentUser, JsonBody(body): JsonBody) -> ApiResult {
    const FAILED: &str = "Failed to create configuration";
    admin_only(&user)?;
    let mut input = body.as_object().cloned().unwrap_or_default();
    input.insert("createdBy".into(), json!(user.id()));
    let mut data = insert_schema()
        .parse(&Value::Object(input))
        .map_err(|_| failure(FAILED))?;
    encrypt_token(&mut data, &state.config.encryption_key);
    let config: NocodbConfigRow = db::insert(&state.db, &data).await.map_err(|error| {
        tracing::error!(%error, "{FAILED}");
        failure(FAILED)
    })?;
    let config = nocodb::decrypt_config(config, &state.config.encryption_key);
    Ok((StatusCode::CREATED, Json(config)).into_response())
}

async fn update(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<String>,
    JsonBody(body): JsonBody,
) -> ApiResult {
    const FAILED: &str = "Failed to update configuration";
    admin_only(&user)?;
    let mut data = insert_schema()
        .partial()
        .parse(&body)
        .map_err(|_| failure(FAILED))?;
    let id = int_id(&id, FAILED).map_err(|_| failure(FAILED))?;
    encrypt_token(&mut data, &state.config.encryption_key);
    let config = db::update_by_id::<NocodbConfigRow>(&state.db, id, &data, true)
        .await
        .map_err(|error| {
            tracing::error!(%error, "{FAILED}");
            failure(FAILED)
        })?;
    let key = &state.config.encryption_key;
    Ok(json_or_empty(
        config.map(|config| nocodb::decrypt_config(config, key)),
    ))
}

async fn remove(State(state): State<AppState>, user: CurrentUser, Path(id): Path<String>) -> ApiResult {
    const FAILED: &str = "Failed to delete configuration";
    admin_only(&user)?;
    let id = int_id(&id, FAILED).map_err(|_| failure(FAILED))?;
    db::delete_by_id::<NocodbConfigRow>(&state.db, id)
        .await
        .map_err(|error| {
            tracing::error!(%error, "{FAILED}");
            failure(FAILED)
        })?;
    Ok(StatusCode::NO_CONTENT.into_response())
}

async fn active(State(state): State<AppState>, _user: CurrentUser) -> ApiResult {
    let config = nocodb::active_config(&state).await;
    Ok(Json(config).into_response())
}
