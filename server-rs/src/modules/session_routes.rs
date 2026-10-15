// Connexion et déconnexion : /api/login, /api/logout, /api/user, /api/default-credentials-check (lot 5, docs/PLAN-MIGRATION-RUST.md).
// Pas encore porté : ces adresses sont servies par Node.

use axum::Router;

use crate::AppState;

pub fn routes() -> Router<AppState> {
    Router::new()
}
