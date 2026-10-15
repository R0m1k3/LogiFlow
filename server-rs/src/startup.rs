// Migrations de démarrage, reprises de server/migrations.production.ts et du CMD
// de l'ancien Dockerfile : toutes idempotentes (IF NOT EXISTS), une erreur est
// journalisée sans empêcher le démarrage, comme dans Node. Les index de
// performance se créent ensuite en arrière-plan (CREATE INDEX CONCURRENTLY).

use std::collections::HashSet;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Instant;

use sqlx::{PgPool, Row};

/// Schéma attendu par le code : colonnes et tables ajoutées depuis init.sql
const SCHEMA_STATEMENTS: &[(&str, &str)] = &[
    (
        "colonne priority des tickets SAV",
        "ALTER TABLE sav_tickets ADD COLUMN IF NOT EXISTS priority varchar(50) NOT NULL DEFAULT 'normale'",
    ),
    (
        "rupture de stock des DLC",
        "ALTER TABLE dlc_products ADD COLUMN IF NOT EXISTS stock_epuise boolean DEFAULT false NOT NULL,
           ADD COLUMN IF NOT EXISTS stock_epuise_by varchar(255),
           ADD COLUMN IF NOT EXISTS stock_epuise_at timestamp",
    ),
    (
        "index de rupture de stock des DLC",
        "CREATE INDEX IF NOT EXISTS idx_dlc_products_stock_epuise ON dlc_products(stock_epuise)",
    ),
    (
        "client prévenu des commandes clients",
        "ALTER TABLE customer_orders ADD COLUMN IF NOT EXISTS notified_at TIMESTAMP,
           ADD COLUMN IF NOT EXISTS notified_comment TEXT",
    ),
    (
        "code fournisseur",
        "ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS codefou VARCHAR",
    ),
    (
        "coordonnées et SMTP des magasins",
        "ALTER TABLE groups ADD COLUMN IF NOT EXISTS address TEXT,
           ADD COLUMN IF NOT EXISTS phone VARCHAR(50),
           ADD COLUMN IF NOT EXISTS logo TEXT,
           ADD COLUMN IF NOT EXISTS smtp_enabled BOOLEAN DEFAULT false,
           ADD COLUMN IF NOT EXISTS smtp_host VARCHAR(255),
           ADD COLUMN IF NOT EXISTS smtp_port INTEGER,
           ADD COLUMN IF NOT EXISTS smtp_secure BOOLEAN DEFAULT false,
           ADD COLUMN IF NOT EXISTS smtp_user VARCHAR(255),
           ADD COLUMN IF NOT EXISTS smtp_password VARCHAR(255),
           ADD COLUMN IF NOT EXISTS smtp_sender_email VARCHAR(255),
           ADD COLUMN IF NOT EXISTS smtp_sender_name VARCHAR(255)",
    ),
    (
        "historique des courriels fournisseurs",
        "CREATE TABLE IF NOT EXISTS supplier_mail_logs (
           id SERIAL PRIMARY KEY,
           delivery_id INTEGER NOT NULL,
           group_id INTEGER NOT NULL,
           supplier_id INTEGER,
           supplier_name VARCHAR(255),
           sent_to VARCHAR(255) NOT NULL,
           subject TEXT,
           status VARCHAR(20) NOT NULL,
           error_message TEXT,
           message_id VARCHAR(255),
           sent_by VARCHAR NOT NULL,
           sent_by_name VARCHAR(255),
           created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
         )",
    ),
    (
        "index des courriels fournisseurs par livraison",
        "CREATE INDEX IF NOT EXISTS idx_supplier_mail_logs_delivery ON supplier_mail_logs(delivery_id)",
    ),
    (
        "index des courriels fournisseurs par magasin",
        "CREATE INDEX IF NOT EXISTS idx_supplier_mail_logs_group ON supplier_mail_logs(group_id)",
    ),
    (
        "clés de l'API externe",
        "CREATE TABLE IF NOT EXISTS external_api_keys (
           id SERIAL PRIMARY KEY,
           name VARCHAR(100) NOT NULL,
           key_prefix VARCHAR(16) NOT NULL,
           key_hash VARCHAR(64) NOT NULL UNIQUE,
           created_by VARCHAR,
           created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
           last_used_at TIMESTAMP,
           revoked_at TIMESTAMP
         )",
    ),
    (
        "configuration du webhook BAP",
        "CREATE TABLE IF NOT EXISTS webhook_bap_config (
           id SERIAL PRIMARY KEY,
           name VARCHAR(100) NOT NULL DEFAULT 'Configuration BAP',
           webhook_url TEXT NOT NULL,
           description TEXT,
           is_active BOOLEAN NOT NULL DEFAULT true,
           created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
           updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
         )",
    ),
    (
        "sessions de connexion",
        "CREATE TABLE IF NOT EXISTS sessions (
           sid VARCHAR PRIMARY KEY,
           sess JSONB NOT NULL,
           expire TIMESTAMP NOT NULL
         )",
    ),
    (
        "index d'expiration des sessions",
        "CREATE INDEX IF NOT EXISTS \"IDX_session_expire\" ON sessions (expire)",
    ),
];

