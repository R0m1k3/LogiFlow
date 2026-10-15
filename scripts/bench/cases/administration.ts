// Lot 5 : connexion et session, utilisateurs, magasins, sauvegardes, paramètres
// généraux, diagnostic du schéma (docs/PLAN-MIGRATION-RUST.md). Les lectures
// de /api/user, /api/default-credentials-check (socle.ts, « auth »),
// /api/users et /api/groups (referentiel.ts) sont déjà au banc.
import type { ReadCase, WriteScenario } from "../types";
import { LOGGED_ACCOUNTS } from "../types";
import { STUB_SMTP_PORT } from "../config";

// Le hash renvoyé par Node après POST / PUT /api/users (sel aléatoire) n'est pas
// renvoyé par Rust : écart voulu, retiré de la comparaison (réponses et table users)
const PASSWORD_HASH = {
  fields: ["password"],
  reason: "USERS-02 : l'empreinte du mot de passe n'est plus renvoyée après création ou modification d'un compte",
};

// Session d'une connexion : identifiant et échéance propres à chaque passage
const SESSION_IGNORE = ["sid", "expire", "expires"];

const BROWSER_ACCEPT = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";

// Magasin dont le serveur SMTP est le service simulé du banc
const SMTP = {
  smtpEnabled: true,
  smtpHost: "127.0.0.1",
  smtpPort: STUB_SMTP_PORT,
  smtpSecure: false,
  smtpUser: "toul@banc.test",
  smtpSenderEmail: "toul@banc.test",
  smtpSenderName: "Magasin Toul",
};

export const reads: ReadCase[] = [
  { module: "backups", path: "/api/backups" },
  { module: "backups", path: "/api/backups/backup_banc_1.sql/download" },
  { module: "backups", path: "/api/backups/backup_banc_500.sql/download", accounts: ["admin", "manager"] },
  { module: "backups", path: "/api/backups/absente.sql/download", accounts: ["admin", "manager"] },
  { module: "utilities", path: "/api/utilities" },
  { module: "admin", path: "/api/debug/log-schema" },
  { module: "admin", path: "/api/debug/download-schema" },
];

