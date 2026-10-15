// Tâches de démarrage et de fond, reprises du serveur Node :
// - compte administrateur par défaut (createDefaultAdminUser, server/localAuth.ts) ;
// - configuration météo depuis VISUAL_CROSSING_API_KEY (server/weatherAutoConfig.ts) ;
// - sauvegarde automatique quotidienne, vérifiée toutes les heures (server/backupService.ts) ;
// - purge du cache de vérification des factures toutes les 6 h (server/maintenance.ts).
// Comme dans Node, une tâche en échec est journalisée sans arrêter le serveur. Le
// serveur tourne en UTC (image Docker sans TZ) : « 2 h » et « aujourd'hui » sont en UTC.

use std::time::Duration;

use chrono::{NaiveDateTime, Timelike, Utc};
use sqlx::PgPool;

use crate::AppState;
use crate::modules::{backups, session_routes, weather};

const BACKUP_CHECK_INTERVAL: Duration = Duration::from_secs(60 * 60);
const CACHE_PURGE_INTERVAL: Duration = Duration::from_secs(6 * 60 * 60);
const CACHE_PURGE_FIRST_DELAY: Duration = Duration::from_secs(60);

/// Lance les tâches de fond (sauvegarde, purge, configuration météo)
pub fn spawn(state: AppState) {
    tokio::spawn(initialize_weather_config(state.db.clone()));
    tokio::spawn(backup_scheduler(state.clone()));
    tokio::spawn(cache_purge(state.db.clone()));
}

/// Compte « admin » créé s'il n'existe pas (mot de passe « admin », à changer à la
/// première connexion), ou mot de passe remis au bon format s'il est illisible.
/// La valeur « admin.salt », acceptée par l'accès de développement de Node pour le
/// mot de passe « admin », est remplacée par une vraie empreinte du même mot de passe.
pub async fn ensure_default_admin(db: &PgPool) {
    let existing: Result<Option<(String, Option<String>)>, sqlx::Error> =
        sqlx::query_as("SELECT id, password FROM users WHERE username = 'admin'")
            .fetch_optional(db)
            .await;
    let result = match existing {
        Ok(None) => {
            let password = session_routes::hash_password("admin".into()).await;
            sqlx::query(
                "INSERT INTO users (id, username, email, first_name, last_name, password, role, password_changed)
                 VALUES ('admin_local', 'admin', 'admin@logiflow.com', 'Administrateur', 'Système', $1, 'admin', false)",
            )
            .bind(password)
            .execute(db)
            .await
            .map(|_| tracing::info!("compte admin créé (mot de passe par défaut : admin)"))
        }
        Ok(Some((id, password))) => {
            let unreadable = password
                .as_deref()
                .is_none_or(|p| !p.contains('.') || p == "admin.salt");
            if unreadable {
                let password = session_routes::hash_password("admin".into()).await;
                sqlx::query(
                    "UPDATE users SET password = $1, password_changed = false, updated_at = $2 WHERE id = $3",
                )
                .bind(password)
                .bind(now_ms())
                .bind(id)
                .execute(db)
                .await
                .map(|_| tracing::info!("mot de passe du compte admin remis au bon format"))
            } else {
                Ok(())
            }
        }
        Err(error) => Err(error),
    };
    if let Err(error) = result {
        tracing::error!(%error, "vérification du compte admin en échec");
    }
}

/// Instant présent à la milliseconde, comme new Date() écrit par Drizzle
fn now_ms() -> NaiveDateTime {
    let now = Utc::now().naive_utc();
    now.with_nanosecond(now.nanosecond() / 1_000_000 * 1_000_000)
        .unwrap_or(now)
}

