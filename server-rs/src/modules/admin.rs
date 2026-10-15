// Administration et diagnostic : /api/debug/*, /api/admin/* (lot 5, docs/PLAN-MIGRATION-RUST.md).
// Pas encore porté : ces adresses sont servies par Node.

use axum::Router;

use crate::AppState;

pub fn routes() -> Router<AppState> {
    Router::new()
}
