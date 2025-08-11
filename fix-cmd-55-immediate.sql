-- Script de correction immédiate pour CMD-55 et autres commandes similaires
-- À exécuter directement sur votre base de données de production

-- 1. Identifier CMD-55 et son statut actuel
SELECT 
  o.id as order_id,
  o.status as current_order_status,
  COUNT(d.id) as total_deliveries,
  COUNT(CASE WHEN d.status = 'delivered' THEN 1 END) as delivered_deliveries,
  string_agg(d.status, ', ') as delivery_statuses
FROM orders o
LEFT JOIN deliveries d ON o.id = d."orderId"
WHERE o.id = 55
GROUP BY o.id, o.status;

-- 2. Corriger CMD-55 directement si elle a des livraisons delivered
UPDATE orders 
SET status = 'delivered'
WHERE id = 55 
  AND status != 'delivered'
  AND EXISTS (
    SELECT 1 FROM deliveries d 
    WHERE d."orderId" = 55 
    AND d.status = 'delivered'
  );

-- 3. Vérifier que la correction a été appliquée
SELECT 
  o.id as order_id,
  o.status as new_order_status,
  COUNT(d.id) as total_deliveries,
  COUNT(CASE WHEN d.status = 'delivered' THEN 1 END) as delivered_deliveries
FROM orders o
LEFT JOIN deliveries d ON o.id = d."orderId"
WHERE o.id = 55
GROUP BY o.id, o.status;

-- 4. BONUS: Corriger toutes les autres commandes dans la même situation
UPDATE orders 
SET status = 'delivered'
WHERE status != 'delivered'
  AND EXISTS (
    SELECT 1 FROM deliveries d 
    WHERE d."orderId" = orders.id 
    AND d.status = 'delivered'
  );

-- 5. Voir toutes les commandes qui ont été corrigées
SELECT 
  o.id as order_id,
  o.status as order_status,
  COUNT(d.id) as total_deliveries,
  COUNT(CASE WHEN d.status = 'delivered' THEN 1 END) as delivered_deliveries
FROM orders o
LEFT JOIN deliveries d ON o.id = d."orderId"
WHERE o.status = 'delivered'
  AND EXISTS (
    SELECT 1 FROM deliveries d2 
    WHERE d2."orderId" = o.id 
    AND d2.status = 'delivered'
  )
GROUP BY o.id, o.status
ORDER BY o.id;