/// initializeWeatherConfig : configuration active déjà présente, ou clé d'API de
/// l'environnement testée puis enregistrée pour « Nancy, France »
async fn initialize_weather_config(db: PgPool) {
    let settings = match weather::weather_settings(&db).await {
        Ok(settings) => settings,
        Err(error) => {
            tracing::error!(%error, "configuration météo illisible");
            return;
        }
    };
    if settings.as_ref().is_some_and(|s| s.is_active) {
        return;
    }
    let Some(api_key) = std::env::var("VISUAL_CROSSING_API_KEY")
        .ok()
        .filter(|key| !key.is_empty())
    else {
        return;
    };
    const LOCATION: &str = "Nancy, France";
    let (success, message) = weather::test_api_connection(&api_key, LOCATION).await;
    if !success {
        tracing::error!(%message, "clé météo de l'environnement refusée");
        return;
    }
    let result = match settings {
        Some(existing) => sqlx::query(
            "UPDATE weather_settings SET api_key = $1, location = $2, is_active = true, updated_at = $3 WHERE id = $4",
        )
        .bind(&api_key)
        .bind(LOCATION)
        .bind(now_ms())
        .bind(existing.id)
        .execute(&db)
        .await,
        None => sqlx::query("INSERT INTO weather_settings (api_key, location, is_active) VALUES ($1, $2, true)")
            .bind(&api_key)
            .bind(LOCATION)
            .execute(&db)
            .await,
    };
    match result {
        Ok(_) => tracing::info!("météo configurée depuis VISUAL_CROSSING_API_KEY"),
        Err(error) => tracing::error!(%error, "enregistrement de la configuration météo en échec"),
    }
}

/// Toutes les heures (et au démarrage) : après 2 h, une sauvegarde automatique par
/// jour, sauf si Paramètres les a désactivées
async fn backup_scheduler(state: AppState) {
    let mut last_automatic_backup: Option<String> = None;
    let mut interval = tokio::time::interval(BACKUP_CHECK_INTERVAL);
    loop {
        interval.tick().await;
        if let Err(error) = check_automatic_backup(&state, &mut last_automatic_backup).await {
            tracing::error!(%error, "vérification de la sauvegarde automatique en échec");
        }
    }
}

async fn check_automatic_backup(state: &AppState, last_done: &mut Option<String>) -> anyhow::Result<()> {
    let enabled: Option<(Option<bool>,)> =
        sqlx::query_as("SELECT automatic_backups_enabled FROM utilities LIMIT 1")
            .fetch_optional(&state.db)
            .await?;
    if matches!(enabled, Some((Some(false),))) {
        return Ok(());
    }
    // Une fois par jour, à partir de 2 h à Paris (décision R5)
    let now = crate::clock::now();
    let today = now.format("%Y-%m-%d").to_string();
    if now.hour() < 2 || last_done.as_deref() == Some(today.as_str()) {
        return Ok(());
    }
    let last_backup: Option<(Option<NaiveDateTime>,)> = sqlx::query_as(
        "SELECT created_at FROM database_backups WHERE backup_type = 'automatic' ORDER BY created_at DESC LIMIT 1",
    )
    .fetch_optional(&state.db)
    .await?;
    let last_backup_day = last_backup
        .and_then(|(created,)| created)
        .map(|created| crate::clock::paris_date(created).format("%Y-%m-%d").to_string());
    if last_backup_day.as_deref() == Some(today.as_str()) {
        return Ok(());
    }
    // Un administrateur, à défaut n'importe quel compte (clé étrangère created_by)
    let user: Option<(String,)> =
        sqlx::query_as("SELECT id FROM users ORDER BY (role = 'admin') DESC LIMIT 1")
            .fetch_optional(&state.db)
            .await?;
    let Some((user_id,)) = user else {
        tracing::warn!("aucun compte : sauvegarde automatique ignorée");
        return Ok(());
    };
    tracing::info!("sauvegarde automatique en cours");
    backups::create_backup(state, "automatic", &user_id).await?;
    *last_done = Some(today);
    tracing::info!("sauvegarde automatique terminée");
    Ok(())
}

/// Purge du cache de vérification des factures : 60 s après le démarrage, puis toutes les 6 h
async fn cache_purge(db: PgPool) {
    tokio::time::sleep(CACHE_PURGE_FIRST_DELAY).await;
    let mut interval = tokio::time::interval(CACHE_PURGE_INTERVAL);
    loop {
        interval.tick().await;
        match sqlx::query("DELETE FROM invoice_verification_cache WHERE expires_at < NOW()")
            .execute(&db)
            .await
        {
            Ok(result) => tracing::info!(rows = result.rows_affected(), "cache des factures purgé"),
            Err(error) => tracing::error!(%error, "purge du cache des factures en échec"),
        }
    }
}
