import { Client } from 'pg';

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