/// Applique les migrations de schéma, puis chiffre les secrets encore en clair
pub async fn run_migrations(db: &PgPool, encryption_key: &str) {
    if let Err(error) = set_aside_legacy_sessions_table(db).await {
        tracing::error!(%error, "vérification de la table sessions en échec");
    }
    for (label, statement) in SCHEMA_STATEMENTS {
        if let Err(error) = sqlx::query(statement).execute(db).await {
            tracing::error!(%error, "migration « {label} » en échec");
        }
    }
    match encrypt_plain_secrets(db, encryption_key).await {
        Ok(0) => {}
        Ok(count) => tracing::info!(count, "secrets en clair chiffrés"),
        Err(error) => tracing::error!(%error, "chiffrement des secrets en clair en échec"),
    }
    tracing::info!("migrations de démarrage terminées");
}

/// Une base peut porter une table « sessions » d'une autre forme, jamais utilisée
/// (l'ancien serveur gardait les sessions en mémoire) : CREATE TABLE IF NOT EXISTS
/// la laisserait en place et toute connexion échouerait (« column "sid" does not
/// exist »). Elle est renommée, sans rien supprimer, et la bonne table est créée
/// ensuite par SCHEMA_STATEMENTS. Les sessions ne sont que des connexions ouvertes.
async fn set_aside_legacy_sessions_table(db: &PgPool) -> Result<(), sqlx::Error> {
    let (exists, expected_columns): (bool, i64) = sqlx::query_as(
        "SELECT to_regclass('sessions') IS NOT NULL,
                (SELECT count(*) FROM information_schema.columns
                  WHERE table_schema = current_schema() AND table_name = 'sessions'
                    AND column_name IN ('sid', 'sess', 'expire'))",
    )
    .fetch_one(db)
    .await?;
    if !exists || expected_columns == 3 {
        return Ok(());
    }
    let suffix = chrono::Utc::now().format("%Y%m%d%H%M%S");
    let legacy = format!("sessions_ancienne_{suffix}");
    let mut transaction = db.begin().await?;
    sqlx::query(&format!("ALTER TABLE sessions RENAME TO {legacy}"))
        .execute(&mut *transaction)
        .await?;
    // Un index de ce nom sur l'ancienne table empêcherait de le créer sur la nouvelle
    sqlx::query(&format!(
        "ALTER INDEX IF EXISTS \"IDX_session_expire\" RENAME TO \"IDX_session_expire_ancienne_{suffix}\""
    ))
    .execute(&mut *transaction)
    .await?;
    transaction.commit().await?;
    tracing::warn!(table = %legacy, "table sessions d'une autre forme mise de côté");
    Ok(())
}

