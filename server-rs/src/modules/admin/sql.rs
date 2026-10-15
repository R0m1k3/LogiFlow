// POST /api/admin/execute-sql (server/routes.ts) : SQL saisi par l'administrateur
// dans la page SQL de l'interface (SQLExecutor.tsx), exécuté tel quel, comme
// db.execute(sql.raw(…)) de Drizzle sur node-pg : protocole simple (plusieurs
// instructions possibles, résultats en texte), lignes converties par les
// analyseurs de node-pg (pg-types), sauf dates, horodatages et intervalles que
// Drizzle laisse en texte.
//
// Faille connue, reprise telle quelle (audit SQL-01) : aucune confirmation ni
// restriction des instructions, l'administrateur exécute ce qu'il veut.
//
// Approximations :
// - rowCount : node-pg lit le nombre de l'étiquette de fin de commande
//   (« UPDATE 3 »), null quand elle n'en porte pas (« CREATE TABLE ») ; sqlx ne
//   rend que ce nombre (0 sans nombre), la commande est donc reconnue à son
//   premier mot quand il vaut 0 ;
// - tableaux d'intervalles : laissés en texte (objets PostgresInterval dans Node).

use axum::Json;
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use chrono::{NaiveDate, TimeZone, Utc};
use futures_util::TryStreamExt;
use serde_json::{Map, Value, json};
use sqlx::postgres::PgRow;
use sqlx::{Column, Either, Row, ValueRef};

use crate::AppState;
use crate::auth::CurrentUser;
use crate::error::{ApiResult, AppError};
use crate::js;
use crate::request::JsonBody;

fn error_body(status: StatusCode, body: Value) -> AppError {
    AppError::with_body(status, body)
}

// ---------- Exécution ----------

/// Ce que node-pg rend : un résultat par instruction terminée (tableau de
/// résultats au-delà d'une), les lignes de l'unique instruction
struct Outcome {
    /// rows_affected de chaque fin de commande, dans l'ordre
    completions: Vec<u64>,
    rows: Vec<Map<String, Value>>,
}

async fn run(db: &sqlx::PgPool, sql: &str) -> Result<Outcome, sqlx::Error> {
    let mut stream = sqlx::raw_sql(sql).fetch_many(db);
    let mut outcome = Outcome {
        completions: Vec::new(),
        rows: Vec::new(),
    };
    while let Some(item) = stream.try_next().await? {
        match item {
            Either::Left(done) => outcome.completions.push(done.rows_affected()),
            Either::Right(row) => outcome.rows.push(row_json(&row)),
        }
    }
    Ok(outcome)
}

/// Ligne en objet : une colonne de même nom remplace la précédente, à sa place
fn row_json(row: &PgRow) -> Map<String, Value> {
    let mut out = Map::new();
    for column in row.columns() {
        let value = match row.try_get_raw(column.ordinal()) {
            Ok(raw) if !raw.is_null() => {
                let oid = raw.type_info().oid().map_or(0, |oid| oid.0);
                match raw.as_str() {
                    Ok(text) => node_pg_value(oid, text),
                    Err(_) => Value::Null,
                }
            }
            _ => Value::Null,
        };
        out.insert(column.name().to_string(), value);
    }
    out
}

/// Premier mot d'une instruction, commentaires et parenthèses ouvrantes passés
fn first_keyword(sql: &str) -> String {
    let mut rest = sql;
    loop {
        rest = rest.trim_start_matches(|c: char| c.is_whitespace() || c == '(');
        if let Some(after) = rest.strip_prefix("--") {
            rest = after.split_once('\n').map_or("", |(_, next)| next);
        } else if let Some(after) = rest.strip_prefix("/*") {
            rest = after.split_once("*/").map_or("", |(_, next)| next);
        } else {
            break;
        }
    }
    rest.chars()
        .take_while(|c| c.is_ascii_alphabetic())
        .collect::<String>()
        .to_ascii_uppercase()
}

