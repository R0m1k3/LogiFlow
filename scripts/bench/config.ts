// Réglages communs du banc de comparaison Node / Rust.

export interface BenchAccount {
  key: string;
  id: string;
  username: string;
  password: string;
  role: "admin" | "directeur" | "manager" | "employee";
  firstName: string;
  lastName: string;
  groupIds: number[];
}

// Un compte par profil à tester (règles communes du plan du webUI)
export const BENCH_ACCOUNTS: BenchAccount[] = [
  { key: "admin", id: "admin_local", username: "admin", password: "banc-admin", role: "admin", firstName: "Alice", lastName: "Admin", groupIds: [] },
  { key: "directeur", id: "bench_directeur", username: "directeur", password: "banc-directeur", role: "directeur", firstName: "Denis", lastName: "Directeur", groupIds: [1, 2] },
  { key: "manager", id: "bench_manager", username: "manager", password: "banc-manager", role: "manager", firstName: "Manon", lastName: "Manager", groupIds: [1] },
  { key: "employe", id: "bench_employee", username: "employe", password: "banc-employe", role: "employee", firstName: "Émile", lastName: "Employé", groupIds: [1] },
  { key: "sans-magasin", id: "bench_sans_magasin", username: "sansmagasin", password: "banc-sans-magasin", role: "employee", firstName: "Sacha", lastName: "Sans", groupIds: [] },
];

// Clé de l'API externe enregistrée par seed.ts (empreinte seulement)
export const BENCH_API_KEY = "lf_banc_cle_de_test_0123456789";

// Plusieurs bancs peuvent tourner en parallèle (un par copie de travail) :
// BENCH_ID sépare les bases, BENCH_PORT_BASE les ports.
export const BENCH_ID = process.env.BENCH_ID || "";
const SUFFIX = BENCH_ID ? `_${BENCH_ID}` : "";
const PORT_BASE = Number(process.env.BENCH_PORT_BASE || 3200);

export const TEMPLATE_DB = process.env.BENCH_TEMPLATE_DB || `bench_seed${SUFFIX}`;
export const DB_PREFIX = `bench${SUFFIX}`;
export const LEFT_PORT = PORT_BASE + 1;
export const RIGHT_PORT = PORT_BASE + 3;
// Node derrière Rust : port du serveur Rust + 100
export const UPSTREAM_OFFSET = 100;

// Services externes simulés (NocoDB, webhooks, SMTP) : voir stub.ts.
// Les magasins de seed.ts pointent vers ces ports.
export const STUB_PORT = PORT_BASE + 90;
export const STUB_URL = `http://127.0.0.1:${STUB_PORT}`;
export const STUB_SMTP_PORT = PORT_BASE + 91;

// Environnement commun aux deux serveurs
export const BENCH_ENV = {
  SESSION_SECRET: "banc-secret-de-session",
  ENCRYPTION_KEY: "banc-cle-de-chiffrement",
  EXTERNAL_API_KEYS: "",
  TZ: "UTC",
};
