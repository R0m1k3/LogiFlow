-- Migration pour corriger les tables SAV en production
-- À exécuter sur le serveur PostgreSQL de production

-- 1. Ajouter les colonnes manquantes à la table sav_tickets
DO $$ 
BEGIN
  -- Ajouter la colonne priority si elle n'existe pas
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sav_tickets' AND column_name='priority') THEN
    ALTER TABLE sav_tickets ADD COLUMN priority varchar(50) NOT NULL DEFAULT 'normale';
  END IF;

  -- Ajouter la colonne problem_type si elle n'existe pas
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sav_tickets' AND column_name='problem_type') THEN
    ALTER TABLE sav_tickets ADD COLUMN problem_type varchar(100) NOT NULL DEFAULT 'panne';
  END IF;

  -- Ajouter la colonne resolution_description si elle n'existe pas
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sav_tickets' AND column_name='resolution_description') THEN
    ALTER TABLE sav_tickets ADD COLUMN resolution_description text;
  END IF;

  -- Ajouter la colonne resolved_at si elle n'existe pas
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sav_tickets' AND column_name='resolved_at') THEN
    ALTER TABLE sav_tickets ADD COLUMN resolved_at timestamp;
  END IF;

  -- Ajouter la colonne closed_at si elle n'existe pas
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sav_tickets' AND column_name='closed_at') THEN
    ALTER TABLE sav_tickets ADD COLUMN closed_at timestamp;
  END IF;

  -- Vérifier si la colonne status existe, sinon l'ajouter
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sav_tickets' AND column_name='status') THEN
    ALTER TABLE sav_tickets ADD COLUMN status varchar(50) NOT NULL DEFAULT 'nouveau';
  END IF;

  RAISE NOTICE 'Colonnes manquantes ajoutées à sav_tickets';
END $$;

-- 2. Créer la table sav_ticket_history si elle n'existe pas
CREATE TABLE IF NOT EXISTS sav_ticket_history (
  id serial PRIMARY KEY,
  ticket_id integer NOT NULL,
  action varchar(100) NOT NULL,
  description text,
  created_by varchar(255) NOT NULL,
  created_at timestamp DEFAULT NOW()
);

-- 3. Ajouter les contraintes de clé étrangère si elles n'existent pas
DO $$
BEGIN
  -- Vérifier et ajouter la contrainte FK vers suppliers
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='sav_tickets_supplier_id_fkey') THEN
    ALTER TABLE sav_tickets ADD CONSTRAINT sav_tickets_supplier_id_fkey 
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id);
  END IF;

  -- Vérifier et ajouter la contrainte FK vers groups
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='sav_tickets_group_id_fkey') THEN
    ALTER TABLE sav_tickets ADD CONSTRAINT sav_tickets_group_id_fkey 
    FOREIGN KEY (group_id) REFERENCES groups(id);
  END IF;

  -- Vérifier et ajouter la contrainte FK pour sav_ticket_history
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='sav_ticket_history_ticket_id_fkey') THEN
    ALTER TABLE sav_ticket_history ADD CONSTRAINT sav_ticket_history_ticket_id_fkey 
    FOREIGN KEY (ticket_id) REFERENCES sav_tickets(id) ON DELETE CASCADE;
  END IF;

  RAISE NOTICE 'Contraintes de clé étrangère vérifiées/ajoutées';
END $$;

-- 4. Créer les index pour optimiser les performances
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sav_tickets_status ON sav_tickets(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sav_tickets_priority ON sav_tickets(priority);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sav_tickets_supplier_id ON sav_tickets(supplier_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sav_tickets_group_id ON sav_tickets(group_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sav_tickets_created_at ON sav_tickets(created_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sav_ticket_history_ticket_id ON sav_ticket_history(ticket_id);

-- 5. Mettre à jour les valeurs existantes si nécessaire
UPDATE sav_tickets 
SET priority = 'normale' 
WHERE priority IS NULL OR priority = '';

UPDATE sav_tickets 
SET problem_type = 'panne' 
WHERE problem_type IS NULL OR problem_type = '';

-- 6. Vérification finale
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

RAISE NOTICE 'Migration SAV production terminée avec succès !';