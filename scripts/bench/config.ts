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

// Services externes simulés (NocoDB, webhooks, SMTP) : voir stub.ts
export const STUB_PORT = 3199;
export const STUB_URL = `http://127.0.0.1:${STUB_PORT}`;
export const STUB_SMTP_PORT = 3198;

// Environnement commun aux deux serveurs
export const BENCH_ENV = {
  SESSION_SECRET: "banc-secret-de-session",
  ENCRYPTION_KEY: "banc-cle-de-chiffrement",
  EXTERNAL_API_KEYS: "",
  TZ: "UTC",
};
