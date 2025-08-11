-- Script SQL d'urgence pour corriger les permissions tâches en production
-- À exécuter manuellement sur la base de données de production

-- 1. Vérifier si les permissions tâches existent
DO $$
BEGIN
    -- Créer les permissions tâches si elles n'existent pas
    INSERT INTO permissions (name, display_name, description, category, action, resource, is_system)
    VALUES 
        ('tasks_read', 'Voir tâches', 'Accès en lecture aux tâches', 'gestion_taches', 'read', 'tasks', true),
        ('tasks_create', 'Créer tâches', 'Création de nouvelles tâches', 'gestion_taches', 'create', 'tasks', true),
        ('tasks_update', 'Modifier tâches', 'Modification des tâches existantes', 'gestion_taches', 'update', 'tasks', true),
        ('tasks_delete', 'Supprimer tâches', 'Suppression des tâches', 'gestion_taches', 'delete', 'tasks', true),
        ('tasks_assign', 'Assigner tâches', 'Assignation des tâches aux utilisateurs', 'gestion_taches', 'assign', 'tasks', true)
    ON CONFLICT (name) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        description = EXCLUDED.description,
        category = EXCLUDED.category;

    RAISE NOTICE 'Permissions tâches créées/mises à jour avec succès';
END $$;

-- 2. Assigner les permissions aux rôles appropriés
DO $$
DECLARE
    admin_role_id INTEGER;
    manager_role_id INTEGER;
    employee_role_id INTEGER;
    directeur_role_id INTEGER;
    perm_read_id INTEGER;
    perm_create_id INTEGER;
    perm_update_id INTEGER;
    perm_delete_id INTEGER;
    perm_assign_id INTEGER;
BEGIN
    -- Récupérer les IDs des rôles
    SELECT id INTO admin_role_id FROM roles WHERE name = 'admin';
    SELECT id INTO manager_role_id FROM roles WHERE name = 'manager';
    SELECT id INTO employee_role_id FROM roles WHERE name = 'employee';
    SELECT id INTO directeur_role_id FROM roles WHERE name = 'directeur';
    
    -- Récupérer les IDs des permissions tâches
    SELECT id INTO perm_read_id FROM permissions WHERE name = 'tasks_read';
    SELECT id INTO perm_create_id FROM permissions WHERE name = 'tasks_create';
    SELECT id INTO perm_update_id FROM permissions WHERE name = 'tasks_update';
    SELECT id INTO perm_delete_id FROM permissions WHERE name = 'tasks_delete';
    SELECT id INTO perm_assign_id FROM permissions WHERE name = 'tasks_assign';
    
    -- Assigner toutes les permissions tâches au rôle admin
    IF admin_role_id IS NOT NULL THEN
        INSERT INTO role_permissions (role_id, permission_id)
        VALUES 
            (admin_role_id, perm_read_id),
            (admin_role_id, perm_create_id),
            (admin_role_id, perm_update_id),
            (admin_role_id, perm_delete_id),
            (admin_role_id, perm_assign_id)
        ON CONFLICT (role_id, permission_id) DO NOTHING;
        RAISE NOTICE 'Permissions tâches assignées au rôle admin (ID: %)', admin_role_id;
    END IF;
    
    -- Assigner permissions au rôle manager (read, create, update, assign)
    IF manager_role_id IS NOT NULL THEN
        INSERT INTO role_permissions (role_id, permission_id)
        VALUES 
            (manager_role_id, perm_read_id),
            (manager_role_id, perm_create_id),
            (manager_role_id, perm_update_id),
            (manager_role_id, perm_assign_id)
        ON CONFLICT (role_id, permission_id) DO NOTHING;
        RAISE NOTICE 'Permissions tâches assignées au rôle manager (ID: %)', manager_role_id;
    END IF;
    
    -- Assigner permissions au rôle employee (read, create, update)
    IF employee_role_id IS NOT NULL THEN
        INSERT INTO role_permissions (role_id, permission_id)
        VALUES 
            (employee_role_id, perm_read_id),
            (employee_role_id, perm_create_id),
            (employee_role_id, perm_update_id)
        ON CONFLICT (role_id, permission_id) DO NOTHING;
        RAISE NOTICE 'Permissions tâches assignées au rôle employee (ID: %)', employee_role_id;
    END IF;
    
    -- Assigner toutes les permissions au rôle directeur
    IF directeur_role_id IS NOT NULL THEN
        INSERT INTO role_permissions (role_id, permission_id)
        VALUES 
            (directeur_role_id, perm_read_id),
            (directeur_role_id, perm_create_id),
            (directeur_role_id, perm_update_id),
            (directeur_role_id, perm_delete_id),
            (directeur_role_id, perm_assign_id)
        ON CONFLICT (role_id, permission_id) DO NOTHING;
        RAISE NOTICE 'Permissions tâches assignées au rôle directeur (ID: %)', directeur_role_id;
    END IF;
    
END $$;

-- 3. Vérifier le résultat
SELECT 
    r.name as role_name,
    COUNT(rp.permission_id) as task_permissions_count
FROM roles r
LEFT JOIN role_permissions rp ON r.id = rp.role_id
LEFT JOIN permissions p ON rp.permission_id = p.id AND p.category = 'gestion_taches'
WHERE r.name IN ('admin', 'manager', 'employee', 'directeur')
GROUP BY r.id, r.name
ORDER BY r.name;

-- 4. Afficher toutes les permissions tâches pour vérification
SELECT 
    p.id,
    p.name,
    p.display_name,
    p.category,
    COUNT(rp.role_id) as assigned_to_roles_count
FROM permissions p
LEFT JOIN role_permissions rp ON p.id = rp.permission_id
WHERE p.category = 'gestion_taches'
GROUP BY p.id, p.name, p.display_name, p.category
ORDER BY p.name;