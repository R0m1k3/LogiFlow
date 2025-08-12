-- Fix urgent production: permissions employé pour commandes client et DLC
-- À exécuter sur la base de production

-- 1. Vérifier les permissions actuelles pour le rôle employé
SELECT 
    p.name as permission_name,
    p.category,
    CASE WHEN rp.permission_id IS NOT NULL THEN 'GRANTED' ELSE 'DENIED' END as status
FROM permissions p
LEFT JOIN role_permissions rp ON p.id = rp.permission_id 
    AND rp.role_id = (SELECT id FROM roles WHERE name = 'employee')
WHERE p.category IN ('customer-orders', 'dlc')
ORDER BY p.category, p.name;

-- 2. Vérifier si le rôle employé existe
SELECT * FROM roles WHERE name = 'employee';

-- 3. Obtenir l'ID du rôle employé  
SELECT id FROM roles WHERE name = 'employee';

-- 4. Vérifier les permissions requises qui pourraient manquer
SELECT id, name, category, description 
FROM permissions 
WHERE category IN ('customer-orders', 'dlc') 
  AND name IN ('create', 'view')
  AND id NOT IN (
    SELECT permission_id 
    FROM role_permissions 
    WHERE role_id = (SELECT id FROM roles WHERE name = 'employee')
  );

-- 5. Si des permissions manquent, les ajouter (À DÉCOMMENTER SI NÉCESSAIRE)
/*
-- Ajouter permission créer commandes client pour employé
INSERT INTO role_permissions (role_id, permission_id, assigned_by, created_at)
SELECT 
    (SELECT id FROM roles WHERE name = 'employee'),
    p.id,
    'system_fix',
    NOW()
FROM permissions p
WHERE p.category = 'customer-orders' 
  AND p.name = 'create'
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp 
    WHERE rp.role_id = (SELECT id FROM roles WHERE name = 'employee') 
      AND rp.permission_id = p.id
  );

-- Ajouter permission créer DLC pour employé  
INSERT INTO role_permissions (role_id, permission_id, assigned_by, created_at)
SELECT 
    (SELECT id FROM roles WHERE name = 'employee'),
    p.id,
    'system_fix',
    NOW()
FROM permissions p
WHERE p.category = 'dlc' 
  AND p.name = 'create'
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp 
    WHERE rp.role_id = (SELECT id FROM roles WHERE name = 'employee') 
      AND rp.permission_id = p.id
  );
*/

-- 6. Vérifier l'utilisateur qui a des problèmes
SELECT 
    u.id,
    u.username,
    u.role,
    u.first_name,
    u.last_name,
    COUNT(ug.group_id) as group_count
FROM users u
LEFT JOIN user_groups ug ON u.id = ug.user_id
WHERE u.id = '_1753266816257'
GROUP BY u.id, u.username, u.role, u.first_name, u.last_name;

-- 7. Vérifier les groupes de l'utilisateur
SELECT 
    ug.user_id,
    ug.group_id,
    g.name as group_name,
    g.color as group_color
FROM user_groups ug
JOIN groups g ON ug.group_id = g.id
WHERE ug.user_id = '_1753266816257';

-- Notes pour le debugging:
-- - Si pas de résultats dans requête 4: permissions OK
-- - Si résultats dans requête 4: décommenter section 5
-- - Vérifier que l'utilisateur a bien un groupe assigné
-- - Le problème peut être côté frontend si permissions OK