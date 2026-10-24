// Échappe une valeur avant de l'insérer dans du HTML construit à la main
// (fenêtres d'impression écrites avec document.write) : une saisie
// utilisateur ne doit jamais être interprétée comme du code.
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
