import { format } from "date-fns";
import { fr } from "date-fns/locale";

/**
 * Formate une date de façon sécurisée pour éviter "Invalid time value"
 * Retourne une chaîne par défaut si la date est invalide
 */
export function safeFormat(
  date: string | Date | null | undefined,
  formatStr: string = "dd/MM/yyyy",
  options: { locale?: Locale; defaultValue?: string } = {}
): string {
  const { locale = fr, defaultValue = "Date non disponible" } = options;
  
  if (!date) {
    return defaultValue;
  }
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    // Vérifier si la date est valide
    if (isNaN(dateObj.getTime())) {
      return defaultValue;
    }
    
    return format(dateObj, formatStr, { locale });
  } catch (error) {
    console.warn('Date formatting error:', error, 'for date:', date);
    return defaultValue;
  }
}

/**
 * Crée un objet Date de façon sécurisée
 * Retourne null si la date est invalide
 */
export function safeDate(date: string | Date | null | undefined): Date | null {
  if (!date) {
    return null;
  }
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    // Vérifier si la date est valide
    if (isNaN(dateObj.getTime())) {
      return null;
    }
    
    return dateObj;
  } catch (error) {
    console.warn('Date creation error:', error, 'for date:', date);
    return null;
  }
}

/**
 * Compare deux dates de façon sécurisée
 * Retourne 0 si l'une des dates est invalide
 */
export function safeCompareDate(a: string | Date | null | undefined, b: string | Date | null | undefined): number {
  const dateA = safeDate(a);
  const dateB = safeDate(b);
  
  if (!dateA || !dateB) {
    return 0;
  }
  
  return dateA.getTime() - dateB.getTime();
}