// Lot 4, rapprochement : avoirs (et leur webhook), échéancier des paiements (lecture
// complétée par NocoDB, export CSV), envoi d'une facture au webhook du magasin,
// SQL et migration d'urgence de l'administration. NocoDB et les webhooks sont
// simulés par stub.ts. Données complémentaires : seeds/lot4-rapprochement.ts.
import { STUB_URL } from "../config";
import type { ReadCase, WriteScenario } from "../types";

// Mois « AAAA-MM » relatif au mois courant (sélecteur de l'échéancier)
function month(offset: number): string {
  const date = new Date();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 7);
}

// Durée de vie des entrées du cache : relative à l'heure du passage, différente
// entre les deux serveurs
const CACHE_IGNORE = ["expires_at"];

const ALL_METHODS = ["virement", "prelevement", "cheque", "Non défini"];

// Fichier envoyé par BLReconciliation.tsx avec les champs du formulaire
const INVOICE_FILE = [{ field: "file", filename: "facture BL-1001.pdf", contentType: "application/pdf", size: 2048 }];

export const reads: ReadCase[] = [
  // ---------- Avoirs (Avoirs.tsx, mobile/AvoirsPage.tsx : storeId du magasin choisi) ----------
  { module: "avoirs", path: "/api/avoirs" },
  { module: "avoirs", path: "/api/avoirs?storeId=1" },
  { module: "avoirs", path: "/api/avoirs?storeId=2" },
  { module: "avoirs", path: "/api/avoirs?storeId=3" },
  { module: "avoirs", path: "/api/avoirs?storeId=" },
  { module: "avoirs", path: "/api/avoirs?storeId=abc" },
  { module: "avoirs", path: "/api/avoirs?storeId=99999999999" },
  { module: "avoirs", path: "/api/avoirs/1" },
  { module: "avoirs", path: "/api/avoirs/3" },
  { module: "avoirs", path: "/api/avoirs/701" },
  { module: "avoirs", path: "/api/avoirs/999" },
  { module: "avoirs", path: "/api/avoirs/abc" },

  // ---------- Échéancier (PaymentSchedulePage.tsx : groupId du magasin choisi) ----------
  // La lecture complète en base les échéances et montants manquants (NocoDB) :
  // les comptes suivants voient les livraisons déjà complétées
  { module: "payment-schedule", path: "/api/payment-schedule?groupId=1" },
  { module: "payment-schedule", path: "/api/payment-schedule?groupId=2" },
  { module: "payment-schedule", path: "/api/payment-schedule?groupId=3" },
  { module: "payment-schedule", path: "/api/payment-schedule?groupId=999" },
  { module: "payment-schedule", path: "/api/payment-schedule?groupId=abc", accounts: ["admin", "directeur", "manager"] },
  { module: "payment-schedule", path: "/api/payment-schedule", accounts: ["admin", "directeur"] },
  { module: "payment-schedule", path: "/api/payment-schedule?groupId=", accounts: ["admin", "directeur"] },
  { module: "payment-schedule", path: "/api/payment-schedule?groupId=0", accounts: ["admin", "directeur"] },
  { module: "payment-schedule", path: "/api/payment-schedule?groupId=1.5", accounts: ["admin", "directeur"] },
  { module: "payment-schedule", path: "/api/payment-schedule?groupId=-1", accounts: ["admin", "directeur"] },
  { module: "payment-schedule", path: "/api/payment-schedule?groupId=%201%20", accounts: ["admin", "directeur"] },
  { module: "payment-schedule", path: "/api/payment-schedule?groupId=99999999999", accounts: ["admin", "directeur"] },
];

