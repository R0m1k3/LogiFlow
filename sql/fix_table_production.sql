-- 🔧 CORRECTION TABLE PRODUCTION
-- Script pour corriger la table avoirs en production

-- 1. Vérifier la structure actuelle
SELECT 'STRUCTURE_ACTUELLE' as check_type, 
       column_name, 
       data_type, 
       is_nullable,
       column_default
FROM information_schema.columns 
WHERE table_name = 'avoirs' 
ORDER BY ordinal_position;

-- 2. Corriger les colonnes pour les rendre optionnelles
ALTER TABLE avoirs ALTER COLUMN invoice_reference DROP NOT NULL;
ALTER TABLE avoirs ALTER COLUMN amount DROP NOT NULL;

-- 3. Vérifier après correction
SELECT 'STRUCTURE_CORRIGÉE' as check_type,
       column_name, 
       data_type, 
       is_nullable,
       column_default
FROM information_schema.columns 
WHERE table_name = 'avoirs' 
ORDER BY ordinal_position;

-- 4. Test d'insertion avec champs optionnels
INSERT INTO avoirs (
    supplier_id, 
    group_id, 
    comment, 
    commercial_processed, 
    created_by
) VALUES (
    (SELECT id FROM suppliers LIMIT 1),
    (SELECT id FROM groups LIMIT 1),
    'Test champs optionnels',
    false,
    (SELECT id FROM users LIMIT 1)::varchar
) RETURNING id, invoice_reference, amount;

-- 5. Nettoyer le test
DELETE FROM avoirs WHERE comment = 'Test champs optionnels';