-- Script de synchronisation immédiate des statuts commandes/livraisons
-- Exécuter directement sur la base de données de production

-- Étape 1: Diagnostic - Afficher les commandes problématiques
SELECT 
    o.id as order_id,
    o.status as order_status,
    d.id as delivery_id,
    d.status as delivery_status,
    d.delivered_date,
    o.supplier_id,
    s.name as supplier_name
FROM orders o
JOIN deliveries d ON d.order_id = o.id  
JOIN suppliers s ON o.supplier_id = s.id
WHERE d.status = 'delivered' AND o.status != 'delivered'
ORDER BY o.id;

-- Étape 2: Mise à jour automatique des statuts
-- Marquer toutes les commandes comme "delivered" si au moins une de leurs livraisons est livrée
UPDATE orders 
SET status = 'delivered'
WHERE id IN (
    SELECT DISTINCT o.id 
    FROM orders o
    JOIN deliveries d ON d.order_id = o.id
    WHERE d.status = 'delivered' AND o.status != 'delivered'
);

-- Étape 3: Mise à jour des dates de livraison manquantes
-- Ajouter delivered_date aux livraisons qui ont le status 'delivered' mais pas de date
UPDATE deliveries
SET delivered_date = scheduled_date
WHERE status = 'delivered' 
  AND delivered_date IS NULL 
  AND scheduled_date IS NOT NULL;

-- Étape 4: Pour les livraisons sans scheduled_date, utiliser la date de création + 1 jour
UPDATE deliveries
SET delivered_date = DATE(created_at) + INTERVAL '1 day'
WHERE status = 'delivered' 
  AND delivered_date IS NULL 
  AND scheduled_date IS NULL;

-- Étape 5: Diagnostic final - Vérifier les résultats
SELECT 
    'RÉSULTAT FINAL' as status,
    COUNT(*) as total_orders,
    SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered_orders,
    SUM(CASE WHEN status = 'planned' THEN 1 ELSE 0 END) as planned_orders
FROM orders;

SELECT 
    'LIVRAISONS MISES À JOUR' as status,
    COUNT(*) as total_delivered_deliveries,
    SUM(CASE WHEN delivered_date IS NOT NULL THEN 1 ELSE 0 END) as with_delivered_date,
    SUM(CASE WHEN delivered_date IS NULL THEN 1 ELSE 0 END) as missing_delivered_date
FROM deliveries 
WHERE status = 'delivered';

-- Afficher la commande CMD-55 spécifiquement
SELECT 
    'COMMANDE CMD-55' as status,
    o.id,
    o.status as order_status,
    o.planned_date,
    d.status as delivery_status, 
    d.delivered_date,
    d.scheduled_date,
    s.name as supplier
FROM orders o
LEFT JOIN deliveries d ON d.order_id = o.id
JOIN suppliers s ON o.supplier_id = s.id
WHERE o.id = 55;