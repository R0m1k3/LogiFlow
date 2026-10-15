// Adresses de secours :
// - POST /api/admin/emergency-migration (server/routes.ts, admin) : relance les
//   migrations de démarrage (startup.rs), puis la création des index en
//   arrière-plan ; les erreurs sont journalisées, la réponse est toujours un succès ;
// - POST /api/emergency-admin-reset (server/index.production.ts, sans session) :
//   remet le mot de passe « admin » au compte admin si le corps porte le secret
//   EMERGENCY_SECRET de l'environnement ; l'adresse n'existe pas (404) sans lui.

use axum::Json;
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use serde_json::{Value, json};

use crate::AppState;
use crate::auth::CurrentUser;
use crate::db::Table;
use crate::error::{ApiResult, AppError};
use crate::modules::now_iso;
use crate::modules::session_routes::hash_password;
use crate::schema::UsersRow;
use crate::zod::Parsed;

pub async fn emergency_migration(State(state): State<AppState>, user: CurrentUser) -> ApiResult {
    if !user.is_admin() {
        return Err(AppError::forbidden("Insufficient permissions"));
    }
    tracing::warn!(user = user.id(), "migration d'urgence demandée");
    crate::startup::run_migrations(&state.db, &state.config.encryption_key).await;
    crate::startup::spawn_performance_indexes(state.db.clone());
    Ok(Json(json!({
        "success": true,
        "message": "Emergency migration executed successfully",
        "timestamp": now_iso(),
    }))
    .into_response())
}

fn error_body(status: StatusCode, body: Value) -> AppError {
    AppError::with_body(status, body)
}

pub async fn emergency_admin_reset(
    State(state): State<AppState>,
    crate::request::JsonBody(body): crate::request::JsonBody,
) -> ApiResult {
    let secret = std::env::var("EMERGENCY_SECRET").unwrap_or_default();
    if secret.is_empty() {
        return Err(error_body(StatusCode::NOT_FOUND, json!({ "error": "Not found" })));
    }
    if body.get("secret").and_then(Value::as_str) != Some(secret.as_str()) {
        tracing::warn!("réinitialisation du compte admin avec un secret invalide");
        return Err(error_body(
            StatusCode::FORBIDDEN,
            json!({ "error": "Invalid emergency secret" }),
        ));
    }
    tracing::warn!("réinitialisation d'urgence du mot de passe admin");
    let failed = |error: sqlx::Error| {
        error_body(
            StatusCode::INTERNAL_SERVER_ERROR,
            json!({ "error": "Reset failed", "details": crate::services::nocodb::database_message(&error) }),
        )
    };
    // storage.getUserByUsername('admin')
    let admin: Option<UsersRow> = sqlx::query_as(&UsersRow::select("WHERE username = $1"))
        .bind("admin")
        .fetch_optional(&state.db)
        .await
        .map_err(failed)?;
    let Some(admin) = admin else {
        return Err(error_body(
            StatusCode::NOT_FOUND,
            json!({ "error": "Admin user not found" }),
        ));
    };
    let mut data = Parsed::new();
    data.insert("password".into(), json!(hash_password("admin".to_string()).await));
    data.insert("passwordChanged".into(), json!(false));
    crate::modules::users::update_user(&state.db, &admin.id, &data)
        .await
        .map_err(failed)?;
    Ok(Json(json!({
        "success": true,
        "message": "Admin password reset to admin/admin",
        "adminId": admin.id,
    }))
    .into_response())
}
