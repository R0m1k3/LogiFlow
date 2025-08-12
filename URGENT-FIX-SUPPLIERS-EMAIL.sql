-- CORRECTION URGENTE : Ajouter la colonne email manquante dans suppliers
-- Cette colonne est requise par le code Drizzle mais n'existe pas en production

BEGIN;

-- Ajouter la colonne email après phone
ALTER TABLE suppliers ADD COLUMN email character varying(255);

-- Mettre à jour la timestamp
UPDATE suppliers SET updated_at = CURRENT_TIMESTAMP;

-- Vérifier le résultat
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

-- Message de confirmation
SELECT 'Colonne email ajoutée avec succès à la table suppliers' as status;