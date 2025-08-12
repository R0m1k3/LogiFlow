-- =============================================
-- PRODUCTION SCHEMA UPDATE - Groups NocoDB Configuration
-- Date: 2025-08-12
-- Description: Synchronise le schéma production avec les nouveaux champs NocoDB
-- =============================================

-- Retirer le champ nocodbTableId qui n'est plus nécessaire
ALTER TABLE groups DROP COLUMN IF EXISTS "nocodb_table_id";

-- Ajouter les nouveaux champs de configuration NocoDB par magasin
ALTER TABLE groups ADD COLUMN IF NOT EXISTS "nocodb_bl_column_name" VARCHAR;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS "nocodb_amount_column_name" VARCHAR;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS "nocodb_supplier_column_name" VARCHAR;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS "webhook_url" VARCHAR(500);

-- Modifier la colonne color pour avoir une valeur par défaut (si elle n'en a pas déjà une)
ALTER TABLE groups ALTER COLUMN color SET DEFAULT '#1976D2';

-- Ajout de commentaires pour documentation
COMMENT ON COLUMN groups.color IS 'Couleur hex du groupe, par défaut #1976D2';
COMMENT ON COLUMN groups.nocodb_table_name IS 'Nom de la table NocoDB spécifique au magasin';
COMMENT ON COLUMN groups.invoice_column_name IS 'Nom de la colonne facture dans la table NocoDB du magasin';
COMMENT ON COLUMN groups.nocodb_bl_column_name IS 'Nom de la colonne BL dans la table NocoDB du magasin';
COMMENT ON COLUMN groups.nocodb_amount_column_name IS 'Nom de la colonne montant dans la table NocoDB du magasin';
COMMENT ON COLUMN groups.nocodb_supplier_column_name IS 'Nom de la colonne fournisseur dans la table NocoDB du magasin';
COMMENT ON COLUMN groups.webhook_url IS 'URL webhook pour notifications spécifiques au magasin';

-- Vérification du schéma final
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default,
    col_description(pg_class.oid, ordinal_position) as column_comment
FROM information_schema.columns 
JOIN pg_class ON pg_class.relname = table_name
WHERE table_name = 'groups' 
    AND table_schema = 'public'
ORDER BY ordinal_position;