// GET /api/health (server/routes.ts:118), utilisé par le contrôle de santé Docker.

use axum::Json;
use axum::extract::State;
use serde_json::{Value, json};

use crate::AppState;

pub async fn health(State(state): State<AppState>) -> Json<Value> {
    Json(json!({
        "status": "healthy",
        "timestamp": crate::modules::now_iso(),
        "environment": state.config.environment,
        "database": "connected",
    }))
}
