// Sauvegardes de la base : /api/backups (server/routes.ts, « Backup management
// routes », et server/backupService.ts), réservées à l'administrateur.
//
// pg_dump est lancé sans shell, avec des arguments séparés ; mêmes options, même
// nom de fichier, mêmes lignes dans database_backups, dix sauvegardes gardées.
//
// Écart voulu (audit BACKUP-09) : Node joint le nom reçu dans l'adresse au
// dossier des sauvegardes sans le contrôler (« ../ » sort du dossier). Rust
// n'accepte qu'un simple nom de fichier (ni « / », ni « \ », ni « . » ou « .. ») ;
// sinon la réponse est celle d'une sauvegarde introuvable.
//
// Non reportées ici : la sauvegarde automatique (vérification horaire, et après
// chaque connexion) reste faite par Node jusqu'à la bascule.

use std::path::{Path as FsPath, PathBuf};
use std::process::Stdio;
use std::time::UNIX_EPOCH;

use axum::body::Body;
use axum::extract::{Path, State};
use axum::http::{HeaderMap, HeaderValue, Method, StatusCode, header};
use axum::response::IntoResponse;
use axum::{Json, Router, routing::delete, routing::get};
use chrono::{DateTime, Utc};
use rand::RngCore;
use serde_json::{Value, json};

use crate::AppState;
use crate::auth::CurrentUser;
use crate::db::{self, Table};
use crate::error::{ApiResult, AppError, OrInternal};
use crate::schema::DatabaseBackupsRow;
use crate::zod::Parsed;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/backups", get(list).post(create))
        .route("/api/backups/{filename}", delete(remove))
        .route("/api/backups/{filename}/download", get(download))
}

/// maxBackups de backupService
const MAX_BACKUPS: i64 = 10;

fn access_denied() -> AppError {
    AppError::forbidden("Access denied")
}

fn admin_only(user: &CurrentUser) -> Result<(), AppError> {
    if user.is_admin() {
        Ok(())
    } else {
        Err(access_denied())
    }
}

/// Simple nom de fichier, sans chemin (BACKUP-09)
fn is_plain_name(name: &str) -> bool {
    !name.is_empty() && name != "." && name != ".." && !name.contains(['/', '\\', '\0'])
}

/// nanoid() : 21 caractères de l'alphabet sûr pour les adresses
fn nanoid() -> String {
    const ALPHABET: &[u8] = b"useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict";
    let mut bytes = [0u8; 21];
    rand::thread_rng().fill_bytes(&mut bytes);
    bytes
        .iter()
        .map(|byte| ALPHABET[(byte & 63) as usize] as char)
        .collect()
}

/// backup_<type>_<new Date().toISOString() avec « : » et « . » remplacés>.sql
fn backup_filename(kind: &str, now: &DateTime<Utc>) -> String {
    let stamp = crate::js::iso(now).replace([':', '.'], "-");
    format!("backup_{kind}_{stamp}.sql")
}

/// Paramètres de connexion lus dans DATABASE_URL comme new URL() : nom, mot de
/// passe et base gardent leur encodage d'origine
#[derive(Debug, PartialEq)]
struct DatabaseConfig {
    host: String,
    port: String,
    database: String,
    username: String,
    password: String,
}

fn database_config(url: &str) -> Option<DatabaseConfig> {
    let (_, rest) = url.split_once("://")?;
    let authority_end = rest.find(['/', '?', '#']).unwrap_or(rest.len());
    let (authority, tail) = rest.split_at(authority_end);
    let (userinfo, host_port) = match authority.rsplit_once('@') {
        Some((userinfo, host_port)) => (userinfo, host_port),
        None => ("", authority),
    };
    let (username, password) = userinfo.split_once(':').unwrap_or((userinfo, ""));
    let (host, port) = if host_port.starts_with('[') {
        let end = host_port.find(']')?;
        let port = host_port[end + 1..].strip_prefix(':').unwrap_or("");
        (&host_port[..=end], port)
    } else {
        host_port.rsplit_once(':').unwrap_or((host_port, ""))
    };
    let path = tail.split(['?', '#']).next().unwrap_or("");
    Some(DatabaseConfig {
        host: host.to_string(),
        port: if port.is_empty() {
            "5432".into()
        } else {
            port.to_string()
        },
        database: path.strip_prefix('/').unwrap_or(path).to_string(),
        username: username.to_string(),
        password: password.to_string(),
    })
}

