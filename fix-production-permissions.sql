-- Script SQL COMPLET pour corriger les rôles ET permissions en production
-- Exécutez ce script sur votre base de données de production

-- ========================================
-- PARTIE 1: CORRECTION DES RÔLES
-- ========================================

-- Mise à jour des rôles avec les displayName français
UPDATE roles SET display_name = 'Administrateur' WHERE name = 'admin';
UPDATE roles SET display_name = 'Manager' WHERE name = 'manager';
UPDATE roles SET display_name = 'Employé' WHERE name = 'employee' OR name = 'employé';
UPDATE roles SET display_name = 'Directeur' WHERE name = 'directeur';

-- ========================================
-- PARTIE 2: CORRECTION DES PERMISSIONS
-- ========================================

-- Mise à jour des permissions avec les displayName français

-- Administration
UPDATE permissions SET display_name = 'Administration système' WHERE name = 'system_admin';
UPDATE permissions SET display_name = 'Configuration NocoDB' WHERE name = 'nocodb_config';

-- Calendrier
UPDATE permissions SET display_name = 'Voir calendrier' WHERE name = 'calendar_read';
UPDATE permissions SET display_name = 'Créer événements' WHERE name = 'calendar_create';
UPDATE permissions SET display_name = 'Modifier calendrier' WHERE name = 'calendar_update';
UPDATE permissions SET display_name = 'Supprimer événements' WHERE name = 'calendar_delete';

-- Tableau de bord
UPDATE permissions SET display_name = 'Voir tableau de bord' WHERE name = 'dashboard_read';

-- Livraisons
UPDATE permissions SET display_name = 'Voir livraisons' WHERE name = 'deliveries_read';
UPDATE permissions SET display_name = 'Créer livraisons' WHERE name = 'deliveries_create';
UPDATE permissions SET display_name = 'Modifier livraisons' WHERE name = 'deliveries_update';
UPDATE permissions SET display_name = 'Supprimer livraisons' WHERE name = 'deliveries_delete';
UPDATE permissions SET display_name = 'Valider livraisons' WHERE name = 'deliveries_validate';

-- Magasins
UPDATE permissions SET display_name = 'Voir magasins' WHERE name = 'groups_read';
UPDATE permissions SET display_name = 'Créer magasins' WHERE name = 'groups_create';
UPDATE permissions SET display_name = 'Modifier magasins' WHERE name = 'groups_update';
UPDATE permissions SET display_name = 'Supprimer magasins' WHERE name = 'groups_delete';

-- Commandes
UPDATE permissions SET display_name = 'Voir commandes' WHERE name = 'orders_read';
UPDATE permissions SET display_name = 'Créer commandes' WHERE name = 'orders_create';
UPDATE permissions SET display_name = 'Modifier commandes' WHERE name = 'orders_update';
UPDATE permissions SET display_name = 'Supprimer commandes' WHERE name = 'orders_delete';

-- Publicités
UPDATE permissions SET display_name = 'Voir publicités' WHERE name = 'publicities_read';
UPDATE permissions SET display_name = 'Créer publicités' WHERE name = 'publicities_create';
UPDATE permissions SET display_name = 'Modifier publicités' WHERE name = 'publicities_update';
UPDATE permissions SET display_name = 'Supprimer publicités' WHERE name = 'publicities_delete';
UPDATE permissions SET display_name = 'Participer aux publicités' WHERE name = 'publicities_participate';

-- Rapprochement
UPDATE permissions SET display_name = 'Voir rapprochements' WHERE name = 'reconciliation_read';
UPDATE permissions SET display_name = 'Créer rapprochements' WHERE name = 'reconciliation_create';
UPDATE permissions SET display_name = 'Modifier rapprochements' WHERE name = 'reconciliation_update';
UPDATE permissions SET display_name = 'Supprimer rapprochements' WHERE name = 'reconciliation_delete';

-- Fournisseurs
UPDATE permissions SET display_name = 'Voir fournisseurs' WHERE name = 'suppliers_read';
UPDATE permissions SET display_name = 'Créer fournisseurs' WHERE name = 'suppliers_create';
UPDATE permissions SET display_name = 'Modifier fournisseurs' WHERE name = 'suppliers_update';
UPDATE permissions SET display_name = 'Supprimer fournisseurs' WHERE name = 'suppliers_delete';

-- Commandes clients
UPDATE permissions SET display_name = 'Voir commandes clients' WHERE name = 'customer_orders_read';
UPDATE permissions SET display_name = 'Créer commandes clients' WHERE name = 'customer_orders_create';
UPDATE permissions SET display_name = 'Modifier commandes clients' WHERE name = 'customer_orders_update';
UPDATE permissions SET display_name = 'Supprimer commandes clients' WHERE name = 'customer_orders_delete';
UPDATE permissions SET display_name = 'Imprimer étiquettes' WHERE name = 'customer_orders_print';
UPDATE permissions SET display_name = 'Notifier clients' WHERE name = 'customer_orders_notify';

-- Utilisateurs
UPDATE permissions SET display_name = 'Voir utilisateurs' WHERE name = 'users_read';
UPDATE permissions SET display_name = 'Créer utilisateurs' WHERE name = 'users_create';
UPDATE permissions SET display_name = 'Modifier utilisateurs' WHERE name = 'users_update';
UPDATE permissions SET display_name = 'Supprimer utilisateurs' WHERE name = 'users_delete';

-- Gestion des rôles
UPDATE permissions SET display_name = 'Voir rôles' WHERE name = 'roles_read';
UPDATE permissions SET display_name = 'Créer rôles' WHERE name = 'roles_create';
UPDATE permissions SET display_name = 'Modifier rôles' WHERE name = 'roles_update';
UPDATE permissions SET display_name = 'Supprimer rôles' WHERE name = 'roles_delete';

-- Gestion DLC (déjà corrects normalement)
UPDATE permissions SET display_name = 'Voir produits DLC' WHERE name = 'dlc_read';
UPDATE permissions SET display_name = 'Créer produits DLC' WHERE name = 'dlc_create';
UPDATE permissions SET display_name = 'Modifier produits DLC' WHERE name = 'dlc_update';
UPDATE permissions SET display_name = 'Supprimer produits DLC' WHERE name = 'dlc_delete';
UPDATE permissions SET display_name = 'Valider produits DLC' WHERE name = 'dlc_validate';
UPDATE permissions SET display_name = 'Imprimer étiquettes DLC' WHERE name = 'dlc_print';
UPDATE permissions SET display_name = 'Voir statistiques DLC' WHERE name = 'dlc_stats';

-- Rapprochement BL
UPDATE permissions SET display_name = 'Voir rapprochements BL' WHERE name = 'bl_reconciliation_read';
UPDATE permissions SET display_name = 'Modifier rapprochements BL' WHERE name = 'bl_reconciliation_update';

-- ========================================
-- VÉRIFICATIONS FINALES
-- ========================================

-- Vérifier les rôles après mise à jour
SELECT name, display_name FROM roles ORDER BY name;

-- Vérifier les permissions après mise à jour
SELECT name, display_name, category FROM permissions ORDER BY category, name;

-- Compter les éléments corrigés
SELECT 
  'RÔLES' as type,
  COUNT(*) as total,
  COUNT(CASE WHEN display_name != name THEN 1 END) as avec_traduction_francaise
FROM roles
UNION ALL
SELECT 
  'PERMISSIONS' as type,
  COUNT(*) as total,
  COUNT(CASE WHEN display_name != name THEN 1 END) as avec_traduction_francaise
FROM permissions;