/// Mots de passe SMTP des magasins et jetons NocoDB encore en clair → enc:v1
async fn encrypt_plain_secrets(db: &PgPool, key: &str) -> Result<usize, sqlx::Error> {
    let mut count = 0;
    let groups: Vec<(i32, String)> = sqlx::query_as(
        "SELECT id, smtp_password FROM groups
          WHERE smtp_password IS NOT NULL AND smtp_password != '' AND smtp_password NOT LIKE 'enc:v1:%'",
    )
    .fetch_all(db)
    .await?;
    for (id, secret) in groups {
        sqlx::query("UPDATE groups SET smtp_password = $1 WHERE id = $2")
            .bind(crate::crypto::encrypt(&secret, key))
            .bind(id)
            .execute(db)
            .await?;
        count += 1;
    }
    let tokens: Vec<(i32, String)> = sqlx::query_as(
        "SELECT id, api_token FROM nocodb_config
          WHERE api_token IS NOT NULL AND api_token != '' AND api_token NOT LIKE 'enc:v1:%'",
    )
    .fetch_all(db)
    .await?;
    for (id, secret) in tokens {
        sqlx::query("UPDATE nocodb_config SET api_token = $1 WHERE id = $2")
            .bind(crate::crypto::encrypt(&secret, key))
            .bind(id)
            .execute(db)
            .await?;
        count += 1;
    }
    Ok(count)
}

struct PerformanceIndex {
    name: &'static str,
    table: &'static str,
    columns: &'static str,
    predicate: Option<&'static str>,
}

const fn index(name: &'static str, table: &'static str, columns: &'static str) -> PerformanceIndex {
    PerformanceIndex {
        name,
        table,
        columns,
        predicate: None,
    }
}

const fn partial(
    name: &'static str,
    table: &'static str,
    columns: &'static str,
    predicate: &'static str,
) -> PerformanceIndex {
    PerformanceIndex {
        name,
        table,
        columns,
        predicate: Some(predicate),
    }
}

