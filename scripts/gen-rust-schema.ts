// Génère server-rs/src/schema.rs à partir de shared/schema.ts :
// - une structure par table, avec les mêmes clés JSON, dans le même ordre et
//   aux mêmes formats que ce que Drizzle renvoie à l'interface ;
// - le schéma de validation que drizzle-zod (createInsertSchema) en tire.
// Les colonnes nulles dans la base réelle le sont aussi en Rust (DATABASE_URL).
//
// Usage : DATABASE_URL=postgres://… npx tsx scripts/gen-rust-schema.ts
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import { getTableColumns } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import * as schema from "../shared/schema";

const OUTPUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../server-rs/src/schema.rs");

const RUST_KEYWORDS = new Set(["type", "match", "ref", "move", "use", "loop", "where", "self", "struct", "enum"]);

function pascal(name: string): string {
  return name.split("_").map((part) => part[0].toUpperCase() + part.slice(1)).join("");
}

interface ColumnInfo {
  jsKey: string;
  name: string;
  columnType: string;
  notNull: boolean;
  hasDefault: boolean;
  length?: number;
  scale?: number;
}

// Type SQL vers lequel le texte d'un paramètre est converti (comme node-pg, qui
// envoie tous les paramètres en texte)
function sqlType(column: ColumnInfo): string {
  switch (column.columnType) {
    case "PgSerial":
    case "PgInteger":
      return "int4";
    case "PgBigInt53":
      return "int8";
    case "PgVarchar":
    case "PgText":
      return "text";
    case "PgBoolean":
      return "bool";
    case "PgTimestamp":
      return "timestamp";
    case "PgDateString":
      return "date";
    case "PgNumeric":
      return "numeric";
    case "PgJsonb":
      return "jsonb";
    default:
      throw new Error(`Type de colonne non géré : ${column.columnType} (${column.name})`);
  }
}

function rustType(column: ColumnInfo): string {
  switch (column.columnType) {
    case "PgSerial":
    case "PgInteger":
      return "i32";
    case "PgBigInt53":
      return "i64";
    case "PgVarchar":
    case "PgText":
      return "String";
    case "PgBoolean":
      return "bool";
    case "PgTimestamp":
      return "NaiveDateTime";
    case "PgDateString":
      return "NaiveDate";
    case "PgNumeric":
      return "Decimal";
    case "PgJsonb":
      return "serde_json::Value";
    default:
      throw new Error(`Type de colonne non géré : ${column.columnType} (${column.name})`);
  }
}

// Même correspondance que drizzle-zod 0.7 (columnToSchema)
function zodField(column: ColumnInfo): string {
  let field: string;
  switch (column.columnType) {
    case "PgSerial":
    case "PgInteger":
      field = `Field::int32("${column.jsKey}")`;
      break;
    case "PgBigInt53":
      field = `Field::safe_integer("${column.jsKey}")`;
      break;
    case "PgVarchar":
      field = column.length ? `Field::string("${column.jsKey}").max_len(${column.length})` : `Field::string("${column.jsKey}")`;
      break;
    case "PgText":
    case "PgDateString":
    case "PgNumeric":
      field = `Field::string("${column.jsKey}")`;
      break;
    case "PgBoolean":
      field = `Field::boolean("${column.jsKey}")`;
      break;
    case "PgTimestamp":
      field = `Field::date("${column.jsKey}")`;
      break;
    case "PgJsonb":
      field = `Field::json("${column.jsKey}")`;
      break;
    default:
      throw new Error(`Type de colonne non géré : ${column.columnType}`);
  }
  if (!column.notNull) field += ".nullable()";
  if (!column.notNull || column.hasDefault) field += ".optional()";
  return field;
}

