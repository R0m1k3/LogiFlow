// Administration : diagnostic du schéma (GET /api/debug/log-schema et
// /api/debug/download-schema, réservés à l'administrateur et à la production),
// exécution de SQL (sql.rs) et adresses de secours (emergency.rs : migration
// d'urgence, réinitialisation du compte admin).

use axum::extract::State;
use axum::http::{HeaderValue, StatusCode, header};
use axum::response::IntoResponse;
use axum::{Json, Router, routing::get, routing::post};
use serde_json::json;

use crate::AppState;
use crate::auth::CurrentUser;
use crate::error::{ApiResult, AppError};
use crate::http::express_etag;
use crate::js;

mod emergency;
mod sql;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/debug/log-schema", get(log_schema))
        .route("/api/debug/download-schema", get(download_schema))
        .route("/api/admin/execute-sql", post(sql::execute_sql))
        .route(
            "/api/admin/emergency-migration",
            post(emergency::emergency_migration),
        )
        .route(
            "/api/emergency-admin-reset",
            post(emergency::emergency_admin_reset),
        )
}

const RULE: &str = "===============================================";

#[derive(sqlx::FromRow)]
struct Column {
    column_name: String,
    data_type: String,
    character_maximum_length: Option<i32>,
    is_nullable: String,
    column_default: Option<String>,
}

struct Table {
    name: String,
    columns: Vec<Column>,
    /// Nombre de lignes, ou message de l'erreur de comptage
    count: Result<i64, String>,
}

#[derive(sqlx::FromRow)]
struct ForeignKey {
    table_name: String,
    column_name: String,
    foreign_table_name: String,
    foreign_column_name: String,
}

/// Tables du schéma public, leurs colonnes et leur nombre de lignes, puis les
/// clés étrangères : mêmes requêtes que Node
async fn scan(db: &sqlx::PgPool) -> Result<(Vec<Table>, Vec<ForeignKey>), sqlx::Error> {
    let names: Vec<(String,)> = sqlx::query_as(
        "SELECT table_name::text
           FROM information_schema.tables
          WHERE table_schema = 'public'
          ORDER BY table_name",
    )
    .fetch_all(db)
    .await?;
    let mut tables = Vec::with_capacity(names.len());
    for (name,) in names {
        let columns: Vec<Column> = sqlx::query_as(
            "SELECT column_name::text, data_type::text, character_maximum_length::int,
                    is_nullable::text, column_default::text
               FROM information_schema.columns
              WHERE table_schema = 'public'
                AND table_name = $1
              ORDER BY ordinal_position",
        )
        .bind(&name)
        .fetch_all(db)
        .await?;
        let count = if columns.is_empty() {
            Ok(0)
        } else {
            // Nom lu dans le catalogue, entre guillemets comme dans Node
            sqlx::query_as::<_, (i64,)>(&format!(
                "SELECT COUNT(*) AS total FROM \"{}\"",
                name.replace('"', "\"\"")
            ))
            .fetch_one(db)
            .await
            .map(|(total,)| total)
            .map_err(|error| match error {
                sqlx::Error::Database(database) => database.message().to_string(),
                other => other.to_string(),
            })
        };
        tables.push(Table { name, columns, count });
    }
    let foreign_keys: Vec<ForeignKey> = sqlx::query_as(
        "SELECT
           tc.table_name::text,
           kcu.column_name::text,
           ccu.table_name::text AS foreign_table_name,
           ccu.column_name::text AS foreign_column_name,
           tc.constraint_name::text
         FROM information_schema.table_constraints AS tc
         JOIN information_schema.key_column_usage AS kcu
           ON tc.constraint_name = kcu.constraint_name
           AND tc.table_schema = kcu.table_schema
         JOIN information_schema.constraint_column_usage AS ccu
           ON ccu.constraint_name = tc.constraint_name
           AND ccu.table_schema = tc.table_schema
         WHERE tc.constraint_type = 'FOREIGN KEY'
           AND tc.table_schema = 'public'
         ORDER BY tc.table_name, kcu.column_name",
    )
    .fetch_all(db)
    .await?;
    Ok((tables, foreign_keys))
}

