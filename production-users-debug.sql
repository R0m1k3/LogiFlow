-- Script de diagnostic pour résoudre le problème "Aucun utilisateur trouvé" en production

-- 1. Vérifier si la table users existe et contient des données
SELECT 'Users table check' as diagnostic;
SELECT COUNT(*) as user_count FROM users;
SELECT id, username, email, role FROM users LIMIT 5;

-- 2. Vérifier la structure de la table users
SELECT 'Users table structure' as diagnostic;
\d users;

-- 3. Vérifier les connexions/permissions de base de données
SELECT 'Database info' as diagnostic;
SELECT current_database(), current_user, version();

-- 4. Vérifier la table groups
SELECT 'Groups table check' as diagnostic;
SELECT COUNT(*) as group_count FROM groups;
SELECT id, name FROM groups LIMIT 5;

-- 5. Vérifier la table user_groups et sa structure
SELECT 'User_groups table check' as diagnostic;
SELECT COUNT(*) as user_group_count FROM user_groups;
\d user_groups;

-- 6. Test de la requête utilisée par l'application
SELECT 'Full user query test' as diagnostic;
SELECT 
  u.id,
  u.username,
  u.email,
  u.role,
  COUNT(ug.group_id) as groups_count
FROM users u
LEFT JOIN user_groups ug ON u.id = ug.user_id
GROUP BY u.id, u.username, u.email, u.role
LIMIT 5;