/// L'étiquette de fin de commande porte-t-elle un nombre ? (« SELECT n »,
/// « INSERT 0 n », … ; CREATE TABLE … AS et CREATE MATERIALIZED VIEW rendent
/// « SELECT n »)
fn tag_has_count(sql: &str) -> bool {
    const COUNTED: &[&str] = &[
        "SELECT", "INSERT", "UPDATE", "DELETE", "MERGE", "MOVE", "FETCH", "COPY", "VALUES", "TABLE", "WITH",
    ];
    let keyword = first_keyword(sql);
    if COUNTED.contains(&keyword.as_str()) {
        return true;
    }
    if keyword != "CREATE" {
        return false;
    }
    let words: Vec<String> = sql
        .split(|c: char| c.is_whitespace() || c == '(' || c == ')')
        .filter(|word| !word.is_empty())
        .map(str::to_ascii_uppercase)
        .collect();
    let Some(as_index) = words.iter().position(|word| word == "AS") else {
        return false;
    };
    let before = &words[..as_index];
    let creates_table = before
        .iter()
        .any(|word| word == "TABLE" || word == "MATERIALIZED");
    let query_follows = words
        .get(as_index + 1)
        .is_some_and(|word| ["SELECT", "VALUES", "TABLE", "WITH", "EXECUTE"].contains(&word.as_str()));
    creates_table && query_follows
}

/// rowCount d'une instruction seule : null si l'étiquette n'a pas de nombre
fn row_count(sql: &str, rows_affected: u64) -> Value {
    if rows_affected > 0 || tag_has_count(sql) {
        json!(rows_affected)
    } else {
        Value::Null
    }
}

pub async fn execute_sql(
    State(state): State<AppState>,
    user: CurrentUser,
    JsonBody(body): JsonBody,
) -> ApiResult {
    if !user.is_admin() {
        return Err(error_body(
            StatusCode::FORBIDDEN,
            json!({ "error": "Accès refusé - Admin uniquement" }),
        ));
    }
    let Some(sql) = body
        .get("sql")
        .and_then(Value::as_str)
        .filter(|sql| !sql.is_empty())
    else {
        return Err(error_body(
            StatusCode::BAD_REQUEST,
            json!({ "error": "SQL query requis" }),
        ));
    };
    tracing::info!(user = user.id(), "exécution SQL de l'administrateur");
    let mut logs = vec!["🔄 Exécution SQL démarrée...".to_string()];

    let outcome = match run(&state.db, sql).await {
        Ok(outcome) => outcome,
        Err(error) => {
            let message = crate::services::nocodb::database_message(&error);
            logs.push(format!("❌ Erreur SQL: {message}"));
            return Err(error_body(
                StatusCode::INTERNAL_SERVER_ERROR,
                json!({ "error": format!("Erreur SQL: {message}"), "logs": logs }),
            ));
        }
    };

    logs.push("✅ SQL exécuté avec succès".to_string());
    // Plusieurs instructions : node-pg rend un tableau de résultats, sans rows ni rowCount
    if outcome.completions.len() > 1 {
        logs.push("📊 Nombre de lignes affectées: 0".to_string());
        return Ok(Json(json!({ "success": true, "logs": logs })).into_response());
    }
    // Requête vide (blancs seuls) : aucun nombre
    let count = outcome
        .completions
        .first()
        .map_or(Value::Null, |rows_affected| row_count(sql, *rows_affected));
    logs.push(format!(
        "📊 Nombre de lignes affectées: {}",
        count.as_u64().unwrap_or(0)
    ));
    let rows: Vec<Value> = outcome.rows.into_iter().map(Value::Object).collect();
    if !rows.is_empty() {
        logs.push(format!("📋 Nombre de lignes retournées: {}", rows.len()));
        // JSON.stringify(lignes, null, 2)
        if rows.len() <= 10 {
            logs.push(format!(
                "📋 Résultats: {}",
                serde_json::to_string_pretty(&rows).unwrap_or_default()
            ));
        } else {
            logs.push(format!(
                "📋 Échantillon (10 premières lignes): {}",
                serde_json::to_string_pretty(&rows[..10]).unwrap_or_default()
            ));
        }
    }
    Ok(Json(json!({ "success": true, "logs": logs, "results": rows, "rowCount": count })).into_response())
}

// ---------- Valeurs, au comportement de node-pg (pg-types) ----------

