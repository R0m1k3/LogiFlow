-- 🔍 TEST DE DIAGNOSTIC COMPLET
-- Vérifiez que tout fonctionne côté base de données

-- 1. La table existe-t-elle vraiment ?
SELECT COUNT(*) as table_count
FROM information_schema.tables 
WHERE table_name = 'avoirs' AND table_schema = 'public';

-- 2. Test d'insertion manuelle pour voir si ça marche
INSERT INTO avoirs (
    supplier_id, 
    group_id, 
    invoice_reference, 
    amount, 
    comment, 
    commercial_processed, 
    created_by
) VALUES (
    1,  -- Remplacez par un ID supplier existant
    1,  -- Remplacez par un ID group existant
    'TEST-MANUEL-' || EXTRACT(EPOCH FROM NOW()),
    25.99,
    'Test diagnostic manuel',
    false,
    'admin'  -- Remplacez par un user_id existant
) RETURNING id, created_at;

-- 3. Vérifiez le résultat
SELECT COUNT(*) as total_avoirs FROM avoirs;

-- 4. Supprimez le test
DELETE FROM avoirs WHERE comment = 'Test diagnostic manuel';