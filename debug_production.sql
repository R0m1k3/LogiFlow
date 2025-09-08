-- 🔍 DIAGNOSTIC PRODUCTION COMPLET - Module Avoirs
-- Copiez-collez ce script dans votre utilitaire SQL pour diagnostic précis

BEGIN;

-- SECTION 1: STRUCTURE DES TABLES
SELECT 'VÉRIFICATION STRUCTURE TABLES' AS section_title;

-- Table avoirs - structure exacte
SELECT 'STRUCTURE_AVOIRS' AS check_type, column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'avoirs' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Table suppliers - structure exacte  
SELECT 'STRUCTURE_SUPPLIERS' AS check_type, column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'suppliers' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Table groups - structure exacte
SELECT 'STRUCTURE_GROUPS' AS check_type, column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'groups' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Table users - structure exacte
SELECT 'STRUCTURE_USERS' AS check_type, column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'users' AND table_schema = 'public'
ORDER BY ordinal_position;

-- SECTION 2: CONTRAINTES
SELECT 'CONTRAINTES_AVOIRS' AS check_type, conname AS constraint_name, contype AS type,
       confrelid::regclass AS referenced_table
FROM pg_constraint 
WHERE conrelid = 'avoirs'::regclass;

-- SECTION 3: DONNÉES EXISTANTES
SELECT 'COMPTES_TABLES' AS check_type, 'suppliers' AS table_name, COUNT(*) AS count FROM suppliers
UNION ALL
SELECT 'COMPTES_TABLES', 'groups', COUNT(*) FROM groups
UNION ALL  
SELECT 'COMPTES_TABLES', 'users', COUNT(*) FROM users
UNION ALL
SELECT 'COMPTES_TABLES', 'avoirs', COUNT(*) FROM avoirs;

-- SECTION 4: EXEMPLES DE DONNÉES (si elles existent)
-- Suppliers
SELECT 'EXEMPLES_SUPPLIERS' AS check_type, id, name FROM suppliers LIMIT 3;

-- Groups  
SELECT 'EXEMPLES_GROUPS' AS check_type, id, name FROM groups LIMIT 3;

-- Users
SELECT 'EXEMPLES_USERS' AS check_type, id, 
       COALESCE(username, 'no_username') AS username,
       role
FROM users LIMIT 3;

-- SECTION 5: TEST DE COMPATIBILITÉ
-- Test si on peut insérer avec des champs NULL
SELECT 'TEST_COMPATIBILITÉ' AS check_type,
       CASE 
         WHEN (SELECT is_nullable FROM information_schema.columns 
               WHERE table_name = 'avoirs' AND column_name = 'invoice_reference') = 'YES'
         THEN 'invoice_reference_NULLABLE'
         ELSE 'invoice_reference_NOT_NULL'
       END AS invoice_ref_status,
       CASE 
         WHEN (SELECT is_nullable FROM information_schema.columns 
               WHERE table_name = 'avoirs' AND column_name = 'amount') = 'YES'
         THEN 'amount_NULLABLE' 
         ELSE 'amount_NOT_NULL'
       END AS amount_status;

ROLLBACK; -- Ne pas sauvegarder, c'est juste du diagnostic