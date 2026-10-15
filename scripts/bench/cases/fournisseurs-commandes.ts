// Lot 4, commandes et livraisons : commandes fournisseurs, livraisons (validation,
// contrôle, rapprochement automatique, échéance relue dans NocoDB), API externe
// de rapprochement (/api/ext/v1, clé d'API) et relais ffnancy (sans réseau : seul
// le refus sans session est rejoué). NocoDB est simulé par stub.ts.
import { BENCH_API_KEY } from "../config";
import type { AccountKey, ReadCase, WriteScenario } from "../types";

// Clé d'API (en-tête X-API-Key), et deux sessions qui n'y donnent pas accès
const EXT_ACCOUNTS: AccountKey[] = ["api", "anonyme", "admin"];

// Durée de vie des entrées du cache des factures : relative à l'heure du passage
const CACHE_IGNORE = ["expires_at"];

const ext = (path: string): ReadCase => ({ module: "external-api-v1", path: `/api/ext/v1${path}`, accounts: EXT_ACCOUNTS });

export const reads: ReadCase[] = [
  // ---------- Commandes (Orders.tsx, Dashboard.tsx, Calendar.tsx, modales, mobile) ----------
  { module: "orders", path: "/api/orders" },
  { module: "orders", path: "/api/orders?storeId=1" },
  { module: "orders", path: "/api/orders?storeId=2" },
  { module: "orders", path: "/api/orders?storeId=3" },
  { module: "orders", path: "/api/orders?storeId=abc" },
  { module: "orders", path: "/api/orders?" },
  { module: "orders", path: "/api/orders?startDate={{today-30}}&endDate={{today+30}}" },
  { module: "orders", path: "/api/orders?startDate={{today-30}}&endDate={{today+30}}&storeId=1" },
  { module: "orders", path: "/api/orders?storeId=2&startDate={{today}}&endDate={{today}}" },
  { module: "orders", path: "/api/orders?startDate={{today-400}}&endDate={{today+400}}&storeId=2" },
  { module: "orders", path: "/api/orders?startDate={{today}}" },
  { module: "orders", path: "/api/orders?startDate=abc&endDate=xyz" },
  { module: "orders", path: "/api/orders/1" },
  { module: "orders", path: "/api/orders/2" },
  { module: "orders", path: "/api/orders/4" },
  { module: "orders", path: "/api/orders/6" },
  { module: "orders", path: "/api/orders/600" },
  { module: "orders", path: "/api/orders/999" },
  { module: "orders", path: "/api/orders/abc" },

  // ---------- Livraisons (Deliveries.tsx, BLReconciliation.tsx, Calendar.tsx, mobile) ----------
  { module: "deliveries", path: "/api/deliveries" },
  { module: "deliveries", path: "/api/deliveries?storeId=1" },
  { module: "deliveries", path: "/api/deliveries?storeId=2" },
  { module: "deliveries", path: "/api/deliveries?storeId=3" },
  { module: "deliveries", path: "/api/deliveries?storeId=abc" },
  { module: "deliveries", path: "/api/deliveries?" },
  { module: "deliveries", path: "/api/deliveries?status=delivered" },
  { module: "deliveries", path: "/api/deliveries?status=delivered&storeId=2" },
  { module: "deliveries", path: "/api/deliveries?status=inconnu" },
  { module: "deliveries", path: "/api/deliveries?startDate={{today-30}}&endDate={{today+30}}" },
  { module: "deliveries", path: "/api/deliveries?startDate={{today-30}}&endDate={{today+30}}&storeId=1" },
  { module: "deliveries", path: "/api/deliveries?storeId=2&startDate={{today}}&endDate={{today}}" },
  { module: "deliveries", path: "/api/deliveries?startDate={{today-30}}&endDate={{today+30}}&status=planned" },
  { module: "deliveries", path: "/api/deliveries?startDate=abc&endDate=xyz" },
  { module: "deliveries", path: "/api/deliveries?withBL=true" },
  { module: "deliveries", path: "/api/deliveries?withBL=true&storeId=1" },
  { module: "deliveries", path: "/api/deliveries/1" },
  { module: "deliveries", path: "/api/deliveries/3" },
  { module: "deliveries", path: "/api/deliveries/5" },
  { module: "deliveries", path: "/api/deliveries/6" },
  { module: "deliveries", path: "/api/deliveries/7" },
  { module: "deliveries", path: "/api/deliveries/600" },
  { module: "deliveries", path: "/api/deliveries/601" },
  { module: "deliveries", path: "/api/deliveries/999" },
  { module: "deliveries", path: "/api/deliveries/abc" },

  // ---------- API externe (docs/API-RAPPROCHEMENT.md) ----------
  ext("/stores"),
  ext("/suppliers"),
  ext("/deliveries"),
  ext("/deliveries?storeId=1"),
  ext("/deliveries?storeId=2&reconciled=true"),
  ext("/deliveries?supplierId=2&hasInvoice=false"),
  ext("/deliveries?blNumber=%20bl-1002%20"),
  ext("/deliveries?blNumber=BL-1002&blNumber=BL-1004"),
  ext("/deliveries?hasBl=true&from={{today-30}}&to={{today-2}}"),
  ext("/deliveries?to={{today-6}}&reconciled=false"),
  ext("/deliveries?limit=2&offset=1"),
  ext("/deliveries?limit=1e3&offset=0x2"),
  ext("/deliveries?offset=50&limit="),
  ext("/deliveries?storeId=0&supplierId=1.5&reconciled=oui&hasBl=1&hasInvoice=&from=2026-1-1&to=x&limit=0&offset=-1"),
  ext("/deliveries?storeId=1&storeId=2"),
  ext("/deliveries?storeId=99999999999"),
  ext("/deliveries/1"),
  ext("/deliveries/2"),
  ext("/deliveries/3"),
  ext("/deliveries/602"),
  ext("/deliveries/999"),
  ext("/deliveries/abc"),
  ext("/deliveries/0"),
  ext("/deliveries/1.5"),
  ext("/deliveries/99999999999"),
  ext(""),
  ext("/"),
  ext("/inconnue"),
  ext("/stores/extra"),
  // Variantes qu'Express accepte (casse, barre finale) : relayées à Node
  ext("/stores/"),
  ext("/SUPPLIERS"),

  // ---------- Relais ffnancy : sans session seulement (les autres appels partent sur Internet) ----------
  { module: "ffnancy", path: "/api/ffnancy/articles?ean=3245678901234&limit=1", accounts: ["anonyme"] },
  { module: "ffnancy", path: "/api/ffnancy/mouvements/entrees?artNoId=1&limit=1&dateDebut=2000-01-01", accounts: ["anonyme"] },
];

