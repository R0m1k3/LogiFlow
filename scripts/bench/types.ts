// Description des requêtes rejouées par le banc.

// "anonyme" : sans session ; "api" : clé de l'API externe (en-tête X-API-Key)
export type AccountKey = "admin" | "directeur" | "manager" | "employe" | "sans-magasin" | "anonyme" | "api";

export const ALL_ACCOUNTS: AccountKey[] = ["admin", "directeur", "manager", "employe", "sans-magasin", "anonyme"];
export const LOGGED_ACCOUNTS: AccountKey[] = ["admin", "directeur", "manager", "employe", "sans-magasin"];

// Écart voulu entre Node et Rust (faille fermée…), décidé et inscrit au banc :
// ces champs sont retirés des deux côtés avant la comparaison, et le banc
// rappelle la raison à la fin de son rapport
export interface Deviation {
  fields: string[];
  reason: string;
}

// Lecture : rejouée sur la même base pour chaque compte
export interface ReadCase {
  module: string;
  path: string;
  accounts?: AccountKey[]; // par défaut ALL_ACCOUNTS
  // Champs ignorés dans la comparaison (valeurs propres à chaque passage)
  ignore?: string[];
  deviation?: Deviation;
}

// Les chemins et corps acceptent des gabarits :
//   {{today}} {{today+3}} {{today-30}} → AAAA-MM-JJ ; {{year}} {{year-1}} {{month}}
//   {{0.id}} → champ id de la réponse JSON de l'étape 0 du même scénario
export interface Step {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  body?: unknown;
  // json (par défaut), form (urlencoded) ou multipart (champs + fichiers)
  bodyType?: "json" | "form" | "multipart";
  files?: { field: string; filename: string; contentType: string; size: number }[];
  headers?: Record<string, string>;
}

// Écriture : base remise à zéro avant chaque compte, puis état des tables comparé
export interface WriteScenario {
  module: string;
  name: string;
  accounts?: AccountKey[]; // par défaut LOGGED_ACCOUNTS
  steps: Step[];
  tables: string[];
  ignore?: string[];
  deviation?: Deviation;
}
