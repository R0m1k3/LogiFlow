-- 🔍 DIAGNOSTIC COMPLET FINAL - Production
-- Trouvons exactement où ça bloque !

-- SECTION 1: Vérification des tables et leurs structures
SELECT 'TABLES EXISTANTES' as check_type;
SELECT table_name, 
       (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
AND table_name IN ('suppliers', 'groups', 'users', 'avoirs')
ORDER BY table_name;

-- SECTION 2: Structure détaillée de la table avoirs
SELECT 'STRUCTURE TABLE AVOIRS' as check_type;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'avoirs' 
ORDER BY ordinal_position;

-- SECTION 3: Contraintes de la table avoirs
SELECT 'CONTRAINTES AVOIRS' as check_type;
SELECT conname as constraint_name, 
       confrelid::regclass as referenced_table,
       contype as constraint_type
FROM pg_constraint 
WHERE conrelid = 'avoirs'::regclass;

-- SECTION 4: Données dans les tables liées
SELECT 'DONNÉES TABLES LIÉES' as check_type;
SELECT 'suppliers' as table_name, COUNT(*) as count FROM suppliers
UNION ALL
SELECT 'groups', COUNT(*) FROM groups
UNION ALL
SELECT 'users', COUNT(*) FROM users
UNION ALL
SELECT 'avoirs', COUNT(*) FROM avoirs;

-- SECTION 5: Si les tables ont des données, montrez quelques exemples
SELECT 'EXEMPLES SUPPLIERS' as check_type;
SELECT id, name, 
       CASE WHEN LENGTH(name) > 20 THEN LEFT(name, 20) || '...' ELSE name END as display_name
FROM suppliers LIMIT 3;

SELECT 'EXEMPLES GROUPS' as check_type;
SELECT id, name,
       CASE WHEN LENGTH(name) > 20 THEN LEFT(name, 20) || '...' ELSE name END as display_name
FROM groups LIMIT 3;

SELECT 'EXEMPLES USERS' as check_type;
SELECT id, 
       COALESCE(username, 'no_username') as username,
       CASE WHEN LENGTH(COALESCE(username, 'no_username')) > 15 
            THEN LEFT(COALESCE(username, 'no_username'), 15) || '...' 
            ELSE COALESCE(username, 'no_username') END as display_username
FROM users LIMIT 3;

-- SECTION 6: Test d'insertion simple
SELECT 'TEST INSERTION' as check_type;
-- Seulement si toutes les tables ont des données
SELECT CASE 
    WHEN (SELECT COUNT(*) FROM suppliers) > 0 
     AND (SELECT COUNT(*) FROM groups) > 0 
     AND (SELECT COUNT(*) FROM users) > 0
    THEN 'READY_FOR_INSERT'
    ELSE 'MISSING_REFERENCE_DATA'
END as insert_status;