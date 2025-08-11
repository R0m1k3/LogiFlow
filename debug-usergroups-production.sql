-- Script de débogage pour vérifier l'état des groupes d'utilisateurs en production
-- À exécuter sur votre base de données de production

-- 1. Vérifier la structure de la table user_groups
\d user_groups;

-- 2. Vérifier tous les enregistrements dans user_groups
SELECT * FROM user_groups ORDER BY user_id;

-- 3. Vérifier les groupes disponibles
SELECT id, name, color FROM groups ORDER BY name;

-- 4. Vérifier les utilisateurs existants
SELECT id, username, email, role FROM users ORDER BY username;

-- 5. Requête combinée pour voir les associations utilisateur-groupe
SELECT 
    u.id as user_id,
    u.username,
    u.email,
    ug.group_id,
    g.name as group_name,
    g.color as group_color
FROM users u
LEFT JOIN user_groups ug ON u.id = ug.user_id
LEFT JOIN groups g ON ug.group_id = g.id
ORDER BY u.username, g.name;

-- 6. Compter les associations par utilisateur
SELECT 
    u.username,
    COUNT(ug.group_id) as groups_count
FROM users u
LEFT JOIN user_groups ug ON u.id = ug.user_id
GROUP BY u.id, u.username
ORDER BY u.username;

-- 7. Vérifier s'il y a des enregistrements orphelins dans user_groups
SELECT 
    ug.*,
    CASE WHEN u.id IS NULL THEN 'USER_MISSING' ELSE 'USER_OK' END as user_status,
    CASE WHEN g.id IS NULL THEN 'GROUP_MISSING' ELSE 'GROUP_OK' END as group_status
FROM user_groups ug
LEFT JOIN users u ON ug.user_id = u.id
LEFT JOIN groups g ON ug.group_id = g.id
WHERE u.id IS NULL OR g.id IS NULL;