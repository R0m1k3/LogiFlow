import { safeFormat } from "@/lib/dateUtils";

/**
 * Génération des emails de relance fournisseur (rapprochement BL/Factures).
 * Le lien mailto ouvre le client de messagerie par défaut du poste (Outlook)
 * avec le destinataire, l'objet et le corps du message déjà préremplis.
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

/** Enseigne utilisée dans la signature des mails fournisseurs. */
export const COMPANY_NAME = "LaFoir'Fouille";

/**
 * Objet du mail : identifie la livraison concernée.
 */
export function buildSupplierMailSubject(delivery: SupplierMailDelivery): string {
  const deliveryDate = delivery.deliveredDate || delivery.scheduledDate;
  const formattedDate = deliveryDate
    ? safeFormat(deliveryDate, "dd/MM/yyyy", { defaultValue: "" })
    : "";

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
 * Corps du mail : rappel des documents attendus + récapitulatif de la livraison.
 * Seules les informations réellement renseignées sont listées.
 */
export function buildSupplierMailBody(delivery: SupplierMailDelivery): string {
  const deliveryDate = delivery.deliveredDate || delivery.scheduledDate;
  const formattedDate = deliveryDate
    ? safeFormat(deliveryDate, "dd/MM/yyyy", { defaultValue: "" })
    : "";

  const blAmount =
    delivery.blAmount !== null && delivery.blAmount !== undefined && delivery.blAmount !== ""
      ? parseFloat(String(delivery.blAmount))
      : null;

  const details: string[] = [];
  if (delivery.supplier?.name) details.push(`- Fournisseur : ${delivery.supplier.name}`);
  if (delivery.group?.name) details.push(`- Magasin : ${delivery.group.name}`);
  if (formattedDate) details.push(`- Date de livraison : ${formattedDate}`);
  if (delivery.blNumber) details.push(`- N° de BL : ${delivery.blNumber}`);
  if (blAmount !== null && !isNaN(blAmount)) {
    details.push(`- Montant du BL : ${blAmount.toFixed(2)} €`);
  }
  if (delivery.invoiceReference) {
    details.push(`- Référence facture : ${delivery.invoiceReference}`);
  }

  // Signature : enseigne + magasin enregistré sur la livraison
  const signature = [COMPANY_NAME, delivery.group?.name].filter(Boolean).join("\n");

  const lines = [
    "Bonjour,",
    "",
    "Dans le cadre du rapprochement de nos bons de livraison et de vos factures, nous vous remercions de bien vouloir nous transmettre :",
    "",
    "- la facture au format PDF, ou",
    "- le bon de livraison au format Excel",
    "",
    "Livraison concernée :",
    ...(details.length > 0 ? details : ["- (informations de livraison à préciser)"]),
    "",
    "Vous en remerciant par avance.",
    "",
    "Cordialement,",
    ...(signature ? [signature] : []),
  ];

  return lines.join("\n");
}

/**
 * Construit le lien mailto complet (destinataire + objet + corps préremplis).
 */
export function buildSupplierMailtoUrl(
  delivery: SupplierMailDelivery,
  supplierEmail: string
): string {
  const subject = buildSupplierMailSubject(delivery);
  // RFC 6068 : les sauts de ligne du corps doivent être encodés en CRLF (%0D%0A),
  // sinon Outlook peut coller les lignes les unes aux autres.
  const body = buildSupplierMailBody(delivery).replace(/\n/g, "\r\n");

  return `mailto:${supplierEmail.trim()}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/**
 * Ouvre le client de messagerie par défaut (Outlook sur les postes du magasin).
 */
export function openMailClient(mailtoUrl: string): void {
  const link = document.createElement("a");
  link.href = mailtoUrl;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