/// Valeur texte d'une colonne selon son type (OID PostgreSQL)
fn node_pg_value(oid: u32, text: &str) -> Value {
    match oid {
        16 => json!(parse_bool(text)),
        17 => buffer_json(&parse_bytea(text)),
        // int2, int4, oid : parseInt
        21 | 23 | 26 => int_value(text),
        // float4, float8 : parseFloat
        700 | 701 => js::number_value(js::parse_float(text)),
        // json, jsonb
        114 | 3802 => serde_json::from_str(text).unwrap_or(Value::Null),
        600 => parse_point(text),
        718 => parse_circle(text),
        // Tableaux
        1000 => parse_array(text, &|entry| json!(parse_bool(entry))),
        1001 => parse_array(text, &|entry| buffer_json(&parse_bytea(entry))),
        1005 | 1007 | 1028 => parse_array(text, &int_value),
        1016 => parse_array(text, &|entry| json!(js::trim(entry))),
        1017 => parse_array(text, &parse_point),
        1021 | 1022 | 1231 => parse_array(text, &|entry| js::number_value(js::parse_float(entry))),
        651 | 791 | 1008 | 1009 | 1014 | 1015 | 1040 | 1041 | 1183 | 1270 | 2951 | 3907 => {
            parse_array(text, &|entry| json!(entry))
        }
        1115 | 1182 | 1185 => parse_array(text, &parse_date),
        199 | 3807 => parse_array(text, &|entry| serde_json::from_str(entry).unwrap_or(Value::Null)),
        // int8, numeric, texte, dates, horodatages, intervalles… : le texte tel quel
        _ => json!(text),
    }
}

/// parseInt(texte, 10), NaN écrit null
fn int_value(text: &str) -> Value {
    js::number_value(js::parse_int(text).unwrap_or(f64::NAN))
}

fn parse_bool(text: &str) -> bool {
    matches!(text, "TRUE" | "t" | "true" | "y" | "yes" | "on" | "1")
}

/// postgres-bytea : format hexadécimal (\x…) ou échappé (\ooo, \\)
fn parse_bytea(text: &str) -> Vec<u8> {
    if let Some(hex) = text.strip_prefix("\\x") {
        return js_hex(hex);
    }
    let chars: Vec<char> = text.chars().collect();
    let mut out = Vec::new();
    let mut i = 0;
    while i < chars.len() {
        if chars[i] != '\\' {
            out.push(chars[i] as u32 as u8);
            i += 1;
            continue;
        }
        let octal: String = chars[i + 1..].iter().take(3).collect();
        if octal.len() == 3 && octal.chars().all(|c| ('0'..='7').contains(&c)) {
            out.push(u8::from_str_radix(&octal, 8).unwrap_or_default());
            i += 4;
        } else {
            let mut backslashes = 1;
            while i + backslashes < chars.len() && chars[i + backslashes] == '\\' {
                backslashes += 1;
            }
            out.extend(std::iter::repeat_n(b'\\', backslashes / 2));
            i += (backslashes / 2) * 2;
            if backslashes == 1 {
                // Barre isolée : JavaScript n'avance pas (boucle infinie évitée ici)
                i += 1;
            }
        }
    }
    out
}

/// Buffer.from(texte, 'hex') : paires lues jusqu'au premier caractère invalide
fn js_hex(text: &str) -> Vec<u8> {
    let digit = |c: u8| (c as char).to_digit(16).map(|d| d as u8);
    let mut out = Vec::with_capacity(text.len() / 2);
    for pair in text.as_bytes().chunks_exact(2) {
        match (digit(pair[0]), digit(pair[1])) {
            (Some(high), Some(low)) => out.push((high << 4) | low),
            _ => break,
        }
    }
    out
}

/// JSON d'un Buffer : { type: "Buffer", data: [octets] }
fn buffer_json(bytes: &[u8]) -> Value {
    json!({ "type": "Buffer", "data": bytes })
}

/// parsePoint : « (x,y) » → { x, y }
fn parse_point(text: &str) -> Value {
    if !text.starts_with('(') {
        return Value::Null;
    }
    let inner = text.get(1..text.len().saturating_sub(1)).unwrap_or_default();
    let mut values = inner.split(',');
    let x = js::parse_float(values.next().unwrap_or_default());
    let y = values.next().map_or(f64::NAN, js::parse_float);
    json!({ "x": js::number_value(x), "y": js::number_value(y) })
}

/// parseCircle : « <(x,y),r> » → { x, y, radius }
fn parse_circle(text: &str) -> Value {
    let chars: Vec<char> = text.chars().collect();
    if chars.first() != Some(&'<') && chars.get(1) != Some(&'(') {
        return Value::Null;
    }
    let mut point = String::from("(");
    let mut radius = String::new();
    let mut point_parsed = false;
    for &c in chars.iter().take(chars.len().saturating_sub(1)).skip(2) {
        if !point_parsed {
            point.push(c);
        }
        if c == ')' {
            point_parsed = true;
            continue;
        } else if !point_parsed || c == ',' {
            continue;
        }
        radius.push(c);
    }
    let mut result = parse_point(&point);
    if let Some(object) = result.as_object_mut() {
        object.insert("radius".into(), js::number_value(js::parse_float(&radius)));
    }
    result
}

