// Accès générique aux tables décrites dans schema.rs (généré), au comportement de
// Drizzle : insert().values(), update().set().returning(), select().from().
//
// Comme node-pg, chaque valeur part en texte et PostgreSQL la convertit vers le
// type de la colonne ($1::date, $2::numeric…) : mêmes conversions, mêmes erreurs.

use serde_json::Value;
use sqlx::postgres::{PgArguments, PgRow};
use sqlx::{Arguments, FromRow, PgPool};

use crate::zod::Parsed;

/// Colonne : clé JSON (Drizzle), nom SQL, type SQL
#[derive(Debug, Clone, Copy)]
pub struct Col {
    pub key: &'static str,
    pub column: &'static str,
    pub sql_type: &'static str,
}

pub trait Table: for<'r> FromRow<'r, PgRow> + Send + Unpin {
    const TABLE: &'static str;
    /// Colonnes dans l'ordre de shared/schema.ts, entre guillemets
    const COLUMNS: &'static str;
    const FIELDS: &'static [Col];

    fn field(key: &str) -> Option<&'static Col> {
        Self::FIELDS.iter().find(|col| col.key == key)
    }

    /// SELECT des colonnes de la table, suivi de `rest` (WHERE, ORDER BY…)
    fn select(rest: &str) -> String {
        format!("SELECT {} FROM {} {rest}", Self::COLUMNS, Self::TABLE)
    }
}

/// Valeur JavaScript telle que node-pg l'envoie (prepareValue) : texte, ou NULL
pub fn pg_text(value: &Value) -> Option<String> {
    match value {
        Value::Null => None,
        Value::Bool(flag) => Some(flag.to_string()),
        Value::Number(number) => Some(match number.as_f64() {
            Some(float) => crate::js::number_to_string(float),
            None => number.to_string(),
        }),
        Value::String(text) => Some(text.clone()),
        other => Some(other.to_string()),
    }
}

/// prepareValue de node-pg pour une valeur du corps passée telle quelle à une
/// colonne qui n'est pas jsonb (sans schéma zod ni conversion par Drizzle) :
/// tableau → littéral de tableau PostgreSQL, objet → JSON, autre → String(valeur)
pub fn node_pg_text(value: &Value) -> Option<String> {
    match value {
        Value::Null => None,
        Value::Array(items) => Some(pg_array_literal(items)),
        Value::Object(_) => Some(value.to_string()),
        other => Some(crate::js::string_of(other)),
    }
}

/// Nombre JavaScript envoyé par node-pg à une colonne integer (String(nombre)) :
/// la valeur si PostgreSQL l'accepte, None s'il refuse (NaN, décimal, hors limites)
pub fn js_int4(number: f64) -> Option<i32> {
    let integral = number.is_finite() && number.fract() == 0.0;
    (integral && number >= f64::from(i32::MIN) && number <= f64::from(i32::MAX)).then_some(number as i32)
}

/// parseInt(texte) envoyé à une colonne integer (identifiants, magasins)
pub fn parse_int4(text: &str) -> Option<i32> {
    crate::js::parse_int(text).and_then(js_int4)
}

/// arrayString de node-pg : {"a","b",NULL,{"c"}}
fn pg_array_literal(items: &[Value]) -> String {
    let elements: Vec<String> = items
        .iter()
        .map(|item| match item {
            Value::Null => "NULL".to_string(),
            Value::Array(nested) => pg_array_literal(nested),
            other => {
                let text = node_pg_text(other).unwrap_or_default();
                format!("\"{}\"", text.replace('\\', "\\\\").replace('"', "\\\""))
            }
        })
        .collect();
    format!("{{{}}}", elements.join(","))
}

/// Une ligne par son identifiant (colonne id)
pub async fn find_by_id<T: Table>(db: &PgPool, id: i32) -> Result<Option<T>, sqlx::Error> {
    sqlx::query_as::<_, T>(&T::select("WHERE id = $1"))
        .bind(id)
        .fetch_optional(db)
        .await
}

