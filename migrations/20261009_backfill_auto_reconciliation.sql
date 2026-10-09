-- Backfill rapprochement automatique
--
-- Contexte : l'endpoint POST /api/deliveries/:id/validate ne posait pas
-- reconciled = true pour les fournisseurs en rapprochement automatique
-- (automatic_reconciliation = true). Ces livraisons n'apparaissaient ni dans
-- l'onglet "Manuels" (exclues car fournisseur auto) ni dans "Validées"
-- (reconciled = false). Même cas pour les livraisons antérieures au passage
-- d'un fournisseur en mode automatique.
--
-- Applique le même critère que l'auto-validation côté serveur :
-- livraison livrée + numéro de BL renseigné.

UPDATE deliveries d
SET reconciled = true,
    validated_at = COALESCE(d.validated_at, NOW())
FROM suppliers s
WHERE d.supplier_id = s.id
  AND s.automatic_reconciliation = true
  AND d.status = 'delivered'
  AND d.bl_number IS NOT NULL
  AND TRIM(d.bl_number) <> ''
  AND (d.reconciled IS NULL OR d.reconciled = false);
