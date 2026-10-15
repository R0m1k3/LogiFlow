// Compare les colonnes déclarées dans shared/schema.ts à celles d'une base réelle.
// Usage : DATABASE_URL=postgres://… npx tsx scripts/bench/schema-check.ts
import pg from "pg";
import * as schema from "../../shared/schema";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";

async function main() {
  const declared = new Map<string, Map<string, string>>();
  for (const value of Object.values(schema)) {
    if (!(value instanceof PgTable)) continue;
    const config = getTableConfig(value);
    declared.set(config.name, new Map(config.columns.map((c) => [c.name, `${c.getSQLType()}${c.notNull ? " not null" : ""}`])));
  }

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const { rows } = await client.query(
    `SELECT table_name, column_name, data_type, is_nullable
       FROM information_schema.columns WHERE table_schema = 'public'`,
  );
  await client.end();

  const actual = new Map<string, Map<string, string>>();
  for (const row of rows) {
    if (!actual.has(row.table_name)) actual.set(row.table_name, new Map());
    actual.get(row.table_name)!.set(row.column_name, `${row.data_type}${row.is_nullable === "NO" ? " not null" : ""}`);
  }

  let problems = 0;
  for (const [table, columns] of declared) {
    const real = actual.get(table);
    if (!real) { console.log(`table absente : ${table}`); problems++; continue; }
    for (const [column, type] of columns) {
      if (!real.has(column)) { console.log(`colonne absente : ${table}.${column} (${type})`); problems++; }
    }
    for (const [column, type] of real) {
      if (!columns.has(column)) console.log(`colonne en plus dans la base : ${table}.${column} (${type})`);
    }
  }
  for (const table of actual.keys()) {
    if (!declared.has(table)) console.log(`table en plus dans la base : ${table}`);
  }
  console.log(problems === 0 ? "Schéma conforme à shared/schema.ts" : `${problems} écart(s) bloquant(s)`);
  process.exit(problems === 0 ? 0 : 1);
}

main().catch((error) => { console.error(error); process.exit(1); });