/// db.insert(table).values(data).returning() : les champs absents prennent la
/// valeur par défaut de la colonne
pub async fn insert<T: Table>(db: &PgPool, data: &Parsed) -> Result<T, sqlx::Error> {
    let mut columns = Vec::new();
    let mut placeholders = Vec::new();
    let mut arguments = PgArguments::default();
    for col in T::FIELDS {
        if let Some(value) = data.get(col.key) {
            columns.push(format!("\"{}\"", col.column));
            arguments.add(pg_text(value)).map_err(sqlx::Error::Encode)?;
            placeholders.push(format!("${}::{}", columns.len(), col.sql_type));
        }
    }
    let sql = if columns.is_empty() {
        format!("INSERT INTO {} DEFAULT VALUES RETURNING {}", T::TABLE, T::COLUMNS)
    } else {
        format!(
            "INSERT INTO {} ({}) VALUES ({}) RETURNING {}",
            T::TABLE,
            columns.join(", "),
            placeholders.join(", "),
            T::COLUMNS
        )
    };
    sqlx::query_as_with::<_, T, _>(&sql, arguments)
        .fetch_one(db)
        .await
}

/// db.update(table).set({ ...data, updatedAt: new Date() }).where(id).returning()
/// None si aucune ligne n'a cet identifiant
pub async fn update_by_id<T: Table>(
    db: &PgPool,
    id: i32,
    data: &Parsed,
    touch_updated_at: bool,
) -> Result<Option<T>, sqlx::Error> {
    let mut sets = Vec::new();
    let mut arguments = PgArguments::default();
    let mut count = 0;
    for col in T::FIELDS {
        let value = if touch_updated_at && col.key == "updatedAt" {
            Some(Value::String(crate::modules::now_iso()))
        } else {
            data.get(col.key).cloned()
        };
        if let Some(value) = value {
            count += 1;
            arguments.add(pg_text(&value)).map_err(sqlx::Error::Encode)?;
            sets.push(format!("\"{}\" = ${count}::{}", col.column, col.sql_type));
        }
    }
    if sets.is_empty() {
        // Drizzle refuse un set() vide (« No values to set »)
        return Err(sqlx::Error::Protocol("No values to set".into()));
    }
    arguments.add(id).map_err(sqlx::Error::Encode)?;
    let sql = format!(
        "UPDATE {} SET {} WHERE id = ${} RETURNING {}",
        T::TABLE,
        sets.join(", "),
        count + 1,
        T::COLUMNS
    );
    sqlx::query_as_with::<_, T, _>(&sql, arguments)
        .fetch_optional(db)
        .await
}

/// db.delete(table).where(eq(table.id, id))
pub async fn delete_by_id<T: Table>(db: &PgPool, id: i32) -> Result<u64, sqlx::Error> {
    let sql = format!("DELETE FROM {} WHERE id = $1", T::TABLE);
    Ok(sqlx::query(&sql).bind(id).execute(db).await?.rows_affected())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn valeurs_comme_node_pg() {
        // Valeurs de require('pg/lib/utils').prepareValue dans Node
        assert_eq!(node_pg_text(&json!(null)), None);
        assert_eq!(node_pg_text(&json!(2030.5)).as_deref(), Some("2030.5"));
        assert_eq!(node_pg_text(&json!(true)).as_deref(), Some("true"));
        assert_eq!(node_pg_text(&json!({ "a": 1 })).as_deref(), Some("{\"a\":1}"));
        assert_eq!(
            node_pg_text(&json!(["Spécial", "jar\"din", null, [1, 2], { "b": "c\\d" }])).as_deref(),
            Some(r#"{"Spécial","jar\"din",NULL,{"1","2"},"{\"b\":\"c\\\\d\"}"}"#)
        );
    }

    #[test]
    fn entiers_acceptes_par_postgresql() {
        assert_eq!(parse_int4("12abc"), Some(12));
        assert_eq!(parse_int4("-0"), Some(0));
        assert_eq!(parse_int4("abc"), None);
        assert_eq!(parse_int4("99999999999"), None);
        assert_eq!(js_int4(1.5), None);
        assert_eq!(js_int4(f64::NAN), None);
        assert_eq!(js_int4(-2147483648.0), Some(i32::MIN));
    }
}