const NEW_DELIVERY = { supplierId: 1, groupId: 1, scheduledDate: "{{today+4}}", quantity: 1, unit: "colis" };

export const writes: WriteScenario[] = [
  // ---------- Commandes ----------
  {
    module: "orders",
    name: "commandes : créer, modifier, supprimer",
    steps: [
      { method: "POST", path: "/api/orders", body: { supplierId: 1, groupId: 1, plannedDate: "{{today+7}}", notes: "Commande du banc" } },
      { method: "PUT", path: "/api/orders/{{0.id}}", body: { plannedDate: "{{today+8}}", notes: "Modifiée", quantity: 3, unit: "palettes" } },
      { method: "GET", path: "/api/orders/{{0.id}}" },
      { method: "DELETE", path: "/api/orders/{{0.id}}" },
      { method: "POST", path: "/api/orders", body: { supplierId: 2, groupId: 2, plannedDate: "{{today+1}}" } },
      { method: "PUT", path: "/api/orders/4", body: { status: "planned" } },
      { method: "PUT", path: "/api/orders/6", body: { notes: "Épinal" } },
      { method: "DELETE", path: "/api/orders/6" },
      { method: "DELETE", path: "/api/orders/3" },
      // Commande qui a des livraisons : clé étrangère
      { method: "DELETE", path: "/api/orders/2" },
      { method: "GET", path: "/api/orders?storeId=1" },
    ],
    tables: ["orders"],
  },
  {
    module: "orders",
    name: "commandes : corps invalides et identifiants inconnus",
    steps: [
      { method: "POST", path: "/api/orders", body: {} },
      { method: "POST", path: "/api/orders", body: { supplierId: "1", groupId: 1.5, plannedDate: 5, quantity: "2" } },
      { method: "POST", path: "/api/orders", body: [] },
      { method: "POST", path: "/api/orders", body: { supplierId: 1, groupId: 1, plannedDate: "pas une date" } },
      { method: "POST", path: "/api/orders", body: { supplierId: 999, groupId: 1, plannedDate: "{{today}}" } },
      { method: "POST", path: "/api/orders", body: { supplierId: 1, groupId: 1, plannedDate: "{{today}}", createdBy: "admin_local", status: "delivered", id: 999, createdAt: "{{today}}" } },
      { method: "PUT", path: "/api/orders/1", body: { groupId: "x" } },
      { method: "PUT", path: "/api/orders/1", body: [] },
      { method: "PUT", path: "/api/orders/1", body: {} },
      // Commande déplacée dans un autre magasin, créateur changé
      { method: "PUT", path: "/api/orders/3", body: { groupId: 3, createdBy: "bench_employee" } },
      { method: "PUT", path: "/api/orders/999", body: {} },
      { method: "PUT", path: "/api/orders/abc", body: {} },
      { method: "DELETE", path: "/api/orders/999" },
      { method: "DELETE", path: "/api/orders/abc" },
      { method: "GET", path: "/api/orders/3" },
    ],
    tables: ["orders"],
  },
  {
    module: "orders",
    name: "synchroniser les statuts commandes / livraisons",
    steps: [
      { method: "POST", path: "/api/sync-order-delivery-status" },
      { method: "POST", path: "/api/sync-order-delivery-status" },
      { method: "GET", path: "/api/orders/600" },
    ],
    tables: ["orders"],
  },

  // ---------- Livraisons ----------
  {
    module: "deliveries",
    name: "livraisons : créer, modifier, supprimer",
    steps: [
      // CreateDeliveryModal : commande 3 en attente, passée à « planned »
      { method: "POST", path: "/api/deliveries", body: { orderId: "3", supplierId: 3, groupId: 1, scheduledDate: "{{today+3}}", quantity: 2, unit: "palettes", status: "planned", notes: "Livraison du banc", createdBy: "admin_local" } },
      // EditDeliveryModal
      { method: "PUT", path: "/api/deliveries/{{0.id}}", body: { supplierId: 3, groupId: 1, orderId: null, scheduledDate: "{{today+5}}", quantity: 4, unit: "palettes", notes: "Modifiée" } },
      { method: "GET", path: "/api/deliveries/{{0.id}}" },
      { method: "DELETE", path: "/api/deliveries/{{0.id}}" },
      { method: "POST", path: "/api/deliveries", body: { ...NEW_DELIVERY, orderId: "none", groupId: 2 } },
      { method: "POST", path: "/api/deliveries", body: { ...NEW_DELIVERY, orderId: 4 } },
      { method: "POST", path: "/api/deliveries", body: { ...NEW_DELIVERY, orderId: 999 } },
      { method: "PUT", path: "/api/deliveries/5", body: { orderId: 1 } },
      { method: "PUT", path: "/api/deliveries/5", body: { orderId: 999 } },
      { method: "PUT", path: "/api/deliveries/5", body: { notes: "Metz" } },
      { method: "PUT", path: "/api/deliveries/601", body: { orderId: 3 } },
      { method: "DELETE", path: "/api/deliveries/7" },
      // Commentaires supprimés avec la livraison (cascade)
      { method: "DELETE", path: "/api/deliveries/2" },
      { method: "GET", path: "/api/deliveries?storeId=1" },
    ],
    tables: ["deliveries", "orders", "reconciliation_comments"],
  },
  {
    module: "deliveries",
    name: "livraisons : corps invalides et identifiants inconnus",
    steps: [
      { method: "POST", path: "/api/deliveries", body: {} },
      { method: "POST", path: "/api/deliveries", body: [] },
      { method: "POST", path: "/api/deliveries", body: { ...NEW_DELIVERY, orderId: "abc" } },
      { method: "POST", path: "/api/deliveries", body: { ...NEW_DELIVERY, orderId: "12abc" } },
      { method: "POST", path: "/api/deliveries", body: { ...NEW_DELIVERY, orderId: 0 } },
      { method: "POST", path: "/api/deliveries", body: { ...NEW_DELIVERY, orderId: "" } },
      { method: "POST", path: "/api/deliveries", body: { ...NEW_DELIVERY, deliveredDate: "{{today}}" } },
      { method: "POST", path: "/api/deliveries", body: { ...NEW_DELIVERY, status: "", blAmount: "12.5", blNumber: "BL-9000" } },
      { method: "POST", path: "/api/deliveries", body: { ...NEW_DELIVERY, groupId: 3, orderId: 6 } },
      { method: "PUT", path: "/api/deliveries/1", body: { invoiceAmountTTC: 5 } },
      { method: "PUT", path: "/api/deliveries/1", body: { dueDate: "pas une date" } },
      { method: "PUT", path: "/api/deliveries/4", body: { deliveredDate: "{{today}}" } },
      { method: "PUT", path: "/api/deliveries/4", body: { validatedAt: "", blAmount: 99.5, invoiceAmount: true, notes: null } },
      { method: "PUT", path: "/api/deliveries/4", body: { blAmount: 99.5, notes: null, blNumber: "" } },
      { method: "PUT", path: "/api/deliveries/4", body: [] },
      { method: "PUT", path: "/api/deliveries/999", body: {} },
      { method: "PUT", path: "/api/deliveries/abc", body: {} },
      { method: "DELETE", path: "/api/deliveries/999" },
      { method: "DELETE", path: "/api/deliveries/abc" },
      { method: "GET", path: "/api/deliveries/4" },
    ],
    tables: ["deliveries", "orders"],
  },
  {
    module: "deliveries",
    name: "livraisons : référence de facture et échéance (NocoDB)",
    steps: [
      { method: "PUT", path: "/api/deliveries/2", body: { invoiceReference: "FAC-2002", invoiceAmount: "310.00" } },
      { method: "PUT", path: "/api/deliveries/2", body: { invoiceReference: "FAC-2002" } },
      { method: "PUT", path: "/api/deliveries/2", body: { invoiceReference: "FAC-9999" } },
      { method: "PUT", path: "/api/deliveries/2", body: { invoiceReference: "", dueDate: "{{today+60}}" } },
      { method: "PUT", path: "/api/deliveries/4", body: { invoiceReference: "AV-3001" } },
      { method: "PUT", path: "/api/deliveries/6", body: { invoiceReference: "FAC-2006" } },
      { method: "PUT", path: "/api/deliveries/6", body: { invoiceReference: "FAC-2001", dueDate: null } },
      // Validation rapide et dévalidation (BLReconciliation.tsx)
      { method: "PUT", path: "/api/deliveries/4", body: { reconciled: true, validatedAt: "{{today}}T08:00:00.000Z" } },
      { method: "PUT", path: "/api/deliveries/1", body: { reconciled: false, validatedAt: null } },
      { method: "GET", path: "/api/deliveries/2" },
    ],
    tables: ["deliveries", "invoice_verification_cache"],
    ignore: CACHE_IGNORE,
  },
  {
    module: "deliveries",
    name: "livraisons : rapprochement automatique à la modification",
    steps: [
      // Bonduelle : livrée avec un BL, rapprochée d'office (la réponse reste la première mise à jour)
      { method: "PUT", path: "/api/deliveries/601", body: { status: "delivered", blNumber: "BL-6010" } },
      { method: "PUT", path: "/api/deliveries/3", body: { blNumber: "BL-3000" } },
      // Fournisseur changé : relu dans la table
      { method: "PUT", path: "/api/deliveries/3", body: { supplierId: 1, status: "delivered" } },
      { method: "PUT", path: "/api/deliveries/600", body: { supplierId: 2, blNumber: "BL-6000" } },
      { method: "GET", path: "/api/deliveries/601" },
    ],
    tables: ["deliveries"],
  },
  {
    module: "deliveries",
    name: "livraisons : valider",
    steps: [
      // Bonduelle, commande 2 : livraison rapprochée d'office, commande livrée
      { method: "POST", path: "/api/deliveries/3/validate", body: { blNumber: "  BL-3001  ", blAmount: 150.5 } },
      { method: "POST", path: "/api/deliveries/5/validate", body: { blNumber: "BL-5001" } },
      { method: "POST", path: "/api/deliveries/7/validate", body: { blNumber: "BL-7001", blAmount: "" } },
      // Cache : référence et BL de la livraison marqués « rapprochés »
      { method: "POST", path: "/api/deliveries/4/validate", body: { blNumber: "BL-1004" } },
      { method: "POST", path: "/api/deliveries/8/validate", body: { blNumber: "BL-0900", blAmount: null } },
      { method: "POST", path: "/api/deliveries/2/validate", body: { blNumber: "   " } },
      { method: "POST", path: "/api/deliveries/2/validate", body: {} },
      { method: "POST", path: "/api/deliveries/2/validate", body: [] },
      { method: "POST", path: "/api/deliveries/2/validate", body: { blNumber: 5 } },
      { method: "POST", path: "/api/deliveries/2/validate", body: { blNumber: "BL-1002", blAmount: "abc" } },
      { method: "POST", path: "/api/deliveries/999/validate", body: { blNumber: "x" } },
      { method: "POST", path: "/api/deliveries/abc/validate", body: { blNumber: "x" } },
      { method: "GET", path: "/api/deliveries/3" },
    ],
    tables: ["deliveries", "orders", "invoice_verification_cache"],
    ignore: CACHE_IGNORE,
  },
  {
    module: "deliveries",
    name: "livraisons : contrôle effectué",
    steps: [
      { method: "PUT", path: "/api/deliveries/4/control" },
      { method: "PUT", path: "/api/deliveries/6/control" },
      { method: "PUT", path: "/api/deliveries/999/control" },
      { method: "PUT", path: "/api/deliveries/abc/control" },
      { method: "PUT", path: "/api/deliveries/99999999999/control" },
      { method: "GET", path: "/api/deliveries?storeId=2" },
    ],
    tables: ["deliveries"],
  },

  // ---------- API externe ----------
  {
    module: "external-api-v1",
    name: "API externe : écrire la facture",
    accounts: ["api"],
    steps: [
      // Bonduelle (automatique), non rapprochée : échéance reprise de NocoDB
      { method: "PATCH", path: "/api/ext/v1/deliveries/2", body: { invoiceReference: " FAC-2002 ", invoiceAmount: "1 234,56", invoiceAmountTTC: 1481.47 } },
      { method: "PATCH", path: "/api/ext/v1/deliveries/2", body: { invoiceReference: "FAC-2002" } },
      { method: "PATCH", path: "/api/ext/v1/deliveries/2", body: { dueDate: "{{today+45}}", reconciled: true } },
      { method: "PATCH", path: "/api/ext/v1/deliveries/2", body: { invoiceAmount: "10" } },
      // Lactalis rapprochée : figée, sauf dévalidation dans la même requête
      { method: "PATCH", path: "/api/ext/v1/deliveries/1", body: { invoiceAmount: 5 } },
      { method: "PATCH", path: "/api/ext/v1/deliveries/1", body: { invoiceAmount: 5, reconciled: false } },
      { method: "PATCH", path: "/api/ext/v1/deliveries/1", body: { invoiceReference: "" } },
      { method: "PATCH", path: "/api/ext/v1/deliveries/1", body: { reconciled: true } },
      { method: "PATCH", path: "/api/ext/v1/deliveries/602", body: { invoiceReference: "FAC-2006", invoiceAmountTTC: null } },
      { method: "PATCH", path: "/api/ext/v1/deliveries/3", body: { invoiceReference: "X" } },
      { method: "PATCH", path: "/api/ext/v1/deliveries/4", body: { invoiceReference: "FAC-9999" } },
      { method: "PATCH", path: "/api/ext/v1/deliveries/4", body: { dueDate: "2026-02-30" } },
      { method: "PATCH", path: "/api/ext/v1/deliveries/4", body: { dueDate: "2026-13-45" } },
      { method: "PATCH", path: "/api/ext/v1/deliveries/999", body: { reconciled: true } },
      { method: "PATCH", path: "/api/ext/v1/deliveries/abc", body: { reconciled: true } },
      { method: "PATCH", path: "/api/ext/v1/deliveries/99999999999", body: { reconciled: true } },
      { method: "GET", path: "/api/ext/v1/deliveries?storeId=1&hasInvoice=true" },
    ],
    tables: ["deliveries", "invoice_verification_cache"],
    ignore: CACHE_IGNORE,
  },
  {
    module: "external-api-v1",
    name: "API externe : corps invalides et routes inconnues",
    accounts: ["api"],
    steps: [
      { method: "PATCH", path: "/api/ext/v1/deliveries/2", body: {} },
      { method: "PATCH", path: "/api/ext/v1/deliveries/2", body: [] },
      { method: "PATCH", path: "/api/ext/v1/deliveries/2", body: { foo: 1, 2: 3 } },
      { method: "PATCH", path: "/api/ext/v1/deliveries/2", body: { invoiceAmount: "abc", dueDate: "15/10/2026", reconciled: "oui", extra: 1 } },
      { method: "PATCH", path: "/api/ext/v1/deliveries/2", body: { invoiceAmount: true, invoiceAmountTTC: "1e9" } },
      { method: "PATCH", path: "/api/ext/v1/deliveries/2", body: { invoiceReference: "x".repeat(101) } },
      { method: "PATCH", path: "/api/ext/v1/deliveries/2", body: { invoiceReference: 5, reconciled: null } },
      { method: "PATCH", path: "/api/ext/v1/deliveries/abc", body: {} },
      { method: "POST", path: "/api/ext/v1/deliveries", body: {} },
      { method: "PUT", path: "/api/ext/v1/deliveries/2", body: {} },
      { method: "DELETE", path: "/api/ext/v1/stores" },
      { method: "POST", path: "/api/ext/v1/inconnue", body: { a: 1 } },
      { method: "GET", path: "/api/ext/v1/deliveries/2" },
    ],
    tables: ["deliveries"],
  },
  {
    module: "external-api-v1",
    name: "API externe : clés refusées ou passées autrement",
    accounts: ["api"],
    steps: [
      { method: "GET", path: "/api/ext/v1/stores", headers: { "x-api-key": "lf_cle_revoquee" } },
      { method: "GET", path: "/api/ext/v1/stores", headers: { "x-api-key": "mauvaise" } },
      { method: "GET", path: "/api/ext/v1/stores", headers: { "x-api-key": " ", authorization: `Bearer ${BENCH_API_KEY}` } },
      { method: "GET", path: "/api/ext/v1/suppliers", headers: { "x-api-key": "", authorization: `bearer  ${BENCH_API_KEY} ` } },
      { method: "GET", path: "/api/ext/v1/stores", headers: { "x-api-key": " ", authorization: "Bearer   " } },
      { method: "GET", path: "/api/ext/v1/stores", headers: { "x-api-key": " ", authorization: `Basic ${BENCH_API_KEY}` } },
      { method: "PATCH", path: "/api/ext/v1/deliveries/2", body: { reconciled: true }, headers: { "x-api-key": "mauvaise" } },
      { method: "POST", path: "/api/ext/v1/inconnue", headers: { "x-api-key": "mauvaise" } },
    ],
    tables: ["deliveries"],
  },
  {
    module: "external-api-v1",
    name: "API externe : désactivée sans clé active",
    accounts: ["admin"],
    steps: [
      // La session ne donne pas accès à l'API externe
      { method: "GET", path: "/api/ext/v1/stores" },
      { method: "GET", path: "/api/ext/v1/stores", headers: { "x-api-key": BENCH_API_KEY } },
      { method: "DELETE", path: "/api/external-api/keys/1" },
      { method: "GET", path: "/api/ext/v1/stores" },
      { method: "GET", path: "/api/ext/v1/stores", headers: { "x-api-key": BENCH_API_KEY } },
      { method: "GET", path: "/api/ext/v1/inconnue" },
      { method: "PATCH", path: "/api/ext/v1/deliveries/2", body: { reconciled: true }, headers: { "x-api-key": BENCH_API_KEY } },
    ],
    tables: ["external_api_keys"],
  },
];