/// postgres-date : Date JavaScript (heure locale du serveur Node : UTC), écrite en
/// ISO ; infinity et date illisible écrites null
fn parse_date(text: &str) -> Value {
    let (date_part, rest) = text.split_once(' ').unwrap_or((text, ""));
    let mut fields = date_part.splitn(3, '-');
    let (Some(year), Some(month), Some(day)) = (fields.next(), fields.next(), fields.next()) else {
        return Value::Null;
    };
    let (Ok(year), Ok(month), Ok(day)) = (year.parse::<i32>(), month.parse::<u32>(), day.parse::<u32>())
    else {
        return Value::Null;
    };
    let Some(date) = NaiveDate::from_ymd_opt(year, month, day) else {
        return Value::Null;
    };
    // Heure, fraction (tronquée à la milliseconde) et décalage éventuel
    let (time, offset) = match rest.find(['+', '-', 'Z']) {
        Some(index) => (&rest[..index], Some(&rest[index..])),
        None => (rest, None),
    };
    let mut millis = 0;
    let naive = if time.is_empty() {
        date.and_hms_opt(0, 0, 0)
    } else {
        let (clock, fraction) = time.split_once('.').unwrap_or((time, ""));
        let mut parts = clock.split(':').map(|part| part.parse::<u32>().ok());
        let (Some(Some(hour)), Some(Some(minute)), Some(Some(second))) =
            (parts.next(), parts.next(), parts.next())
        else {
            return Value::Null;
        };
        millis = format!("{fraction:0<3}")[..3].parse::<i64>().unwrap_or(0);
        date.and_hms_opt(hour, minute, second)
    };
    let Some(naive) = naive else {
        return Value::Null;
    };
    let mut instant = Utc.from_utc_datetime(&naive) + chrono::Duration::milliseconds(millis);
    if let Some(offset) = offset.filter(|offset| !offset.starts_with('Z')) {
        let sign = if offset.starts_with('-') { -1 } else { 1 };
        let mut units = offset[1..]
            .split(':')
            .map(|unit| unit.parse::<i64>().unwrap_or(0));
        let seconds =
            units.next().unwrap_or(0) * 3600 + units.next().unwrap_or(0) * 60 + units.next().unwrap_or(0);
        instant -= chrono::Duration::seconds(sign * seconds);
    }
    json!(js::iso(&instant))
}

/// Tableau PostgreSQL ({a,"b c",NULL,{d}}) au comportement de postgres-array :
/// `transform` appliqué à chaque élément non NULL
fn parse_array(text: &str, transform: &dyn Fn(&str) -> Value) -> Value {
    let chars: Vec<char> = text.chars().collect();
    Value::Array(ArrayParser::new(&chars, transform).parse(false))
}

struct ArrayParser<'a> {
    source: &'a [char],
    transform: &'a dyn Fn(&str) -> Value,
    position: usize,
    entries: Vec<Value>,
    recorded: Vec<char>,
    dimension: i32,
}

impl<'a> ArrayParser<'a> {
    fn new(source: &'a [char], transform: &'a dyn Fn(&str) -> Value) -> Self {
        Self {
            source,
            transform,
            position: 0,
            entries: Vec::new(),
            recorded: Vec::new(),
            dimension: 0,
        }
    }

    fn next_character(&mut self) -> (Option<char>, bool) {
        let character = self.source.get(self.position).copied();
        self.position += 1;
        if character == Some('\\') {
            let escaped = self.source.get(self.position).copied();
            self.position += 1;
            return (escaped, true);
        }
        (character, false)
    }

    fn new_entry(&mut self, include_empty: bool) {
        if !self.recorded.is_empty() || include_empty {
            let entry: String = self.recorded.drain(..).collect();
            let value = if entry == "NULL" && !include_empty {
                Value::Null
            } else {
                (self.transform)(&entry)
            };
            self.entries.push(value);
        }
    }

    fn parse(mut self, nested: bool) -> Vec<Value> {
        self.parse_with_position(nested).0
    }

