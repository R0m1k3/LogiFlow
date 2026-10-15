// Lot 4, commandes et livraisons (cases/fournisseurs-commandes.ts) : cas que les
// données de base n'exercent pas.
type Query = (text: string, values?: unknown[]) => Promise<unknown>;

export async function seed(q: Query) {
  // Commande de Metz dont le créateur n'existe plus (creator: null), en attente
  // alors que sa livraison est livrée (synchronisation des statuts)
  await q(`INSERT INTO orders (id, supplier_id, group_id, planned_date, quantity, unit, status, notes, created_by, created_at, updated_at) VALUES
           (600, 2, 2, CURRENT_DATE + 5, 6, 'colis', 'pending', 'Créateur supprimé', 'utilisateur_supprime',
             CURRENT_DATE - 2 + time '11:00', CURRENT_DATE - 2 + time '11:00')`);

  await q(`INSERT INTO deliveries (id, order_id, supplier_id, group_id, scheduled_date, delivered_date, quantity, unit, status, notes, bl_number, bl_amount,
             invoice_reference, invoice_amount, invoice_amount_ttc, due_date, reconciled, validated_at, control_validated, control_validated_by,
             control_validated_at, created_by, created_at, updated_at) VALUES
           -- Livraison de Nancy liée à la commande 600 de Metz : la commande n'est jamais jointe
           (600, 600, 2, 1, CURRENT_DATE - 3, CURRENT_DATE - 3 + time '15:00', 6, 'colis', 'delivered', 'Commande d''un autre magasin', 'BL-6000', 120.00,
             NULL, NULL, NULL, NULL, false, NULL, false, NULL, NULL, 'bench_manager', CURRENT_DATE - 4 + time '10:00', CURRENT_DATE - 3 + time '15:00'),
           -- Bonduelle (rapprochement automatique), prévue, créateur supprimé ; même date
           -- prévue que la livraison 7 (ordre à égalité de tri)
           (601, NULL, 2, 1, CURRENT_DATE + 2, NULL, 3, 'colis', 'planned', NULL, NULL, NULL,
             NULL, NULL, NULL, NULL, false, NULL, false, NULL, NULL, 'utilisateur_supprime', CURRENT_DATE - 1 + time '12:00', CURRENT_DATE - 1 + time '12:00'),
           -- Bonduelle à Metz, rapprochée d'office, sans facture (API externe)
           (602, NULL, 2, 2, CURRENT_DATE - 7, CURRENT_DATE - 7 + time '08:15', 4, 'colis', 'delivered', NULL, 'BL-6002', 88.40,
             NULL, NULL, NULL, NULL, true, CURRENT_DATE - 7 + time '08:20', false, NULL, NULL, 'bench_directeur', CURRENT_DATE - 8 + time '10:00', CURRENT_DATE - 7 + time '08:20')`);
}
