import { neon } from '@neondatabase/serverless';

export async function runProductionMigrations() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL not found for migrations');
    return;
  }

  const sql = neon(databaseUrl);
  
  try {
    console.log('🔄 Checking and running SAV production migrations...');
    
    // Vérifier si la colonne priority existe
    const checkPriorityColumn = await sql`
      SELECT 1 FROM information_schema.columns 
      WHERE table_name='sav_tickets' AND column_name='priority'
    `;

    if (checkPriorityColumn.length === 0) {
      console.log('📝 Running SAV table migrations...');
      
      // Ajouter seulement la colonne priority manquante
      await sql`
        ALTER TABLE sav_tickets ADD COLUMN priority varchar(50) NOT NULL DEFAULT 'normale';
      `;
      console.log('✅ Colonne priority ajoutée à sav_tickets');

      // Créer les index pour optimiser les performances
      await sql`
        CREATE INDEX IF NOT EXISTS idx_sav_tickets_priority ON sav_tickets(priority);
      `;
      console.log('✅ Index priority créé');

      console.log('✅ SAV production migrations completed successfully!');
      
      // Vérification finale
      const verificationResult = await sql`
        SELECT 
          'sav_tickets' as table_name,
          COUNT(*) as record_count,
          COUNT(CASE WHEN priority IS NOT NULL THEN 1 END) as records_with_priority
        FROM sav_tickets
        UNION ALL
        SELECT 
          'sav_ticket_history' as table_name,
          COUNT(*) as record_count,
          NULL as records_with_priority
        FROM sav_ticket_history;
      `;
      
      console.log('📊 SAV tables status:', verificationResult);
      
    } else {
      console.log('✅ SAV migrations already applied, skipping');
    }
    
  } catch (error) {
    console.error('❌ Error running SAV production migrations:', error);
    // Ne pas faire échouer le démarrage du serveur pour les erreurs de migration
    // L'application peut continuer à fonctionner même si la migration échoue
  }
}