/// Dossier des sauvegardes, créé au besoin (repli sur /tmp/backups comme
/// ensureBackupDirectory au démarrage de Node)
async fn backup_dir(state: &AppState) -> PathBuf {
    let dir = state.config.backup_dir.clone();
    if tokio::fs::create_dir_all(&dir).await.is_ok() {
        return dir;
    }
    let fallback = PathBuf::from("/tmp/backups");
    let _ = tokio::fs::create_dir_all(&fallback).await;
    fallback
}

/// getBackupList : les dix plus récentes ; une erreur donne une liste vide
async fn list(State(state): State<AppState>, user: CurrentUser) -> ApiResult {
    admin_only(&user)?;
    let backups: Vec<DatabaseBackupsRow> =
        sqlx::query_as(&DatabaseBackupsRow::select("ORDER BY created_at DESC LIMIT $1"))
            .bind(MAX_BACKUPS)
            .fetch_all(&state.db)
            .await
            .unwrap_or_else(|error| {
                tracing::error!(%error, "liste des sauvegardes");
                Vec::new()
            });
    Ok(Json(backups).into_response())
}

async fn create(State(state): State<AppState>, user: CurrentUser) -> ApiResult {
    admin_only(&user)?;
    let backup = create_backup(&state, "manual", user.id())
        .await
        .or_500("Failed to create backup")?;
    Ok(Json(backup).into_response())
}

/// backupService.createBackup : ligne « creating », pg_dump, puis taille et
/// nombre de tables, et ménage des anciennes sauvegardes
async fn create_backup(state: &AppState, kind: &str, created_by: &str) -> anyhow::Result<DatabaseBackupsRow> {
    let now = Utc::now();
    let id = nanoid();
    let filename = backup_filename(kind, &now);
    let dir = backup_dir(state).await;
    let filepath = dir.join(&filename);
    let label = if kind == "manual" { "Manuel" } else { "Automatique" };

    let mut row = Parsed::new();
    row.insert("id".into(), Value::String(id.clone()));
    row.insert("filename".into(), Value::String(filename.clone()));
    // toLocaleDateString('fr-FR') : JJ/MM/AAAA (serveur en UTC)
    row.insert(
        "description".into(),
        Value::String(format!("{label} backup du {}", now.format("%d/%m/%Y"))),
    );
    row.insert("size".into(), json!(0));
    row.insert("createdBy".into(), Value::String(created_by.to_string()));
    row.insert("tablesCount".into(), json!(0));
    row.insert("status".into(), json!("creating"));
    row.insert("backupType".into(), Value::String(kind.to_string()));
    db::insert::<DatabaseBackupsRow>(&state.db, &row).await?;

    let config = database_config(&state.config.database_url)
        .ok_or_else(|| anyhow::anyhow!("DATABASE_URL illisible"))?;
    run_pg_dump(&config, &filepath).await?;

    let size = tokio::fs::metadata(&filepath).await?.len() as i64;
    let (tables_count,): (i32,) = sqlx::query_as(
        "SELECT count(*)::int AS count
           FROM information_schema.tables
          WHERE table_type = 'BASE TABLE'
            AND table_schema NOT IN ('pg_catalog', 'information_schema')",
    )
    .fetch_one(&state.db)
    .await?;
    let updated: DatabaseBackupsRow = sqlx::query_as(&format!(
        "UPDATE database_backups SET size = $1, tables_count = $2, status = 'completed' WHERE id = $3 RETURNING {}",
        DatabaseBackupsRow::COLUMNS
    ))
    .bind(size)
    .bind(tables_count)
    .bind(&id)
    .fetch_one(&state.db)
    .await?;
    tracing::info!(%filename, size, tables_count, "sauvegarde {kind} créée");

    clean_old_backups(state, &dir).await;
    Ok(updated)
}

/// pg_dump -h … -p … -U … -d … --no-password --verbose --clean --if-exists
/// --create > fichier, sans shell ; mot de passe par PGPASSWORD
async fn run_pg_dump(config: &DatabaseConfig, filepath: &FsPath) -> anyhow::Result<()> {
    let mut command = tokio::process::Command::new("pg_dump");
    command
        .args(["-h", &config.host, "-p", &config.port, "-U", &config.username])
        .args(["-d", &config.database])
        .args(["--no-password", "--verbose", "--clean", "--if-exists", "--create"])
        .env("PGPASSWORD", &config.password);
    run_to_file(command, filepath).await
}

