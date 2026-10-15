// Lot 4, services partagés (cases/fournisseurs-services.ts) : entrées du cache des
// factures pour exercer le marquage « rapproché » et le diagnostic du cache.
type Query = (text: string, values?: unknown[]) => Promise<unknown>;

export async function seed(q: Query) {
  await q(`INSERT INTO invoice_verification_cache (id, cache_key, group_id, invoice_reference, supplier_name, invoice_amount, invoice_amount_ttc,
             due_date, exists, match_type, error_message, cache_hit, api_call_time, is_reconciled, expires_at, created_at, updated_at) VALUES
           -- Livraison 6 validée (Metz), entrée encore valable : marquée par la mise à jour en lot
           (400, '2_fac-2006', 2, 'FAC-2006', 'Jardin & Co', 450.25, 540.30, CURRENT_DATE - 5, true, 'invoice_reference', NULL, false, 80, false,
             CURRENT_DATE + 2, CURRENT_DATE - 3 + time '10:00', CURRENT_DATE - 3 + time '10:00'),
           -- Numéro de BL de la livraison 8, validée : recherche infructueuse en cache
           (401, '1_bl-0900', 1, 'BL-0900', NULL, NULL, NULL, NULL, false, 'none', 'Aucune correspondance trouvée dans NocoDB', false, NULL, false,
             CURRENT_DATE + 1, CURRENT_DATE - 1 + time '09:00', CURRENT_DATE - 1 + time '09:00'),
           -- Facture de la livraison 8, expirée : ni marquée, et supprimée à sa lecture
           (402, '1_fac-1900', 1, 'FAC-1900', 'Lactalis', 800.00, 960.00, CURRENT_DATE - 350, true, 'invoice_reference', NULL, false, 70, false,
             CURRENT_DATE - 1, CURRENT_DATE - 2 + time '09:00', CURRENT_DATE - 2 + time '09:00'),
           -- Clé au format du diagnostic (référence_magasin), expirée : supprimée par GET /api/cache/diagnosis
           (403, 'fac-2001_1', 1, 'FAC-2001', 'Lactalis', 1250.50, 1500.60, NULL, true, 'invoice_reference', NULL, false, NULL, false,
             CURRENT_DATE - 2, CURRENT_DATE - 30 + time '09:00', CURRENT_DATE - 30 + time '09:00'),
           -- Même format, valable : trouvée par le diagnostic
           (404, 'fac-2006_2', 2, 'FAC-2006', 'Jardin & Co', 450.25, 540.30, NULL, true, 'invoice_reference', NULL, false, NULL, true,
             CURRENT_DATE + 3, CURRENT_DATE - 30 + time '09:00', CURRENT_DATE - 30 + time '09:00')`);
}
