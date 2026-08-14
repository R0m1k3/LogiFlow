/**
 * Contenu des mails de relance fournisseur (rapprochement BL/Factures).
 * Partagé client/serveur : le serveur construit et envoie le mail via le SMTP
 * du magasin, le client peut réutiliser l'objet pour l'affichage.
 */

export interface SupplierMailDelivery {
  blNumber?: string | null;
  blAmount?: string | number | null;
  invoiceReference?: string | null;
  scheduledDate?: string | Date | null;
  deliveredDate?: string | Date | null;
  supplier?: {
    name?: string | null;
    email?: string | null;
    contact?: string | null;
  } | null;
  group?: { name?: string | null } | null;
}

/** Coordonnées du magasin reprises dans la signature. */
export interface StoreSignature {
  name?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
}

/** Formatage jj/mm/aaaa, tolérant aux valeurs absentes ou invalides. */
function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "";
  try {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return "";

    const day = String(dateObj.getDate()).padStart(2, "0");
    const month = String(dateObj.getMonth() + 1).padStart(2, "0");
    return `${day}/${month}/${dateObj.getFullYear()}`;
  } catch {
    return "";
  }
}

/**
 * Objet du mail : identifie la livraison concernée.
 */
export function buildSupplierMailSubject(delivery: SupplierMailDelivery): string {
  const formattedDate = formatDate(delivery.deliveredDate || delivery.scheduledDate);

  const reference = delivery.blNumber
    ? `BL n° ${delivery.blNumber}`
    : formattedDate
      ? `Livraison du ${formattedDate}`
      : "Livraison";

  const parts = [
    "Demande de facture (PDF) ou BL (Excel)",
    delivery.blNumber && formattedDate ? `${reference} du ${formattedDate}` : reference,
  ];

  if (delivery.group?.name) {
    parts.push(delivery.group.name);
  }

  return parts.join(" - ");
}

/**
 * Récapitulatif de la livraison : seules les informations renseignées sont listées.
 */
function buildDeliveryDetails(delivery: SupplierMailDelivery): string[] {
  const formattedDate = formatDate(delivery.deliveredDate || delivery.scheduledDate);

  const blAmount =
    delivery.blAmount !== null && delivery.blAmount !== undefined && delivery.blAmount !== ""
      ? parseFloat(String(delivery.blAmount))
      : null;

  const details: string[] = [];
  if (delivery.supplier?.name) details.push(`Fournisseur : ${delivery.supplier.name}`);
  if (delivery.group?.name) details.push(`Magasin : ${delivery.group.name}`);
  if (formattedDate) details.push(`Date de livraison : ${formattedDate}`);
  if (delivery.blNumber) details.push(`N° de BL : ${delivery.blNumber}`);
  if (blAmount !== null && !isNaN(blAmount)) {
    details.push(`Montant du BL : ${blAmount.toFixed(2)} €`);
  }
  if (delivery.invoiceReference) {
    details.push(`Référence facture : ${delivery.invoiceReference}`);
  }

  return details.length > 0 ? details : ["(informations de livraison à préciser)"];
}

/**
 * Version texte du mail (repli pour les clients sans HTML).
 */
export function buildSupplierMailText(
  delivery: SupplierMailDelivery,
  store?: StoreSignature | null
): string {
  const details = buildDeliveryDetails(delivery).map(line => `- ${line}`);

  const signature = [store?.name, store?.address, store?.phone ? `Tél. ${store.phone}` : null, store?.email]
    .filter(Boolean)
    .join("\n");

  const lines = [
    "Bonjour,",
    "",
    "Dans le cadre du rapprochement de nos bons de livraison et de vos factures, nous vous remercions de bien vouloir nous transmettre :",
    "",
    "- la facture au format PDF, ou",
    "- le bon de livraison au format Excel",
    "",
    "Livraison concernée :",
    ...details,
    "",
    "Vous en remerciant par avance.",
    "",
    "Cordialement,",
    ...(signature ? [signature] : []),
  ];

  return lines.join("\n");
}

/** Échappement HTML des valeurs injectées dans le corps du mail. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Version HTML du mail, avec la signature du magasin et son logo.
 * Le logo est référencé par `cid:logo` : il est joint au message par
 * l'expéditeur, ce qui évite les images distantes bloquées par Outlook.
 */
export function buildSupplierMailHtml(
  delivery: SupplierMailDelivery,
  store?: StoreSignature | null,
  options: { hasLogo?: boolean } = {}
): string {
  const details = buildDeliveryDetails(delivery)
    .map(line => `<li>${escapeHtml(line)}</li>`)
    .join("");

  const signatureLines = [
    store?.name ? `<strong>${escapeHtml(store.name)}</strong>` : null,
    store?.address ? escapeHtml(store.address).replace(/\n/g, "<br>") : null,
    store?.phone ? `Tél. ${escapeHtml(store.phone)}` : null,
    store?.email
      ? `<a href="mailto:${escapeHtml(store.email)}">${escapeHtml(store.email)}</a>`
      : null,
  ].filter(Boolean);

  const logoBlock = options.hasLogo
    ? '<p style="margin:0 0 8px 0;"><img src="cid:logo" alt="" style="max-width:200px;height:auto;border:0;"></p>'
    : "";

  const signatureBlock = signatureLines.length > 0 || logoBlock
    ? `${logoBlock}<p style="margin:0;color:#444;font-size:13px;line-height:1.5;">${signatureLines.join("<br>")}</p>`
    : "";

  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222;line-height:1.5;">
  <p>Bonjour,</p>
  <p>Dans le cadre du rapprochement de nos bons de livraison et de vos factures, nous vous remercions de bien vouloir nous transmettre&nbsp;:</p>
  <ul>
    <li>la facture au format PDF, ou</li>
    <li>le bon de livraison au format Excel</li>
  </ul>
  <p style="margin-bottom:4px;">Livraison concernée&nbsp;:</p>
  <ul>${details}</ul>
  <p>Vous en remerciant par avance.</p>
  <p style="margin-bottom:12px;">Cordialement,</p>
  ${signatureBlock}
</div>`;
}
