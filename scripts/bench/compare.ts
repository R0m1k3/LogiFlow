// Banc de comparaison : rejoue les mêmes requêtes sur deux serveurs et compare
// statuts, corps JSON, en-têtes utiles, état de la base et appels aux services
// externes (docs/PLAN-MIGRATION-RUST.md, « Vérification »).
//
//   npx tsx scripts/bench/compare.ts                  Node de référence contre Rust
//   npx tsx scripts/bench/compare.ts --mode node      Node contre Node (le banc est-il stable ?)
//   npx tsx scripts/bench/compare.ts --only dlc,tasks  seulement ces modules
//
// Prérequis : PostgreSQL local, base modèle bench_seed (voir README.md), serveur Node
// de référence construit (reference-node.sh), binaire Rust construit (server-rs/target/release).
import { spawn, execFileSync, type ChildProcess } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import pg from "pg";
import { fileURLToPath } from "url";
import { BENCH_ACCOUNTS, BENCH_API_KEY, BENCH_ENV, DB_PREFIX, LEFT_PORT, RIGHT_PORT, STUB_URL, TEMPLATE_DB } from "./config";
import { startStub } from "./stub";
import { READS, WRITES } from "./cases";
import { ALL_ACCOUNTS, LOGGED_ACCOUNTS, type AccountKey, type Deviation, type ReadCase, type Step, type WriteScenario } from "./types";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
// Fichiers des sauvegardes déclarées par les seeds (database_backups), copiés
// dans le dossier de sauvegardes de chaque serveur
const SEED_BACKUPS_DIR = path.join(ROOT, "scripts/bench/seeds/sauvegardes");
const PG_ADMIN_URL = process.env.BENCH_PG_URL || "postgres://logiflow_admin:bench@localhost:5432";
// Chemin relatif : depuis cette copie de travail (les serveurs sont lancés depuis BENCH_NODE_DIR)
const RUST_BIN = path.resolve(ROOT, process.env.RUST_BIN || "server-rs/target/release/logiflow");
// Serveur Node de référence construit par reference-node.sh (dist/ et node_modules/)
const NODE_DIR = process.env.BENCH_NODE_DIR || path.join(ROOT, ".bench-reference");
const WORK_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "logiflow-banc-"));

const args = process.argv.slice(2);
const mode = args.includes("--mode") ? args[args.indexOf("--mode") + 1] : "rust";
const only = args.includes("--only") ? args[args.indexOf("--only") + 1].split(",") : null;
const keep = args.includes("--keep");

// ---------- Gabarits ----------

function isoDay(offset: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function fill(template: string, results: unknown[]): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, expr: string) => {
    const day = expr.match(/^today([+-]\d+)?$/);
    if (day) return isoDay(Number(day[1] || 0));
    const year = expr.match(/^year([+-]\d+)?$/);
    if (year) return String(new Date().getUTCFullYear() + Number(year[1] || 0));
    if (expr === "month") return String(new Date().getUTCMonth() + 1);
    const ref = expr.match(/^(\d+)\.(.+)$/);
    if (ref) {
      const value = ref[2].split(".").reduce<any>((acc, key) => acc?.[key], results[Number(ref[1])]);
      return String(value);
    }
    throw new Error(`Gabarit inconnu : {{${expr}}}`);
  });
}

function fillDeep(value: unknown, results: unknown[]): unknown {
  if (typeof value === "string") {
    const whole = value.match(/^\{\{(\d+\.[^}]+)\}\}$/);
    if (whole) {
      // Valeur entière ({{0.id}}) : garder son type (nombre, booléen…)
      const [index, ...keys] = whole[1].split(".");
      return keys.reduce<any>((acc, key) => acc?.[key], results[Number(index)]);
    }
    return fill(value, results);
  }
  if (Array.isArray(value)) return value.map((item) => fillDeep(item, results));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, fillDeep(item, results)]));
  }
  return value;
}

