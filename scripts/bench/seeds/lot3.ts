// Lot 3 « Au quotidien » : tâches, DLC, commandes clients et SAV (identifiants 300…).
// Complète seed.ts pour exercer ce que ses lignes ne couvrent pas : une ligne du
// magasin d'Épinal (aucun compte du banc n'y est affecté, sauf l'administrateur),
// les bornes de date des filtres (aujourd'hui, J+15, J+16) et des tâches
// programmées plus tard dans la journée.
type Query = (text: string, values?: unknown[]) => Promise<unknown>;

export async function seed(q: Query) {
  await q(`INSERT INTO tasks (id, title, description, start_date, due_date, priority, status, assigned_to, created_by, group_id, completed_at, completed_by, created_at, updated_at) VALUES
           (300, 'Inventaire Épinal', 'Magasin sans compte du banc', NULL, CURRENT_DATE + 4, 'medium', 'pending', 'Équipe Épinal', 'admin_local', 3, NULL, NULL, CURRENT_DATE - 2 + time '09:00', CURRENT_DATE - 2 + time '09:00'),
           (301, 'Réception livraison', NULL, CURRENT_DATE + time '00:00', CURRENT_DATE, 'high', 'pending', 'Marc', 'bench_manager', 1, NULL, NULL, CURRENT_DATE - 1 + time '07:00', CURRENT_DATE - 1 + time '07:00'),
           (302, 'Préparer la vitrine', NULL, CURRENT_DATE + time '10:00', CURRENT_DATE + 1, 'low', 'pending', 'Sophie', 'bench_directeur', 1, NULL, NULL, CURRENT_DATE - 1 + time '06:00', CURRENT_DATE - 1 + time '06:00'),
           (303, 'Commande ancienne', NULL, CURRENT_DATE - 10 + time '08:00', CURRENT_DATE - 9, 'medium', 'completed', 'Léa', 'bench_directeur', 2, CURRENT_DATE - 9 + time '17:00', 'bench_directeur', CURRENT_DATE - 12 + time '08:00', CURRENT_DATE - 9 + time '17:00')`);

  await q(`INSERT INTO dlc_products (id, name, product_name, gencode, supplier_id, group_id, expiry_date, date_type, quantity, unit, location, alert_threshold,
             status, stock_epuise, stock_epuise_by, stock_epuise_at, processed_at, processed_by, processed_until_expiry, notes, created_by,
             validated_by, validated_at, created_at, updated_at) VALUES
           (300, 'Saucisson', 'Saucisson sec', '3000000000301', 1, 3, CURRENT_DATE + 5, 'dlc', 8, 'unité', 'Magasin', 15,
             'en_cours', false, NULL, NULL, NULL, NULL, false, NULL, 'admin_local', NULL, NULL, CURRENT_DATE - 2 + time '08:30', CURRENT_DATE - 2 + time '08:30'),
           (301, 'Lait demi-écrémé', 'Lait demi-écrémé 1 L', '3000000000318', 1, 1, CURRENT_DATE + 30, 'dlc', 20, 'unité', 'Réserve', 15,
             'en_cours', false, NULL, NULL, NULL, NULL, false, NULL, 'bench_employee', NULL, NULL, CURRENT_DATE - 1 + time '08:30', CURRENT_DATE - 1 + time '08:30'),
           (302, 'Compote', 'Compote pomme x4', '3000000000325', 2, 1, CURRENT_DATE, 'ddm', 5, 'unité', 'Magasin', 15,
             'en_cours', false, NULL, NULL, NULL, NULL, false, NULL, 'bench_manager', NULL, NULL, CURRENT_DATE - 8 + time '08:30', CURRENT_DATE - 8 + time '08:30'),
           (303, 'Jus d''orange', NULL, NULL, 2, 1, CURRENT_DATE + 15, 'dluo', 3, 'unité', 'Magasin', 15,
             'en_cours', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'bench_manager', NULL, NULL, CURRENT_DATE - 6 + time '09:30', CURRENT_DATE - 6 + time '09:30'),
           (304, 'Fromage blanc', 'Fromage blanc 500 g', '3000000000349', 1, 2, CURRENT_DATE + 16, 'dlc', 7, 'unité', 'Rayon frais', 15,
             'en_cours', false, NULL, NULL, NULL, NULL, false, NULL, 'bench_directeur', NULL, NULL, CURRENT_DATE - 4 + time '10:30', CURRENT_DATE - 4 + time '10:30'),
           (305, 'Pâté de campagne', 'Pâté de campagne 180 g', '3000000000356', 1, 1, CURRENT_DATE - 5, 'dlc', 2, 'unité', 'Rayon frais', 15,
             'valides', false, NULL, NULL, NULL, NULL, false, 'Retiré du rayon', 'bench_employee', 'bench_manager', CURRENT_DATE - 5 + time '08:00', CURRENT_DATE - 12 + time '08:30', CURRENT_DATE - 5 + time '08:00')`);

  await q(`INSERT INTO customer_orders (id, order_taker, customer_name, customer_phone, customer_email, product_designation, product_reference, gencode,
             quantity, supplier_id, status, deposit, is_promotional_price, customer_notified, notes, group_id, created_by, created_at, updated_at,
             notified_at, notified_comment) VALUES
           (300, 'Hugo', 'M. Colin', '06 66 66 66 66', NULL, 'Tronçonneuse', 'TR-35', '3245678901300', 1, 3,
             'Arrivé', 20.00, false, false, NULL, 3, 'admin_local', CURRENT_DATE - 4 + time '12:00', CURRENT_DATE - 1 + time '12:00', NULL, NULL),
           (301, 'Sophie', 'Mme Robert', '06 77 77 77 77', 'robert@client.test', 'Plateau de fromages', NULL, '3245678901317', 1, 1,
             'prêt', 0.00, false, false, 'Pour samedi', 1, 'bench_employee', CURRENT_DATE - 2 + time '09:00', CURRENT_DATE + time '06:00', NULL, NULL),
           (302, 'Léa', 'M. Simon', '06 88 88 88 88', NULL, 'Sécateur', 'SC-20', '3245678901324', 2, 4,
             'Disponible', 0.00, false, NULL, NULL, 2, 'bench_directeur', CURRENT_DATE - 7 + time '09:00', CURRENT_DATE - 3 + time '09:00', NULL, NULL),
           (303, 'Léa', 'Mme Michel', '06 99 99 99 99', NULL, 'Terreau 40 L', NULL, '3245678901331', 4, 4,
             'Prêt', 5.50, true, false, NULL, 2, 'bench_directeur', CURRENT_DATE - 9 + time '09:00', CURRENT_DATE - 2 + time '09:00', NULL, NULL)`);

  // 301 : créé l'an dernier (hors du compte qui numérote les nouveaux tickets),
  // par un compte supprimé depuis (créateur absent de la jointure)
  const year = new Date().getFullYear();
  await q(`INSERT INTO sav_tickets (id, ticket_number, supplier_id, group_id, product_gencode, product_reference, product_designation, problem_type,
             problem_description, resolution_description, status, priority, client_name, client_phone, created_by, created_at, updated_at, resolved_at, closed_at) VALUES
           (300, $1, 2, 3, '3245678901300', 'TR-35', 'Tronçonneuse', 'autre', 'Chaîne bloquée', NULL, 'en_cours', 'critique', 'M. Colin', '06 66 66 66 66', 'admin_local', CURRENT_DATE - 3 + time '11:00', CURRENT_DATE - 1 + time '11:00', NULL, NULL),
           (301, $2, 1, 1, '3000000000011', NULL, 'Yaourt nature', 'non_conforme', 'Emballage gonflé', 'Remboursé', 'ferme', 'normale', NULL, NULL, 'utilisateur_supprime', CURRENT_DATE - 400 + time '10:00', CURRENT_DATE - 390 + time '10:00', CURRENT_DATE - 395 + time '10:00', CURRENT_DATE - 390 + time '10:00'),
           (302, $3, 4, 2, '3245678901324', 'SC-20', 'Sécateur', 'defectueux', 'Ressort cassé', NULL, 'attente_echange', 'faible', 'M. Simon', NULL, 'bench_directeur', CURRENT_DATE - 6 + time '14:00', CURRENT_DATE - 6 + time '14:00', NULL, NULL)`,
    [`SAV-${year}-0004`, `SAV-${year - 1}-0042`, `SAV-${year}-0005`]);
}
