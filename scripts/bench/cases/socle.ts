import type { ReadCase, WriteScenario } from "../types";

export const reads: ReadCase[] = [
  { module: "socle", path: "/", accounts: ["anonyme"] },
  { module: "socle", path: "/deliveries", accounts: ["anonyme", "manager"] },
  { module: "socle", path: "/favicon.ico", accounts: ["anonyme"] },
  { module: "socle", path: "/api/health", accounts: ["anonyme"] },
  { module: "socle", path: "/api/adresse-inconnue", accounts: ["anonyme", "admin"] },
  { module: "auth", path: "/api/user" },
  { module: "auth", path: "/api/default-credentials-check" },
];

export const writes: WriteScenario[] = [
  {
    module: "auth",
    name: "déconnexion puis lecture de l'utilisateur",
    steps: [
      { method: "POST", path: "/api/logout" },
      { method: "GET", path: "/api/user" },
    ],
    tables: [],
  },
  {
    module: "auth",
    name: "connexion refusée",
    accounts: ["anonyme"],
    steps: [
      { method: "POST", path: "/api/login", body: { username: "manager", password: "mauvais" } },
      { method: "POST", path: "/api/login", body: { username: "inconnu", password: "x" } },
      { method: "POST", path: "/api/login", body: {} },
    ],
    tables: ["users"],
  },
  // ---------- Requêtes d'écriture d'un autre site (décision R4) ----------
  {
    module: "socle",
    name: "écriture d'un autre site refusée",
    accounts: ["manager"],
    steps: [
      {
        method: "POST",
        path: "/api/logout",
        headers: { origin: "https://site-tiers.example", "sec-fetch-site": "cross-site" },
      },
      { method: "POST", path: "/api/logout", headers: { origin: "null" } },
      // La session est toujours ouverte côté Rust
      { method: "GET", path: "/api/user" },
    ],
    tables: [],
    deviation: {
      fields: ["status", "headers", "body"],
      reason:
        "R4 : une requête /api qui n'est pas une lecture est refusée (403) quand le navigateur indique qu'elle vient d'un autre site (Sec-Fetch-Site, sinon Origin)",
    },
  },
  {
    module: "socle",
    name: "écriture du même site acceptée",
    accounts: ["manager"],
    steps: [
      { method: "POST", path: "/api/logout", headers: { "sec-fetch-site": "same-origin" } },
      { method: "GET", path: "/api/user" },
    ],
    tables: [],
  },
];
