-- 🔍 DIAGNOSTIC DES RÉFÉRENCES - Trouvons le vrai problème
-- Exécutez chaque section séparément

-- SECTION 1: Vérifier les tables dépendantes
SELECT 'suppliers' as table_name, COUNT(*) as record_count FROM suppliers
UNION ALL
SELECT 'groups' as table_name, COUNT(*) FROM groups  
UNION ALL
SELECT 'users' as table_name, COUNT(*) FROM users;

-- SECTION 2: Voir les premiers IDs disponibles
SELECT 'supplier_ids' as type, string_agg(id::text, ', ') as available_ids 
FROM (SELECT id FROM suppliers LIMIT 5) s
UNION ALL
SELECT 'group_ids' as type, string_agg(id::text, ', ') 
FROM (SELECT id FROM groups LIMIT 5) g
UNION ALL  
SELECT 'user_ids' as type, string_agg(id::text, ', ') 
FROM (SELECT id FROM users LIMIT 5) u;

-- SECTION 3: Vérifier les types de colonnes
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('suppliers', 'groups', 'users', 'avoirs')
AND column_name IN ('id', 'created_by')
ORDER BY table_name, column_name;

-- SECTION 4: Test d'insertion avec de vraies données
-- ATTENTION: Remplacez les valeurs par les vrais IDs trouvés ci-dessus
INSERT INTO avoirs (
    supplier_id, 
    group_id, 
    invoice_reference, 
    amount, 
    comment, 
    commercial_processed, 
    created_by
) VALUES (
    (SELECT id FROM suppliers LIMIT 1),  -- Premier supplier existant
    (SELECT id FROM groups LIMIT 1),     -- Premier group existant  
    'TEST-REF-' || EXTRACT(EPOCH FROM NOW()),
    29.99,
    'Test avec vraies données',
    false,
    (SELECT id FROM users LIMIT 1)::varchar  -- Premier user existant
) RETURNING id, created_at;