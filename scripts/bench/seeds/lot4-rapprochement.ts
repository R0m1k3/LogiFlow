// Lot 4, rapprochement (cases/fournisseurs-rapprochement.ts) : avoirs et échéancier
// (identifiants 700…).
// - avoirs hors de Nancy : un de Metz à vérifier dans NocoDB, un d'Épinal (aucun
//   compte du banc n'y est affecté, sauf l'administrateur) créé par un compte
//   supprimé depuis, et un avoir validé à la référence vide ;
// - livraisons que GET /api/payment-schedule complète avec NocoDB : échéance
//   absente (trouvée, introuvable, ou sans échéance dans NocoDB), montant TTC nul
//   (repli « TTC »), magasin d'Épinal sans configuration NocoDB ;
// - échéances aux bornes du mois courant (premier jour à minuit, dernière
//   microseconde, premier jour du mois suivant) pour l'export CSV.
type Query = (text: string, values?: unknown[]) => Promise<unknown>;

export async function seed(q: Query) {
  await q(`INSERT INTO avoirs (id, supplier_id, group_id, invoice_reference, amount, comment, commercial_processed, status, webhook_sent, nocodb_verified,
             nocodb_verified_at, processed_at, created_by, created_at, updated_at) VALUES
           (700, 2, 2, 'FAC-2006', 10.50, 'Remise oubliée', false, 'Demandé', false, false, NULL, NULL, 'bench_directeur',
             CURRENT_DATE - 3 + time '11:00', CURRENT_DATE - 3 + time '11:00'),
           (701, 1, 3, NULL, NULL, NULL, NULL, 'En attente de demande', NULL, NULL, NULL, NULL, 'compte_disparu',
             CURRENT_DATE - 2 + time '11:00', CURRENT_DATE - 2 + time '11:00'),
           (702, 4, 1, '  ', 0.00, '', true, 'Reçu', true, true, CURRENT_DATE - 1 + time '09:00', CURRENT_DATE - 1 + time '09:00', 'bench_employee',
             CURRENT_DATE - 1 + time '08:00', CURRENT_DATE - 1 + time '09:00')`);

  const month = `date_trunc('month', CURRENT_DATE::timestamp)`;
  await q(`INSERT INTO deliveries (id, order_id, supplier_id, group_id, scheduled_date, delivered_date, quantity, unit, status, notes, bl_number, bl_amount,
             invoice_reference, invoice_amount, invoice_amount_ttc, due_date, reconciled, validated_at, control_validated, created_by, created_at, updated_at) VALUES
           -- Échéance et montant absents : retrouvés dans NocoDB (FAC-2002)
           (700, NULL, 2, 1, CURRENT_DATE - 8, CURRENT_DATE - 8 + time '10:00', 3, 'colis', 'delivered', NULL, 'BL-7000', 300.00,
             'FAC-2002', NULL, NULL, NULL, false, CURRENT_DATE - 8 + time '10:10', false, 'bench_manager', CURRENT_DATE - 9 + time '10:00', CURRENT_DATE - 8 + time '10:10'),
           -- Référence introuvable dans NocoDB
           (701, NULL, 1, 1, CURRENT_DATE - 7, CURRENT_DATE - 7 + time '10:00', 1, 'colis', 'delivered', NULL, 'BL-7001', 50.00,
             'FAC-INCONNUE', NULL, NULL, NULL, false, CURRENT_DATE - 7 + time '10:10', false, 'bench_manager', CURRENT_DATE - 8 + time '09:00', CURRENT_DATE - 7 + time '10:10'),
           -- Trouvée sans échéance (avoir AV-3001) : seul le montant est repris
           (702, NULL, 3, 1, CURRENT_DATE - 6, CURRENT_DATE - 6 + time '10:00', 1, 'colis', 'delivered', NULL, NULL, NULL,
             'AV-3001', NULL, NULL, NULL, false, CURRENT_DATE - 6 + time '10:10', false, 'bench_manager', CURRENT_DATE - 7 + time '09:00', CURRENT_DATE - 6 + time '10:10'),
           -- Montant TTC nul : repli « TTC », qui réécrit le HT et l'échéance de NocoDB (FAC-2006)
           (703, NULL, 4, 1, CURRENT_DATE - 5, CURRENT_DATE - 5 + time '10:00', 2, 'palettes', 'delivered', NULL, 'BL-7003', 450.25,
             'FAC-2006', 450.25, 0.00, CURRENT_DATE + 3 + time '00:00', false, CURRENT_DATE - 5 + time '10:10', false, 'bench_manager', CURRENT_DATE - 6 + time '09:00', CURRENT_DATE - 5 + time '10:10'),
           -- Référence vide : hors échéancier
           (704, NULL, 2, 1, CURRENT_DATE - 4, CURRENT_DATE - 4 + time '10:00', 1, 'colis', 'delivered', NULL, NULL, NULL,
             '', 12.00, 14.40, CURRENT_DATE + 4, false, CURRENT_DATE - 4 + time '10:10', false, 'bench_manager', CURRENT_DATE - 5 + time '09:00', CURRENT_DATE - 4 + time '10:10'),
           -- Metz : échéance absente, retrouvée dans NocoDB (FAC-2001)
           (705, NULL, 1, 2, CURRENT_DATE - 4, CURRENT_DATE - 4 + time '11:00', 4, 'colis', 'delivered', NULL, 'BL-7005', 1200.00,
             'FAC-2001', NULL, NULL, NULL, false, CURRENT_DATE - 4 + time '11:10', false, 'bench_directeur', CURRENT_DATE - 5 + time '11:00', CURRENT_DATE - 4 + time '11:10'),
           -- Épinal : magasin sans configuration NocoDB
           (706, NULL, 3, 3, CURRENT_DATE - 3, CURRENT_DATE - 3 + time '11:00', 1, 'palettes', 'delivered', NULL, 'BL-7006', 99.00,
             'FAC-2004', NULL, NULL, NULL, false, CURRENT_DATE - 3 + time '11:10', false, 'admin_local', CURRENT_DATE - 4 + time '11:00', CURRENT_DATE - 3 + time '11:10'),
           (707, NULL, 4, 3, CURRENT_DATE - 3, CURRENT_DATE - 3 + time '12:00', 1, 'palettes', 'delivered', NULL, 'BL-7007', 80.00,
             'FAC-7007', 80.00, 96.00, ${month} + interval '12 days', false, CURRENT_DATE - 3 + time '12:10', false, 'admin_local', CURRENT_DATE - 4 + time '12:00', CURRENT_DATE - 3 + time '12:10'),
           -- Bornes du mois courant (export CSV)
           (708, NULL, 1, 1, CURRENT_DATE - 2, CURRENT_DATE - 2 + time '09:00', 1, 'colis', 'delivered', NULL, 'BL-7008', 100.00,
             'FAC-7008', 100.00, 120.00, ${month}, false, CURRENT_DATE - 2 + time '09:10', false, 'bench_manager', CURRENT_DATE - 3 + time '08:00', CURRENT_DATE - 2 + time '09:10'),
           (709, NULL, 2, 1, CURRENT_DATE - 2, CURRENT_DATE - 2 + time '10:00', 1, 'colis', 'delivered', NULL, 'BL-7009', 20.10,
             'FAC-7009', 20.10, 24.12, ${month} + interval '1 month' - interval '1 microsecond', false, CURRENT_DATE - 2 + time '10:10', false, 'bench_manager', CURRENT_DATE - 3 + time '08:30', CURRENT_DATE - 2 + time '10:10'),
           (710, NULL, 4, 1, CURRENT_DATE - 1, CURRENT_DATE - 1 + time '09:00', 1, 'colis', 'delivered', NULL, 'BL-7010', 55.55,
             'FAC-7010', 55.55, 66.66, ${month} + interval '1 month', false, CURRENT_DATE - 1 + time '09:10', false, 'bench_manager', CURRENT_DATE - 2 + time '08:00', CURRENT_DATE - 1 + time '09:10'),
           (711, NULL, 3, 1, CURRENT_DATE - 1, CURRENT_DATE - 1 + time '10:00', 1, 'colis', 'delivered', NULL, 'BL-7011', 0.10,
             'FAC-7011', 0.10, 0.20, ${month} + interval '14 days 10:30', false, CURRENT_DATE - 1 + time '10:10', false, 'bench_manager', CURRENT_DATE - 2 + time '08:30', CURRENT_DATE - 1 + time '10:10'),
           -- Échéances de NocoDB au format JJ/MM/AAAA (illisible par new Date) et MM/JJ/AAAA
           (712, NULL, 2, 1, CURRENT_DATE - 1, CURRENT_DATE - 1 + time '11:00', 1, 'colis', 'delivered', NULL, 'BL-1007', 99.90,
             'FAC-2007', NULL, NULL, NULL, false, CURRENT_DATE - 1 + time '11:10', false, 'bench_manager', CURRENT_DATE - 2 + time '09:00', CURRENT_DATE - 1 + time '11:10'),
           (713, NULL, 3, 1, CURRENT_DATE - 1, CURRENT_DATE - 1 + time '12:00', 1, 'colis', 'delivered', NULL, 'BL-1008', 12.34,
             'FAC-2008', NULL, NULL, NULL, true, CURRENT_DATE - 1 + time '12:10', false, 'bench_manager', CURRENT_DATE - 2 + time '09:30', CURRENT_DATE - 1 + time '12:10')`);
}
