// API externe et ses clés : /api/ext/v1, /api/external-api/keys (lot 4, docs/PLAN-MIGRATION-RUST.md).
// Pas encore porté : ces adresses sont servies par Node.

use axum::Router;

use crate::AppState;

pub fn routes() -> Router<AppState> {
    Router::new()
}
