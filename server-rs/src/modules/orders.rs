// Commandes fournisseurs : /api/orders, /api/sync-order-delivery-status (lot 4, docs/PLAN-MIGRATION-RUST.md).
// Pas encore porté : ces adresses sont servies par Node.

use axum::Router;

use crate::AppState;

pub fn routes() -> Router<AppState> {
    Router::new()
}
