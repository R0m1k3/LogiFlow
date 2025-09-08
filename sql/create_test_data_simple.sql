-- 🔧 CRÉATION DONNÉES DE TEST SIMPLIFIÉES
-- Sans colonnes optionnelles, juste les colonnes essentielles

-- 1. Créer un fournisseur de test (sans contact_email)
INSERT INTO suppliers (name) VALUES ('Fournisseur Test') 
ON CONFLICT DO NOTHING
RETURNING id;

-- 2. Créer un groupe de test  
INSERT INTO groups (name) VALUES ('Magasin Test')
ON CONFLICT DO NOTHING
RETURNING id;

-- 3. Vérifier qu'on a au moins un utilisateur
SELECT 'Utilisateurs disponibles:', COUNT(*) FROM users;
SELECT 'Premier utilisateur:', id FROM users LIMIT 1;

-- 4. Test d'insertion avoir avec les données créées
INSERT INTO avoirs (
    supplier_id, 
    group_id, 
    invoice_reference, 
    amount, 
    comment, 
    commercial_processed, 
    created_by
) VALUES (
    (SELECT id FROM suppliers WHERE name = 'Fournisseur Test' LIMIT 1),
    (SELECT id FROM groups WHERE name = 'Magasin Test' LIMIT 1),
    'TEST-FINAL-' || EXTRACT(EPOCH FROM NOW()),
    75.50,
    'Test insertion production',
    false,
    (SELECT id FROM users LIMIT 1)::varchar
) RETURNING id, supplier_id, group_id, created_by, created_at;

-- 5. Vérification finale
SELECT COUNT(*) as total_avoirs FROM avoirs;

-- 6. Nettoyer le test si vous voulez
-- DELETE FROM avoirs WHERE comment = 'Test insertion production';