    fn parse_with_position(&mut self, nested: bool) -> (Vec<Value>, usize) {
        let mut quote = false;
        // Décoration de dimensions ([1:2]={…})
        if self.source.first() == Some(&'[') {
            while self.position < self.source.len() {
                if self.next_character().0 == Some('=') {
                    break;
                }
            }
        }
        while self.position < self.source.len() {
            let (character, escaped) = self.next_character();
            match character {
                Some('{') if !quote => {
                    self.dimension += 1;
                    if self.dimension > 1 {
                        let mut parser = ArrayParser::new(&self.source[self.position - 1..], self.transform);
                        let (nested_entries, consumed) = parser.parse_with_position(true);
                        self.entries.push(Value::Array(nested_entries));
                        self.position = (self.position + consumed).saturating_sub(2);
                    }
                }
                Some('}') if !quote => {
                    self.dimension -= 1;
                    if self.dimension == 0 {
                        self.new_entry(false);
                        if nested {
                            return (std::mem::take(&mut self.entries), self.position);
                        }
                    }
                }
                Some('"') if !escaped => {
                    if quote {
                        self.new_entry(true);
                    }
                    quote = !quote;
                }
                Some(',') if !quote => self.new_entry(false),
                Some(other) => self.recorded.push(other),
                None => {}
            }
        }
        (std::mem::take(&mut self.entries), self.position)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn valeurs_comme_node_pg() {
        // Résultats de node-pg (pg-types 2.2) pour ces textes
        assert_eq!(node_pg_value(23, "12"), json!(12));
        assert_eq!(node_pg_value(20, "12345678901"), json!("12345678901"));
        assert_eq!(node_pg_value(701, "2"), json!(2));
        assert_eq!(node_pg_value(701, "NaN"), Value::Null);
        assert_eq!(node_pg_value(1700, "1.50"), json!("1.50"));
        assert_eq!(node_pg_value(16, "f"), json!(false));
        assert_eq!(
            node_pg_value(17, "\\x78ff"),
            json!({ "type": "Buffer", "data": [120, 255] })
        );
        assert_eq!(
            node_pg_value(1114, "2026-10-15 10:00:00.5"),
            json!("2026-10-15 10:00:00.5")
        );
        assert_eq!(
            node_pg_value(3802, r#"{"a": [1, "b"]}"#),
            json!({ "a": [1, "b"] })
        );
        assert_eq!(node_pg_value(600, "(1.5,-2)"), json!({ "x": 1.5, "y": -2 }));
        assert_eq!(
            node_pg_value(718, "<(1,2),3>"),
            json!({ "x": 1, "y": 2, "radius": 3 })
        );
    }

    #[test]
    fn tableaux_comme_postgres_array() {
        assert_eq!(node_pg_value(1007, "{1,2,NULL}"), json!([1, 2, null]));
        assert_eq!(
            node_pg_value(1009, r#"{a,"b c","NULL",NULL,"x\"y"}"#),
            json!(["a", "b c", "NULL", null, "x\"y"])
        );
        assert_eq!(node_pg_value(1007, "{{1,2},{3,4}}"), json!([[1, 2], [3, 4]]));
        assert_eq!(node_pg_value(1009, "{}"), json!([]));
        assert_eq!(node_pg_value(1016, "{1, 2}"), json!(["1", "2"]));
        assert_eq!(node_pg_value(1009, "[0:1]={a,b}"), json!(["a", "b"]));
        assert_eq!(
            node_pg_value(1182, "{2026-10-15,infinity}"),
            json!(["2026-10-15T00:00:00.000Z", null])
        );
        assert_eq!(
            node_pg_value(1185, "{\"2026-01-01 08:00:00.123456+02\"}"),
            json!(["2026-01-01T06:00:00.123Z"])
        );
    }

    #[test]
    fn nombre_de_lignes_de_l_etiquette() {
        assert_eq!(row_count("UPDATE groups SET x = 1 WHERE false", 0), json!(0));
        assert_eq!(row_count("  -- commentaire\n(SELECT 1 WHERE false)", 0), json!(0));
        assert_eq!(row_count("ANALYZE groups", 0), Value::Null);
        assert_eq!(row_count("CREATE TABLE t (x int)", 0), Value::Null);
        assert_eq!(row_count("create table t as select 1 where false", 0), json!(0));
        assert_eq!(row_count("CREATE VIEW v AS SELECT 1", 0), Value::Null);
        assert_eq!(
            row_count("CREATE TABLE t (id int GENERATED ALWAYS AS IDENTITY)", 0),
            Value::Null
        );
        assert_eq!(row_count("SHOW timezone", 0), Value::Null);
        assert_eq!(row_count("DELETE FROM t", 4), json!(4));
    }
}
