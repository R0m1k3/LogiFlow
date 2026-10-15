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
];