export const writes: WriteScenario[] = [
  // ---------- Session ----------
  {
    module: "session",
    name: "connexion réussie : réponse, cookie et session enregistrée",
    accounts: ["anonyme"],
    steps: [
      { method: "POST", path: "/api/login", body: { username: "directeur", password: "banc-directeur" } },
      { method: "GET", path: "/api/user" },
    ],
    tables: ["sessions"],
    ignore: SESSION_IGNORE,
  },
  {
    module: "session",
    name: "connexion par formulaire ou par l'adresse",
    accounts: ["anonyme"],
    steps: [
      { method: "POST", path: "/api/login", body: { username: "employe", password: "banc-employe" }, bodyType: "form" },
      { method: "POST", path: "/api/login?username=manager&password=banc-manager" },
      { method: "POST", path: "/api/login?username=sansmagasin", body: { password: "banc-sans-magasin" } },
    ],
    tables: [],
  },
  {
    module: "session",
    name: "connexion refusée : identifiants mal formés",
    accounts: ["anonyme"],
    steps: [
      { method: "POST", path: "/api/login", body: { username: "manager", password: 123 } },
      { method: "POST", path: "/api/login", body: { username: "manager", password: true } },
      { method: "POST", path: "/api/login", body: { username: "manager", password: ["banc-manager"] } },
      { method: "POST", path: "/api/login", body: { username: ["manager"], password: "banc-manager" } },
      { method: "POST", path: "/api/login", body: { username: "manager", password: "" } },
      { method: "POST", path: "/api/login", body: { username: "MANAGER", password: "banc-manager" } },
      { method: "POST", path: "/api/login", body: { username: 0, password: "x" } },
      { method: "POST", path: "/api/login", body: { username: 12, password: "x" } },
      { method: "POST", path: "/api/login", body: ["manager", "banc-manager"] },
      { method: "POST", path: "/api/login?username=manager&username=directeur&password=banc-manager" },
      { method: "POST", path: "/api/login", body: { username: "admin", password: "admin" } },
    ],
    tables: ["sessions"],
  },
  {
    module: "session",
    name: "connexion par-dessus une session ouverte",
    steps: [
      { method: "POST", path: "/api/login", body: { username: "sansmagasin", password: "banc-sans-magasin" } },
      // L'ancienne session est détruite : le cookie du compte ne vaut plus rien
      { method: "GET", path: "/api/user" },
    ],
    tables: ["sessions"],
    ignore: SESSION_IGNORE,
  },
  {
    module: "session",
    name: "déconnexion (GET et POST, selon Accept) puis lecture de l'utilisateur",
    accounts: [...LOGGED_ACCOUNTS, "anonyme"],
    steps: [
      { method: "GET", path: "/api/logout", headers: { accept: BROWSER_ACCEPT } },
      { method: "GET", path: "/api/user" },
      { method: "POST", path: "/api/logout", headers: { accept: "application/json" } },
      { method: "POST", path: "/api/logout" },
    ],
    tables: ["sessions"],
  },
  {
    // Toute adresse encore servie par Node lit la session ouverte par la connexion
    module: "session",
    name: "session acceptée par une adresse de Node (test SMTP)",
    steps: [{ method: "POST", path: "/api/groups/1/test-smtp" }],
    tables: [],
  },

  // ---------- Utilisateurs ----------
  {
    module: "users",
    name: "créer, modifier, affecter, retirer et supprimer un utilisateur",
    steps: [
      {
        method: "POST",
        path: "/api/users",
        body: { id: "bench_nouveau", username: "nouveau", email: "nouveau@banc.test", firstName: "Noé", lastName: "Nouveau", password: "banc-nouveau", role: "employee" },
      },
      { method: "PUT", path: "/api/users/bench_nouveau", body: { firstName: "Noémie", lastName: "", email: "", role: "manager", password: "banc-nouveau-2" } },
      { method: "POST", path: "/api/users/bench_nouveau/groups", body: { groupId: 2 } },
      { method: "POST", path: "/api/users/bench_nouveau/groups", body: { groupId: 3 } },
      { method: "DELETE", path: "/api/users/bench_nouveau/groups/2" },
      { method: "GET", path: "/api/users" },
      { method: "PUT", path: "/api/users/bench_employee", body: { password: "banc-employe-2" } },
      { method: "DELETE", path: "/api/users/bench_nouveau" },
      { method: "GET", path: "/api/users" },
      // Le mot de passe modifié est vérifiable (en dernier : la connexion
      // remplace la session du compte qui rejoue le scénario)
      { method: "POST", path: "/api/login", body: { username: "employe", password: "banc-employe-2" } },
    ],
    tables: ["users", "user_groups"],
    deviation: PASSWORD_HASH,
  },
  {
    module: "users",
    name: "créer un utilisateur sans identifiant ni adresse",
    accounts: ["admin", "manager"],
    steps: [
      { method: "POST", path: "/api/users", body: { username: "sansid", password: "banc-sans-id", email: "" } },
      { method: "POST", path: "/api/users", body: { username: "blanc", password: "x", email: "  " } },
      { method: "POST", path: "/api/users", body: { id: "", username: "sansid2", password: "x", email: null, firstName: "", role: "directeur" } },
      // Le mot de passe du compte créé est vérifiable
      { method: "POST", path: "/api/login", body: { username: "sansid", password: "banc-sans-id" } },
    ],
    tables: ["users"],
    // Identifiant généré : manual_<millisecondes>_<aléatoire>
    ignore: ["id"],
    deviation: PASSWORD_HASH,
  },
  {
    module: "users",
    name: "utilisateurs invalides, en double ou introuvables",
    steps: [
      { method: "POST", path: "/api/users", body: {} },
      { method: "POST", path: "/api/users", body: { username: "", password: "", email: 5, role: "chef" } },
      { method: "POST", path: "/api/users", body: { username: "a", password: "b", email: "pas-un-courriel", firstName: null } },
      { method: "POST", path: "/api/users", body: { username: "manager", password: "x" } },
      { method: "POST", path: "/api/users", body: { username: "autre", password: "x", email: "manager@banc.test" } },
      { method: "POST", path: "/api/users", body: { id: "bench_manager", username: "autre2", password: "x" } },
      { method: "POST", path: "/api/users", body: ["x"] },
      { method: "PUT", path: "/api/users/bench_employee", body: { role: "chef", firstName: 5 } },
      { method: "PUT", path: "/api/users/bench_employee", body: { username: "manager" } },
      { method: "PUT", path: "/api/users/bench_employee", body: { email: "directeur@banc.test" } },
      { method: "PUT", path: "/api/users/inconnu", body: { firstName: "X" } },
      // Noms effacés ; adresse vide ignorée (non effacée, comme Node)
      { method: "PUT", path: "/api/users/bench_employee", body: { firstName: null, lastName: "", email: "" } },
      { method: "DELETE", path: "/api/users/admin_local" },
      { method: "DELETE", path: "/api/users/bench_employee" },
      { method: "POST", path: "/api/users/bench_manager/groups", body: { groupId: "2" } },
      { method: "POST", path: "/api/users/bench_manager/groups", body: {} },
      { method: "DELETE", path: "/api/users/bench_manager/groups/abc" },
      { method: "DELETE", path: "/api/users/bench_manager/groups/1" },
      // Mot de passe vide enregistré tel quel (défaut de Node) : connexion
      // impossible (en dernier : une connexion réussie remplacerait la session)
      { method: "PUT", path: "/api/users/bench_sans_magasin", body: { password: "" } },
      { method: "POST", path: "/api/login", body: { username: "sansmagasin", password: "banc-sans-magasin" } },
    ],
    tables: ["users", "user_groups"],
    deviation: PASSWORD_HASH,
  },

  // ---------- Magasins ----------
  {
    module: "groups",
    name: "créer, modifier, tester et supprimer un magasin",
    steps: [
      {
        method: "POST",
        path: "/api/groups",
        body: { name: "Magasin Toul", color: "#7B1FA2", address: "", phone: "", logo: "", nocodbConfigId: null, ...SMTP, smtpPassword: "secret-toul" },
      },
      // Node relit le mot de passe chiffré par l'autre serveur
      { method: "POST", path: "/api/groups/{{0.id}}/test-smtp" },
      { method: "PUT", path: "/api/groups/{{0.id}}", body: { name: "Magasin de Toul", phone: "03 83 00 00 05", smtpPassword: "" } },
      { method: "PUT", path: "/api/groups/{{0.id}}", body: { smtpPassword: "nouveau-secret", smtpPort: String(STUB_SMTP_PORT) } },
      { method: "POST", path: "/api/groups/{{0.id}}/test-smtp" },
      { method: "PUT", path: "/api/groups/{{0.id}}", body: { smtpSenderEmail: "", smtpPort: null } },
      { method: "POST", path: "/api/groups/{{0.id}}/test-smtp" },
      { method: "GET", path: "/api/groups" },
      { method: "DELETE", path: "/api/groups/{{0.id}}" },
    ],
    tables: ["groups"],
    // Chiffré avec un vecteur aléatoire
    ignore: ["smtp_password"],
  },
  {
    module: "groups",
    name: "magasins invalides, introuvables ou encore utilisés",
    steps: [
      { method: "POST", path: "/api/groups", body: {} },
      { method: "POST", path: "/api/groups", body: { name: "X", smtpSenderEmail: 5 } },
      { method: "POST", path: "/api/groups", body: { name: "X", smtpSenderEmail: "abc", smtpPort: "0" } },
      { method: "POST", path: "/api/groups", body: { name: "X", smtpPort: "abc", phone: 12 } },
      { method: "PUT", path: "/api/groups/1", body: { name: 5 } },
      { method: "PUT", path: "/api/groups/999", body: { name: "Fantôme" } },
      { method: "PUT", path: "/api/groups/abc", body: { name: "X" } },
      // Un manager modifie un magasin qui n'est pas le sien (comme Node)
      { method: "PUT", path: "/api/groups/2", body: { color: "#000000", smtpPassword: null } },
      { method: "DELETE", path: "/api/groups/1" },
      { method: "DELETE", path: "/api/groups/999" },
      { method: "DELETE", path: "/api/groups/abc" },
    ],
    tables: ["groups"],
    ignore: ["smtp_password"],
  },

  // ---------- Sauvegardes ----------
  {
    module: "backups",
    name: "créer une sauvegarde (pg_dump), ménage des anciennes",
    steps: [
      { method: "POST", path: "/api/backups" },
      { method: "GET", path: "/api/backups" },
      { method: "DELETE", path: "/api/backups/{{0.filename}}" },
      { method: "GET", path: "/api/backups" },
    ],
    // Les deux plus anciennes (sans fichier) ont été supprimées par le ménage
    tables: ["database_backups"],
    // Identifiant aléatoire, nom horodaté, taille du fichier pg_dump
    ignore: ["id", "filename", "size"],
  },
  {
    module: "backups",
    name: "supprimer une sauvegarde et son fichier",
    steps: [
      { method: "DELETE", path: "/api/backups/backup_banc_500.sql" },
      { method: "GET", path: "/api/backups/backup_banc_500.sql/download" },
      { method: "DELETE", path: "/api/backups/backup_banc_500.sql" },
      { method: "DELETE", path: "/api/backups/absente.sql" },
      { method: "GET", path: "/api/backups" },
    ],
    tables: ["database_backups"],
  },

  // ---------- Paramètres généraux ----------
  {
    module: "utilities",
    name: "modifier les paramètres généraux",
    steps: [
      { method: "POST", path: "/api/utilities", body: { salesAnalysisUrl: "https://analyse.banc.test/nouveau" } },
      { method: "POST", path: "/api/utilities", body: { automaticBackupsEnabled: true, autre: 1 } },
      { method: "POST", path: "/api/utilities", body: { salesAnalysisUrl: null } },
      { method: "GET", path: "/api/utilities" },
    ],
    tables: ["utilities"],
  },
  {
    module: "utilities",
    name: "paramètres généraux invalides",
    steps: [
      { method: "POST", path: "/api/utilities", body: { salesAnalysisUrl: 5 } },
      { method: "POST", path: "/api/utilities", body: { salesAnalysisUrl: "x".repeat(501), automaticBackupsEnabled: "oui" } },
      { method: "POST", path: "/api/utilities", body: [] },
    ],
    tables: ["utilities"],
  },
];
