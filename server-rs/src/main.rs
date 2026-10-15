// Serveur LogiFlow : l'API (router.rs), l'interface construite par Vite
// (static_files.rs), les migrations de démarrage et les tâches de fond.
// Il a remplacé le serveur Node (docs/PLAN-MIGRATION-RUST.md).

mod access;
mod auth;
mod config;
mod crypto;
mod db;
mod error;
mod express_routes;
mod http;
mod jobs;
mod js;
mod json;
mod modules;
mod projections;
mod request;
mod router;
mod schema;
mod services;
mod startup;
mod static_files;
mod zod;

use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;

use sqlx::postgres::PgPoolOptions;
use tracing_subscriber::EnvFilter;

use crate::config::Config;

#[derive(Clone)]
pub struct AppState {
    pub config: Arc<Config>,
    pub db: sqlx::PgPool,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        // Pas de couleurs dans les journaux Docker
        .with_ansi(std::io::IsTerminal::is_terminal(&std::io::stdout()))
        .with_env_filter(
            EnvFilter::try_from_env("RUST_LOG").unwrap_or_else(|_| EnvFilter::new("info,sqlx=warn")),
        )
        .init();

    let config = Config::from_env()?;
    // Connexion paresseuse : le serveur démarre même si la base n'est pas encore prête
    let db = PgPoolOptions::new()
        .max_connections(20)
        .acquire_timeout(Duration::from_secs(15))
        .idle_timeout(Duration::from_secs(30))
        .connect_lazy(&config.database_url)?;

    // Comme Node : migrations avant d'accepter des requêtes, puis compte admin,
    // index en arrière-plan et tâches de fond
    startup::run_migrations(&db, &config.encryption_key).await;
    jobs::ensure_default_admin(&db).await;
    startup::spawn_performance_indexes(db.clone());

    let state = AppState {
        config: Arc::new(config),
        db,
    };
    let port = state.config.port;
    tracing::info!(port, "LogiFlow démarre");

    jobs::spawn(state.clone());
    let app = router::build(state);
    let listener = tokio::net::TcpListener::bind(SocketAddr::from(([0, 0, 0, 0], port))).await?;
    axum::serve(listener, app.into_make_service_with_connect_info::<SocketAddr>())
        .with_graceful_shutdown(shutdown_signal())
        .await?;
    Ok(())
}

async fn shutdown_signal() {
    let ctrl_c = async {
        let _ = tokio::signal::ctrl_c().await;
    };
    let terminate = async {
        if let Ok(mut signal) = tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()) {
            signal.recv().await;
        }
    };
    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }
    tracing::info!("arrêt demandé");
}
