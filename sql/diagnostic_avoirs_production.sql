-- 🔍 DIAGNOSTIC COMPLET - Table avoirs pour production
-- Copiez-collez ce script dans votre utilitaire SQL pour diagnostiquer le problème

-- 1. Vérifier si la table existe
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name = 'avoirs'
) AS table_exists;

-- 2. Voir la structure de la table (si elle existe)
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'avoirs' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. Vérifier les contraintes
SELECT conname, contype, confrelid::regclass AS referenced_table
FROM pg_constraint 
WHERE conrelid = 'avoirs'::regclass;

-- 4. Tester une insertion basique pour voir l'erreur exacte
-- ATTENTION: Adaptez les valeurs selon vos données existantes !
INSERT INTO avoirs (
    supplier_id, 
    group_id, 
    invoice_reference, 
    amount, 
    comment, 
    commercial_processed, 
    created_by
) VALUES (
    1,  -- Utilisez un supplier_id qui existe dans votre table suppliers
    1,  -- Utilisez un group_id qui existe dans votre table groups  
    'TEST-DIAGNOSTIC-001',
    50.00,
    'Test diagnostic production',
    false,
    'admin'  -- Utilisez un user ID qui existe dans votre table users
) RETURNING id, created_at;

-- 5. Si l'insertion échoue, voir les tables liées
SELECT 'suppliers' AS table_name, COUNT(*) AS count FROM suppliers
UNION ALL
SELECT 'groups' AS table_name, COUNT(*) FROM groups
UNION ALL  
SELECT 'users' AS table_name, COUNT(*) FROM users;

-- 6. Voir les premiers enregistrements des tables liées
SELECT 'suppliers' AS source, id, name FROM suppliers LIMIT 3
UNION ALL
SELECT 'groups' AS source, id::text, name FROM groups LIMIT 3
UNION ALL
SELECT 'users' AS source, id, COALESCE(username, 'no_username') FROM users LIMIT 3;