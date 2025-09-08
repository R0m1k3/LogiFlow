-- 🔧 CORRECTION DES RÉFÉRENCES - Si les tables sont vides
-- Utilisez ce script SI les tables suppliers/groups/users sont vides

-- 1. Créer des données de test minimales pour suppliers
INSERT INTO suppliers (name, contact) VALUES 
('Fournisseur Test', 'Contact Test')
ON CONFLICT DO NOTHING;

-- 2. Créer des données de test minimales pour groups  
INSERT INTO groups (name, description) VALUES 
('Magasin Test', 'Magasin de test pour avoirs')
ON CONFLICT DO NOTHING;

-- 3. Vérifier/créer un utilisateur admin
INSERT INTO users (id, username, email, role) VALUES 
('admin', 'admin', 'admin@test.com', 'admin')
ON CONFLICT (id) DO NOTHING;

-- 4. Maintenant tester l'insertion avoir
INSERT INTO avoirs (
    supplier_id, 
    group_id, 
    invoice_reference, 
    amount, 
    comment, 
    commercial_processed, 
    created_by
) VALUES (
    (SELECT id FROM suppliers WHERE name = 'Fournisseur Test'),
    (SELECT id FROM groups WHERE name = 'Magasin Test'), 
    'TEST-FINAL-001',
    99.99,
    'Test avec données créées',
    false,
    'admin'
) RETURNING id, supplier_id, group_id, created_by;

-- 5. Nettoyer le test
DELETE FROM avoirs WHERE invoice_reference = 'TEST-FINAL-001';