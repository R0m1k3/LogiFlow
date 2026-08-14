import crypto from 'crypto';

/**
 * Chiffrement au repos des secrets applicatifs (mot de passe SMTP des
 * magasins, jeton API NocoDB).
 *
 * - AES-256-GCM (chiffrement authentifié : toute altération en base est détectée)
 * - Clé dérivée de ENCRYPTION_KEY, avec repli sur SESSION_SECRET pour que la
 *   production existante fonctionne sans nouvelle variable d'environnement
 * - Format stocké : enc:v1:<iv>:<tag>:<données>, tout en base64
 * - Les valeurs héritées en clair sont acceptées en lecture (déchiffrement
 *   transparent) et re-chiffrées par le balayage de démarrage
 *
 * ATTENTION : changer ENCRYPTION_KEY/SESSION_SECRET après coup rend les
 * secrets déjà chiffrés illisibles — il faudrait alors les ressaisir.
 */

const PREFIX = 'enc:v1:';

function getKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY || process.env.SESSION_SECRET;
  if (!secret) {
    // Même repli figé que les sessions : mieux vaut un chiffrement à clé
    // faible qu'un stockage en clair, et la production définit toujours
    // SESSION_SECRET via docker-compose.
    return crypto.createHash('sha256').update('logiflow-fallback-secret-key').digest();
  }
  return crypto.createHash('sha256').update(secret).digest();
}

export function isEncryptedSecret(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

/**
 * Chiffre un secret. Les valeurs vides et les valeurs déjà chiffrées sont
 * renvoyées telles quelles (idempotent : pas de double chiffrement possible).
 */
export function encryptSecret(value: string | null | undefined): string | null | undefined {
  if (!value || isEncryptedSecret(value)) {
    return value;
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

/**
 * Déchiffre un secret. Une valeur non chiffrée (héritage d'avant le
 * chiffrement) est renvoyée telle quelle.
 */
export function decryptSecret(value: string | null | undefined): string | null | undefined {
  if (!value || !isEncryptedSecret(value)) {
    return value;
  }

  const parts = value.slice(PREFIX.length).split(':');
  if (parts.length !== 3) {
    throw new Error('Secret chiffré illisible : format inattendu');
  }

  try {
    const [iv, tag, data] = parts.map(p => Buffer.from(p, 'base64'));
    const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    throw new Error(
      'Secret chiffré illisible : clé de chiffrement changée ou donnée altérée. Ressaisissez la valeur.'
    );
  }
}