async function main() {
  const nullableInDb = new Set<string>();
  if (process.env.DATABASE_URL) {
    const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    const { rows } = await client.query(
      `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' AND is_nullable = 'YES'`,
    );
    for (const row of rows) nullableInDb.add(`${row.table_name}.${row.column_name}`);
    await client.end();
  } else {
    console.warn("DATABASE_URL absent : nullabilité tirée de shared/schema.ts seulement");
  }

  const tables = new Map<string, ColumnInfo[]>();
  for (const value of Object.values(schema)) {
    if (!(value instanceof PgTable)) continue;
    const config = getTableConfig(value);
    if (tables.has(config.name)) continue;
    const columns = Object.entries(getTableColumns(value)).map(([jsKey, column]: [string, any]) => ({
      jsKey,
      name: column.name,
      columnType: column.columnType,
      notNull: column.notNull,
      hasDefault: column.hasDefault,
      length: column.length,
      scale: column.scale,
    }));
    tables.set(config.name, columns);
  }

  const out: string[] = [];
  out.push("// Généré par scripts/gen-rust-schema.ts à partir de shared/schema.ts : ne pas modifier à la main.");
  out.push("// Une structure par table (clés, ordre et formats JSON de Drizzle) et son schéma");
  out.push("// d'insertion drizzle-zod (createInsertSchema).");
  out.push("#![allow(dead_code)]");
  out.push("");
  out.push("use chrono::{NaiveDate, NaiveDateTime};");
  out.push("use rust_decimal::Decimal;");
  out.push("use serde::Serialize;");
  out.push("use sqlx::FromRow;");
  out.push("");
  out.push("use crate::db::{Col, Table};");
  out.push("use crate::zod::{Field, Object};");
  out.push("");

  for (const [table, columns] of [...tables].sort(([a], [b]) => a.localeCompare(b))) {
    const name = `${pascal(table)}Row`;
    out.push(`/// Table ${table}`);
    out.push("#[derive(Debug, Clone, Serialize, FromRow)]");
    out.push(`pub struct ${name} {`);
    for (const column of columns) {
      const nullable = !column.notNull || nullableInDb.has(`${table}.${column.name}`);
      const base = rustType(column);
      const type = nullable ? `Option<${base}>` : base;
      const attributes: string[] = [];
      const field = RUST_KEYWORDS.has(column.name) ? `${column.name}_` : column.name;
      if (field !== column.name) attributes.push(`#[sqlx(rename = "${column.name}")]`);
      const serde = [`rename = "${column.jsKey}"`];
      if (base === "NaiveDateTime") serde.push(`serialize_with = "${nullable ? "crate::json::ts_opt" : "crate::json::ts"}"`);
      if (base === "Decimal") {
        // Échelle de la colonne : PostgreSQL rend "0.00", sqlx lit 0
        if (typeof column.scale !== "number") throw new Error(`Échelle inconnue : ${table}.${column.name}`);
        serde.push(`serialize_with = "${nullable ? "crate::json::numeric_opt" : "crate::json::numeric"}::<${column.scale}, _>"`);
      }
      attributes.push(`#[serde(${serde.join(", ")})]`);
      for (const attribute of attributes) out.push(`    ${attribute}`);
      out.push(`    pub ${field}: ${type},`);
    }
    out.push("}");
    out.push("");
    out.push(`impl Table for ${name} {`);
    out.push(`    const TABLE: &'static str = "${table}";`);
    out.push(`    const COLUMNS: &'static str = "${columns.map((c) => `\\"${c.name}\\"`).join(", ")}";`);
    out.push("    const FIELDS: &'static [Col] = &[");
    for (const column of columns) {
      out.push(`        Col { key: "${column.jsKey}", column: "${column.name}", sql_type: "${sqlType(column)}" },`);
    }
    out.push("    ];");
    out.push("}");
    out.push("");
    out.push(`impl ${name} {`);
    out.push(`    /// createInsertSchema(${table})`);
    out.push("    pub fn insert_schema() -> Object {");
    out.push("        Object::new(vec![");
    for (const column of columns) out.push(`            ${zodField(column)},`);
    out.push("        ])");
    out.push("    }");
    out.push("}");
    out.push("");
  }

  fs.writeFileSync(OUTPUT, out.join("\n"));
  // Même mise en forme que cargo fmt (server-rs/rustfmt.toml)
  execFileSync("rustfmt", ["--edition", "2024", "--config-path", path.dirname(path.dirname(OUTPUT)), OUTPUT]);
  console.log(`${tables.size} tables écrites dans ${path.relative(process.cwd(), OUTPUT)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
