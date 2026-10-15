// Table des adresses servies par Rust. Toute adresse absente d'ici part vers
// Node (static_files::fallback → proxy::forward) : faire revenir une adresse à
// Node, c'est retirer sa ligne.

use axum::Router;
use axum::extract::DefaultBodyLimit;
use axum::middleware;
use axum::routing::get;
use tower_http::compression::CompressionLayer;
use tower_http::compression::predicate::{DefaultPredicate, Predicate, SizeAbove};
use tower_http::trace::TraceLayer;

use crate::modules::*;
use crate::{AppState, express_routes, http, proxy, static_files};

// Même limite qu'express.json({ limit: '10mb' })
const BODY_LIMIT: usize = 10 * 1024 * 1024;

pub fn build(state: AppState) -> Router {
    let api = Router::new()
        .route("/api/health", get(health::health))
        // Lot 1
        .merge(contacts::routes())
        .merge(suppliers::routes())
        // Lot 2
        .merge(announcements::routes())
        .merge(publicities::routes())
        .merge(weather::routes())
        .merge(stats::routes())
        .merge(analytics::routes())
        // Lot 3
        .merge(tasks::routes())
        .merge(dlc::routes())
        .merge(customer_orders::routes())
        .merge(sav::routes())
        // Lot 4
        .merge(orders::routes())
        .merge(deliveries::routes())
        .merge(reconciliation::routes())
        .merge(avoirs::routes())
        .merge(payment_schedule::routes())
        .merge(nocodb_config::routes())
        .merge(bap::routes())
        .merge(external_api::routes())
        .merge(ffnancy::routes())
        // Lot 5
        .merge(session_routes::routes())
        .merge(users::routes())
        .merge(groups::routes())
        .merge(backups::routes())
        .merge(utilities::routes())
        .merge(admin::routes())
        // Méthode non portée sur une adresse portée : Node la sert encore
        .method_not_allowed_fallback(proxy::forward)
        .route_layer(middleware::from_fn(http::api_response_headers));

    // Pour rejouer une adresse qu'Express aurait servie (casse, « / » final)
    express_routes::install(api.clone().with_state(state.clone()));

    Router::new()
        .merge(api)
        .fallback(static_files::fallback)
        .layer(DefaultBodyLimit::max(BODY_LIMIT))
        // Comme compression() d'Express : gzip au-delà de 1 Ko ; les réponses déjà
        // compressées par Node passent telles quelles
        .layer(
            CompressionLayer::new()
                .gzip(true)
                .no_br()
                .no_deflate()
                .no_zstd()
                .compress_when(DefaultPredicate::new().and(SizeAbove::new(1024))),
        )
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}
