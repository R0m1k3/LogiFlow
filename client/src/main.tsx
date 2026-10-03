import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Les pages sont chargées à la demande : après une mise en production, les
// anciens fichiers JS n'existent plus sur le serveur et le chargement d'une page
// échoue. On recharge alors l'application une seule fois pour récupérer la
// nouvelle version (au plus une fois par minute, pour ne pas boucler si le
// serveur est indisponible ; l'erreur est alors affichée normalement).
window.addEventListener("vite:preloadError", () => {
  const storageKey = "logiflow-chunk-reload-at";
  try {
    const lastReload = Number(sessionStorage.getItem(storageKey) || 0);
    if (Date.now() - lastReload < 60 * 1000) return;
    sessionStorage.setItem(storageKey, String(Date.now()));
  } catch {
    return;
  }
  window.location.reload();
});

createRoot(document.getElementById("root")!).render(<App />);
