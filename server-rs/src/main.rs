// Socle partagé utilisé au fil des lots : pas d'avertissement « jamais utilisé »
// avant la fin du portage (docs/PLAN-MIGRATION-RUST.md).
#![allow(dead_code)]

// Serveur LogiFlow en Rust. Placé devant le serveur Node, il sert l'interface et
// les adresses déjà portées (router.rs) ; toutes les autres partent vers Node
// (proxy.rs). Plan : docs/PLAN-MIGRATION-RUST.md.

mod access;
mod auth;
mod config;
mod crypto;
mod db;
mod error;
mod http;
mod js;
mod json;
mod modules;
mod projections;
mod proxy;
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
    pub proxy: proxy::ProxyClient,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        // Pas de couleurs dans les journaux Docker
        .with_ansi(std::io::IsTerminal::is_terminal(&std::io::stdout()))
        .with_env_filter(EnvFilter::try_from_env("RUST_LOG").unwrap_or_else(|_| EnvFilter::new("info")))
        .init();

    let config = Config::from_env()?;
    // Connexion paresseuse : le serveur démarre même si la base n'est pas encore prête
    let db = PgPoolOptions::new()
        .max_connections(20)
        .acquire_timeout(Duration::from_secs(15))
        .idle_timeout(Duration::from_secs(30))
        .connect_lazy(&config.database_url)?;

    let state = AppState {
        config: Arc::new(config),
        db,
        proxy: proxy::client(),
    };
    let port = state.config.port;
    tracing::info!(port, upstream = %state.config.node_upstream, "LogiFlow (Rust) démarre");

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
