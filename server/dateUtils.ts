// Normalisation des dates d'échéance renvoyées par NocoDB (formats variés)
// vers YYYY-MM-DD. Partagée par les routes web et l'API externe.
export function normalizeDateString(dateString: string | null | undefined): string | null {
  if (!dateString || typeof dateString !== 'string') return null;

  const trimmed = dateString.trim();
  if (!trimmed) return null;

  try {
    // Si déjà au format ISO (YYYY-MM-DD), le retourner tel quel
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }

    // Format slash ou tiret : DD/MM/YYYY, MM/DD/YYYY, DD-MM-YYYY, MM-DD-YYYY
    const slashMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (slashMatch) {
      const [, first, second, year] = slashMatch;
      const firstNum = parseInt(first);
      const secondNum = parseInt(second);

      // Validation basique des valeurs
      if (firstNum > 31 || secondNum > 31 || firstNum === 0 || secondNum === 0) {
        console.warn(`⚠️ Date invalide (valeurs hors limites): ${trimmed}`);
        return null;
      }

      // Déterminer le format en fonction des valeurs
      let day: string, month: string;

      if (firstNum > 12) {
        // first > 12 → forcément DD/MM (format français/européen)
        day = first.padStart(2, '0');
        month = second.padStart(2, '0');
      } else if (secondNum > 12) {
        // second > 12 → forcément MM/DD (format américain)
        day = second.padStart(2, '0');
        month = first.padStart(2, '0');
      } else {
        // Ambiguïté (les deux < 12) → on assume format français DD/MM par défaut
        // Pour être plus sûr, on pourrait vérifier la configuration du groupe/locale
        day = first.padStart(2, '0');
        month = second.padStart(2, '0');
      }

      // Validation finale : mois entre 1-12, jour entre 1-31
      const monthNum = parseInt(month);
      const dayNum = parseInt(day);
      if (monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) {
        console.warn(`⚠️ Date invalide après parsing: ${trimmed} → month=${month}, day=${day}`);
        return null;
      }

      return `${year}-${month}-${day}`;
    }

    // Essayer de parser avec Date (format ISO complet avec heures)
    const date = new Date(trimmed);
    if (!isNaN(date.getTime())) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    // Si aucun format reconnu, retourner null (ne pas persister une date invalide)
    console.warn(`⚠️ Format de date non reconnu: ${trimmed}`);
    return null;
  } catch (error) {
    console.error('❌ Erreur normalisation date:', error);
    return null; // Retourner null en cas d'erreur pour éviter de persister des données invalides
  }
}