/// `   01. nom_de_colonne              : type(255) NULL DEFAULT …`
fn column_line(index: usize, column: &Column) -> String {
    let padding = 25usize.saturating_sub(js::length(&column.column_name));
    let max_length = match column.character_maximum_length {
        Some(length) if length != 0 => format!("({length})"),
        _ => String::new(),
    };
    let nullable = if column.is_nullable == "YES" {
        "NULL"
    } else {
        "NOT NULL"
    };
    let default = match column.column_default.as_deref() {
        Some(default) if !default.is_empty() => format!(" DEFAULT {default}"),
        _ => String::new(),
    };
    format!(
        "   {:02}. {}{} : {}{max_length} {nullable}{default}",
        index + 1,
        column.column_name,
        " ".repeat(padding),
        column.data_type
    )
}

fn count_line(count: &Result<i64, String>) -> String {
    match count {
        Ok(total) => format!("   📈 Nombre d'enregistrements: {total}"),
        Err(message) => format!("   ⚠️  Impossible de compter les enregistrements: {message}"),
    }
}

fn foreign_key_line(fk: &ForeignKey) -> String {
    format!(
        "   {}.{} → {}.{}",
        fk.table_name, fk.column_name, fk.foreign_table_name, fk.foreign_column_name
    )
}

fn check_access(user: &CurrentUser, state: &AppState, denied: &str) -> Result<(), AppError> {
    if !user.is_admin() {
        return Err(AppError::forbidden(denied));
    }
    if state.config.environment != "production" {
        return Err(AppError::with_body(
            StatusCode::BAD_REQUEST,
            json!({ "error": "Cette route fonctionne uniquement en production sur votre serveur privé" }),
        ));
    }
    Ok(())
}

fn scan_error(error: sqlx::Error) -> AppError {
    tracing::error!(%error, "scan du schéma");
    let message = match &error {
        sqlx::Error::Database(database) => database.message().to_string(),
        other => other.to_string(),
    };
    AppError::with_body(StatusCode::INTERNAL_SERVER_ERROR, json!({ "error": message }))
}

/// Écrit le schéma dans le journal du serveur et renvoie un résumé
async fn log_schema(State(state): State<AppState>, user: CurrentUser) -> ApiResult {
    check_access(
        &user,
        &state,
        "Accès refusé. Seuls les administrateurs peuvent utiliser cette route de debug.",
    )?;
    let timestamp = crate::modules::now_iso();
    let (tables, foreign_keys) = scan(&state.db).await.map_err(scan_error)?;

    let mut log = format!(
        "\n🔍 ===== DÉBUT SCAN SCHÉMA BASE DE DONNÉES =====\n⏰ Timestamp: {timestamp}\n\n📊 TOTAL DES TABLES TROUVÉES: {}\n==========================================\n",
        tables.len()
    );
    for table in &tables {
        log.push_str(&format!(
            "\n🔸 TABLE: {}\n{}\n",
            table.name.to_uppercase(),
            "=".repeat(js::length(&table.name) + 8)
        ));
        if !table.columns.is_empty() {
            for (index, column) in table.columns.iter().enumerate() {
                log.push_str(&column_line(index, column));
                log.push('\n');
            }
            log.push_str(&count_line(&table.count));
            log.push('\n');
        }
    }
    log.push_str("\n🔗 CONTRAINTES DE CLÉS ÉTRANGÈRES:\n===================================\n");
    if foreign_keys.is_empty() {
        log.push_str("   Aucune contrainte de clé étrangère trouvée\n");
    }
    for fk in &foreign_keys {
        log.push_str(&foreign_key_line(fk));
        log.push('\n');
    }
    log.push_str("\n🏁 ===== FIN SCAN SCHÉMA BASE DE DONNÉES =====\n");
    tracing::info!("{log}");

    Ok(Json(json!({
        "success": true,
        "message": "Schéma loggé avec succès dans les logs du serveur",
        "totalTables": tables.len(),
        "totalForeignKeys": foreign_keys.len(),
        "timestamp": crate::modules::now_iso(),
        "downloadUrl": "/api/debug/download-schema",
    }))
    .into_response())
}

