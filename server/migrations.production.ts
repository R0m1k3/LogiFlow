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
      
      // Exécuter la migration complète SAV
      await sql`
        -- Ajouter la colonne priority si elle n'existe pas
        DO $$ 
        BEGIN
          -- Ajouter la colonne priority si elle n'existe pas
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sav_tickets' AND column_name='priority') THEN
            ALTER TABLE sav_tickets ADD COLUMN priority varchar(50) NOT NULL DEFAULT 'normale';
            RAISE NOTICE 'Colonne priority ajoutée';
          END IF;

          -- Ajouter la colonne problem_type si elle n'existe pas
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sav_tickets' AND column_name='problem_type') THEN
            ALTER TABLE sav_tickets ADD COLUMN problem_type varchar(100) NOT NULL DEFAULT 'defectueux';
            RAISE NOTICE 'Colonne problem_type ajoutée';
          END IF;

          -- Ajouter la colonne resolution_description si elle n'existe pas
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sav_tickets' AND column_name='resolution_description') THEN
            ALTER TABLE sav_tickets ADD COLUMN resolution_description text;
            RAISE NOTICE 'Colonne resolution_description ajoutée';
          END IF;

          -- Ajouter la colonne resolved_at si elle n'existe pas
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sav_tickets' AND column_name='resolved_at') THEN
            ALTER TABLE sav_tickets ADD COLUMN resolved_at timestamp;
            RAISE NOTICE 'Colonne resolved_at ajoutée';
          END IF;

          -- Ajouter la colonne closed_at si elle n'existe pas
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sav_tickets' AND column_name='closed_at') THEN
            ALTER TABLE sav_tickets ADD COLUMN closed_at timestamp;
            RAISE NOTICE 'Colonne closed_at ajoutée';
          END IF;

          -- Vérifier si la colonne status existe, sinon l'ajouter
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sav_tickets' AND column_name='status') THEN
            ALTER TABLE sav_tickets ADD COLUMN status varchar(50) NOT NULL DEFAULT 'nouveau';
            RAISE NOTICE 'Colonne status ajoutée';
          END IF;

        END $$;
      `;

      // Créer la table sav_ticket_history si elle n'existe pas
      await sql`
        CREATE TABLE IF NOT EXISTS sav_ticket_history (
          id serial PRIMARY KEY,
          ticket_id integer NOT NULL,
          action varchar(100) NOT NULL,
          description text,
          created_by varchar(255) NOT NULL,
          created_at timestamp DEFAULT NOW()
        );
      `;

      // Ajouter les contraintes de clé étrangère si elles n'existent pas
      await sql`
        DO $$
        BEGIN
          -- Vérifier et ajouter la contrainte FK vers suppliers
          IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='sav_tickets_supplier_id_fkey') THEN
            ALTER TABLE sav_tickets ADD CONSTRAINT sav_tickets_supplier_id_fkey 
            FOREIGN KEY (supplier_id) REFERENCES suppliers(id);
            RAISE NOTICE 'Contrainte FK supplier_id ajoutée';
          END IF;

          -- Vérifier et ajouter la contrainte FK vers groups
          IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='sav_tickets_group_id_fkey') THEN
            ALTER TABLE sav_tickets ADD CONSTRAINT sav_tickets_group_id_fkey 
            FOREIGN KEY (group_id) REFERENCES groups(id);
            RAISE NOTICE 'Contrainte FK group_id ajoutée';
          END IF;

          -- Vérifier et ajouter la contrainte FK pour sav_ticket_history
          IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='sav_ticket_history_ticket_id_fkey') THEN
            ALTER TABLE sav_ticket_history ADD CONSTRAINT sav_ticket_history_ticket_id_fkey 
            FOREIGN KEY (ticket_id) REFERENCES sav_tickets(id) ON DELETE CASCADE;
            RAISE NOTICE 'Contrainte FK history ticket_id ajoutée';
          END IF;

        END $$;
      `;

      // Créer les index pour optimiser les performances
      await sql`
        CREATE INDEX IF NOT EXISTS idx_sav_tickets_status ON sav_tickets(status);
        CREATE INDEX IF NOT EXISTS idx_sav_tickets_priority ON sav_tickets(priority);
        CREATE INDEX IF NOT EXISTS idx_sav_tickets_supplier_id ON sav_tickets(supplier_id);
        CREATE INDEX IF NOT EXISTS idx_sav_tickets_group_id ON sav_tickets(group_id);
        CREATE INDEX IF NOT EXISTS idx_sav_tickets_created_at ON sav_tickets(created_at);
        CREATE INDEX IF NOT EXISTS idx_sav_ticket_history_ticket_id ON sav_ticket_history(ticket_id);
      `;

      // Mettre à jour les valeurs existantes si nécessaire
      await sql`
        UPDATE sav_tickets 
        SET priority = 'normale' 
        WHERE priority IS NULL OR priority = '';
      `;

      await sql`
        UPDATE sav_tickets 
        SET problem_type = 'defectueux' 
        WHERE problem_type IS NULL OR problem_type = '';
      `;

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