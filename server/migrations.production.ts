import { Client } from 'pg';
import { encryptSecret, isEncryptedSecret } from './crypto.js';
import { pool } from './db.js';

// Index de performance garantis à chaque démarrage.
// Union de migrations/20260814_add_performance_indexes.sql, des index d'init.sql
// et des index composites issus de l'audit base de données (DB-14, DB-15, DB-34,
// DB-35, TASKS-29, SAV-27). Tables et colonnes conformes à shared/schema.ts.
// Volontairement absents : IDX_session_expire (table sessions inutilisée),
// pg_trgm, et l'index unique de user_groups (dédoublonnage préalable requis).
type PerformanceIndex = { name: string; table: string; columns: string; where?: string };

const PERFORMANCE_INDEXES: PerformanceIndex[] = [
  // user_groups : lu à chaque requête authentifiée via getUserWithGroups()
  { name: 'idx_user_groups_user_id', table: 'user_groups', columns: 'user_id' },
  { name: 'idx_user_groups_group_id', table: 'user_groups', columns: 'group_id' },

  // orders
  { name: 'idx_orders_group_id', table: 'orders', columns: 'group_id' },
  { name: 'idx_orders_supplier_id', table: 'orders', columns: 'supplier_id' },
  { name: 'idx_orders_created_by', table: 'orders', columns: 'created_by' },
  { name: 'idx_orders_planned_date', table: 'orders', columns: 'planned_date' },
  { name: 'idx_orders_group_planned_date', table: 'orders', columns: 'group_id, planned_date' },
  { name: 'idx_orders_created_at', table: 'orders', columns: 'created_at DESC' },
  { name: 'idx_orders_status', table: 'orders', columns: 'status' },
  // Comptage des commandes en attente par magasin (statistiques)
  { name: 'idx_orders_group_status', table: 'orders', columns: 'group_id, status' },

  // deliveries : order_id est la clé de jointure la plus sollicitée
  { name: 'idx_deliveries_order_id', table: 'deliveries', columns: 'order_id' },
  { name: 'idx_deliveries_group_id', table: 'deliveries', columns: 'group_id' },
  { name: 'idx_deliveries_supplier_id', table: 'deliveries', columns: 'supplier_id' },
  { name: 'idx_deliveries_created_by', table: 'deliveries', columns: 'created_by' },
  { name: 'idx_deliveries_scheduled_date', table: 'deliveries', columns: 'scheduled_date' },
  { name: 'idx_deliveries_group_scheduled_date', table: 'deliveries', columns: 'group_id, scheduled_date' },
  { name: 'idx_deliveries_created_at', table: 'deliveries', columns: 'created_at DESC' },
  { name: 'idx_deliveries_invoice_reference', table: 'deliveries', columns: 'invoice_reference', where: 'invoice_reference IS NOT NULL' },
  { name: 'idx_deliveries_status', table: 'deliveries', columns: 'status' },
  { name: 'idx_deliveries_bl_number', table: 'deliveries', columns: 'bl_number' },
  { name: 'idx_deliveries_due_date', table: 'deliveries', columns: 'due_date' },
  // Livraisons livrées par magasin (rapprochement, statistiques)
  { name: 'idx_deliveries_group_status', table: 'deliveries', columns: 'group_id, status' },
  { name: 'idx_deliveries_group_delivered_date', table: 'deliveries', columns: 'group_id, delivered_date' },

  // reconciliation_comments
  { name: 'idx_reconciliation_comments_delivery_id', table: 'reconciliation_comments', columns: 'delivery_id' },
  { name: 'idx_reconciliation_comments_group_id', table: 'reconciliation_comments', columns: 'group_id' },

  // contacts
  { name: 'idx_contacts_group_id', table: 'contacts', columns: 'group_id' },

  // customer_orders
  { name: 'idx_customer_orders_group_id', table: 'customer_orders', columns: 'group_id' },
  { name: 'idx_customer_orders_supplier_id', table: 'customer_orders', columns: 'supplier_id' },
  { name: 'idx_customer_orders_created_at', table: 'customer_orders', columns: 'created_at DESC' },
  { name: 'idx_customer_orders_group_status', table: 'customer_orders', columns: 'group_id, status' },
  // Appels clients en attente : même prédicat que getPendingClientCalls()
  { name: 'idx_customer_orders_pending_calls', table: 'customer_orders', columns: 'group_id, created_at DESC', where: 'customer_notified = false' },

  // dlc_products
  { name: 'idx_dlc_products_group_id', table: 'dlc_products', columns: 'group_id' },
  { name: 'idx_dlc_products_supplier_id', table: 'dlc_products', columns: 'supplier_id' },
  { name: 'idx_dlc_products_expiry_date', table: 'dlc_products', columns: 'expiry_date' },
  { name: 'idx_dlc_products_status', table: 'dlc_products', columns: 'status' },
  { name: 'idx_dlc_products_group_status', table: 'dlc_products', columns: 'group_id, status' },
  { name: 'idx_dlc_products_group_expiry', table: 'dlc_products', columns: 'group_id, expiry_date' },

  // tasks
  { name: 'idx_tasks_group_id', table: 'tasks', columns: 'group_id' },
  { name: 'idx_tasks_created_by', table: 'tasks', columns: 'created_by' },
  { name: 'idx_tasks_due_date', table: 'tasks', columns: 'due_date' },
  { name: 'idx_tasks_group_status', table: 'tasks', columns: 'group_id, status' },
  { name: 'idx_tasks_group_created', table: 'tasks', columns: 'group_id, created_at DESC' },

  // avoirs
  { name: 'idx_avoirs_group_id', table: 'avoirs', columns: 'group_id' },
  { name: 'idx_avoirs_supplier_id', table: 'avoirs', columns: 'supplier_id' },
  { name: 'idx_avoirs_created_at', table: 'avoirs', columns: 'created_at DESC' },
  { name: 'idx_avoirs_group_status', table: 'avoirs', columns: 'group_id, status' },

  // sav_tickets
  { name: 'idx_sav_tickets_group_id', table: 'sav_tickets', columns: 'group_id' },
  { name: 'idx_sav_tickets_supplier_id', table: 'sav_tickets', columns: 'supplier_id' },
  { name: 'idx_sav_tickets_created_at', table: 'sav_tickets', columns: 'created_at DESC' },
  { name: 'idx_sav_tickets_status', table: 'sav_tickets', columns: 'status' },
  { name: 'idx_sav_tickets_priority', table: 'sav_tickets', columns: 'priority' },
  { name: 'idx_sav_tickets_group_status', table: 'sav_tickets', columns: 'group_id, status' },
  { name: 'idx_sav_tickets_group_created', table: 'sav_tickets', columns: 'group_id, created_at DESC' },

  // invoice_verification_cache : expires_at sert la purge périodique
  { name: 'idx_invoice_cache_expires_at', table: 'invoice_verification_cache', columns: 'expires_at' },
  { name: 'idx_invoice_cache_group_id', table: 'invoice_verification_cache', columns: 'group_id' },

  // publicity_participations : la clé primaire (publicity_id, group_id) ne couvre pas group_id seul
  { name: 'idx_publicity_participations_group_id', table: 'publicity_participations', columns: 'group_id' },

  // publicities
  { name: 'idx_publicities_year', table: 'publicities', columns: 'year' },
  { name: 'idx_publicities_start_date', table: 'publicities', columns: 'start_date' },

  // dashboard_messages
  { name: 'idx_dashboard_messages_store_id', table: 'dashboard_messages', columns: 'store_id' },
  { name: 'idx_dashboard_messages_created_at', table: 'dashboard_messages', columns: 'created_at DESC' },

  // weather_data
  { name: 'idx_weather_data_date_location', table: 'weather_data', columns: 'date, location' },
  { name: 'idx_weather_data_date_year', table: 'weather_data', columns: 'date, is_current_year' },

  // supplier_mail_logs : historique récent par magasin
  { name: 'idx_supplier_mail_logs_delivery', table: 'supplier_mail_logs', columns: 'delivery_id' },
  { name: 'idx_supplier_mail_logs_group', table: 'supplier_mail_logs', columns: 'group_id' },
  { name: 'idx_supplier_mail_logs_group_created', table: 'supplier_mail_logs', columns: 'group_id, created_at DESC' },
];

