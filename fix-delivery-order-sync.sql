-- Script pour diagnostiquer et corriger la synchronisation des statuts commandes/livraisons
-- À exécuter en production pour résoudre les problèmes de dates et statuts

-- 1. Diagnostiquer les livraisons avec statut "delivered" mais dates manquantes
SELECT 'Livraisons livrées sans date de livraison:' as diagnostic, 
       COUNT(*) as count
FROM deliveries 
WHERE status = 'delivered' AND delivered_date IS NULL;

-- Afficher les détails
SELECT d.id, d.status, d.scheduled_date, d.delivered_date, d.validated_at,
       o.id as order_id, o.status as order_status
FROM deliveries d
LEFT JOIN orders o ON d.order_id = o.id
WHERE d.status = 'delivered' AND d.delivered_date IS NULL
LIMIT 10;

-- 2. Diagnostiquer les commandes avec livraisons livrées mais statut incorrect
SELECT 'Commandes avec livraisons livrées mais pas en statut delivered:' as diagnostic,
       COUNT(*) as count
FROM orders o
WHERE EXISTS (
    SELECT 1 FROM deliveries d 
    WHERE d.order_id = o.id AND d.status = 'delivered'
) AND o.status != 'delivered';

-- Afficher les détails
SELECT o.id as order_id, o.status as order_status, o.planned_date,
       COUNT(d.id) as total_deliveries,
       SUM(CASE WHEN d.status = 'delivered' THEN 1 ELSE 0 END) as delivered_deliveries
FROM orders o
LEFT JOIN deliveries d ON d.order_id = o.id
WHERE EXISTS (
    SELECT 1 FROM deliveries d2 
    WHERE d2.order_id = o.id AND d2.status = 'delivered'
) AND o.status != 'delivered'
GROUP BY o.id, o.status, o.planned_date
LIMIT 10;

-- 3. Corriger les livraisons livrées sans date de livraison
UPDATE deliveries 
SET delivered_date = COALESCE(validated_at, updated_at, created_at)
WHERE status = 'delivered' AND delivered_date IS NULL;

-- 4. Corriger les statuts des commandes liées aux livraisons livrées
UPDATE orders 
SET status = 'delivered', updated_at = NOW()
WHERE id IN (
    SELECT DISTINCT d.order_id 
    FROM deliveries d 
    WHERE d.order_id IS NOT NULL 
      AND d.status = 'delivered'
      AND d.order_id NOT IN (
          SELECT o.id FROM orders o WHERE o.status = 'delivered'
      )
);

-- 5. Vérification finale
SELECT 'Vérification finale - Commandes avec statuts corrects:' as final_check,
       COUNT(*) as count
FROM orders o
WHERE EXISTS (
    SELECT 1 FROM deliveries d 
    WHERE d.order_id = o.id AND d.status = 'delivered'
) AND o.status = 'delivered';

-- Afficher un résumé des corrections
SELECT 
    'Résumé des corrections:' as summary,
    (SELECT COUNT(*) FROM deliveries WHERE status = 'delivered') as total_delivered_deliveries,
    (SELECT COUNT(*) FROM deliveries WHERE status = 'delivered' AND delivered_date IS NOT NULL) as deliveries_with_date,
    (SELECT COUNT(*) FROM orders WHERE status = 'delivered') as total_delivered_orders;