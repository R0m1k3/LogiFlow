// Configuration lue dans l'environnement, mêmes variables que le serveur Node.

use std::env;
use std::path::PathBuf;

#[derive(Clone, Debug)]
pub struct Config {
    pub port: u16,
    pub database_url: String,
    /// Serveur Node qui sert les adresses pas encore portées
    pub node_upstream: String,
    /// Interface construite par Vite (dist/public)
    pub static_dir: PathBuf,
    pub session_secret: String,
    /// Clé de chiffrement des secrets (à défaut SESSION_SECRET), comme server/crypto.ts
    pub encryption_key: String,
    pub environment: String,
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        let session_secret = env::var("SESSION_SECRET").unwrap_or_else(|_| "fallback-secret-key".into());
        let encryption_key = env::var("ENCRYPTION_KEY")
            .ok()
            .filter(|key| !key.is_empty())
            .or_else(|| env::var("SESSION_SECRET").ok().filter(|key| !key.is_empty()))
            .unwrap_or_else(|| "logiflow-fallback-secret-key".into());
        Ok(Self {
            port: env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(3000),
            database_url: env::var("DATABASE_URL").map_err(|_| anyhow::anyhow!("DATABASE_URL manquant"))?,
            node_upstream: env::var("NODE_UPSTREAM")
                .unwrap_or_else(|_| "http://127.0.0.1:3001".into())
                .trim_end_matches('/')
                .to_string(),
            static_dir: env::var("STATIC_DIR")
                .map(PathBuf::from)
                .unwrap_or_else(|_| PathBuf::from("dist/public")),
            session_secret,
            encryption_key,
            environment: env::var("NODE_ENV").unwrap_or_else(|_| "production".into()),
        })
    }
}
