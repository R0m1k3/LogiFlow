-- 🔍 DIAGNOSTIC SIMPLE - Une requête à la fois
-- Copiez chaque ligne séparément pour voir les résultats précis

-- ÉTAPE 1: La table existe-t-elle ?
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name = 'avoirs'
) AS table_avoirs_exists;

-- ÉTAPE 2: Quelles sont les colonnes ?  
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'avoirs' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- ÉTAPE 3: Les tables liées existent-elles ?
SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'suppliers') AS suppliers_exists,
       EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'groups') AS groups_exists,  
       EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users') AS users_exists;

-- ÉTAPE 4: Test basique d'insertion
SELECT COUNT(*) FROM suppliers;
SELECT COUNT(*) FROM groups;  
SELECT COUNT(*) FROM users LIMIT 1;