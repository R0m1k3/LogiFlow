// Configuration lue dans l'environnement, mêmes variables que le serveur Node.

use std::env;
use std::path::PathBuf;

#[derive(Clone, Debug)]
pub struct Config {
    pub port: u16,
    pub database_url: String,
    /// Interface construite par Vite (dist/public)
    pub static_dir: PathBuf,
    pub session_secret: String,
    /// Clé de chiffrement des secrets (à défaut SESSION_SECRET), comme server/crypto.ts
    pub encryption_key: String,
    pub environment: String,
    /// Dossier des sauvegardes pg_dump, comme server/backupService.ts : BACKUP_DIR
    /// (à défaut /app/backups) en production, ./backups sinon
    pub backup_dir: PathBuf,
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        let session_secret = env::var("SESSION_SECRET").unwrap_or_else(|_| "fallback-secret-key".into());
        let encryption_key = env::var("ENCRYPTION_KEY")
            .ok()
            .filter(|key| !key.is_empty())
            .or_else(|| env::var("SESSION_SECRET").ok().filter(|key| !key.is_empty()))
            .unwrap_or_else(|| "logiflow-fallback-secret-key".into());
        let environment = env::var("NODE_ENV").unwrap_or_else(|_| "production".into());
        let backup_dir = if environment == "production" {
            env::var("BACKUP_DIR")
                .ok()
                .filter(|dir| !dir.is_empty())
                .map(PathBuf::from)
                .unwrap_or_else(|| PathBuf::from("/app/backups"))
        } else {
            env::current_dir().unwrap_or_default().join("backups")
        };
        Ok(Self {
            port: env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(3000),
            database_url: env::var("DATABASE_URL").map_err(|_| anyhow::anyhow!("DATABASE_URL manquant"))?,
            static_dir: env::var("STATIC_DIR")
                .map(PathBuf::from)
                .unwrap_or_else(|_| PathBuf::from("dist/public")),
            session_secret,
            encryption_key,
            environment,
            backup_dir,
        })
    }
}
