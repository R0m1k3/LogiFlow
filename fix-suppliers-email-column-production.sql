-- Fix pour ajouter la colonne email manquante dans la table suppliers en production
-- Cette colonne est définie dans le schéma Drizzle mais n'existe pas en base

BEGIN;

-- Vérifier si la colonne email existe déjà
DO $$
BEGIN
    -- Essayer d'ajouter la colonne email si elle n'existe pas
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'suppliers' 
        AND column_name = 'email'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE suppliers ADD COLUMN email VARCHAR;
        RAISE NOTICE 'Colonne email ajoutée à la table suppliers';
    ELSE
        RAISE NOTICE 'Colonne email existe déjà dans la table suppliers';
    END IF;
    
    -- Vérifier si la colonne automatic_reconciliation existe déjà  
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'suppliers' 
        AND column_name = 'automatic_reconciliation'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE suppliers ADD COLUMN automatic_reconciliation BOOLEAN DEFAULT false;
        RAISE NOTICE 'Colonne automatic_reconciliation ajoutée à la table suppliers';
    ELSE
        RAISE NOTICE 'Colonne automatic_reconciliation existe déjà dans la table suppliers';
    END IF;
END
$$;

-- Vérifier l'état final des colonnes
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'suppliers' 
AND table_schema = 'public'
ORDER BY ordinal_position;

COMMIT;