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

/// Une ligne par son identifiant (colonne id)
pub async fn find_by_id<T: Table>(db: &PgPool, id: i32) -> Result<Option<T>, sqlx::Error> {
    sqlx::query_as::<_, T>(&T::select("WHERE id = $1"))
        .bind(id)
        .fetch_optional(db)
        .await
}

/// Lignes dont l'identifiant figure dans `ids` : seconde moitié d'une jointure
/// (leftJoin de Drizzle), relue par identifiant pour garder les structures de schema.rs
pub async fn find_by_ids<T: Table>(db: &PgPool, ids: &[i32]) -> Result<Vec<T>, sqlx::Error> {
    sqlx::query_as::<_, T>(&T::select("WHERE id = ANY($1)"))
        .bind(ids)
        .fetch_all(db)
        .await
}

/// Colonnes de la table préfixées par `alias` (requête avec jointures, où « id »
/// serait ambigu)
pub fn columns_of<T: Table>(alias: &str) -> String {
    T::COLUMNS
        .split(", ")
        .map(|column| format!("{alias}.{column}"))
        .collect::<Vec<_>>()
        .join(", ")
}

/// Objet de la requête passé tel quel à Drizzle, sans schéma zod
/// (db.insert(t).values({ ...req.body }), db.update(t).set({ ...req.body })) :
/// - les clés qui ne sont pas des colonnes sont ignorées ;
/// - une colonne timestamp attend un Date (mapToDriverValue appelle toISOString) :
///   toute valeur JSON autre que null lève une TypeError avant la requête, rendue ici
///   en Err avec le message de JavaScript ;
/// - jsonb : JSON.stringify ; autres colonnes : valeur préparée par node-pg.
pub fn drizzle_values<T: Table>(data: &serde_json::Map<String, Value>) -> Result<Parsed, String> {
    let mut parsed = Parsed::new();
    for col in T::FIELDS {
        let Some(value) = data.get(col.key) else {
            continue;
        };
        let prepared = match (col.sql_type, value) {
            (_, Value::Null) => Value::Null,
            ("timestamp", _) => return Err("value.toISOString is not a function".into()),
            ("jsonb", other) => Value::String(other.to_string()),
            (_, other) => node_pg_value(other),
        };
        parsed.insert(col.key.to_string(), prepared);
    }
    Ok(parsed)
}

/// prepareValue de node-pg pour une valeur JSON : un tableau devient un littéral de
/// tableau PostgreSQL ({"a","b"}), le reste part tel quel (pg_text)
pub fn node_pg_value(value: &Value) -> Value {
    match value {
        Value::Array(items) => Value::String(pg_array_literal(items)),
        other => other.clone(),
    }
}

/// arrayString de node-pg
fn pg_array_literal(items: &[Value]) -> String {
    let elements: Vec<String> = items
        .iter()
        .map(|item| match item {
            Value::Null => "NULL".to_string(),
            Value::Array(nested) => pg_array_literal(nested),
            other => {
                let text = pg_text(other).unwrap_or_default();
                format!("\"{}\"", text.replace('\\', "\\\\").replace('"', "\\\""))
            }
        })
        .collect();
    format!("{{{}}}", elements.join(","))
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
    use crate::schema::CustomerOrdersRow;
    use serde_json::json;

    fn object(value: Value) -> serde_json::Map<String, Value> {
        value.as_object().cloned().unwrap()
    }

    #[test]
    fn corps_brut_comme_drizzle() {
        let parsed = drizzle_values::<CustomerOrdersRow>(&object(json!({
            "inconnu": 1, "notes": ["a", "b\"c", null], "quantity": "2", "notifiedAt": null, "groupId": 1
        })))
        .unwrap();
        assert_eq!(
            Value::Object(parsed),
            json!({ "quantity": "2", "notifiedAt": null, "notes": r#"{"a","b\"c",NULL}"#, "groupId": 1 })
        );
    }

    #[test]
    fn horodatage_en_texte_refuse() {
        let error =
            drizzle_values::<CustomerOrdersRow>(&object(json!({ "createdAt": "2026-10-15" }))).unwrap_err();
        assert_eq!(error, "value.toISOString is not a function");
    }

    #[test]
    fn colonnes_prefixees() {
        assert!(columns_of::<CustomerOrdersRow>("co").starts_with("co.\"id\", co.\"order_taker\""));
    }
}
