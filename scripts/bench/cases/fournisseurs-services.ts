// Lot 4, services partagés : rapprochement BL / factures (commentaires, courriels
// fournisseurs, vérification des factures, cache), configuration NocoDB, BAP et
// clés de l'API externe. NocoDB, les webhooks et le SMTP sont simulés par stub.ts.
import { STUB_SMTP_PORT, STUB_URL } from "../config";
import type { ReadCase, WriteScenario } from "../types";

export const reads: ReadCase[] = [
  // Commentaires de rapprochement (ReconciliationComments.tsx)
  { module: "reconciliation", path: "/api/deliveries/2/reconciliation-comments" },
  { module: "reconciliation", path: "/api/deliveries/4/reconciliation-comments" },
  { module: "reconciliation", path: "/api/deliveries/6/reconciliation-comments" },
  { module: "reconciliation", path: "/api/deliveries/999/reconciliation-comments" },
  { module: "reconciliation", path: "/api/deliveries/abc/reconciliation-comments" },
  // Historique des relances (BLReconciliation.tsx : « ? » seul, ou storeId pour admin et directeur)
  { module: "reconciliation", path: "/api/supplier-mail-logs?" },
  { module: "reconciliation", path: "/api/supplier-mail-logs?storeId=1" },
  { module: "reconciliation", path: "/api/supplier-mail-logs?storeId=2" },
  { module: "reconciliation", path: "/api/supplier-mail-logs?deliveryId=2" },
  { module: "reconciliation", path: "/api/supplier-mail-logs?deliveryId=abc" },
  { module: "reconciliation", path: "/api/supplier-mail-logs?storeId=abc" },
  // Diagnostic du cache (sans appelant dans l'interface ; supprime au passage une entrée expirée)
  { module: "reconciliation", path: "/api/cache/diagnosis" },
  // Configuration NocoDB (NocoDBConfig.tsx, Groups.tsx)
  { module: "nocodb-config", path: "/api/nocodb-config" },
  { module: "nocodb-config", path: "/api/nocodb-config/active" },
  // Webhook BAP (WebhookBAPConfig.tsx, BapUploadModal.tsx)
  { module: "bap", path: "/api/webhook-bap-config" },
  // Clés de l'API externe (ExternalApiSettings.tsx)
  { module: "external-api", path: "/api/external-api/keys" },
];

// Durée de vie des entrées du cache : relative à l'heure du passage, différente
// entre les deux serveurs (vérifiée par les tests unitaires de Rust)
const CACHE_IGNORE = ["expires_at"];

