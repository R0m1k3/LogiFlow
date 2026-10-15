// Données du lot 2 (Informations et planning), identifiants à partir de 200 :
// - informations au-delà de la limite de 5, par magasin et globales, avec des
//   auteurs de chaque forme (prénom et nom, nom d'affichage seul, prénom seul,
//   compte disparu) ;
// - publicités dont les N° testent le tri numérique (« 12 », « 3 », « 3-bis »)
//   et des participations du magasin d'Épinal ;
// - une commande livrée en retard par magasin hors Nancy, pour des délais moyens
//   non nuls dans les statistiques ;
// - la météo en cache pour aujourd'hui et pour la date de l'an dernier calculée
//   par le serveur Node : /api/weather/current ne sollicite jamais Visual
//   Crossing pendant le banc (fenêtre de 9 jours, au cas où le banc tourne
//   quelques jours après setup.sh).
import { weatherService } from "../../../server/weatherService";

type Query = (text: string, values?: unknown[]) => Promise<unknown>;

function isoDay(offset: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

export async function seed(q: Query) {
  // Auteurs d'informations sans magasin (connexion impossible : empreinte factice)
  await q(`INSERT INTO users (id, username, email, name, first_name, last_name, password, role, password_changed, created_at, updated_at) VALUES
           ('bench_lot2_redaction', 'redaction', 'redaction@banc.test', 'Équipe Rédaction Nancy', NULL, NULL, 'x', 'employee', true, CURRENT_DATE - 90 + time '08:00', CURRENT_DATE - 90 + time '08:00'),
           ('bench_lot2_prenom', 'prenom-seul', NULL, NULL, 'Paulette', NULL, 'x', 'employee', true, CURRENT_DATE - 90 + time '08:00', CURRENT_DATE - 90 + time '08:00')`);

  await q(`INSERT INTO dashboard_messages (id, title, content, type, store_id, created_by, created_at) VALUES
           (200, 'Fermeture exceptionnelle', 'Fermeture à 18 h samedi', 'error', 1, 'manager', CURRENT_DATE - 2 + time '09:00'),
           (201, 'Nouvelle procédure', 'Procédure de réception mise à jour', 'success', NULL, 'admin', CURRENT_DATE - 3 + time '10:00'),
           (202, 'Réunion Metz', 'Réunion d''équipe jeudi', 'info', 2, 'directeur', CURRENT_DATE - 1 + time '14:00'),
           (203, 'Message de la rédaction', 'Nouvelle charte affichage', 'warning', 3, 'redaction', CURRENT_DATE - 5 + time '11:00'),
           (204, 'Prénom seul', 'Auteur sans nom de famille', 'info', NULL, 'prenom-seul', CURRENT_DATE - 4 + time '16:30'),
           (205, 'Auteur supprimé', 'Compte disparu depuis', 'info', 1, 'ancien-compte', CURRENT_DATE - 6 + time '08:15')`);

  const year = new Date().getUTCFullYear();
  await q(`INSERT INTO publicities (id, pub_number, designation, start_date, end_date, year, created_by, created_at, updated_at) VALUES
           (200, '12', 'Promo hiver', CURRENT_DATE + 40, CURRENT_DATE + 50, $1, 'admin_local', CURRENT_DATE - 30 + time '09:00', CURRENT_DATE - 30 + time '09:00'),
           (201, '3', 'Semaine du blanc', CURRENT_DATE - 3, CURRENT_DATE + 4, $1, 'admin_local', CURRENT_DATE - 40 + time '09:00', CURRENT_DATE - 35 + time '09:00'),
           (202, '3-bis', 'Semaine du blanc (suite)', CURRENT_DATE + 5, CURRENT_DATE + 9, $1, 'admin_local', CURRENT_DATE - 40 + time '09:30', CURRENT_DATE - 40 + time '09:30'),
           (203, 'PUB-03', 'Catalogue de l''an prochain', CURRENT_DATE + 200, CURRENT_DATE + 214, $2, 'admin_local', CURRENT_DATE - 10 + time '09:00', CURRENT_DATE - 10 + time '09:00')`,
    [year, year + 1]);
  await q(`INSERT INTO publicity_participations (publicity_id, group_id, created_at) VALUES
           (200, 3, CURRENT_DATE - 30 + time '09:00'), (201, 1, CURRENT_DATE - 40 + time '09:00'), (201, 3, CURRENT_DATE - 40 + time '09:00'),
           (203, 2, CURRENT_DATE - 10 + time '09:00')`);

  await q(`INSERT INTO orders (id, supplier_id, group_id, planned_date, quantity, unit, status, notes, created_by, created_at, updated_at) VALUES
           (200, 2, 2, CURRENT_DATE - 12, 7, 'palettes', 'delivered', NULL, 'bench_directeur', CURRENT_DATE - 14 + time '10:00', CURRENT_DATE - 9 + time '15:10'),
           (201, 4, 3, CURRENT_DATE - 15, 2, 'colis', 'delivered', NULL, 'admin_local', CURRENT_DATE - 16 + time '10:00', CURRENT_DATE - 13 + time '10:10')`);
  await q(`INSERT INTO deliveries (id, order_id, supplier_id, group_id, scheduled_date, delivered_date, quantity, unit, status, notes, bl_number, bl_amount,
             invoice_reference, invoice_amount, invoice_amount_ttc, due_date, reconciled, validated_at, control_validated, created_by, created_at, updated_at) VALUES
           (200, 200, 2, 2, CURRENT_DATE - 12, CURRENT_DATE - 9 + time '15:00', 7, 'palettes', 'delivered', NULL, 'BL-2200', 640.40,
             'FAC-2200', 640.40, 768.48, CURRENT_DATE + 20, false, CURRENT_DATE - 9 + time '15:10', false, 'bench_directeur', CURRENT_DATE - 14 + time '10:00', CURRENT_DATE - 9 + time '15:10'),
           (201, 201, 4, 3, CURRENT_DATE - 15, CURRENT_DATE - 13 + time '10:00', 2, 'colis', 'delivered', NULL, 'BL-2201', NULL,
             NULL, NULL, NULL, NULL, false, CURRENT_DATE - 13 + time '10:10', false, 'admin_local', CURRENT_DATE - 16 + time '10:00', CURRENT_DATE - 13 + time '10:10')`);

  // Météo en cache : même date de l'an dernier que GET /api/weather/current
  const conditions = [
    ["partly-cloudy-day", "Partiellement nuageux"],
    ["rain", "Pluie légère"],
    ["clear-day", "Dégagé"],
    ["fog", "Brouillard"],
    ["icone-inconnue", "Variable"],
  ];
  const rows: unknown[][] = [];
  const previousDates = new Set<string>();
  const log = console.log;
  const timezone = process.env.TZ;
  console.log = () => {}; // getPreviousYearDate journalise chaque calcul
  process.env.TZ = "UTC"; // comme le serveur du banc (BENCH_ENV)
  try {
    for (let offset = -1; offset <= 7; offset++) {
      const day = isoDay(offset);
      const [icon, label] = conditions[(offset + 1) % conditions.length];
      rows.push([day, "Nancy, France", (14.3 + offset).toFixed(1), (6 + offset / 2).toString(), icon, label, true]);
      const previous = weatherService.getPreviousYearDate(new Date(`${day}T12:00:00Z`));
      if (!previousDates.has(previous)) {
        previousDates.add(previous);
        const [oldIcon, oldLabel] = conditions[(offset + 3) % conditions.length];
        rows.push([previous, "Nancy, France", (12 + offset).toString(), (3.5 - offset).toFixed(2), oldIcon, oldLabel, false]);
      }
    }
  } finally {
    console.log = log;
    if (timezone === undefined) delete process.env.TZ;
    else process.env.TZ = timezone;
  }
  let id = 200;
  for (const row of rows) {
    await q(`INSERT INTO weather_data (id, date, location, temp_max, temp_min, icon, conditions, is_current_year, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_DATE - 1 + time '06:00', CURRENT_DATE - 1 + time '06:00')`, [id++, ...row]);
  }
}