/// Index de performance garantis à chaque démarrage (même liste que Node)
const PERFORMANCE_INDEXES: &[PerformanceIndex] = &[
    index("idx_user_groups_user_id", "user_groups", "user_id"),
    index("idx_user_groups_group_id", "user_groups", "group_id"),
    index("idx_orders_group_id", "orders", "group_id"),
    index("idx_orders_supplier_id", "orders", "supplier_id"),
    index("idx_orders_created_by", "orders", "created_by"),
    index("idx_orders_planned_date", "orders", "planned_date"),
    index(
        "idx_orders_group_planned_date",
        "orders",
        "group_id, planned_date",
    ),
    index("idx_orders_created_at", "orders", "created_at DESC"),
    index("idx_orders_status", "orders", "status"),
    index("idx_orders_group_status", "orders", "group_id, status"),
    index("idx_deliveries_order_id", "deliveries", "order_id"),
    index("idx_deliveries_group_id", "deliveries", "group_id"),
    index("idx_deliveries_supplier_id", "deliveries", "supplier_id"),
    index("idx_deliveries_created_by", "deliveries", "created_by"),
    index("idx_deliveries_scheduled_date", "deliveries", "scheduled_date"),
    index(
        "idx_deliveries_group_scheduled_date",
        "deliveries",
        "group_id, scheduled_date",
    ),
    index("idx_deliveries_created_at", "deliveries", "created_at DESC"),
    partial(
        "idx_deliveries_invoice_reference",
        "deliveries",
        "invoice_reference",
        "invoice_reference IS NOT NULL",
    ),
    index("idx_deliveries_status", "deliveries", "status"),
    index("idx_deliveries_bl_number", "deliveries", "bl_number"),
    index("idx_deliveries_due_date", "deliveries", "due_date"),
    index("idx_deliveries_group_status", "deliveries", "group_id, status"),
    index(
        "idx_deliveries_group_delivered_date",
        "deliveries",
        "group_id, delivered_date",
    ),
    index(
        "idx_reconciliation_comments_delivery_id",
        "reconciliation_comments",
        "delivery_id",
    ),
    index(
        "idx_reconciliation_comments_group_id",
        "reconciliation_comments",
        "group_id",
    ),
    index("idx_contacts_group_id", "contacts", "group_id"),
    index("idx_customer_orders_group_id", "customer_orders", "group_id"),
    index(
        "idx_customer_orders_supplier_id",
        "customer_orders",
        "supplier_id",
    ),
    index(
        "idx_customer_orders_created_at",
        "customer_orders",
        "created_at DESC",
    ),
    index(
        "idx_customer_orders_group_status",
        "customer_orders",
        "group_id, status",
    ),
    partial(
        "idx_customer_orders_pending_calls",
        "customer_orders",
        "group_id, created_at DESC",
        "customer_notified = false",
    ),
    index("idx_dlc_products_group_id", "dlc_products", "group_id"),
    index("idx_dlc_products_supplier_id", "dlc_products", "supplier_id"),
    index("idx_dlc_products_expiry_date", "dlc_products", "expiry_date"),
    index("idx_dlc_products_status", "dlc_products", "status"),
    index(
        "idx_dlc_products_group_status",
        "dlc_products",
        "group_id, status",
    ),
    index(
        "idx_dlc_products_group_expiry",
        "dlc_products",
        "group_id, expiry_date",
    ),
    index("idx_tasks_group_id", "tasks", "group_id"),
    index("idx_tasks_created_by", "tasks", "created_by"),
    index("idx_tasks_due_date", "tasks", "due_date"),
    index("idx_tasks_group_status", "tasks", "group_id, status"),
    index("idx_tasks_group_created", "tasks", "group_id, created_at DESC"),
    index("idx_avoirs_group_id", "avoirs", "group_id"),
    index("idx_avoirs_supplier_id", "avoirs", "supplier_id"),
    index("idx_avoirs_created_at", "avoirs", "created_at DESC"),
    index("idx_avoirs_group_status", "avoirs", "group_id, status"),
    index("idx_sav_tickets_group_id", "sav_tickets", "group_id"),
    index("idx_sav_tickets_supplier_id", "sav_tickets", "supplier_id"),
    index("idx_sav_tickets_created_at", "sav_tickets", "created_at DESC"),
    index("idx_sav_tickets_status", "sav_tickets", "status"),
    index("idx_sav_tickets_priority", "sav_tickets", "priority"),
    index("idx_sav_tickets_group_status", "sav_tickets", "group_id, status"),
    index(
        "idx_sav_tickets_group_created",
        "sav_tickets",
        "group_id, created_at DESC",
    ),
    index(
        "idx_invoice_cache_expires_at",
        "invoice_verification_cache",
        "expires_at",
    ),
    index(
        "idx_invoice_cache_group_id",
        "invoice_verification_cache",
        "group_id",
    ),
    index(
        "idx_publicity_participations_group_id",
        "publicity_participations",
        "group_id",
    ),
    index("idx_publicities_year", "publicities", "year"),
    index("idx_publicities_start_date", "publicities", "start_date"),
    index(
        "idx_dashboard_messages_store_id",
        "dashboard_messages",
        "store_id",
    ),
    index(
        "idx_dashboard_messages_created_at",
        "dashboard_messages",
        "created_at DESC",
    ),
    index("idx_weather_data_date_location", "weather_data", "date, location"),
    index(
        "idx_weather_data_date_year",
        "weather_data",
        "date, is_current_year",
    ),
    index(
        "idx_supplier_mail_logs_delivery",
        "supplier_mail_logs",
        "delivery_id",
    ),
    index("idx_supplier_mail_logs_group", "supplier_mail_logs", "group_id"),
    index(
        "idx_supplier_mail_logs_group_created",
        "supplier_mail_logs",
        "group_id, created_at DESC",
    ),
];

static INDEXES_RUNNING: AtomicBool = AtomicBool::new(false);

/// Lance la création des index manquants en arrière-plan : ni le démarrage ni le
/// contrôle de santé ne l'attendent. Un seul passage à la fois.
pub fn spawn_performance_indexes(db: PgPool) {
    if INDEXES_RUNNING.swap(true, Ordering::SeqCst) {
        return;
    }
    tokio::spawn(async move {
        if let Err(error) = ensure_performance_indexes(&db).await {
            tracing::error!(%error, "vérification des index en échec");
        }
        INDEXES_RUNNING.store(false, Ordering::SeqCst);
    });
}

