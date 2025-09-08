-- 🔧 CORRECTION CONTRAINTE FOREIGN KEY
-- Le problème : l'utilisateur référencé n'existe pas !

-- ÉTAPE 1: Voir les utilisateurs existants
SELECT 'UTILISATEURS EXISTANTS' as check_type;
SELECT id, username, role FROM users ORDER BY id;

-- ÉTAPE 2: Si aucun utilisateur, créer un utilisateur admin
INSERT INTO users (id, username, email, role) 
VALUES ('admin', 'admin', 'admin@test.com', 'admin')
ON CONFLICT (id) DO NOTHING;

-- ÉTAPE 3: Insérer supplier et group de test si nécessaire
INSERT INTO suppliers (name) VALUES ('Test Supplier') ON CONFLICT DO NOTHING RETURNING id;
INSERT INTO groups (name) VALUES ('Test Group') ON CONFLICT DO NOTHING RETURNING id;

-- ÉTAPE 4: Test avoir avec utilisateur existant
INSERT INTO avoirs (
    supplier_id, 
    group_id, 
    created_by,
    invoice_reference,
    amount,
    comment
) VALUES (
    (SELECT id FROM suppliers WHERE name = 'Test Supplier' LIMIT 1),
    (SELECT id FROM groups WHERE name = 'Test Group' LIMIT 1),
    (SELECT id FROM users WHERE role = 'admin' LIMIT 1),  -- Utilise un ID qui existe !
    'TEST-FK-FIXED',
    99.99,
    'Test après correction foreign key'
) RETURNING id, created_by;

-- ÉTAPE 5: Vérification
SELECT 'RÉSULTAT INSERTION' as check_type;
SELECT COUNT(*) as total_avoirs FROM avoirs;

-- ÉTAPE 6: Nettoyage du test
DELETE FROM avoirs WHERE invoice_reference = 'TEST-FK-FIXED';