let performanceIndexesRunning = false;

/**
 * Crée les index de performance manquants sans verrouiller les tables en écriture.
 *
 * CREATE INDEX CONCURRENTLY est interdit dans une transaction, et pg en ouvre une
 * implicite pour une chaîne de plusieurs instructions : chaque index part donc
 * dans sa propre requête, avec son propre try/catch pour qu'un échec (table
 * absente, etc.) n'empêche pas les suivants.
 */
export async function ensurePerformanceIndexes(): Promise<void> {
  if (!pool) {
    console.warn('⚠️ MIGRATION: No database pool, performance indexes not checked');
    return;
  }

  const startedAt = Date.now();
  console.log('🔄 MIGRATION: Checking performance indexes in background...');

  // 1. Une création CONCURRENTLY interrompue laisse un index invalide, que
  // IF NOT EXISTS considère ensuite comme présent : on purge ces reliquats.
  // Un index en cours de construction (par exemple par le processus d'avant un
  // redémarrage) est lui aussi invalide : on l'écarte via
  // pg_stat_progress_create_index. DROP INDEX CONCURRENTLY ne prend pas de
  // verrou exclusif, donc la purge ne bloque jamais les lectures de l'app.
  try {
    const invalid = await pool.query(`
      SELECT c.relname
      FROM pg_index i
      JOIN pg_class c ON c.oid = i.indexrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE NOT i.indisvalid AND n.nspname = 'public' AND c.relname LIKE 'idx_%'
        AND NOT EXISTS (
          SELECT 1 FROM pg_stat_progress_create_index p WHERE p.index_relid = i.indexrelid
        )
    `);
    for (const row of invalid.rows) {
      const indexName = String(row.relname).replace(/"/g, '""');
      try {
        await pool.query(`DROP INDEX CONCURRENTLY IF EXISTS public."${indexName}"`);
        console.log(`🧹 MIGRATION: Invalid index ${row.relname} dropped`);
      } catch (error) {
        console.warn(`⚠️ MIGRATION: Invalid index ${row.relname} could not be dropped:`, (error as any)?.message);
      }
    }
  } catch (error) {
    console.warn('⚠️ MIGRATION: Invalid indexes purge failed:', (error as any)?.message);
  }

  // 2. État actuel : tables présentes, index par nom (valides ou non) et colonnes
  // déjà indexées sous un autre nom (ex. idx_deliveries_invoice_ref d'init.sql),
  // pour ne pas créer de doublon. En cas d'échec, chaque index est tenté.
  let existingTables: Set<string> | null = null;
  const existingIndexNames = new Set<string>();
  const invalidIndexNames = new Set<string>();
  const indexedColumns = new Set<string>();
  try {
    const tables = await pool.query(`
      SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
    `);
    const indexes = await pool.query(`
      SELECT t.relname AS table_name,
             c.relname AS index_name,
             i.indisvalid AS valid,
             (i.indpred IS NULL AND i.indexprs IS NULL) AS plain,
             array_to_string(ARRAY(
               SELECT a.attname
               FROM unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord)
               JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum
               WHERE k.ord <= i.indnkeyatts
               ORDER BY k.ord
             ), ',') AS columns
      FROM pg_index i
      JOIN pg_class c ON c.oid = i.indexrelid
      JOIN pg_class t ON t.oid = i.indrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public'
    `);
    existingTables = new Set(tables.rows.map((row: any) => row.relname));
    for (const row of indexes.rows) {
      if (!row.valid) {
        invalidIndexNames.add(row.index_name);
        continue;
      }
      existingIndexNames.add(row.index_name);
      if (row.plain) indexedColumns.add(`${row.table_name}(${row.columns})`);
    }
  } catch (error) {
    console.warn('⚠️ MIGRATION: Could not read existing indexes:', (error as any)?.message);
  }

  // 3. Création des index manquants, une requête par index
  let created = 0;
  let present = 0;
  let skipped = 0;
  const failed: string[] = [];
  const tablesToAnalyze = new Set<string>();

  for (const index of PERFORMANCE_INDEXES) {
    // Le sens de tri n'importe pas : un btree se parcourt dans les deux sens
    const keyColumns = index.columns
      .split(',')
      .map((column) => column.trim().split(/\s+/)[0])
      .join(',');
    if (existingIndexNames.has(index.name) || indexedColumns.has(`${index.table}(${keyColumns})`)) {
      present++;
      continue;
    }
    if (existingTables && !existingTables.has(index.table)) {
      skipped++;
      continue;
    }
    // Reliquat invalide que la purge n'a pas pu supprimer : IF NOT EXISTS l'ignorerait
    if (invalidIndexNames.has(index.name)) {
      failed.push(index.name);
      console.warn(`⚠️ MIGRATION: Index ${index.name} is invalid and could not be purged`);
      continue;
    }

    try {
      await pool.query(
        `CREATE INDEX CONCURRENTLY IF NOT EXISTS ${index.name} ON ${index.table} (${index.columns})` +
          (index.where ? ` WHERE ${index.where}` : '')
      );
      created++;
      tablesToAnalyze.add(index.table);
      console.log(`✅ MIGRATION: Index ${index.name} created`);
    } catch (error) {
      failed.push(index.name);
      console.warn(`⚠️ MIGRATION: Index ${index.name} failed:`, (error as any)?.message);
    }
  }

  // 4. Statistiques à jour pour que le planificateur utilise les nouveaux index
  // sans attendre le prochain autovacuum
  for (const table of tablesToAnalyze) {
    try {
      await pool.query(`ANALYZE ${table}`);
    } catch (error) {
      console.warn(`⚠️ MIGRATION: ANALYZE ${table} failed:`, (error as any)?.message);
    }
  }

  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(
    `📊 MIGRATION: Performance indexes: ${created} created, ${present} already present, ` +
      `${skipped} skipped (missing table), ${failed.length} failed in ${seconds}s` +
      (failed.length > 0 ? ` (${failed.join(', ')})` : '')
  );
}

// Lance la vérification des index en tâche de fond : ni le démarrage ni le
// healthcheck n'attendent la fin des créations. La route d'urgence pouvant
// relancer les migrations, un seul passage à la fois.
function startPerformanceIndexes(): void {
  if (performanceIndexesRunning) return;
  performanceIndexesRunning = true;
  ensurePerformanceIndexes()
    .catch((error) => console.error('❌ MIGRATION ERROR: Performance indexes check failed:', error))
    .finally(() => {
      performanceIndexesRunning = false;
    });
}

export async function runProductionMigrations() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ MIGRATION: DATABASE_URL not found for migrations');
    return;
  }

  console.log('🔄 MIGRATION: Starting SAV production migrations...');
  console.log('🔄 MIGRATION: Database URL configured:', databaseUrl.substring(0, 30) + '...');
  
  const client = new Client({
    connectionString: databaseUrl,
    ssl: false, // No SSL for local Docker
  });
  
  try {
    await client.connect();
    console.log('✅ MIGRATION: Connected to PostgreSQL database');
    
    console.log('🔄 MIGRATION: Checking if priority column exists...');
    
    // Vérifier si la colonne priority existe
    const checkPriorityColumn = await client.query(`
      SELECT 1 FROM information_schema.columns 
      WHERE table_name='sav_tickets' AND column_name='priority'
    `);

    console.log('🔄 MIGRATION: Priority column check result:', checkPriorityColumn.rows.length);

    if (checkPriorityColumn.rows.length === 0) {
      console.log('📝 MIGRATION: Priority column missing, adding it now...');
      
      // Ajouter seulement la colonne priority manquante
      await client.query(`
        ALTER TABLE sav_tickets ADD COLUMN priority varchar(50) NOT NULL DEFAULT 'normale';
      `);
      console.log('✅ MIGRATION: Priority column added successfully!');

      // Créer les index pour optimiser les performances
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_sav_tickets_priority ON sav_tickets(priority);
      `);
      console.log('✅ MIGRATION: Priority index created successfully!');

      // Vérification finale
      const verificationResult = await client.query(`
        SELECT 
          COUNT(*) as total_records,
          COUNT(CASE WHEN priority IS NOT NULL THEN 1 END) as records_with_priority
        FROM sav_tickets;
      `);
      
      console.log('✅ MIGRATION: SAV migration completed successfully!');
      console.log('📊 MIGRATION: Verification result:', verificationResult.rows[0]);
      
    } else {
      console.log('✅ MIGRATION: Priority column already exists, skipping migration');
    }

    // Coordonnées magasin + configuration SMTP par magasin (mails fournisseurs)
    console.log('🔄 MIGRATION: Ensuring store contact and SMTP columns on groups...');
    await client.query(`
      ALTER TABLE groups ADD COLUMN IF NOT EXISTS address TEXT;
      ALTER TABLE groups ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
      ALTER TABLE groups ADD COLUMN IF NOT EXISTS logo TEXT;
      ALTER TABLE groups ADD COLUMN IF NOT EXISTS smtp_enabled BOOLEAN DEFAULT false;
      ALTER TABLE groups ADD COLUMN IF NOT EXISTS smtp_host VARCHAR(255);
      ALTER TABLE groups ADD COLUMN IF NOT EXISTS smtp_port INTEGER;
      ALTER TABLE groups ADD COLUMN IF NOT EXISTS smtp_secure BOOLEAN DEFAULT false;
      ALTER TABLE groups ADD COLUMN IF NOT EXISTS smtp_user VARCHAR(255);
      ALTER TABLE groups ADD COLUMN IF NOT EXISTS smtp_password VARCHAR(255);
      ALTER TABLE groups ADD COLUMN IF NOT EXISTS smtp_sender_email VARCHAR(255);
      ALTER TABLE groups ADD COLUMN IF NOT EXISTS smtp_sender_name VARCHAR(255);
    `);
    console.log('✅ MIGRATION: Store contact and SMTP columns are present on groups');

    // Historique des mails de relance fournisseurs
    console.log('🔄 MIGRATION: Ensuring supplier_mail_logs table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS supplier_mail_logs (
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
      );
      CREATE INDEX IF NOT EXISTS idx_supplier_mail_logs_delivery ON supplier_mail_logs(delivery_id);
      CREATE INDEX IF NOT EXISTS idx_supplier_mail_logs_group ON supplier_mail_logs(group_id);
    `);
    console.log('✅ MIGRATION: supplier_mail_logs table is present');

    // Clés de l'API externe de rapprochement, gérées depuis Paramètres
    console.log('🔄 MIGRATION: Ensuring external_api_keys table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS external_api_keys (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        key_prefix VARCHAR(16) NOT NULL,
        key_hash VARCHAR(64) NOT NULL UNIQUE,
        created_by VARCHAR,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_used_at TIMESTAMP,
        revoked_at TIMESTAMP
      );
    `);
    console.log('✅ MIGRATION: external_api_keys table is present');

    // Chiffrement au repos des secrets encore stockés en clair
    // (mots de passe SMTP des magasins, jetons API NocoDB). Idempotent :
    // les valeurs déjà au format enc:v1: sont ignorées.
    console.log('🔄 MIGRATION: Encrypting plaintext secrets at rest...');
    let encryptedCount = 0;

    const plainSmtp = await client.query(`
      SELECT id, smtp_password FROM groups
      WHERE smtp_password IS NOT NULL AND smtp_password != '' AND smtp_password NOT LIKE 'enc:v1:%'
    `);
    for (const row of plainSmtp.rows) {
      await client.query('UPDATE groups SET smtp_password = $1 WHERE id = $2', [
        encryptSecret(row.smtp_password),
        row.id,
      ]);
      encryptedCount++;
    }

    const plainTokens = await client.query(`
      SELECT id, api_token FROM nocodb_config
      WHERE api_token IS NOT NULL AND api_token != '' AND api_token NOT LIKE 'enc:v1:%'
    `);
    for (const row of plainTokens.rows) {
      if (isEncryptedSecret(row.api_token)) continue;
      await client.query('UPDATE nocodb_config SET api_token = $1 WHERE id = $2', [
        encryptSecret(row.api_token),
        row.id,
      ]);
      encryptedCount++;
    }

    console.log(`✅ MIGRATION: Secrets encryption done (${encryptedCount} value(s) encrypted this run)`);

  } catch (error) {
    console.error('❌ MIGRATION ERROR: Failed to run SAV production migrations:', error);
    console.error('❌ MIGRATION ERROR: Error details:', {
      message: (error as any)?.message,
      code: (error as any)?.code,
      stack: (error as any)?.stack
    });
    // Ne pas faire échouer le démarrage du serveur pour les erreurs de migration
  } finally {
    await client.end();
    console.log('🔌 MIGRATION: Database connection closed');
  }

  // Après les migrations de schéma ci-dessus (colonne priority, supplier_mail_logs)
  startPerformanceIndexes();
}