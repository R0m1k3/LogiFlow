-- Script de migration pour synchroniser la base de données de production
-- avec le schéma de développement pour les catégories et permissions

-- 1. Mettre à jour les catégories en français
UPDATE permissions SET category = 'calendrier' WHERE category = 'Calendar';
UPDATE permissions SET category = 'tableau_de_bord' WHERE category = 'Dashboard';
UPDATE permissions SET category = 'livraisons' WHERE category = 'Deliveries';
UPDATE permissions SET category = 'commandes' WHERE category = 'Orders';
UPDATE permissions SET category = 'publicites' WHERE category = 'Publicities';
UPDATE permissions SET category = 'rapprochement' WHERE category = 'Reconciliation';
UPDATE permissions SET category = 'fournisseurs' WHERE category = 'Suppliers';
UPDATE permissions SET category = 'utilisateurs' WHERE category = 'Users';
UPDATE permissions SET category = 'commandes_clients' WHERE category = 'customer_orders';
UPDATE permissions SET category = 'magasins' WHERE category = 'groups';

-- 2. Ajouter les permissions tâches manquantes
INSERT INTO permissions (name, display_name, description, category, action, resource, is_system, created_at) VALUES
('tasks_read', 'Voir tâches', 'Accès en lecture aux tâches', 'gestion_taches', 'read', 'tasks', true, NOW()),
('tasks_create', 'Créer tâches', 'Création de nouvelles tâches', 'gestion_taches', 'create', 'tasks', true, NOW()),
('tasks_update', 'Modifier tâches', 'Modification de tâches existantes', 'gestion_taches', 'update', 'tasks', true, NOW()),
('tasks_delete', 'Supprimer tâches', 'Suppression de tâches', 'gestion_taches', 'delete', 'tasks', true, NOW()),
('tasks_assign', 'Assigner tâches', 'Attribution de tâches aux utilisateurs', 'gestion_taches', 'assign', 'tasks', true, NOW())
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  action = EXCLUDED.action,
  resource = EXCLUDED.resource;

-- 3. Ajouter les permissions administration manquantes
INSERT INTO permissions (name, display_name, description, category, action, resource, is_system, created_at) VALUES
('system_admin', 'Administration système', 'Accès complet à l''administration du système', 'administration', 'admin', 'system', true, NOW()),
('nocodb_config', 'Configuration NocoDB', 'Gestion de la configuration NocoDB', 'administration', 'config', 'nocodb', true, NOW())
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  action = EXCLUDED.action,
  resource = EXCLUDED.resource;

-- 4. Assigner les permissions tâches aux rôles existants
WITH task_permissions AS (
  SELECT id FROM permissions WHERE category = 'gestion_taches'
),
roles_info AS (
  SELECT id, name FROM roles WHERE name IN ('admin', 'manager', 'employee', 'directeur')
)
INSERT INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, NOW()
FROM roles_info r
CROSS JOIN task_permissions p
WHERE 
  -- Admin et directeur ont toutes les permissions tâches
  (r.name IN ('admin', 'directeur'))
  OR 
  -- Manager a read, create, update, assign
  (r.name = 'manager' AND EXISTS(SELECT 1 FROM permissions WHERE id = p.id AND name IN ('tasks_read', 'tasks_create', 'tasks_update', 'tasks_assign')))
  OR
  -- Employee a read, create, update
  (r.name = 'employee' AND EXISTS(SELECT 1 FROM permissions WHERE id = p.id AND name IN ('tasks_read', 'tasks_create', 'tasks_update')))
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 5. Assigner les permissions administration aux administrateurs et directeurs
WITH admin_permissions AS (
  SELECT id FROM permissions WHERE category = 'administration'
),
admin_roles AS (
  SELECT id FROM roles WHERE name IN ('admin', 'directeur')
)
INSERT INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, NOW()
FROM admin_roles r
CROSS JOIN admin_permissions p
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Vérification des résultats
SELECT 'VERIFICATION - Catégories mises à jour:' as check_type, category, COUNT(*) as count
FROM permissions 
GROUP BY category 
ORDER BY category;

SELECT 'VERIFICATION - Permissions tâches:' as check_type, name, display_name, category
FROM permissions 
WHERE category = 'gestion_taches'
ORDER BY name;

SELECT 'VERIFICATION - Permissions administration:' as check_type, name, display_name, category
FROM permissions 
WHERE category = 'administration'
ORDER BY name;