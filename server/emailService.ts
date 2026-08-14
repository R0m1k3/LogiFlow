import nodemailer, { type Transporter } from 'nodemailer';
import { decryptSecret } from './crypto';
import {
  buildSupplierMailSubject,
  buildSupplierMailText,
  buildSupplierMailHtml,
  type SupplierMailDelivery,
} from '@shared/supplierMail';

/**
 * Envoi des mails fournisseurs via la configuration SMTP propre à chaque magasin.
 * Chaque magasin renseigne son serveur, ses identifiants et son adresse
 * d'expédition sur sa fiche : aucun compte global n'est utilisé.
 */

export interface StoreSmtpConfig {
  id?: number;
  name?: string | null;
  address?: string | null;
  phone?: string | null;
  logo?: string | null;
  smtpEnabled?: boolean | null;
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpSecure?: boolean | null;
  smtpUser?: string | null;
  smtpPassword?: string | null;
  smtpSenderEmail?: string | null;
  smtpSenderName?: string | null;
}

export class SmtpConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SmtpConfigError';
  }
}

/**
 * Vérifie que le magasin dispose d'une configuration exploitable.
 * Renvoie la liste des champs manquants plutôt qu'un simple booléen,
 * pour pouvoir dire à l'utilisateur ce qu'il reste à renseigner.
 */
export function getMissingSmtpFields(group: StoreSmtpConfig | null | undefined): string[] {
  if (!group) return ['magasin'];

  const missing: string[] = [];
  if (!group.smtpHost?.trim()) missing.push('serveur SMTP');
  if (!group.smtpPort) missing.push('port SMTP');
  if (!group.smtpSenderEmail?.trim()) missing.push('adresse expéditeur');
  return missing;
}

/**
 * Construit le transporteur nodemailer d'un magasin.
 * L'authentification est optionnelle : certains relais internes acceptent
 * les envois sans identifiants.
 */
export function createTransporter(group: StoreSmtpConfig): Transporter {
  const missing = getMissingSmtpFields(group);
  if (missing.length > 0) {
    throw new SmtpConfigError(`Configuration SMTP incomplète : ${missing.join(', ')}`);
  }

  // Le mot de passe est stocké chiffré (AES-256-GCM) : déchiffré uniquement
  // ici, au moment de la connexion au serveur SMTP
  const smtpPassword = decryptSecret(group.smtpPassword);
  const hasAuth = Boolean(group.smtpUser?.trim() && smtpPassword);

  return nodemailer.createTransport({
    host: group.smtpHost!.trim(),
    port: Number(group.smtpPort),
    secure: Boolean(group.smtpSecure),
    auth: hasAuth
      ? { user: group.smtpUser!.trim(), pass: smtpPassword! }
      : undefined,
  });
}

/** Adresse "De :" du magasin, avec son nom affiché. */
function buildFromAddress(group: StoreSmtpConfig): string {
  const senderEmail = group.smtpSenderEmail!.trim();
  const senderName = group.smtpSenderName?.trim() || group.name?.trim();
  return senderName ? `"${senderName}" <${senderEmail}>` : senderEmail;
}

/**
 * Extrait le contenu binaire d'un logo stocké en data URI.
 * Renvoie null si le logo est absent ou dans un format inattendu.
 */
function parseLogoDataUri(logo: string | null | undefined) {
  if (!logo) return null;

  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(logo.trim());
  if (!match) return null;

  const [, mimeType, base64] = match;
  const extension = mimeType.split('/')[1]?.split('+')[0] || 'png';

  try {
    return {
      content: Buffer.from(base64, 'base64'),
      contentType: mimeType,
      filename: `logo.${extension}`,
    };
  } catch {
    return null;
  }
}

/**
 * Teste la configuration SMTP d'un magasin sans envoyer de message.
 */
export async function verifySmtpConfig(group: StoreSmtpConfig): Promise<void> {
  const transporter = createTransporter(group);
  try {
    await transporter.verify();
  } finally {
    transporter.close();
  }
}

export interface SendSupplierMailResult {
  messageId: string;
  accepted: string[];
  rejected: string[];
}

/**
 * Envoie au fournisseur la demande de facture PDF / BL Excel pour une livraison.
 */
export async function sendSupplierDocumentRequest(
  group: StoreSmtpConfig,
  delivery: SupplierMailDelivery,
  supplierEmail: string
): Promise<SendSupplierMailResult> {
  const transporter = createTransporter(group);

  try {
    const store = {
      name: group.name,
      address: group.address,
      phone: group.phone,
      email: group.smtpSenderEmail,
    };

    const logo = parseLogoDataUri(group.logo);

    const info = await transporter.sendMail({
      from: buildFromAddress(group),
      to: supplierEmail.trim(),
      replyTo: group.smtpSenderEmail!.trim(),
      subject: buildSupplierMailSubject(delivery),
      text: buildSupplierMailText(delivery, store),
      html: buildSupplierMailHtml(delivery, store, { hasLogo: Boolean(logo) }),
      attachments: logo
        ? [{ ...logo, cid: 'logo', contentDisposition: 'inline' as const }]
        : [],
    });

    return {
      messageId: info.messageId,
      accepted: (info.accepted || []).map(String),
      rejected: (info.rejected || []).map(String),
    };
  } finally {
    transporter.close();
  }
}