/// Rapport texte du schéma, en pièce jointe logiflow-schema-AAAA-MM-JJ.txt
async fn download_schema(State(state): State<AppState>, user: CurrentUser) -> ApiResult {
    check_access(
        &user,
        &state,
        "Accès refusé. Seuls les administrateurs peuvent télécharger le rapport de schéma.",
    )?;
    let timestamp = crate::modules::now_iso();
    let mut report = format!(
        "LOGIFLOW - RAPPORT SCHÉMA BASE DE DONNÉES PRODUCTION\n{RULE}\n\nGÉNÉRÉ LE : {timestamp}\nSERVEUR : Production privé LogiFlow\nENVIRONNEMENT : PostgreSQL Docker\nUTILISATEUR : {}\n\n{RULE}\nRÉSUMÉ DU SCAN\n{RULE}\n\n",
        user.user.username
    );
    let (tables, foreign_keys) = scan(&state.db).await.map_err(scan_error)?;

    report.push_str(&format!(
        "TOTAL DES TABLES TROUVÉES: {}\n==========================================\n\n",
        tables.len()
    ));
    for table in &tables {
        report.push_str(&format!(
            "TABLE: {}\n{}\n\n",
            table.name.to_uppercase(),
            "=".repeat(js::length(&table.name) + 6)
        ));
        if !table.columns.is_empty() {
            for (index, column) in table.columns.iter().enumerate() {
                report.push_str(&column_line(index, column));
                report.push('\n');
            }
            report.push_str(&count_line(&table.count));
            report.push_str("\n\n");
        }
    }
    report.push_str("CONTRAINTES DE CLÉS ÉTRANGÈRES:\n===================================\n\n");
    if foreign_keys.is_empty() {
        report.push_str("   Aucune contrainte de clé étrangère trouvée\n");
    }
    for fk in &foreign_keys {
        report.push_str(&foreign_key_line(fk));
        report.push('\n');
    }
    report.push_str(&format!("\n{RULE}\nFIN DU RAPPORT - {timestamp}\n{RULE}"));

    let filename = format!("logiflow-schema-{}.txt", &crate::modules::now_iso()[..10]);
    // res.send calcule l'ETag sur le corps
    let etag = express_etag(report.as_bytes());
    let mut response = report.into_response();
    let headers = response.headers_mut();
    headers.insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static("text/plain; charset=utf-8"),
    );
    if let Ok(value) = HeaderValue::from_str(&format!("attachment; filename=\"{filename}\"")) {
        headers.insert(header::CONTENT_DISPOSITION, value);
    }
    if let Ok(value) = HeaderValue::from_str(&etag) {
        headers.insert(header::ETAG, value);
    }
    Ok(response)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ligne_de_colonne_comme_node() {
        let column = Column {
            column_name: "smtp_password".into(),
            data_type: "character varying".into(),
            character_maximum_length: Some(255),
            is_nullable: "YES".into(),
            column_default: None,
        };
        assert_eq!(
            column_line(21, &column),
            "   22. smtp_password             : character varying(255) NULL"
        );
        let id = Column {
            column_name: "id".into(),
            data_type: "integer".into(),
            character_maximum_length: None,
            is_nullable: "NO".into(),
            column_default: Some("nextval('groups_id_seq'::regclass)".into()),
        };
        assert_eq!(
            column_line(0, &id),
            "   01. id                        : integer NOT NULL DEFAULT nextval('groups_id_seq'::regclass)"
        );
    }
}
