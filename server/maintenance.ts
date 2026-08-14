import { storage } from "./storage.js";

// Purge périodique du cache de vérification des factures.
//
// La table invoice_verification_cache porte une colonne expires_at et
// storage.clearExpiredCache() sait la purger, mais rien ne l'appelait : les
// entrées expirées s'accumulaient indéfiniment et alourdissaient chaque lecture
// du cache. On planifie donc la purge ici.

const PURGE_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 heures
const STARTUP_DELAY_MS = 60 * 1000; // laisse le démarrage se terminer d'abord

async function purgeExpiredInvoiceCache(): Promise<void> {
  try {
    await storage.clearExpiredCache();
    console.log("🧹 [MAINTENANCE] Cache de vérification des factures purgé");
  } catch (error) {
    // Une purge ratée ne doit jamais interrompre le service.
    console.error("❌ [MAINTENANCE] Échec de la purge du cache factures:", error);
  }
}

export function startMaintenanceJobs(): void {
  setTimeout(purgeExpiredInvoiceCache, STARTUP_DELAY_MS);
  setInterval(purgeExpiredInvoiceCache, PURGE_INTERVAL_MS);
  console.log("✅ [MAINTENANCE] Purge du cache factures planifiée (toutes les 6h)");
}