// ---------- Serveurs ----------

interface Target {
  name: string;
  baseUrl: string;
  dbName: string;
  processes: ChildProcess[];
}

function dbUrl(name: string) {
  return `${PG_ADMIN_URL}/${name}`;
}

function psql(database: string, sql: string) {
  execFileSync("psql", ["-q", "-v", "ON_ERROR_STOP=1", dbUrl(database), "-c", sql], { stdio: ["ignore", "ignore", "inherit"] });
}

function startProcess(label: string, command: string, commandArgs: string[], env: Record<string, string>): ChildProcess {
  const log = fs.openSync(path.join(WORK_DIR, `${label}.log`), "a");
  const child = spawn(command, commandArgs, { cwd: NODE_DIR, env: { ...process.env, ...env }, stdio: ["ignore", log, log] });
  child.on("exit", (code) => {
    if (code !== null && code !== 0) console.error(`  ${label} s'est arrêté (code ${code}), voir ${WORK_DIR}/${label}.log`);
  });
  return child;
}

async function waitHealthy(url: string, label: string) {
  for (let i = 0; i < 120; i++) {
    try {
      const res = await fetch(`${url}/api/health`);
      if (res.ok) return;
    } catch { /* pas encore prêt */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`${label} ne répond pas, voir ${WORK_DIR}/${label}.log`);
}

// Dossier de sauvegardes propre à chaque serveur, avec les fichiers des données du banc
function backupDir(port: number): string {
  const dir = path.join(WORK_DIR, `sauvegardes-${port}`);
  fs.mkdirSync(dir, { recursive: true });
  if (fs.existsSync(SEED_BACKUPS_DIR)) fs.cpSync(SEED_BACKUPS_DIR, dir, { recursive: true });
  return dir;
}

function nodeEnv(port: number, database: string): Record<string, string> {
  return { ...BENCH_ENV, NODE_ENV: "production", PORT: String(port), DATABASE_URL: dbUrl(database), BACKUP_DIR: backupDir(port) };
}

async function startTarget(name: string, kind: "node" | "rust", port: number): Promise<Target> {
  const dbName = `${DB_PREFIX}_${name}`;
  psql("postgres", `DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
  psql("postgres", `CREATE DATABASE ${dbName} TEMPLATE ${TEMPLATE_DB}`);
  const processes: ChildProcess[] = [];
  if (kind === "node") {
    processes.push(startProcess(`${name}-node`, "node", ["dist/index.js"], nodeEnv(port, dbName)));
  } else {
    processes.push(startProcess(`${name}-rust`, RUST_BIN, [], {
      ...BENCH_ENV,
      PORT: String(port),
      DATABASE_URL: dbUrl(dbName),
      STATIC_DIR: path.join(NODE_DIR, "dist/public"),
      BACKUP_DIR: backupDir(port),
      RUST_LOG: "warn",
    }));
  }
  const target = { name, baseUrl: `http://127.0.0.1:${port}`, dbName, processes };
  await waitHealthy(target.baseUrl, name);
  return target;
}

function stopTarget(target: Target) {
  for (const child of target.processes) child.kill("SIGTERM");
}

// Remise à zéro de la base d'une cible : vider toutes les tables, recharger les données du modèle
let seedDump: string | null = null;
function resetDatabase(database: string) {
  if (!seedDump) {
    seedDump = path.join(WORK_DIR, "donnees.sql");
    execFileSync("pg_dump", ["--data-only", "--disable-triggers", "-f", seedDump, dbUrl(TEMPLATE_DB)]);
  }
  const tables = execFileSync("psql", ["-At", dbUrl(database), "-c",
    "SELECT string_agg(format('%I', tablename), ', ') FROM pg_tables WHERE schemaname = 'public'"]).toString().trim();
  psql(database, `TRUNCATE ${tables} RESTART IDENTITY CASCADE`);
  execFileSync("psql", ["-q", "-v", "ON_ERROR_STOP=1", "-f", seedDump, dbUrl(database)], { stdio: ["ignore", "ignore", "inherit"] });
}

// ---------- Requêtes ----------

interface Recorded {
  status: number;
  headers: Record<string, string>;
  body: unknown;
}

const KEPT_HEADERS = ["content-type", "cache-control", "location", "content-disposition"];

function describeCookie(header: string): string {
  // Nom et attributs du cookie, sans sa valeur (propre à chaque session)
  const [pair, ...attributes] = header.split(";").map((part) => part.trim());
  const name = pair.split("=")[0];
  const kept = attributes.filter((a) => !/^expires=/i.test(a)).map((a) => a.toLowerCase()).sort();
  return [name, ...kept].join("; ");
}

async function login(baseUrl: string, account: AccountKey): Promise<Record<string, string>> {
  if (account === "anonyme") return {};
  if (account === "api") return { "x-api-key": BENCH_API_KEY };
  const known = BENCH_ACCOUNTS.find((a) => a.key === account)!;
  const res = await fetch(`${baseUrl}/api/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: known.username, password: known.password }),
  });
  if (!res.ok) throw new Error(`Connexion impossible pour ${account} sur ${baseUrl} : ${res.status}`);
  const cookie = res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  return { cookie };
}

function buildBody(step: Step, results: unknown[]): { body?: BodyInit; contentType?: string } {
  if (step.body === undefined && !step.files) return {};
  const data = fillDeep(step.body ?? {}, results) as Record<string, unknown>;
  if (step.bodyType === "form") {
    return { body: new URLSearchParams(data as Record<string, string>).toString(), contentType: "application/x-www-form-urlencoded" };
  }
  if (step.bodyType === "multipart") {
    const form = new FormData();
    for (const [key, value] of Object.entries(data)) form.append(key, String(value));
    for (const file of step.files ?? []) {
      const content = Buffer.alloc(file.size, 0x25); // contenu fixe : « %%%% »
      form.append(file.field, new Blob([content], { type: file.contentType }), file.filename);
    }
    return { body: form };
  }
  return { body: JSON.stringify(data), contentType: "application/json" };
}

async function send(baseUrl: string, step: Step, auth: Record<string, string>, results: unknown[]): Promise<Recorded> {
  const { body, contentType } = buildBody(step, results);
  const headers: Record<string, string> = { ...auth, ...(step.headers ?? {}) };
  if (contentType) headers["content-type"] = contentType;
  const res = await fetch(`${baseUrl}${fill(step.path, results)}`, { method: step.method, headers, body, redirect: "manual" });
  const kept: Record<string, string> = {};
  for (const name of KEPT_HEADERS) {
    const value = res.headers.get(name);
    if (value !== null) kept[name] = value.replace(/;\s*/g, "; ").toLowerCase();
  }
  const cookies = res.headers.getSetCookie();
  if (cookies.length) kept["set-cookie"] = cookies.map(describeCookie).join(" | ");
  const text = await res.text();
  let parsed: unknown = text;
  if ((res.headers.get("content-type") || "").includes("json")) {
    try { parsed = JSON.parse(text); } catch { /* texte brut */ }
  } else if (text.length > 2000) {
    // Gros contenu non JSON (HTML, fichiers) : taille et début suffisent
    parsed = { taille: Buffer.byteLength(text), debut: text.slice(0, 200) };
  }
  return { status: res.status, headers: kept, body: parsed };
}

async function stubCalls(reset = false): Promise<unknown[]> {
  const res = await fetch(`${STUB_URL}/__calls`, { method: reset ? "DELETE" : "GET" });
  return res.json() as Promise<unknown[]>;
}

async function snapshotTables(database: string, tables: string[]) {
  const client = new pg.Client({ connectionString: dbUrl(database) });
  await client.connect();
  const out: Record<string, unknown[]> = {};
  for (const table of tables) {
    const { rows } = await client.query(`SELECT * FROM ${table} ORDER BY 1, 2`);
    out[table] = rows;
  }
  await client.end();
  return out;
}

// ---------- Normalisation ----------

const ISO_DATETIME = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/g;

// drop : champs d'un écart voulu, retirés des deux côtés
function normalize(value: unknown, window: [number, number], ignore: string[] = [], drop: string[] = []): unknown {
  if (value instanceof Date) return normalize(value.toISOString(), window, ignore, drop);
  if (typeof value === "string") {
    return value.replace(ISO_DATETIME, (match) => {
      const time = Date.parse(match);
      return time >= window[0] && time <= window[1] ? "<maintenant>" : match;
    });
  }
  if (Array.isArray(value)) return value.map((item) => normalize(item, window, ignore, drop));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).filter(([key]) => !drop.includes(key)).map(([key, item]) =>
      [key, ignore.includes(key) ? "<ignoré>" : normalize(item, window, ignore, drop)]));
  }
  return value;
}

// ---------- Passage ----------

interface Entry {
  key: string; // module | cas | compte
  module: string;
  data: unknown;
}

async function runTarget(target: Target): Promise<Entry[]> {
  const entries: Entry[] = [];
  const startedAt = Date.now() - 60_000;
  const reads = READS.filter((c) => !only || only.includes(c.module));
  const writes = WRITES.filter((c) => !only || only.includes(c.module));

  // Lectures : une base fraîche, une connexion par compte
  resetDatabase(target.dbName);
  const sessions = new Map<AccountKey, Record<string, string>>();
  for (const account of [...LOGGED_ACCOUNTS, "anonyme", "api"] as AccountKey[]) {
    sessions.set(account, await login(target.baseUrl, account));
  }
  for (const readCase of reads) {
    for (const account of readCase.accounts ?? ALL_ACCOUNTS) {
      await stubCalls(true);
      const recorded = await send(target.baseUrl, { method: "GET", path: readCase.path }, sessions.get(account)!, []);
      const calls = await stubCalls();
      entries.push({
        key: `${readCase.module} | GET ${readCase.path} | ${account}`,
        module: readCase.module,
        data: { reponse: recorded, appels: calls, ignore: readCase.ignore, deviation: readCase.deviation },
      });
    }
  }

  // Écritures : base remise à zéro pour chaque compte
  for (const scenario of writes) {
    for (const account of scenario.accounts ?? LOGGED_ACCOUNTS) {
      resetDatabase(target.dbName);
      await stubCalls(true);
      const auth = await login(target.baseUrl, account);
      const results: unknown[] = [];
      const responses: Recorded[] = [];
      for (const step of scenario.steps) {
        const recorded = await send(target.baseUrl, step, auth, results);
        responses.push(recorded);
        results.push(recorded.body);
      }
      entries.push({
        key: `${scenario.module} | ${scenario.name} | ${account}`,
        module: scenario.module,
        data: {
          reponses: responses,
          tables: await snapshotTables(target.dbName, scenario.tables),
          appels: await stubCalls(),
          ignore: scenario.ignore,
          deviation: scenario.deviation,
        },
      });
    }
  }

  const endedAt = Date.now() + 60_000;
  return entries.map((entry) => {
    const { ignore, deviation, ...data } = entry.data as { ignore?: string[]; deviation?: Deviation };
    return { ...entry, data: normalize(data, [startedAt, endedAt], ignore, deviation?.fields) };
  });
}

// ---------- Comparaison ----------

function differences(a: unknown, b: unknown, where = ""): string[] {
  if (JSON.stringify(a) === JSON.stringify(b)) return [];
  if (Array.isArray(a) && Array.isArray(b)) {
    const out: string[] = [];
    if (a.length !== b.length) out.push(`${where} : ${a.length} éléments contre ${b.length}`);
    for (let i = 0; i < Math.min(a.length, b.length); i++) out.push(...differences(a[i], b[i], `${where}[${i}]`));
    return out;
  }
  if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) {
    const out: string[] = [];
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) {
      if (!(key in (a as object))) out.push(`${where}.${key} : absent à gauche, ${JSON.stringify((b as any)[key])?.slice(0, 120)} à droite`);
      else if (!(key in (b as object))) out.push(`${where}.${key} : ${JSON.stringify((a as any)[key])?.slice(0, 120)} à gauche, absent à droite`);
      else out.push(...differences((a as any)[key], (b as any)[key], `${where}.${key}`));
    }
    return out;
  }
  return [`${where} : ${JSON.stringify(a)?.slice(0, 160)} contre ${JSON.stringify(b)?.slice(0, 160)}`];
}

async function main() {
  console.log(`Banc : ${mode === "node" ? "Node contre Node" : "Node de référence contre Rust"}${only ? ` (modules : ${only.join(", ")})` : ""}`);
  console.log(`Journaux : ${WORK_DIR}`);
  const stopStub = await startStub();
  const targets: Target[] = [];
  try {
    const left = await startTarget("gauche", "node", LEFT_PORT);
    targets.push(left);
    const right = await startTarget("droite", mode === "node" ? "node" : "rust", RIGHT_PORT);
    targets.push(right);

    const leftEntries = await runTarget(left);
    const rightEntries = await runTarget(right);

    const report: { key: string; differences: string[] }[] = [];
    const byModule = new Map<string, { total: number; ko: number }>();
    for (const entry of leftEntries) {
      const other = rightEntries.find((e) => e.key === entry.key);
      const diffs = differences(entry.data, other?.data);
      const stats = byModule.get(entry.module) ?? { total: 0, ko: 0 };
      stats.total++;
      if (diffs.length) { stats.ko++; report.push({ key: entry.key, differences: diffs }); }
      byModule.set(entry.module, stats);
    }

    fs.writeFileSync(path.join(WORK_DIR, "gauche.json"), JSON.stringify(leftEntries, null, 2));
    fs.writeFileSync(path.join(WORK_DIR, "droite.json"), JSON.stringify(rightEntries, null, 2));
    fs.writeFileSync(path.join(WORK_DIR, "ecarts.json"), JSON.stringify(report, null, 2));

    for (const item of report.slice(0, 40)) {
      console.log(`\n✗ ${item.key}`);
      for (const line of item.differences.slice(0, 8)) console.log(`    ${line}`);
      if (item.differences.length > 8) console.log(`    … ${item.differences.length - 8} autre(s)`);
    }
    if (report.length > 40) console.log(`\n… ${report.length - 40} autre(s) cas en écart, voir ${WORK_DIR}/ecarts.json`);

    console.log("\nModule                 cas  écarts");
    for (const [module, stats] of [...byModule].sort()) {
      console.log(`${module.padEnd(22)} ${String(stats.total).padStart(4)}  ${stats.ko}`);
    }
    const deviations = new Set(
      [...READS, ...WRITES]
        .filter((c) => c.deviation && (!only || only.includes(c.module)))
        .map((c) => `${c.module} : ${c.deviation!.fields.join(", ")} — ${c.deviation!.reason}`),
    );
    if (deviations.size) {
      console.log("\nÉcarts voulus (champs retirés de la comparaison) :");
      for (const line of deviations) console.log(`  ${line}`);
    }
    const total = leftEntries.length;
    console.log(`\n${total} cas comparés, ${report.length} en écart.`);
    process.exitCode = report.length ? 1 : 0;
  } finally {
    targets.forEach(stopTarget);
    await stopStub();
    if (!keep) {
      for (const target of targets) {
        try { psql("postgres", `DROP DATABASE IF EXISTS ${target.dbName} WITH (FORCE)`); } catch { /* déjà supprimée */ }
      }
    }
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