export const writes: WriteScenario[] = [
  // ---------- Commentaires ----------
  {
    module: "reconciliation",
    name: "commentaires : ajouter, modifier, supprimer",
    steps: [
      { method: "POST", path: "/api/deliveries/2/reconciliation-comments", body: { content: "Relance faite", type: "warning" } },
      { method: "PUT", path: "/api/reconciliation-comments/{{0.id}}", body: { content: "Relance faite (modifié)", type: "success" } },
      { method: "GET", path: "/api/deliveries/2/reconciliation-comments" },
      { method: "DELETE", path: "/api/reconciliation-comments/{{0.id}}" },
      { method: "POST", path: "/api/deliveries/6/reconciliation-comments", body: { content: "Commentaire à Metz" } },
      { method: "PUT", path: "/api/reconciliation-comments/1", body: { content: "Modifié par un autre compte" } },
      { method: "DELETE", path: "/api/reconciliation-comments/2" },
      { method: "GET", path: "/api/deliveries/4/reconciliation-comments" },
    ],
    tables: ["reconciliation_comments"],
  },
  {
    module: "reconciliation",
    name: "commentaires : corps invalides et identifiants inconnus",
    steps: [
      { method: "POST", path: "/api/deliveries/2/reconciliation-comments", body: {} },
      { method: "POST", path: "/api/deliveries/2/reconciliation-comments", body: { content: "x", type: "bizarre" } },
      { method: "POST", path: "/api/deliveries/2/reconciliation-comments", body: { content: 5 } },
      { method: "POST", path: "/api/deliveries/2/reconciliation-comments", body: { content: "Forcé", deliveryId: 6, groupId: 2, authorId: "admin_local" } },
      { method: "POST", path: "/api/deliveries/999/reconciliation-comments", body: { content: "x" } },
      { method: "POST", path: "/api/deliveries/abc/reconciliation-comments", body: { content: "x" } },
      { method: "PUT", path: "/api/reconciliation-comments/1", body: { type: "inconnu" } },
      { method: "PUT", path: "/api/reconciliation-comments/1", body: { deliveryId: 4, authorId: "admin_local" } },
      { method: "PUT", path: "/api/reconciliation-comments/2", body: { deliveryId: 99999 } },
      { method: "PUT", path: "/api/reconciliation-comments/999", body: {} },
      { method: "PUT", path: "/api/reconciliation-comments/abc", body: {} },
      { method: "DELETE", path: "/api/reconciliation-comments/999" },
      { method: "DELETE", path: "/api/reconciliation-comments/abc" },
    ],
    tables: ["reconciliation_comments"],
  },

  // ---------- Courriel au fournisseur ----------
  {
    module: "reconciliation",
    name: "courriel au fournisseur : envoi et refus",
    steps: [
      { method: "POST", path: "/api/deliveries/2/send-supplier-mail" },
      { method: "POST", path: "/api/deliveries/4/send-supplier-mail" },
      { method: "POST", path: "/api/deliveries/6/send-supplier-mail" },
      { method: "POST", path: "/api/deliveries/7/send-supplier-mail" },
      { method: "POST", path: "/api/deliveries/999/send-supplier-mail" },
      { method: "POST", path: "/api/deliveries/abc/send-supplier-mail" },
      { method: "GET", path: "/api/supplier-mail-logs?deliveryId=2" },
    ],
    tables: ["supplier_mail_logs"],
    ignore: ["messageId", "message_id"],
  },
  {
    module: "reconciliation",
    name: "courriel au fournisseur : SMTP incomplet ou injoignable",
    steps: [
      // PUT /api/groups/:id reste servi par Node (lot 5) : admin et manager
      { method: "PUT", path: "/api/groups/2", body: { smtpEnabled: true } },
      { method: "POST", path: "/api/deliveries/6/send-supplier-mail" },
      // Metz : sans logo, sans nom d'expéditeur ni authentification
      { method: "PUT", path: "/api/groups/2", body: { smtpHost: " 127.0.0.1 ", smtpPort: STUB_SMTP_PORT, smtpSenderEmail: "metz@banc.test", smtpUser: null } },
      { method: "POST", path: "/api/deliveries/6/send-supplier-mail" },
      // Nancy : serveur injoignable
      { method: "PUT", path: "/api/groups/1", body: { smtpPort: 1 } },
      { method: "POST", path: "/api/deliveries/2/send-supplier-mail" },
      { method: "GET", path: "/api/supplier-mail-logs?" },
      { method: "GET", path: "/api/supplier-mail-logs?deliveryId=6&storeId=2" },
    ],
    tables: ["supplier_mail_logs"],
    ignore: ["messageId", "message_id"],
  },

  // ---------- Vérification des factures ----------
  {
    module: "reconciliation",
    name: "vérifier la facture d'une livraison",
    steps: [
      { method: "POST", path: "/api/deliveries/4/verify-invoice", body: { invoiceReference: "FAC-2004", forceRefresh: false } },
      { method: "POST", path: "/api/deliveries/4/verify-invoice", body: { invoiceReference: "FAC-2004", forceRefresh: true } },
      { method: "POST", path: "/api/deliveries/2/verify-invoice", body: { blNumber: "BL-1002", forceRefresh: false } },
      { method: "POST", path: "/api/deliveries/2/verify-invoice", body: { blNumber: "BL-1002" } },
      { method: "POST", path: "/api/deliveries/2/verify-invoice", body: { blNumber: "BL-1004" } },
      { method: "POST", path: "/api/deliveries/2/verify-invoice", body: { invoiceReference: "FAC-9999", blNumber: "BL-1002" } },
      { method: "POST", path: "/api/deliveries/3/verify-invoice", body: { invoiceReference: " BL-1001 " } },
      { method: "POST", path: "/api/deliveries/1/verify-invoice", body: { invoiceReference: "FAC-2001" } },
      { method: "POST", path: "/api/deliveries/6/verify-invoice", body: { invoiceReference: "FAC-2006", forceRefresh: true } },
      { method: "POST", path: "/api/deliveries/7/verify-invoice", body: { invoiceReference: "FAC-3000" } },
      { method: "POST", path: "/api/deliveries/8/verify-invoice", body: { invoiceReference: "AV-3001", forceRefresh: true } },
    ],
    tables: ["deliveries", "invoice_verification_cache"],
    ignore: CACHE_IGNORE,
  },
  {
    module: "reconciliation",
    name: "vérifier la facture d'une livraison : corps invalides",
    steps: [
      { method: "POST", path: "/api/deliveries/4/verify-invoice", body: {} },
      { method: "POST", path: "/api/deliveries/4/verify-invoice", body: { invoiceReference: "  ", blNumber: "" } },
      { method: "POST", path: "/api/deliveries/4/verify-invoice", body: { invoiceReference: 12 } },
      { method: "POST", path: "/api/deliveries/4/verify-invoice", body: { invoiceReference: " ", blNumber: true } },
      { method: "POST", path: "/api/deliveries/999/verify-invoice", body: { invoiceReference: "FAC-2004" } },
      { method: "POST", path: "/api/deliveries/abc/verify-invoice", body: { invoiceReference: "FAC-2004" } },
    ],
    tables: ["deliveries", "invoice_verification_cache"],
    ignore: CACHE_IGNORE,
  },
  {
    module: "reconciliation",
    name: "vérifier une facture : NocoDB injoignable, en erreur ou désactivé",
    steps: [
      { method: "PUT", path: "/api/nocodb-config/1", body: { baseUrl: "http://127.0.0.1:1" } },
      { method: "POST", path: "/api/deliveries/4/verify-invoice", body: { invoiceReference: "FAC-2004", forceRefresh: true } },
      { method: "PUT", path: "/api/nocodb-config/1", body: { baseUrl: `${STUB_URL}/autre` } },
      { method: "POST", path: "/api/deliveries/2/verify-invoice", body: { invoiceReference: "FAC-2002", forceRefresh: true } },
      { method: "POST", path: "/api/deliveries/2/verify-invoice", body: { blNumber: "BL-1002", forceRefresh: true } },
      { method: "PUT", path: "/api/nocodb-config/1", body: { baseUrl: "pas une adresse" } },
      { method: "POST", path: "/api/deliveries/4/verify-invoice", body: { invoiceReference: "FAC-2004", forceRefresh: true } },
      { method: "PUT", path: "/api/nocodb-config/1", body: { isActive: false } },
      { method: "POST", path: "/api/deliveries/4/verify-invoice", body: { invoiceReference: "FAC-2004", forceRefresh: true } },
    ],
    tables: ["invoice_verification_cache", "nocodb_config"],
    ignore: CACHE_IGNORE,
  },
  {
    module: "reconciliation",
    name: "vérifier des factures (adresses sans magasin contrôlé)",
    steps: [
      { method: "POST", path: "/api/verify-invoice", body: { groupId: 1, invoiceReference: "FAC-2002" } },
      { method: "POST", path: "/api/verify-invoice", body: { groupId: "1", invoiceReference: "fac-2002" } },
      { method: "POST", path: "/api/verify-invoice", body: { groupId: 2, invoiceReference: "FAC-2001" } },
      { method: "POST", path: "/api/verify-invoice", body: { groupId: 3, invoiceReference: "FAC-2001" } },
      { method: "POST", path: "/api/verify-invoice", body: { groupId: 99, invoiceReference: "FAC-2001" } },
      { method: "POST", path: "/api/verify-invoice", body: { groupId: "abc", invoiceReference: "FAC-2001" } },
      { method: "POST", path: "/api/verify-invoice", body: { groupId: 1, invoiceReference: 5 } },
      { method: "POST", path: "/api/verify-invoice", body: { groupId: 1, invoiceReference: "   " } },
      { method: "POST", path: "/api/verify-invoice", body: { groupId: 1 } },
      { method: "POST", path: "/api/verify-invoices", body: { invoiceReferences: [{ groupId: 1, invoiceReference: "fac-2001", deliveryId: 10, supplierName: "lactalis" }, { groupId: 3, invoiceReference: "X", deliveryId: 2 }] } },
      { method: "POST", path: "/api/verify-invoices", body: { invoiceReferences: [{ groupId: 1, invoiceReference: "FAC-2001", deliveryId: 1, supplierName: "Bonduelle" }] } },
      { method: "POST", path: "/api/verify-invoices", body: { invoiceReferences: [{ groupId: 1, deliveryId: 3 }] } },
      // Une seule clé non numérique par appel : Node les range dans l'ordre où ses
      // vérifications parallèles se terminent
      { method: "POST", path: "/api/verify-invoices", body: { invoiceReferences: [{ deliveryId: "a" }, { groupId: 99, deliveryId: 5 }] } },
      { method: "POST", path: "/api/verify-invoices", body: { invoiceReferences: [7] } },
      { method: "POST", path: "/api/verify-invoices", body: { invoiceReferences: [{ groupId: "abc", deliveryId: 4 }] } },
      { method: "POST", path: "/api/verify-invoices", body: { invoiceReferences: [null] } },
      { method: "POST", path: "/api/verify-invoices", body: { invoiceReferences: "FAC-2001" } },
    ],
    tables: ["invoice_verification_cache"],
    ignore: CACHE_IGNORE,
  },

  // ---------- Cache des factures ----------
  {
    module: "reconciliation",
    name: "cache : marquer rapproché, mise à jour en lot, diagnostic",
    steps: [
      { method: "POST", path: "/api/cache/mark-reconciled", body: { invoiceReference: " FAC-2004 ", groupId: 1 } },
      { method: "POST", path: "/api/cache/mark-reconciled", body: { invoiceReference: "FAC-1900", groupId: "1" } },
      { method: "POST", path: "/api/cache/mark-reconciled", body: { invoiceReference: 5, groupId: 1 } },
      { method: "POST", path: "/api/cache/mark-reconciled", body: { invoiceReference: "FAC-2004" } },
      { method: "POST", path: "/api/cache/update-reconciled" },
      { method: "GET", path: "/api/cache/diagnosis" },
    ],
    tables: ["invoice_verification_cache"],
  },

  // ---------- Configuration NocoDB ----------
  {
    module: "nocodb-config",
    name: "configurations NocoDB : créer, modifier, supprimer",
    steps: [
      { method: "POST", path: "/api/nocodb-config", body: { name: "NocoDB secours", baseUrl: `${STUB_URL}/nocodb`, projectId: "psecours", apiToken: "jeton-neuf", description: "Seconde base", isActive: false, createdBy: "pirate" } },
      { method: "PUT", path: "/api/nocodb-config/{{0.id}}", body: { name: "NocoDB renommée", apiToken: "jeton-modifié" } },
      { method: "PUT", path: "/api/nocodb-config/{{0.id}}", body: {} },
      { method: "GET", path: "/api/nocodb-config" },
      { method: "GET", path: "/api/nocodb-config/active" },
      { method: "DELETE", path: "/api/nocodb-config/{{0.id}}" },
      { method: "DELETE", path: "/api/nocodb-config/999" },
      { method: "PUT", path: "/api/nocodb-config/999", body: { name: "Absente" } },
      { method: "POST", path: "/api/nocodb-config", body: { name: "Sans jeton", baseUrl: "http://x.test", projectId: "p", apiToken: "" } },
    ],
    tables: ["nocodb_config"],
    ignore: ["api_token"],
  },
  {
    module: "nocodb-config",
    name: "configurations NocoDB : corps invalides",
    steps: [
      { method: "POST", path: "/api/nocodb-config", body: {} },
      { method: "POST", path: "/api/nocodb-config", body: { name: "x", baseUrl: 1, projectId: "p", apiToken: "t" } },
      { method: "PUT", path: "/api/nocodb-config/1", body: { isActive: "oui" } },
      { method: "PUT", path: "/api/nocodb-config/abc", body: {} },
      { method: "DELETE", path: "/api/nocodb-config/abc" },
    ],
    tables: ["nocodb_config"],
    ignore: ["api_token"],
  },

  // ---------- BAP ----------
  {
    module: "bap",
    name: "webhook BAP : configuration",
    steps: [
      { method: "POST", path: "/api/webhook-bap-config", body: { name: "BAP banc", webhookUrl: `${STUB_URL}/webhook/bap-nouveau`, description: "Modifiée", isActive: true, id: 7 } },
      { method: "GET", path: "/api/webhook-bap-config" },
      { method: "POST", path: "/api/webhook-bap-config", body: { webhookUrl: 12 } },
      { method: "POST", path: "/api/webhook-bap-config", body: {} },
      { method: "POST", path: "/api/webhook-bap-config", body: { name: "x".repeat(101), webhookUrl: "u", isActive: "oui" } },
    ],
    tables: ["webhook_bap_config"],
  },
  {
    module: "bap",
    name: "webhook BAP : test de connexion",
    steps: [
      { method: "POST", path: "/api/webhook-bap-config/test", body: { webhookUrl: `${STUB_URL}/webhook/bap` } },
      { method: "POST", path: "/api/webhook-bap-config/test", body: { webhookUrl: `${STUB_URL}/autre` } },
      { method: "POST", path: "/api/webhook-bap-config/test", body: {} },
      { method: "POST", path: "/api/webhook-bap-config/test", body: { webhookUrl: "pas-une-url" } },
      { method: "POST", path: "/api/webhook-bap-config/test", body: { webhookUrl: "http://127.0.0.1:1" } },
      { method: "POST", path: "/api/webhook-bap-config/test", body: { webhookUrl: "ftp://x.test/a" } },
    ],
    tables: [],
  },
  {
    module: "bap",
    name: "envoi d'un BAP au webhook",
    steps: [
      { method: "POST", path: "/api/bap/send-webhook", body: { pdfBase64: "JVBERi0xLjQKJcOkw7zDtsOf", fileName: "Facture-123.PDF", recipient: "Laurie" } },
      { method: "POST", path: "/api/bap/send-webhook", body: { pdfBase64: "JVBERi0xLjQK", fileName: "a.pdf", recipient: "Paul" } },
      { method: "POST", path: "/api/bap/send-webhook", body: { pdfBase64: "JVBERi0xLjQK", fileName: "a.txt", recipient: "Jeremy" } },
      { method: "POST", path: "/api/bap/send-webhook", body: { pdfBase64: 5, fileName: "a.pdf", recipient: "Jeremy" } },
      { method: "POST", path: "/api/bap/send-webhook", body: { pdfBase64: [1, 2], fileName: "a.pdf", recipient: "Jeremy" } },
      { method: "POST", path: "/api/bap/send-webhook", body: { pdfBase64: "x", fileName: 5, recipient: "Laurie" } },
      { method: "POST", path: "/api/bap/send-webhook", body: { fileName: "a.pdf" } },
      { method: "POST", path: "/api/webhook-bap-config", body: { webhookUrl: `${STUB_URL}/autre` } },
      { method: "POST", path: "/api/bap/send-webhook", body: { pdfBase64: "JVBERi0xLjQK", fileName: "b.pdf", recipient: "Jeremy" } },
      { method: "POST", path: "/api/webhook-bap-config", body: { webhookUrl: `${STUB_URL}/webhook/bap`, isActive: false } },
      { method: "POST", path: "/api/bap/send-webhook", body: { pdfBase64: "JVBERi0xLjQK", fileName: "c.pdf", recipient: "Laurie" } },
    ],
    tables: ["webhook_bap_config"],
  },

  // ---------- Clés de l'API externe ----------
  {
    module: "external-api",
    name: "clés d'API : créer, révoquer",
    steps: [
      { method: "POST", path: "/api/external-api/keys", body: { name: "  Nouvel outil  " } },
      { method: "DELETE", path: "/api/external-api/keys/{{0.apiKey.id}}" },
      { method: "DELETE", path: "/api/external-api/keys/{{0.apiKey.id}}" },
      { method: "DELETE", path: "/api/external-api/keys/2" },
      { method: "DELETE", path: "/api/external-api/keys/1" },
      { method: "DELETE", path: "/api/external-api/keys/1e2" },
      { method: "GET", path: "/api/external-api/keys" },
    ],
    tables: ["external_api_keys"],
    ignore: ["key", "keyPrefix", "key_prefix", "key_hash"],
  },
  {
    module: "external-api",
    name: "clés d'API : nom ou identifiant invalide",
    steps: [
      { method: "POST", path: "/api/external-api/keys", body: {} },
      { method: "POST", path: "/api/external-api/keys", body: { name: "   " } },
      { method: "POST", path: "/api/external-api/keys", body: { name: 5 } },
      { method: "POST", path: "/api/external-api/keys", body: { name: "x".repeat(101) } },
      { method: "POST", path: "/api/external-api/keys", body: [] },
      { method: "DELETE", path: "/api/external-api/keys/abc" },
      { method: "DELETE", path: "/api/external-api/keys/0" },
      { method: "DELETE", path: "/api/external-api/keys/1.5" },
      { method: "DELETE", path: "/api/external-api/keys/99999999999" },
    ],
    tables: ["external_api_keys"],
  },
];