/// Lance la commande, sa sortie standard dans le fichier (créé ou vidé, comme
/// « > fichier »), et attend sa fin ; erreur si elle échoue
async fn run_to_file(mut command: tokio::process::Command, filepath: &FsPath) -> anyhow::Result<()> {
    let file = tokio::fs::File::create(filepath).await?.into_std().await;
    // spawn puis wait_with_output : output() de tokio remplacerait la sortie
    // standard configurée par un tube
    let child = command
        .stdin(Stdio::null())
        .stdout(Stdio::from(file))
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .spawn()?;
    let result = child.wait_with_output().await?;
    if !result.status.success() {
        anyhow::bail!(
            "{:?} a échoué ({}) : {}",
            command.as_std().get_program(),
            result.status,
            String::from_utf8_lossy(&result.stderr)
                .lines()
                .last()
                .unwrap_or("")
        );
    }
    Ok(())
}

/// cleanOldBackups : au-delà des dix plus récentes, fichier et ligne supprimés ;
/// les erreurs sont seulement journalisées
async fn clean_old_backups(state: &AppState, dir: &FsPath) {
    // Toute la liste, triée comme Node, puis tout ce qui suit les dix premières
    let all: Result<Vec<(String,)>, sqlx::Error> =
        sqlx::query_as("SELECT filename FROM database_backups ORDER BY created_at DESC")
            .fetch_all(&state.db)
            .await;
    match all {
        Ok(all) => {
            let old = all.get(MAX_BACKUPS as usize..).unwrap_or_default();
            for (filename,) in old {
                if let Err(error) = delete_backup(state, dir, filename).await {
                    tracing::error!(%error, %filename, "suppression d'une ancienne sauvegarde");
                    return;
                }
            }
            if !old.is_empty() {
                tracing::info!(count = old.len(), "anciennes sauvegardes supprimées");
            }
        }
        Err(error) => tracing::error!(%error, "ménage des sauvegardes"),
    }
}

/// backupService.deleteBackup : la ligne doit exister ; fichier puis lignes supprimés
async fn delete_backup(state: &AppState, dir: &FsPath, filename: &str) -> anyhow::Result<()> {
    let found: Option<(String,)> =
        sqlx::query_as("SELECT id FROM database_backups WHERE filename = $1 LIMIT 1")
            .bind(filename)
            .fetch_optional(&state.db)
            .await?;
    if found.is_none() {
        anyhow::bail!("Backup record not found");
    }
    // BACKUP-09 : jamais de fichier hors du dossier des sauvegardes
    if is_plain_name(filename) {
        let filepath = dir.join(filename);
        // fs.existsSync suit les liens symboliques
        if tokio::fs::metadata(&filepath).await.is_ok() {
            tokio::fs::remove_file(&filepath).await?;
        }
    }
    sqlx::query("DELETE FROM database_backups WHERE filename = $1")
        .bind(filename)
        .execute(&state.db)
        .await?;
    Ok(())
}

async fn remove(State(state): State<AppState>, user: CurrentUser, Path(filename): Path<String>) -> ApiResult {
    const FAILED: &str = "Failed to delete backup";
    admin_only(&user)?;
    if !is_plain_name(&filename) {
        return Err(AppError::internal(FAILED));
    }
    let dir = backup_dir(&state).await;
    delete_backup(&state, &dir, &filename).await.or_500(FAILED)?;
    Ok(Json(json!({ "message": "Backup deleted successfully" })).into_response())
}