async fn ensure_performance_indexes(db: &PgPool) -> Result<(), sqlx::Error> {
    let started = Instant::now();

    // 1. Une création CONCURRENTLY interrompue laisse un index invalide, que IF NOT
    //    EXISTS prendrait pour présent : purge des reliquats (sauf en construction)
    let invalid: Vec<(String,)> = sqlx::query_as(
        "SELECT c.relname::text
           FROM pg_index i
           JOIN pg_class c ON c.oid = i.indexrelid
           JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE NOT i.indisvalid AND n.nspname = 'public' AND c.relname LIKE 'idx_%'
            AND NOT EXISTS (SELECT 1 FROM pg_stat_progress_create_index p WHERE p.index_relid = i.indexrelid)",
    )
    .fetch_all(db)
    .await
    .unwrap_or_default();
    for (name,) in invalid {
        let statement = format!(
            "DROP INDEX CONCURRENTLY IF EXISTS public.\"{}\"",
            name.replace('"', "\"\"")
        );
        if let Err(error) = sqlx::query(&statement).execute(db).await {
            tracing::warn!(%error, index = %name, "index invalide non supprimé");
        }
    }

    // 2. Tables présentes, index valides par nom, colonnes déjà indexées sous un autre nom
    let tables: HashSet<String> = sqlx::query(
        "SELECT c.relname::text AS name FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')",
    )
    .fetch_all(db)
    .await?
    .iter()
    .map(|row| row.get("name"))
    .collect();
    let indexes = sqlx::query(
        "SELECT t.relname::text AS table_name, c.relname::text AS index_name, i.indisvalid AS valid,
                (i.indpred IS NULL AND i.indexprs IS NULL) AS plain,
                array_to_string(ARRAY(
                  SELECT a.attname FROM unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord)
                  JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum
                  WHERE k.ord <= i.indnkeyatts ORDER BY k.ord
                ), ',') AS columns
           FROM pg_index i
           JOIN pg_class c ON c.oid = i.indexrelid
           JOIN pg_class t ON t.oid = i.indrelid
           JOIN pg_namespace n ON n.oid = t.relnamespace
          WHERE n.nspname = 'public'",
    )
    .fetch_all(db)
    .await?;
    let mut existing = HashSet::new();
    let mut invalid_names = HashSet::new();
    let mut indexed_columns = HashSet::new();
    for row in &indexes {
        let name: String = row.get("index_name");
        if !row.get::<bool, _>("valid") {
            invalid_names.insert(name);
            continue;
        }
        existing.insert(name);
        if row.get::<bool, _>("plain") {
            let table: String = row.get("table_name");
            let columns: String = row.get("columns");
            indexed_columns.insert(format!("{table}({columns})"));
        }
    }

    // 3. Index manquants, une requête chacun (CONCURRENTLY interdit en transaction)
    let (mut created, mut present, mut skipped, mut failed) = (0, 0, 0, Vec::new());
    let mut to_analyze = Vec::new();
    for index in PERFORMANCE_INDEXES {
        let key_columns: Vec<&str> = index
            .columns
            .split(',')
            .map(|column| column.split_whitespace().next().unwrap_or(""))
            .collect();
        if existing.contains(index.name)
            || indexed_columns.contains(&format!("{}({})", index.table, key_columns.join(",")))
        {
            present += 1;
            continue;
        }
        if !tables.contains(index.table) {
            skipped += 1;
            continue;
        }
        if invalid_names.contains(index.name) {
            failed.push(index.name);
            continue;
        }
        let mut statement = format!(
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS {} ON {} ({})",
            index.name, index.table, index.columns
        );
        if let Some(predicate) = index.predicate {
            statement.push_str(&format!(" WHERE {predicate}"));
        }
        match sqlx::query(&statement).execute(db).await {
            Ok(_) => {
                created += 1;
                if !to_analyze.contains(&index.table) {
                    to_analyze.push(index.table);
                }
            }
            Err(error) => {
                tracing::warn!(%error, index = index.name, "création d'index en échec");
                failed.push(index.name);
            }
        }
    }

    // 4. Statistiques à jour pour que le planificateur utilise les nouveaux index
    for table in to_analyze {
        if let Err(error) = sqlx::query(&format!("ANALYZE {table}")).execute(db).await {
            tracing::warn!(%error, table, "ANALYZE en échec");
        }
    }
    tracing::info!(
        created,
        present,
        skipped,
        failed = failed.len(),
        seconds = started.elapsed().as_secs_f32(),
        "index de performance vérifiés"
    );
    Ok(())
}
