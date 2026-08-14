/**
 * Nettoyage des données sensibles avant envoi au client.
 */

/**
 * Retire récursivement le mot de passe SMTP des réponses API et le remplace par
 * un indicateur de présence (smtpPasswordSet). Traverse les objets et tableaux
 * imbriqués car les magasins apparaissent sous plusieurs formes : liste de
 * groupes, champ "group" d'une livraison ou d'une commande, relations
 * utilisateur... Filtrer chaque requête serait fragile, on nettoie donc une
 * seule fois à la sortie.
 */
export function stripSmtpPassword(value: any, depth = 0, seen = new WeakSet()): any {
  if (depth > 8 || value === null || typeof value !== 'object') {
    return value;
  }

  // Les structures cycliques sont renvoyées telles quelles plutôt que de
  // faire boucler la récursion
  if (seen.has(value)) {
    return value;
  }
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map(item => stripSmtpPassword(item, depth + 1, seen));
  }

  // Ne pas dénaturer les types non sérialisables en objets simples
  if (value instanceof Date || Buffer.isBuffer(value)) {
    return value;
  }

  const result: Record<string, any> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (key === 'smtpPassword' || key === 'smtp_password') {
      result.smtpPasswordSet = Boolean(entry);
      continue;
    }
    result[key] = stripSmtpPassword(entry, depth + 1, seen);
  }
  return result;
}