/// res.download(fichier, nom) : fichier joint, type selon l'extension (paquet
/// send), ETag faible taille-date, 304 si le navigateur l'a déjà
async fn download(
    State(state): State<AppState>,
    user: CurrentUser,
    method: Method,
    headers: HeaderMap,
    Path(filename): Path<String>,
) -> ApiResult {
    const FAILED: &str = "Failed to download backup";
    admin_only(&user)?;
    if !is_plain_name(&filename) {
        return Err(AppError::internal(FAILED));
    }
    let filepath = backup_dir(&state).await.join(&filename);
    // fs.existsSync : absent → 500 ; dossier ou fichier caché refusé par send → 404
    let metadata = tokio::fs::metadata(&filepath)
        .await
        .map_err(|_| AppError::internal(FAILED))?;
    let not_found = || AppError::not_found("Backup file not found");
    if !metadata.is_file() || filename.starts_with('.') {
        return Err(not_found());
    }
    let modified = metadata.modified().map_err(|_| not_found())?;
    let mtime_ms = modified
        .duration_since(UNIX_EPOCH)
        .map_err(|_| not_found())?
        .as_millis();
    let etag = format!("W/\"{:x}-{:x}\"", metadata.len(), mtime_ms);
    let last_modified = DateTime::<Utc>::from(modified)
        .format("%a, %d %b %Y %H:%M:%S GMT")
        .to_string();

    let mut response_headers = HeaderMap::new();
    response_headers.insert(
        header::CACHE_CONTROL,
        HeaderValue::from_static("private, no-cache"),
    );
    let disposition = HeaderValue::from_bytes(&content_disposition(&filename)).map_err(|_| not_found())?;
    response_headers.insert(header::CONTENT_DISPOSITION, disposition);
    response_headers.insert(header::ACCEPT_RANGES, HeaderValue::from_static("bytes"));
    if let Ok(value) = HeaderValue::from_str(&last_modified) {
        response_headers.insert(header::LAST_MODIFIED, value);
    }
    if let Ok(value) = HeaderValue::from_str(&etag) {
        response_headers.insert(header::ETAG, value);
    }
    response_headers.insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static(content_type(&filename)),
    );
    if is_fresh(&headers, &etag, &modified) {
        return Ok((StatusCode::NOT_MODIFIED, response_headers).into_response());
    }
    response_headers.insert(header::CONTENT_LENGTH, HeaderValue::from(metadata.len()));
    if method == Method::HEAD {
        return Ok((StatusCode::OK, response_headers).into_response());
    }
    let content = tokio::fs::read(&filepath).await.map_err(|_| not_found())?;
    Ok((StatusCode::OK, response_headers, Body::from(content)).into_response())
}

/// Type du paquet mime 1.x utilisé par send (sauvegardes : .sql)
fn content_type(filename: &str) -> &'static str {
    match filename
        .rsplit_once('.')
        .map(|(_, ext)| ext.to_ascii_lowercase())
        .as_deref()
    {
        Some("sql") => "application/x-sql",
        Some("gz") => "application/gzip",
        Some("txt") => "text/plain; charset=UTF-8",
        Some("json") => "application/json; charset=UTF-8",
        _ => "application/octet-stream",
    }
}

/// Paquet « fresh » d'Express : If-None-Match, sinon If-Modified-Since
fn is_fresh(request: &HeaderMap, etag: &str, modified: &std::time::SystemTime) -> bool {
    let cache_control = request
        .get(header::CACHE_CONTROL)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    if cache_control.contains("no-cache") {
        return false;
    }
    if let Some(none_match) = request.get(header::IF_NONE_MATCH).and_then(|v| v.to_str().ok()) {
        let bare = etag.trim_start_matches("W/");
        return none_match.trim() == "*"
            || none_match
                .split(',')
                .any(|candidate| candidate.trim().trim_start_matches("W/") == bare);
    }
    if let Some(since) = request
        .get(header::IF_MODIFIED_SINCE)
        .and_then(|v| v.to_str().ok())
        .and_then(|since| DateTime::parse_from_rfc2822(since).ok())
    {
        return DateTime::<Utc>::from(*modified).timestamp() <= since.timestamp();
    }
    false
}

