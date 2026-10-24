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
    /// Clé de chiffrement des secrets (ENCRYPTION_KEY, à défaut SESSION_SECRET)
    pub encryption_key: String,
    /// Anciennes clés de chiffrement : les secrets encore chiffrés avec l'une
    /// d'elles sont rechiffrés avec encryption_key au démarrage (startup.rs)
    pub previous_encryption_keys: Vec<String>,
    pub environment: String,
    /// Dossier des sauvegardes pg_dump, comme server/backupService.ts : BACKUP_DIR
    /// (à défaut /app/backups) en production, ./backups sinon
    pub backup_dir: PathBuf,
    /// Origines autorisées en plus de l'hôte du serveur pour les requêtes
    /// d'écriture (ALLOWED_ORIGINS, séparées par des virgules), voir origin.rs
    pub allowed_origins: Vec<String>,
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        let session_secret = required_secret("SESSION_SECRET")?;
        let encryption_key = match env::var("ENCRYPTION_KEY").ok().filter(|key| !key.is_empty()) {
            Some(key) => key,
            None => {
                // Installations existantes : leurs secrets ont été chiffrés avec
                // SESSION_SECRET. Repli conservé, mais la clé doit être distincte.
                tracing::warn!(
                    "ENCRYPTION_KEY absente : repli sur SESSION_SECRET pour chiffrer les secrets en base. \
                     Définissez ENCRYPTION_KEY (voir README, « Sécurité / variables obligatoires »)"
                );
                session_secret.clone()
            }
        };
        if PUBLIC_SECRETS.contains(&encryption_key.as_str()) {
            tracing::warn!(
                "ENCRYPTION_KEY a une valeur publiée dans le dépôt : choisissez une nouvelle clé, \
                 les secrets en base seront rechiffrés automatiquement au démarrage"
            );
        }
        let previous_encryption_keys = previous_encryption_keys(&encryption_key, &session_secret);
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
            previous_encryption_keys,
            environment,
            backup_dir,
            allowed_origins: env::var("ALLOWED_ORIGINS")
                .unwrap_or_default()
                .split(',')
                .map(|origin| origin.trim().trim_end_matches('/').to_ascii_lowercase())
                .filter(|origin| !origin.is_empty())
                .collect(),
        })
    }
}

/// Valeurs publiées dans le dépôt (docker-compose.yml, .env.example, anciens
/// replis du code) : refusées comme SESSION_SECRET, et essayées comme anciennes
/// clés de chiffrement pour rechiffrer les secrets avec la nouvelle clé.
const PUBLIC_SECRETS: &[&str] = &[
    "LogiFlow_Super_Secret_Session_Key_2025_Production",
    "fallback-secret-key",
    "logiflow-fallback-secret-key",
];

/// Secret obligatoire, refusé s'il est vide, connu publiquement ou trop court
fn required_secret(name: &str) -> anyhow::Result<String> {
    let value = env::var(name).unwrap_or_default();
    if value.trim().is_empty() {
        anyhow::bail!("{name} manquant : définissez-le dans .env (par exemple : openssl rand -hex 32)");
    }
    if PUBLIC_SECRETS.contains(&value.as_str()) {
        anyhow::bail!(
            "{name} a une valeur publiée dans le dépôt : générez-en une nouvelle (openssl rand -hex 32)"
        );
    }
    if value.len() < 16 {
        anyhow::bail!("{name} trop court : 16 caractères au minimum (openssl rand -hex 32)");
    }
    Ok(value)
}

/// ENCRYPTION_KEY_PREVIOUS (facultative, séparées par des virgules), SESSION_SECRET
/// (ancienne clé par défaut) et les valeurs publiées autrefois dans le dépôt, sauf
/// la clé courante
fn previous_encryption_keys(current: &str, session_secret: &str) -> Vec<String> {
    let mut keys: Vec<String> = env::var("ENCRYPTION_KEY_PREVIOUS")
        .unwrap_or_default()
        .split(',')
        .map(str::trim)
        .filter(|key| !key.is_empty())
        .map(str::to_string)
        .collect();
    keys.push(session_secret.to_string());
    keys.extend(PUBLIC_SECRETS.iter().map(|key| key.to_string()));
    let mut unique: Vec<String> = Vec::new();
    for key in keys {
        if key != current && !unique.contains(&key) {
            unique.push(key);
        }
    }
    unique
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn anciennes_cles_sans_la_cle_courante_ni_doublon() {
        let keys = previous_encryption_keys("nouvelle-cle", "ancien-secret-de-session");
        assert_eq!(keys[0], "ancien-secret-de-session");
        assert!(keys.contains(&"LogiFlow_Super_Secret_Session_Key_2025_Production".to_string()));
        assert!(!keys.contains(&"nouvelle-cle".to_string()));
        // Repli : ENCRYPTION_KEY absente, la clé courante est SESSION_SECRET
        let keys = previous_encryption_keys("meme-secret", "meme-secret");
        assert!(!keys.contains(&"meme-secret".to_string()));
    }
}
