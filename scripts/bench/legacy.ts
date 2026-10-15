// Fonctions reprises de l'ancien serveur Node, pour écrire les données du banc
// comme il les aurait écrites (le serveur Node a été retiré du dépôt).
import crypto from "node:crypto";

const PREFIX = "enc:v1:";

/** Ancien server/crypto.ts : AES-256-GCM, clé = SHA-256(ENCRYPTION_KEY ou SESSION_SECRET) */
export function encryptSecret(value: string): string {
  const secret = process.env.ENCRYPTION_KEY || process.env.SESSION_SECRET || "logiflow-fallback-secret-key";
  const key = crypto.createHash("sha256").update(secret).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

/**
 * Ancien weatherService.getPreviousYearDate, serveur en UTC : même jour de la
 * semaine, même rang dans le mois, l'année précédente
 */
export function previousYearDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const dayOfWeek = date.getUTCDay();
  const firstDayOfMonth = new Date(Date.UTC(year - 1, month, 1)).getUTCDay();
  const daysToAdd = (dayOfWeek - firstDayOfMonth + 7) % 7;
  const weekOfMonth = Math.ceil(date.getUTCDate() / 7);
  const target = new Date(Date.UTC(year - 1, month, 1 + daysToAdd + (weekOfMonth - 1) * 7));
  if (target.getUTCMonth() !== month) {
    target.setUTCDate(target.getUTCDate() - 7);
  }
  return target.toISOString().split("T")[0];
}
