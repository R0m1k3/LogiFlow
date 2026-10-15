// Données du banc : 3 magasins, 5 comptes (un par profil à tester) et quelques
// lignes dans chaque table, datées par rapport au jour du passage pour que les
// alertes (DLC, retards, échéances) aient toujours quelque chose à montrer.
// Usage : DATABASE_URL=… SESSION_SECRET=… npx tsx scripts/bench/seed.ts
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import { scryptSync, createHash } from "crypto";
import { encryptSecret } from "../../server/crypto";
import { BENCH_ACCOUNTS, BENCH_API_KEY, STUB_URL, STUB_SMTP_PORT } from "./config";

// Même format que server/localAuth.ts : empreinte_hex.sel_hex, le sel hexadécimal
// servant tel quel de texte. Sel fixe pour un banc reproductible.
function hashPassword(password: string, salt: string): string {
  return `${scryptSync(password, salt, 64).toString("hex")}.${salt}`;
}

// Petit PNG 1×1 : un magasin a un logo, comme en production
const LOGO = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

async function main() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const q = (text: string, values: unknown[] = []) => client.query(text, values);

  await q("BEGIN");

  await q(`INSERT INTO nocodb_config (id, name, base_url, project_id, api_token, description, is_active, created_by, created_at, updated_at)
           VALUES (1, 'NocoDB banc', $1, 'pbench', $2, 'Service simulé du banc', true, 'admin_local', CURRENT_DATE - 30 + time '08:00', CURRENT_DATE - 30 + time '08:00')`,
    [`${STUB_URL}/nocodb`, encryptSecret("nocodb-token-banc")]);

  await q(`INSERT INTO groups (id, name, color, nocodb_config_id, nocodb_table_name, nocodb_table_id, invoice_column_name, nocodb_bl_column_name,
             nocodb_amount_column_name, nocodb_invoice_amount_ttc_column_name, nocodb_supplier_column_name, nocodb_due_date_column_name,
             webhook_url, address, phone, logo, smtp_enabled, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_password,
             smtp_sender_email, smtp_sender_name, created_at, updated_at) VALUES
           (1, 'Magasin Nancy', '#1976D2', 1, 'factures', 'tnancy', 'RefFacture', 'NumBL', 'MontantHT', 'MontantTTC', 'Fournisseur', 'Echeance',
             $1, '12 rue des Dominicains, 54000 Nancy', '03 83 00 00 01', $2, true, '127.0.0.1', $3, false, 'nancy@banc.test', $4,
             'nancy@banc.test', 'Magasin Nancy', CURRENT_DATE - 400 + time '08:00', CURRENT_DATE - 10 + time '08:00'),
           (2, 'Magasin Metz', '#388E3C', 1, 'factures', 'tmetz', 'RefFacture', 'NumBL', 'MontantHT', 'MontantTTC', 'Fournisseur', 'Echeance',
             NULL, NULL, NULL, NULL, false, NULL, NULL, false, NULL, NULL, NULL, NULL, CURRENT_DATE - 300 + time '08:00', CURRENT_DATE - 300 + time '08:00'),
           (3, 'Magasin Épinal', '#F57C00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
             NULL, NULL, NULL, NULL, false, NULL, NULL, false, NULL, NULL, NULL, NULL, CURRENT_DATE - 200 + time '08:00', CURRENT_DATE - 200 + time '08:00')`,
    [`${STUB_URL}/webhook/avoirs`, LOGO, STUB_SMTP_PORT, encryptSecret("smtp-secret-banc")]);

  for (const account of BENCH_ACCOUNTS) {
    await q(`INSERT INTO users (id, username, email, first_name, last_name, password, role, password_changed, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, true, CURRENT_DATE - 100 + time '08:00', CURRENT_DATE - 100 + time '08:00')`,
      [account.id, account.username, `${account.username}@banc.test`, account.firstName, account.lastName,
        hashPassword(account.password, createHash("md5").update(account.username).digest("hex")), account.role]);
    for (const groupId of account.groupIds) {
      await q(`INSERT INTO user_groups (user_id, group_id, created_at) VALUES ($1, $2, CURRENT_DATE - 100 + time '08:00')`, [account.id, groupId]);
    }
  }

  await q(`INSERT INTO suppliers (id, name, contact, phone, has_dlc, payment_method, automatic_reconciliation, requires_control, email, codefou, created_at, updated_at) VALUES
           (1, 'Lactalis', 'M. Durand', '01 00 00 00 01', true, 'virement', false, false, 'commandes@lactalis.test', 'F001', CURRENT_DATE - 500 + time '08:00', CURRENT_DATE - 500 + time '08:00'),
           (2, 'Bonduelle', 'Mme Petit', '01 00 00 00 02', true, 'prelevement', true, false, 'factures@bonduelle.test', 'F002', CURRENT_DATE - 490 + time '08:00', CURRENT_DATE - 490 + time '08:00'),
           (3, 'Brico Pro', NULL, NULL, false, 'cheque', false, true, NULL, NULL, CURRENT_DATE - 480 + time '08:00', CURRENT_DATE - 480 + time '08:00'),
           (4, 'Jardin & Co', 'M. Martin', '01 00 00 00 04', false, NULL, false, false, 'contact@jardin.test', 'F004', CURRENT_DATE - 470 + time '08:00', CURRENT_DATE - 470 + time '08:00')`);

  await q(`INSERT INTO contacts (id, group_id, name, company, role, phone, email, notes, created_at, updated_at) VALUES
           (1, 1, 'Paul Lefort', 'Lactalis', 'Commercial', '06 00 00 00 01', 'paul@lactalis.test', 'Passe le mardi', CURRENT_DATE - 50 + time '09:00', CURRENT_DATE - 50 + time '09:00'),
           (2, 1, 'Agence intérim', NULL, NULL, '03 83 00 00 99', NULL, NULL, CURRENT_DATE - 40 + time '09:00', CURRENT_DATE - 40 + time '09:00'),
           (3, 2, 'Julie Roux', 'Bonduelle', 'Livraisons', '06 00 00 00 03', NULL, NULL, CURRENT_DATE - 30 + time '09:00', CURRENT_DATE - 30 + time '09:00')`);

  await q(`INSERT INTO orders (id, supplier_id, group_id, planned_date, quantity, unit, status, notes, created_by, created_at, updated_at) VALUES
           (1, 1, 1, CURRENT_DATE - 20, 10, 'palettes', 'delivered', 'Commande mensuelle', 'admin_local', CURRENT_DATE - 25 + time '10:00', CURRENT_DATE - 20 + time '10:00'),
           (2, 2, 1, CURRENT_DATE - 2, 5, 'colis', 'planned', NULL, 'bench_manager', CURRENT_DATE - 6 + time '10:00', CURRENT_DATE - 5 + time '10:00'),
           (3, 3, 1, CURRENT_DATE + 3, 2, 'palettes', 'pending', 'Urgent', 'bench_manager', CURRENT_DATE - 1 + time '10:00', CURRENT_DATE - 1 + time '10:00'),
           (4, 1, 2, CURRENT_DATE, 8, 'colis', 'pending', NULL, 'bench_directeur', CURRENT_DATE - 3 + time '10:00', CURRENT_DATE - 3 + time '10:00'),
           (5, 4, 2, CURRENT_DATE - 40, 3, 'palettes', 'delivered', NULL, 'bench_directeur', CURRENT_DATE - 45 + time '10:00', CURRENT_DATE - 40 + time '10:00'),
           (6, 2, 3, CURRENT_DATE + 10, 1, 'palettes', 'pending', NULL, 'admin_local', CURRENT_DATE + time '07:30', CURRENT_DATE + time '07:30'),
           (7, 1, 1, CURRENT_DATE - 380, 4, 'palettes', 'delivered', 'Année précédente', 'admin_local', CURRENT_DATE - 385 + time '10:00', CURRENT_DATE - 380 + time '10:00')`);

  await q(`INSERT INTO deliveries (id, order_id, supplier_id, group_id, scheduled_date, delivered_date, quantity, unit, status, notes, bl_number, bl_amount,
             invoice_reference, invoice_amount, invoice_amount_ttc, due_date, reconciled, validated_at, control_validated, control_validated_by,
             control_validated_at, created_by, created_at, updated_at) VALUES
           (1, 1, 1, 1, CURRENT_DATE - 20, CURRENT_DATE - 20 + time '11:00', 10, 'palettes', 'delivered', NULL, 'BL-1001', 1250.50,
             'FAC-2001', 1250.50, 1500.60, CURRENT_DATE + 10, true, CURRENT_DATE - 20 + time '11:05', false, NULL, NULL, 'admin_local', CURRENT_DATE - 21 + time '10:00', CURRENT_DATE - 19 + time '10:00'),
           (2, NULL, 2, 1, CURRENT_DATE - 5, CURRENT_DATE - 5 + time '14:00', 6, 'colis', 'delivered', 'Carton abîmé', 'BL-1002', 310.00,
             NULL, NULL, NULL, NULL, false, CURRENT_DATE - 5 + time '14:10', false, NULL, NULL, 'bench_manager', CURRENT_DATE - 6 + time '10:00', CURRENT_DATE - 5 + time '14:10'),
           (3, 2, 2, 1, CURRENT_DATE - 2, NULL, 5, 'colis', 'planned', NULL, NULL, NULL,
             NULL, NULL, NULL, NULL, false, NULL, false, NULL, NULL, 'bench_manager', CURRENT_DATE - 5 + time '10:00', CURRENT_DATE - 5 + time '10:00'),
           (4, NULL, 3, 1, CURRENT_DATE - 1, CURRENT_DATE - 1 + time '09:30', 2, 'palettes', 'delivered', NULL, 'BL-1004', 980.00,
             'FAC-2004', 975.00, 1170.00, CURRENT_DATE + 25, false, CURRENT_DATE - 1 + time '09:40', true, 'bench_manager', CURRENT_DATE - 1 + time '10:00', 'bench_manager', CURRENT_DATE - 2 + time '10:00', CURRENT_DATE - 1 + time '10:00'),
           (5, 4, 1, 2, CURRENT_DATE, NULL, 8, 'colis', 'planned', NULL, NULL, NULL,
             NULL, NULL, NULL, NULL, false, NULL, false, NULL, NULL, 'bench_directeur', CURRENT_DATE - 3 + time '10:00', CURRENT_DATE - 3 + time '10:00'),
           (6, 5, 4, 2, CURRENT_DATE - 40, CURRENT_DATE - 40 + time '16:00', 3, 'palettes', 'delivered', NULL, 'BL-1006', 450.25,
             'FAC-2006', 450.25, 540.30, CURRENT_DATE - 5, true, CURRENT_DATE - 40 + time '16:10', false, NULL, NULL, 'bench_directeur', CURRENT_DATE - 41 + time '10:00', CURRENT_DATE - 39 + time '10:00'),
           (7, NULL, 1, 3, CURRENT_DATE + 2, NULL, 1, 'palettes', 'planned', NULL, NULL, NULL,
             NULL, NULL, NULL, NULL, false, NULL, false, NULL, NULL, 'admin_local', CURRENT_DATE + time '07:00', CURRENT_DATE + time '07:00'),
           (8, 7, 1, 1, CURRENT_DATE - 380, CURRENT_DATE - 380 + time '11:00', 4, 'palettes', 'delivered', NULL, 'BL-0900', 800.00,
             'FAC-1900', 800.00, 960.00, CURRENT_DATE - 350, true, CURRENT_DATE - 380 + time '11:05', false, NULL, NULL, 'admin_local', CURRENT_DATE - 381 + time '10:00', CURRENT_DATE - 379 + time '10:00')`);

  await q(`INSERT INTO reconciliation_comments (id, delivery_id, group_id, content, type, author_id, created_at, updated_at) VALUES
           (1, 2, 1, 'Facture non reçue, relancer le fournisseur', 'warning', 'bench_manager', CURRENT_DATE - 4 + time '09:00', CURRENT_DATE - 4 + time '09:00'),
           (2, 4, 1, 'Écart de 5 € sur le BL', 'info', 'admin_local', CURRENT_DATE - 1 + time '15:00', CURRENT_DATE - 1 + time '15:00')`);

  await q(`INSERT INTO invoice_verification_cache (id, cache_key, group_id, invoice_reference, supplier_name, invoice_amount, invoice_amount_ttc, due_date,
             exists, match_type, error_message, cache_hit, api_call_time, is_reconciled, expires_at, created_at, updated_at) VALUES
           (1, '1_fac-2001', 1, 'FAC-2001', 'Lactalis', 1250.50, 1500.60, CURRENT_DATE + 10, true, 'invoice_reference', NULL, false, 120, true,
             CURRENT_DATE + 18000, CURRENT_DATE - 20 + time '11:10', CURRENT_DATE - 20 + time '11:10'),
           (2, '1_fac-2004', 1, 'FAC-2004', 'Brico Pro', 975.00, 1170.00, CURRENT_DATE + 25, true, 'invoice_reference', NULL, false, 95, false,
             CURRENT_DATE + 1, CURRENT_DATE - 1 + time '10:30', CURRENT_DATE - 1 + time '10:30')`);

  await q(`INSERT INTO publicities (id, pub_number, designation, start_date, end_date, year, created_by, created_at, updated_at) VALUES
           (1, 'PUB-01', 'Foire aux vins', CURRENT_DATE - 10, CURRENT_DATE + 5, EXTRACT(YEAR FROM CURRENT_DATE)::int, 'admin_local', CURRENT_DATE - 60 + time '09:00', CURRENT_DATE - 60 + time '09:00'),
           (2, 'PUB-02', 'Spécial jardin', CURRENT_DATE + 20, CURRENT_DATE + 34, EXTRACT(YEAR FROM CURRENT_DATE)::int, 'admin_local', CURRENT_DATE - 50 + time '09:00', CURRENT_DATE - 50 + time '09:00'),
           (3, 'PUB-99', 'Rentrée', CURRENT_DATE - 400, CURRENT_DATE - 386, EXTRACT(YEAR FROM CURRENT_DATE)::int - 1, 'admin_local', CURRENT_DATE - 420 + time '09:00', CURRENT_DATE - 420 + time '09:00')`);
  await q(`INSERT INTO publicity_participations (publicity_id, group_id, created_at) VALUES
           (1, 1, CURRENT_DATE - 60 + time '09:00'), (1, 2, CURRENT_DATE - 60 + time '09:00'), (2, 1, CURRENT_DATE - 50 + time '09:00'), (3, 2, CURRENT_DATE - 420 + time '09:00')`);

  await q(`INSERT INTO customer_orders (id, order_taker, customer_name, customer_phone, customer_email, product_designation, product_reference, gencode,
             quantity, supplier_id, status, deposit, is_promotional_price, customer_notified, notes, group_id, created_by, created_at, updated_at,
             notified_at, notified_comment) VALUES
           (1, 'Sophie', 'Mme Bernard', '06 11 11 11 11', 'bernard@client.test', 'Tondeuse électrique', 'TD-450', '3245678901234', 1, 4,
             'En attente de Commande', 50.00, false, false, NULL, 1, 'bench_employee', CURRENT_DATE - 3 + time '15:00', CURRENT_DATE - 3 + time '15:00', NULL, NULL),
           (2, 'Marc', 'M. Laurent', '06 22 22 22 22', NULL, 'Perceuse sans fil', 'PS-18', '3245678901241', 2, 3,
             'Commande passée', 0.00, true, false, 'Prix promo', 1, 'bench_manager', CURRENT_DATE - 8 + time '11:00', CURRENT_DATE - 6 + time '11:00', NULL, NULL),
           (3, 'Sophie', 'Mme Garcia', '06 33 33 33 33', NULL, 'Fromage affiné', NULL, '3245678901258', 1, 1,
             'Disponible', 0.00, false, false, NULL, 1, 'bench_employee', CURRENT_DATE - 10 + time '10:00', CURRENT_DATE - 1 + time '10:00', NULL, NULL),
           (4, 'Léa', 'M. Thomas', '06 44 44 44 44', NULL, 'Graines de gazon 5 kg', 'GZ-5', '3245678901265', 3, 4,
             'Disponible', 10.00, false, true, NULL, 2, 'bench_directeur', CURRENT_DATE - 12 + time '10:00', CURRENT_DATE - 2 + time '10:00', CURRENT_DATE - 2 + time '11:00', 'Message laissé'),
           (5, 'Léa', 'Mme Petit', '06 55 55 55 55', NULL, 'Arrosoir', NULL, '3245678901272', 1, 4,
             'Retiré', 0.00, false, true, NULL, 2, 'bench_directeur', CURRENT_DATE - 30 + time '10:00', CURRENT_DATE - 20 + time '10:00', CURRENT_DATE - 25 + time '10:00', NULL)`);

  await q(`INSERT INTO dlc_products (id, name, product_name, gencode, supplier_id, group_id, expiry_date, date_type, quantity, unit, location, alert_threshold,
             status, stock_epuise, stock_epuise_by, stock_epuise_at, processed_at, processed_by, processed_until_expiry, notes, created_by,
             validated_by, validated_at, created_at, updated_at) VALUES
           (1, 'Yaourt nature', 'Yaourt nature x4', '3000000000011', 1, 1, CURRENT_DATE - 2, 'dlc', 12, 'unité', 'Rayon frais', 15,
             'en_cours', false, NULL, NULL, NULL, NULL, false, NULL, 'bench_employee', NULL, NULL, CURRENT_DATE - 9 + time '08:30', CURRENT_DATE - 9 + time '08:30'),
           (2, 'Camembert', 'Camembert 250 g', '3000000000028', 1, 1, CURRENT_DATE + 3, 'dlc', 6, 'unité', 'Rayon frais', 15,
             'en_cours', false, NULL, NULL, NULL, NULL, false, 'Promo possible', 'bench_manager', NULL, NULL, CURRENT_DATE - 7 + time '08:30', CURRENT_DATE - 7 + time '08:30'),
           (3, 'Haricots verts', 'Haricots verts 400 g', '3000000000035', 2, 1, CURRENT_DATE + 60, 'ddm', 24, 'unité', 'Réserve', 15,
             'valides', false, NULL, NULL, NULL, NULL, false, NULL, 'bench_manager', 'bench_manager', CURRENT_DATE - 6 + time '09:00', CURRENT_DATE - 6 + time '08:30', CURRENT_DATE - 6 + time '09:00'),
           (4, 'Crème fraîche', 'Crème fraîche 20 cl', '3000000000042', 1, 1, CURRENT_DATE + 1, 'dlc', 4, 'unité', 'Rayon frais', 15,
             'en_cours', true, 'bench_employee', CURRENT_DATE + time '08:00', NULL, NULL, false, NULL, 'bench_employee', NULL, NULL, CURRENT_DATE - 5 + time '08:30', CURRENT_DATE + time '08:00'),
           (5, 'Beurre doux', 'Beurre doux 250 g', '3000000000059', 1, 1, CURRENT_DATE + 2, 'dlc', 10, 'unité', 'Rayon frais', 15,
             'en_cours', false, NULL, NULL, CURRENT_DATE - 1 + time '17:00', 'bench_manager', true, NULL, 'bench_manager', NULL, NULL, CURRENT_DATE - 4 + time '08:30', CURRENT_DATE - 1 + time '17:00'),
           (6, 'Petits pois', 'Petits pois 800 g', '3000000000066', 2, 2, CURRENT_DATE + 10, 'dlc', 30, 'unité', 'Magasin', 15,
             'en_cours', false, NULL, NULL, NULL, NULL, false, NULL, 'bench_directeur', NULL, NULL, CURRENT_DATE - 3 + time '08:30', CURRENT_DATE - 3 + time '08:30')`);

  await q(`INSERT INTO tasks (id, title, description, start_date, due_date, priority, status, assigned_to, created_by, group_id, completed_at, completed_by, created_at, updated_at) VALUES
           (1, 'Inventaire rayon frais', 'Compter les yaourts', CURRENT_DATE - 2 + time '08:00', CURRENT_DATE - 1, 'high', 'pending', 'Équipe frais', 'bench_manager', 1, NULL, NULL, CURRENT_DATE - 3 + time '08:00', CURRENT_DATE - 3 + time '08:00'),
           (2, 'Mise en rayon promo', NULL, NULL, CURRENT_DATE + 2, 'medium', 'pending', 'Sophie', 'bench_manager', 1, NULL, NULL, CURRENT_DATE - 1 + time '08:00', CURRENT_DATE - 1 + time '08:00'),
           (3, 'Nettoyage réserve', NULL, CURRENT_DATE + 5 + time '08:00', CURRENT_DATE + 7, 'low', 'pending', 'Marc', 'bench_directeur', 1, NULL, NULL, CURRENT_DATE - 1 + time '09:00', CURRENT_DATE - 1 + time '09:00'),
           (4, 'Relevé températures', NULL, NULL, CURRENT_DATE - 3, 'medium', 'completed', 'Léa', 'bench_directeur', 2, CURRENT_DATE - 3 + time '18:00', 'bench_directeur', CURRENT_DATE - 5 + time '08:00', CURRENT_DATE - 3 + time '18:00'),
           (5, 'Affichage prix', NULL, NULL, CURRENT_DATE, 'high', 'pending', 'Léa', 'bench_directeur', 2, NULL, NULL, CURRENT_DATE - 2 + time '08:00', CURRENT_DATE - 2 + time '08:00')`);

  await q(`INSERT INTO dashboard_messages (id, title, content, type, store_id, created_by, created_at) VALUES
           (1, 'Inventaire annuel', 'Inventaire le 30 du mois', 'info', NULL, 'admin_local', CURRENT_DATE - 1 + time '08:00'),
           (2, 'Panne caisse 3', 'Caisse 3 hors service', 'warning', 1, 'bench_manager', CURRENT_DATE + time '07:45'),
           (3, 'Ancienne information', 'Texte ancien', 'info', 2, 'admin_local', CURRENT_DATE - 20 + time '08:00')`);

  await q(`INSERT INTO avoirs (id, supplier_id, group_id, invoice_reference, amount, comment, commercial_processed, status, webhook_sent, nocodb_verified,
             nocodb_verified_at, processed_at, created_by, created_at, updated_at) VALUES
           (1, 1, 1, 'AV-3001', 45.90, 'Produits périmés à la livraison', false, 'En attente de demande', false, false, NULL, NULL, 'bench_manager', CURRENT_DATE - 4 + time '10:00', CURRENT_DATE - 4 + time '10:00'),
           (2, 3, 1, 'AV-3002', 120.00, NULL, true, 'Demandé', true, false, NULL, CURRENT_DATE - 2 + time '10:00', 'admin_local', CURRENT_DATE - 6 + time '10:00', CURRENT_DATE - 2 + time '10:00'),
           (3, 4, 2, NULL, 15.00, 'Casse', true, 'Reçu', true, true, CURRENT_DATE - 1 + time '12:00', CURRENT_DATE - 1 + time '12:00', 'bench_directeur', CURRENT_DATE - 9 + time '10:00', CURRENT_DATE - 1 + time '12:00')`);

  const year = new Date().getFullYear();
  await q(`INSERT INTO sav_tickets (id, ticket_number, supplier_id, group_id, product_gencode, product_reference, product_designation, problem_type,
             problem_description, resolution_description, status, priority, client_name, client_phone, created_by, created_at, updated_at, resolved_at, closed_at) VALUES
           (1, $1, 3, 1, '3245678901241', 'PS-18', 'Perceuse sans fil', 'defectueux', 'Ne démarre pas', NULL, 'nouveau', 'haute', 'M. Laurent', '06 22 22 22 22', 'bench_employee', CURRENT_DATE - 2 + time '16:00', CURRENT_DATE - 2 + time '16:00', NULL, NULL),
           (2, $2, 4, 1, '3245678901234', 'TD-450', 'Tondeuse électrique', 'pieces_manquantes', 'Manque le bac', NULL, 'attente_pieces', 'normale', NULL, NULL, 'bench_manager', CURRENT_DATE - 15 + time '10:00', CURRENT_DATE - 5 + time '10:00', NULL, NULL),
           (3, $3, 4, 2, '3245678901265', 'GZ-5', 'Graines de gazon 5 kg', 'non_conforme', 'Sac déchiré', 'Échangé', 'resolu', 'faible', 'M. Thomas', NULL, 'bench_directeur', CURRENT_DATE - 25 + time '10:00', CURRENT_DATE - 20 + time '10:00', CURRENT_DATE - 20 + time '10:00', NULL)`,
    [`SAV-${year}-0001`, `SAV-${year}-0002`, `SAV-${year}-0003`]);

  await q(`INSERT INTO supplier_mail_logs (id, delivery_id, group_id, supplier_id, supplier_name, sent_to, subject, status, error_message, message_id, sent_by, sent_by_name, created_at) VALUES
           (1, 2, 1, 2, 'Bonduelle', 'factures@bonduelle.test', 'Demande de facture BL-1002', 'sent', NULL, '<banc-1@banc.test>', 'bench_manager', 'Manon Manager', CURRENT_DATE - 3 + time '09:00')`);

  await q(`INSERT INTO weather_settings (id, api_key, location, is_active, created_at, updated_at) VALUES
           (1, 'cle-meteo-banc', 'Nancy, France', true, CURRENT_DATE - 100 + time '08:00', CURRENT_DATE - 100 + time '08:00')`);

  await q(`INSERT INTO utilities (id, sales_analysis_url, automatic_backups_enabled, created_at, updated_at) VALUES
           (1, 'https://analyse.banc.test/rapport', false, CURRENT_DATE - 100 + time '08:00', CURRENT_DATE - 100 + time '08:00')`);

  await q(`INSERT INTO webhook_bap_config (id, name, webhook_url, description, is_active, created_at, updated_at) VALUES
           (1, 'Configuration BAP', $1, 'Webhook simulé du banc', true, CURRENT_DATE - 100 + time '08:00', CURRENT_DATE - 100 + time '08:00')`,
    [`${STUB_URL}/webhook/bap`]);

  await q(`INSERT INTO database_backups (id, filename, description, size, created_at, created_by, tables_count, status, backup_type) VALUES
           ('banc-sauvegarde-1', 'backup_banc_1.sql', 'Sauvegarde du banc', 2048, CURRENT_DATE - 1 + time '02:00', 'system', 26, 'completed', 'automatic')`);

  await q(`INSERT INTO external_api_keys (id, name, key_prefix, key_hash, created_by, created_at, last_used_at, revoked_at) VALUES
           (1, 'Outil de rapprochement', $1, $2, 'admin_local', CURRENT_DATE - 30 + time '08:00', NULL, NULL),
           (2, 'Ancienne clé', 'lf_oldkey', $3, 'admin_local', CURRENT_DATE - 90 + time '08:00', NULL, CURRENT_DATE - 60 + time '08:00')`,
    [BENCH_API_KEY.slice(0, 10), createHash("sha256").update(BENCH_API_KEY).digest("hex"), createHash("sha256").update("lf_cle_revoquee").digest("hex")]);

  // Données complémentaires de chaque lot (seeds/*.ts, voir seeds/README.md)
  const seedsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "seeds");
  for (const file of fs.readdirSync(seedsDir).filter((f) => f.endsWith(".ts")).sort()) {
    const extra = await import(path.join(seedsDir, file));
    await extra.seed(q);
  }

  // Les séquences reprennent après les identifiants fixés ci-dessus
  const { rows } = await q(`SELECT table_name, column_name FROM information_schema.columns
                            WHERE table_schema = 'public' AND column_default LIKE 'nextval%'`);
  for (const row of rows) {
    await q(`SELECT setval(pg_get_serial_sequence($1, $2), COALESCE((SELECT MAX(${row.column_name}) FROM ${row.table_name}), 0) + 1, false)`,
      [row.table_name, row.column_name]);
  }

  await q("COMMIT");
  await client.end();
  console.log("Données du banc insérées");
}

main().catch((error) => { console.error(error); process.exit(1); });