/// Paquet content-disposition : attachment; filename="…" (texte latin-1, « ? »
/// pour le reste) et filename*=UTF-8''… quand le nom n'est pas en latin-1 ou
/// contient une séquence %XX. Octets latin-1 : la valeur de l'en-tête tel que
/// Node l'écrit.
fn content_disposition(filename: &str) -> Vec<u8> {
    let is_latin1_text = filename
        .chars()
        .all(|c| matches!(c as u32, 0x20..=0x7e | 0x80..=0xff));
    // Une unité UTF-16 hors latin-1 devient « ? » (deux pour un caractère astral)
    let fallback: String = filename
        .chars()
        .flat_map(|c| match c as u32 {
            0x20..=0x7e | 0xa0..=0xff => vec![c],
            _ => vec!['?'; c.len_utf16()],
        })
        .collect();
    let has_fallback = fallback != filename;
    let has_hex_escape = filename
        .as_bytes()
        .windows(3)
        .any(|w| w[0] == b'%' && w[1].is_ascii_hexdigit() && w[2].is_ascii_hexdigit());

    let mut out: Vec<u8> = b"attachment".to_vec();
    if is_latin1_text || has_fallback {
        let name = if has_fallback { &fallback } else { filename };
        out.extend_from_slice(b"; filename=\"");
        for c in name.chars() {
            if c == '\\' || c == '"' {
                out.push(b'\\');
            }
            // Caractères latin-1 : un octet chacun
            out.push(c as u32 as u8);
        }
        out.push(b'"');
    }
    if has_fallback || !is_latin1_text || has_hex_escape {
        out.extend_from_slice(b"; filename*=UTF-8''");
        for byte in filename.bytes() {
            let keep = byte.is_ascii_alphanumeric() || b"-_.!~".contains(&byte);
            if keep {
                out.push(byte);
            } else {
                out.extend_from_slice(format!("%{byte:02X}").as_bytes());
            }
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    #[test]
    fn noms_de_fichier_acceptes() {
        assert!(is_plain_name("backup_manual_2026-10-15T08-30-00-123Z.sql"));
        assert!(is_plain_name("été x.sql"));
        assert!(!is_plain_name("../etc/passwd"));
        assert!(!is_plain_name(".."));
        assert!(!is_plain_name("."));
        assert!(!is_plain_name("a/b.sql"));
        assert!(!is_plain_name("a\\b.sql"));
        assert!(!is_plain_name(""));
    }

    #[test]
    fn nom_et_identifiant_comme_node() {
        let now = Utc.timestamp_millis_opt(1_792_151_360_449).unwrap();
        assert_eq!(
            backup_filename("manual", &now),
            "backup_manual_2026-10-16T11-49-20-449Z.sql"
        );
        let id = nanoid();
        assert_eq!(id.len(), 21);
        assert!(
            id.chars()
                .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
        );
    }

    #[test]
    fn parametres_de_connexion_comme_new_url() {
        assert_eq!(
            database_config("postgres://logiflow_admin:bench@localhost:5432/bench_lot5_droite"),
            Some(DatabaseConfig {
                host: "localhost".into(),
                port: "5432".into(),
                database: "bench_lot5_droite".into(),
                username: "logiflow_admin".into(),
                password: "bench".into(),
            })
        );
        let config = database_config("postgresql://u:p%40ss@db/logiflow?sslmode=disable").unwrap();
        assert_eq!(
            (
                config.host.as_str(),
                config.port.as_str(),
                config.database.as_str(),
                config.password.as_str()
            ),
            ("db", "5432", "logiflow", "p%40ss")
        );
    }

    #[tokio::test]
    async fn sortie_de_la_commande_ecrite_dans_le_fichier() {
        let dir = std::env::temp_dir().join(format!("logiflow-test-{}", nanoid()));
        tokio::fs::create_dir_all(&dir).await.unwrap();
        let filepath = dir.join("sortie.sql");
        let mut command = tokio::process::Command::new("sh");
        command.args(["-c", "echo '-- dump'; echo 'journal' >&2"]);
        run_to_file(command, &filepath).await.unwrap();
        assert_eq!(tokio::fs::read_to_string(&filepath).await.unwrap(), "-- dump\n");

        let mut failing = tokio::process::Command::new("sh");
        failing.args(["-c", "echo 'connexion refusée' >&2; exit 1"]);
        let error = run_to_file(failing, &filepath).await.unwrap_err();
        assert!(error.to_string().contains("connexion refusée"));
        tokio::fs::remove_dir_all(&dir).await.unwrap();
    }

    #[test]
    fn en_tete_de_piece_jointe_comme_node() {
        // Valeurs du paquet content-disposition (Node)
        let header = |name: &str| String::from_utf8_lossy(&content_disposition(name)).to_string();
        assert_eq!(
            header("backup_banc_1.sql"),
            "attachment; filename=\"backup_banc_1.sql\""
        );
        assert_eq!(header("a\"b.sql"), "attachment; filename=\"a\\\"b.sql\"");
        assert_eq!(
            header("日本.sql"),
            "attachment; filename=\"??.sql\"; filename*=UTF-8''%E6%97%A5%E6%9C%AC.sql"
        );
        assert_eq!(
            header("100%25.sql"),
            "attachment; filename=\"100%25.sql\"; filename*=UTF-8''100%2525.sql"
        );
        // « é » part en un octet latin-1, comme Node
        assert_eq!(
            content_disposition("été.sql"),
            b"attachment; filename=\"\xe9t\xe9.sql\"".to_vec()
        );
    }
}