export const writes: WriteScenario[] = [
  // ---------- Avoirs ----------
  {
    module: "avoirs",
    name: "créer un avoir (webhook du magasin à la création)",
    steps: [
      // Formulaire du bureau
      { method: "POST", path: "/api/avoirs", body: { supplierId: 1, groupId: 1, invoiceReference: "AV-4001", amount: 12.5, comment: "Casse", commercialProcessed: false, status: "En attente de demande" } },
      { method: "GET", path: "/api/avoirs/{{0.id}}" },
      // Formulaire mobile : montant forcé à 0, sans référence ni commentaire
      { method: "POST", path: "/api/avoirs", body: { supplierId: 2, groupId: 1, amount: 0, status: "Demandé", createdBy: "pirate" } },
      // Metz : sans webhook
      { method: "POST", path: "/api/avoirs", body: { supplierId: 3, groupId: 2, invoiceReference: "", amount: "-7.25", comment: "", commercialProcessed: true, status: "Reçu" } },
      // Épinal : aucun compte du banc n'y est affecté (sauf l'administrateur)
      { method: "POST", path: "/api/avoirs", body: { supplierId: 4, groupId: 3, amount: null } },
      { method: "GET", path: "/api/avoirs" },
    ],
    tables: ["avoirs"],
  },
  {
    // Fiche du magasin modifiable par l'admin et le manager
    module: "avoirs",
    name: "webhook du magasin en erreur, injoignable ou invalide",
    accounts: ["admin", "manager"],
    steps: [
      { method: "PUT", path: "/api/groups/1", body: { webhookUrl: `${STUB_URL}/inconnu` } },
      { method: "POST", path: "/api/avoirs", body: { supplierId: 1, groupId: 1, invoiceReference: "AV-4101", amount: 1 } },
      { method: "PUT", path: "/api/groups/1", body: { webhookUrl: "http://127.0.0.1:1/webhook" } },
      { method: "POST", path: "/api/avoirs", body: { supplierId: 1, groupId: 1, invoiceReference: "AV-4102", amount: 2 } },
      { method: "PUT", path: "/api/avoirs/1", body: { status: "Reçu" } },
      { method: "PUT", path: "/api/groups/1", body: { webhookUrl: "pas une adresse" } },
      { method: "POST", path: "/api/avoirs", body: { supplierId: 1, groupId: 1, invoiceReference: "AV-4103", amount: 3 } },
    ],
    tables: ["avoirs"],
  },
  {
    module: "avoirs",
    name: "avoirs invalides à la création",
    steps: [
      { method: "POST", path: "/api/avoirs", body: {} },
      { method: "POST", path: "/api/avoirs", body: { supplierId: "1", groupId: 1.5 } },
      { method: "POST", path: "/api/avoirs", body: { supplierId: 1, groupId: 1, amount: "abc", status: "Perdu", commercialProcessed: "oui" } },
      { method: "POST", path: "/api/avoirs", body: { supplierId: 1, groupId: 1, invoiceReference: null, comment: null, commercialProcessed: null } },
      { method: "POST", path: "/api/avoirs", body: ["x"] },
      // Erreurs de la base : fournisseur ou magasin inconnu, référence trop longue, montant trop grand
      { method: "POST", path: "/api/avoirs", body: { supplierId: 999, groupId: 1 } },
      { method: "POST", path: "/api/avoirs", body: { supplierId: 1, groupId: 999 } },
      { method: "POST", path: "/api/avoirs", body: { supplierId: 1, groupId: 1, invoiceReference: "R".repeat(300) } },
      { method: "POST", path: "/api/avoirs", body: { supplierId: 1, groupId: 1, amount: 1e9 } },
      // Montant vide : Number("") = 0
      { method: "POST", path: "/api/avoirs", body: { supplierId: 1, groupId: 2, amount: "" } },
    ],
    tables: ["avoirs"],
  },
  {
    module: "avoirs",
    name: "modifier un avoir (passage à « Reçu » et webhook)",
    steps: [
      // Formulaire complet : passage à « Reçu », webhook du magasin
      { method: "PUT", path: "/api/avoirs/1", body: { supplierId: 1, groupId: 1, invoiceReference: "AV-3001", amount: 50, comment: "Reçu par courrier", commercialProcessed: true, status: "Reçu" } },
      // Déjà « Reçu » : pas de webhook ; montant, référence et commentaire effacés (AVOIRS-API-06)
      { method: "PUT", path: "/api/avoirs/1", body: { status: "Reçu" } },
      // Metz (sans webhook)
      { method: "PUT", path: "/api/avoirs/3", body: { status: "Demandé", amount: "15.5", invoiceReference: "AV-3003", comment: "" } },
      { method: "PUT", path: "/api/avoirs/700", body: { status: "Reçu", invoiceReference: "FAC-2006", amount: 10.5 } },
      // Changement de magasin et de créateur acceptés (AVOIRS-API-07)
      { method: "PUT", path: "/api/avoirs/2", body: { groupId: 2, createdBy: "pirate", invoiceReference: "AV-3002" } },
      // Épinal
      { method: "PUT", path: "/api/avoirs/701", body: { status: "Reçu" } },
      { method: "GET", path: "/api/avoirs/1" },
    ],
    tables: ["avoirs"],
  },
  {
    module: "avoirs",
    name: "avoirs invalides ou introuvables à la modification",
    steps: [
      { method: "PUT", path: "/api/avoirs/1", body: { status: "Perdu" } },
      { method: "PUT", path: "/api/avoirs/1", body: { amount: "abc", supplierId: "2" } },
      { method: "PUT", path: "/api/avoirs/1", body: { invoiceReference: null } },
      { method: "PUT", path: "/api/avoirs/1", body: { supplierId: 999 } },
      { method: "PUT", path: "/api/avoirs/999", body: { status: "Reçu" } },
      { method: "PUT", path: "/api/avoirs/abc", body: { status: "Reçu" } },
      { method: "PUT", path: "/api/avoirs/1", body: [] },
    ],
    tables: ["avoirs"],
  },
  {
    module: "avoirs",
    name: "supprimer des avoirs",
    steps: [
      { method: "DELETE", path: "/api/avoirs/2" },
      { method: "DELETE", path: "/api/avoirs/700" },
      { method: "DELETE", path: "/api/avoirs/701" },
      { method: "DELETE", path: "/api/avoirs/999" },
      { method: "DELETE", path: "/api/avoirs/abc" },
      { method: "GET", path: "/api/avoirs" },
    ],
    tables: ["avoirs"],
  },
  {
    module: "avoirs",
    name: "vérifier la facture d'un avoir dans NocoDB",
    steps: [
      { method: "POST", path: "/api/avoirs/1/verify-invoice", body: { invoiceReference: "AV-3001", forceRefresh: false } },
      // Depuis le cache, puis en forçant
      { method: "POST", path: "/api/avoirs/1/verify-invoice", body: { invoiceReference: "AV-3001" } },
      { method: "POST", path: "/api/avoirs/1/verify-invoice", body: { invoiceReference: " av-3001 ", forceRefresh: "oui" } },
      { method: "POST", path: "/api/avoirs/2/verify-invoice", body: { invoiceReference: "AV-INCONNU" } },
      { method: "POST", path: "/api/avoirs/700/verify-invoice", body: { invoiceReference: "FAC-2006" } },
      // Épinal : sans configuration NocoDB
      { method: "POST", path: "/api/avoirs/701/verify-invoice", body: { invoiceReference: "FAC-2004" } },
      { method: "POST", path: "/api/avoirs/1/verify-invoice", body: {} },
      { method: "POST", path: "/api/avoirs/1/verify-invoice", body: { invoiceReference: "   " } },
      { method: "POST", path: "/api/avoirs/1/verify-invoice", body: { invoiceReference: 2001 } },
      { method: "POST", path: "/api/avoirs/999/verify-invoice", body: { invoiceReference: "AV-3001" } },
      { method: "POST", path: "/api/avoirs/abc/verify-invoice", body: { invoiceReference: "AV-3001" } },
    ],
    tables: ["invoice_verification_cache"],
    ignore: CACHE_IGNORE,
  },
  {
    module: "avoirs",
    name: "valider un avoir et l'état de son webhook",
    steps: [
      // Entrée du cache à marquer « rapprochée » à la validation
      { method: "POST", path: "/api/avoirs/1/verify-invoice", body: { invoiceReference: "AV-3001" } },
      { method: "PUT", path: "/api/avoirs/1/nocodb-verification", body: { verified: true } },
      { method: "PUT", path: "/api/avoirs/2/nocodb-verification", body: { verified: false } },
      // Référence absente ou blanche : rien à marquer ; autre magasin accepté (AVOIRS-API-08)
      { method: "PUT", path: "/api/avoirs/3/nocodb-verification", body: { verified: true } },
      { method: "PUT", path: "/api/avoirs/702/nocodb-verification", body: { verified: "yes" } },
      { method: "PUT", path: "/api/avoirs/700/nocodb-verification", body: {} },
      { method: "PUT", path: "/api/avoirs/701/nocodb-verification", body: { verified: "oui" } },
      { method: "PUT", path: "/api/avoirs/999/nocodb-verification", body: { verified: true } },
      { method: "PUT", path: "/api/avoirs/abc/nocodb-verification", body: { verified: true } },
      { method: "PUT", path: "/api/avoirs/1/webhook-status", body: { webhookSent: false } },
      { method: "PUT", path: "/api/avoirs/2/webhook-status", body: { webhookSent: 1 } },
      { method: "PUT", path: "/api/avoirs/700/webhook-status", body: {} },
      { method: "PUT", path: "/api/avoirs/701/webhook-status", body: { webhookSent: null } },
      { method: "PUT", path: "/api/avoirs/3/webhook-status", body: { webhookSent: "oui" } },
      { method: "PUT", path: "/api/avoirs/999/webhook-status", body: { webhookSent: true } },
      { method: "PUT", path: "/api/avoirs/abc/webhook-status", body: { webhookSent: true } },
    ],
    tables: ["avoirs", "invoice_verification_cache"],
    ignore: CACHE_IGNORE,
  },

  // ---------- Échéancier ----------
  {
    module: "payment-schedule",
    name: "échéancier : échéances et montants complétés par NocoDB",
    steps: [
      { method: "GET", path: "/api/payment-schedule?groupId=1" },
      // Seconde lecture : le repli « TTC » recommence (montant TTC jamais écrit)
      { method: "GET", path: "/api/payment-schedule?groupId=1" },
      { method: "GET", path: "/api/payment-schedule?groupId=2" },
      { method: "GET", path: "/api/payment-schedule?groupId=3" },
    ],
    tables: ["deliveries", "invoice_verification_cache"],
    ignore: CACHE_IGNORE,
  },
  {
    module: "payment-schedule",
    name: "export CSV de l'échéancier",
    steps: [
      // Formulaire d'export : mois courant, tous les modes de paiement, HT et TTC
      { method: "POST", path: "/api/payment-schedule/export", body: { groupId: "1", month: month(0), paymentMethods: ALL_METHODS, includeHT: true, includeTTC: true } },
      { method: "POST", path: "/api/payment-schedule/export", body: { groupId: 1, month: month(0), paymentMethods: ["virement", "cheque"], includeHT: false, includeTTC: true } },
      { method: "POST", path: "/api/payment-schedule/export", body: { groupId: 1, month: month(1), paymentMethods: ALL_METHODS, includeHT: "non", includeTTC: 0 } },
      { method: "POST", path: "/api/payment-schedule/export", body: { groupId: 2, month: month(0), paymentMethods: ALL_METHODS, includeHT: true } },
      { method: "POST", path: "/api/payment-schedule/export", body: { groupId: 3, month: month(0), paymentMethods: ALL_METHODS, includeTTC: true } },
      { method: "POST", path: "/api/payment-schedule/export", body: { groupId: 1, month: "2020-13", paymentMethods: ALL_METHODS, includeHT: true } },
      { method: "POST", path: "/api/payment-schedule/export", body: { groupId: 999, month: month(0), paymentMethods: ALL_METHODS } },
    ],
    tables: [],
  },
  {
    module: "payment-schedule",
    name: "export CSV : paramètres invalides",
    accounts: ["admin", "directeur", "manager"],
    steps: [
      { method: "POST", path: "/api/payment-schedule/export", body: {} },
      { method: "POST", path: "/api/payment-schedule/export", body: { groupId: "abc", month: month(0), paymentMethods: ALL_METHODS } },
      { method: "POST", path: "/api/payment-schedule/export", body: { groupId: 1.5, month: month(0), paymentMethods: ALL_METHODS } },
      { method: "POST", path: "/api/payment-schedule/export", body: { groupId: 1, month: "2026-1", paymentMethods: ALL_METHODS } },
      { method: "POST", path: "/api/payment-schedule/export", body: { groupId: 1, month: 202610, paymentMethods: ALL_METHODS } },
      { method: "POST", path: "/api/payment-schedule/export", body: { groupId: 1, month: month(0), paymentMethods: [] } },
      { method: "POST", path: "/api/payment-schedule/export", body: { groupId: 1, month: month(0), paymentMethods: "virement" } },
      { method: "POST", path: "/api/payment-schedule/export", body: { groupId: 1, month: month(0), paymentMethods: ["virement", 5, null] } },
      { method: "POST", path: "/api/payment-schedule/export", body: { groupId: 1, month: month(0) } },
    ],
    tables: [],
  },

  // ---------- Envoi d'une facture au webhook (BLReconciliation.tsx) ----------
  {
    module: "send-invoice",
    name: "envoyer une facture au webhook du magasin",
    steps: [
      {
        method: "POST",
        path: "/api/reconciliation/send-invoice",
        bodyType: "multipart",
        body: { webhookUrl: `${STUB_URL}/webhook/avoirs`, supplier: "Lactalis", blNumber: "BL-1001", type: "Facture" },
        files: INVOICE_FILE,
      },
      // Webhook BAP configuré ; champs facultatifs absents
      {
        method: "POST",
        path: "/api/reconciliation/send-invoice",
        bodyType: "multipart",
        body: { webhookUrl: `${STUB_URL}/webhook/bap` },
        files: [{ field: "file", filename: "scan échéance.png", contentType: "image/PNG", size: 10 }],
      },
      // Fichier ou adresse manquants
      { method: "POST", path: "/api/reconciliation/send-invoice", bodyType: "multipart", body: { webhookUrl: `${STUB_URL}/webhook/avoirs`, supplier: "Lactalis" } },
      { method: "POST", path: "/api/reconciliation/send-invoice", bodyType: "multipart", body: { supplier: "Lactalis" }, files: INVOICE_FILE },
      { method: "POST", path: "/api/reconciliation/send-invoice", bodyType: "multipart", body: { webhookUrl: "" }, files: INVOICE_FILE },
      // Champ « file » en texte
      { method: "POST", path: "/api/reconciliation/send-invoice", bodyType: "multipart", body: { file: "pas un fichier", webhookUrl: `${STUB_URL}/webhook/avoirs` } },
      { method: "POST", path: "/api/reconciliation/send-invoice", bodyType: "multipart", body: { file: "", webhookUrl: `${STUB_URL}/webhook/avoirs` } },
      // Pas de multipart
      { method: "POST", path: "/api/reconciliation/send-invoice", body: { webhookUrl: `${STUB_URL}/webhook/avoirs` } },
      { method: "POST", path: "/api/reconciliation/send-invoice" },
    ],
    tables: [],
  },
  {
    module: "send-invoice",
    name: "webhook de facture en erreur ou injoignable",
    accounts: ["admin"],
    steps: [
      // Adresses enregistrées sur la fiche du magasin d'Épinal
      { method: "PUT", path: "/api/groups/3", body: { webhookUrl: `${STUB_URL}/inconnu` } },
      {
        method: "POST",
        path: "/api/reconciliation/send-invoice",
        bodyType: "multipart",
        body: { webhookUrl: `${STUB_URL}/inconnu`, supplier: "Jardin & Co", blNumber: "", type: "Avoir" },
        files: INVOICE_FILE,
      },
      { method: "PUT", path: "/api/groups/3", body: { webhookUrl: "http://127.0.0.1:1/webhook" } },
      {
        method: "POST",
        path: "/api/reconciliation/send-invoice",
        bodyType: "multipart",
        body: { webhookUrl: "http://127.0.0.1:1/webhook", supplier: "Jardin & Co" },
        files: INVOICE_FILE,
      },
    ],
    tables: [],
  },
  {
    // RAPPRO-21 : Node envoie le fichier à toute adresse fournie par le navigateur
    module: "send-invoice",
    name: "envoyer une facture à une adresse non configurée",
    // Les autres comptes sont refusés avant (403), comme dans le premier scénario
    accounts: ["admin", "directeur"],
    steps: [
      {
        method: "POST",
        path: "/api/reconciliation/send-invoice",
        bodyType: "multipart",
        body: { webhookUrl: `${STUB_URL}/webhook/non-configure`, supplier: "Lactalis", blNumber: "BL-1001" },
        files: INVOICE_FILE,
      },
      // Webhook BAP désactivé (par l'admin) : son adresse n'est plus acceptée
      { method: "POST", path: "/api/webhook-bap-config", body: { webhookUrl: `${STUB_URL}/webhook/bap`, isActive: false } },
      {
        method: "POST",
        path: "/api/reconciliation/send-invoice",
        bodyType: "multipart",
        body: { webhookUrl: `${STUB_URL}/webhook/bap`, supplier: "Lactalis" },
        files: INVOICE_FILE,
      },
    ],
    tables: [],
    deviation: {
      fields: ["status", "body", "appels"],
      reason:
        "RAPPRO-21 : l'adresse du webhook doit être celle d'un magasin ou du webhook BAP actif ; toute autre adresse est refusée (400) au lieu d'être appelée par le serveur",
    },
  },

  // ---------- Administration : SQL et migration d'urgence (SQLExecutor.tsx) ----------
  {
    module: "admin-sql",
    name: "exécuter du SQL : lectures, types de colonnes et erreurs",
    steps: [
      { method: "POST", path: "/api/admin/execute-sql", body: { sql: "SELECT id, name, color, nocodb_config_id FROM groups ORDER BY id" } },
      {
        method: "POST",
        path: "/api/admin/execute-sql",
        body: {
          sql: "SELECT count(*) AS total, sum(amount) AS somme, min(created_at) AS premier, min(created_at)::date AS jour, bool_and(true) AS vrai, " +
            "1.5::float8 AS flottant, 2::float8 AS entier, 7::int2 AS petit, 12345678901::int8 AS grand, NULL AS rien, '{\"a\": [1, \"b\"]}'::jsonb AS objet, " +
            "ARRAY[1, 2] AS tableau, ARRAY['a', NULL] AS textes, 'x'::bytea AS octets, '1 day 02:00'::interval AS duree, " +
            "'2026-01-01 10:00+02'::timestamptz AS horodate, 'f'::bool AS faux, 'é\"\\\\'::text AS texte FROM avoirs",
        },
      },
      { method: "POST", path: "/api/admin/execute-sql", body: { sql: "SELECT 'a' AS x, 'b' AS x, 1" } },
      { method: "POST", path: "/api/admin/execute-sql", body: { sql: "SELECT n, n * 1.5 AS demi FROM generate_series(1, 12) AS n" } },
      { method: "POST", path: "/api/admin/execute-sql", body: { sql: "SELECT 1 WHERE false" } },
      { method: "POST", path: "/api/admin/execute-sql", body: { sql: "SELECT 1 AS a; SELECT 2 AS b" } },
      { method: "POST", path: "/api/admin/execute-sql", body: { sql: "SELECT 1 AS a; SELEC 2" } },
      { method: "POST", path: "/api/admin/execute-sql", body: { sql: "ANALYZE groups" } },
      { method: "POST", path: "/api/admin/execute-sql", body: { sql: "   " } },
      { method: "POST", path: "/api/admin/execute-sql", body: { sql: "SELEC 1" } },
      { method: "POST", path: "/api/admin/execute-sql", body: { sql: "SELECT 1/0" } },
      { method: "POST", path: "/api/admin/execute-sql", body: { sql: "" } },
      { method: "POST", path: "/api/admin/execute-sql", body: { sql: 5 } },
      { method: "POST", path: "/api/admin/execute-sql", body: {} },
    ],
    tables: [],
  },
  {
    module: "admin-sql",
    name: "exécuter du SQL : modification d'une ligne",
    steps: [
      { method: "POST", path: "/api/admin/execute-sql", body: { sql: "UPDATE groups SET color = '#123456' WHERE id = 3" } },
      { method: "POST", path: "/api/admin/execute-sql", body: { sql: "UPDATE groups SET color = color WHERE id = 999" } },
      { method: "POST", path: "/api/admin/execute-sql", body: { sql: "UPDATE avoirs SET comment = 'modifié' WHERE id = 1 RETURNING id, comment, amount" } },
      { method: "POST", path: "/api/admin/execute-sql", body: { sql: "SELECT id, color FROM groups WHERE id = 3" } },
    ],
    tables: ["groups", "avoirs"],
  },
  {
    module: "admin-sql",
    name: "migration d'urgence : secrets en clair chiffrés",
    steps: [
      { method: "POST", path: "/api/admin/execute-sql", body: { sql: "UPDATE groups SET smtp_password = 'secret-en-clair' WHERE id = 2" } },
      { method: "POST", path: "/api/admin/emergency-migration" },
      { method: "POST", path: "/api/admin/execute-sql", body: { sql: "SELECT id, smtp_password LIKE 'enc:v1:%' AS chiffre FROM groups ORDER BY id" } },
    ],
    tables: [],
  },
  {
    // N'existe que si EMERGENCY_SECRET est défini (sinon 404) : le banc rejoue le
    // secret de son propre environnement
    module: "admin-sql",
    name: "réinitialisation d'urgence du compte admin",
    accounts: ["anonyme", "manager"],
    steps: [
      { method: "POST", path: "/api/emergency-admin-reset", body: { secret: "mauvais-secret" } },
      { method: "POST", path: "/api/emergency-admin-reset", body: {} },
      { method: "POST", path: "/api/emergency-admin-reset", body: { secret: process.env.EMERGENCY_SECRET || "secret-absent" } },
      { method: "POST", path: "/api/login", body: { username: "admin", password: "admin" } },
    ],
    tables: ["users"],
    // Empreinte au sel aléatoire
    ignore: ["password"],
  },
];
