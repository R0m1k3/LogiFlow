import { Client } from 'pg';
import { encryptSecret, isEncryptedSecret } from './crypto.js';

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
}