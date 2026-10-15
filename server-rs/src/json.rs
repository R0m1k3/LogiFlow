// Formats JSON de l'API Node, à reproduire à l'identique.

use chrono::NaiveDateTime;
use rust_decimal::Decimal;
use serde::Serializer;

/// Colonne timestamp lue par Drizzle : Date JavaScript, « 2026-10-15T08:30:00.000Z »
pub fn ts<S: Serializer>(value: &NaiveDateTime, serializer: S) -> Result<S::Ok, S::Error> {
    serializer.serialize_str(&format_ts(value))
}

pub fn ts_opt<S: Serializer>(value: &Option<NaiveDateTime>, serializer: S) -> Result<S::Ok, S::Error> {
    match value {
        Some(value) => ts(value, serializer),
        None => serializer.serialize_none(),
    }
}

pub fn format_ts(value: &NaiveDateTime) -> String {
    value.format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string()
}

/// Valeur brute du pilote PostgreSQL (colonnes lues par sql`…` dans Drizzle) :
/// « 2026-10-15 08:30:00 », fraction de seconde sans zéros de fin
pub fn pg_text<S: Serializer>(value: &NaiveDateTime, serializer: S) -> Result<S::Ok, S::Error> {
    serializer.serialize_str(&format_pg_text(value))
}

pub fn pg_text_opt<S: Serializer>(value: &Option<NaiveDateTime>, serializer: S) -> Result<S::Ok, S::Error> {
    match value {
        Some(value) => pg_text(value, serializer),
        None => serializer.serialize_none(),
    }
}

pub fn format_pg_text(value: &NaiveDateTime) -> String {
    let base = value.format("%Y-%m-%d %H:%M:%S").to_string();
    let micros = value.and_utc().timestamp_subsec_micros();
    if micros == 0 {
        base
    } else {
        format!("{base}.{}", format!("{micros:06}").trim_end_matches('0'))
    }
}

/// Colonne numeric(…, ÉCHELLE) lue par node-pg : le texte de PostgreSQL ("12.50").
/// sqlx lit zéro sans son échelle (0.00 devient 0) : elle est rétablie ici.
pub fn numeric<const SCALE: u32, S: Serializer>(value: &Decimal, serializer: S) -> Result<S::Ok, S::Error> {
    let mut value = *value;
    if value.scale() < SCALE {
        value.rescale(SCALE);
    }
    serializer.serialize_str(&value.to_string())
}

pub fn numeric_opt<const SCALE: u32, S: Serializer>(
    value: &Option<Decimal>,
    serializer: S,
) -> Result<S::Ok, S::Error> {
    match value {
        Some(value) => numeric::<SCALE, S>(value, serializer),
        None => serializer.serialize_none(),
    }
}

/// Champs d'une ligne, pour la compléter comme `{ ...ligne, group, creator }` en
/// JavaScript (les clés ajoutées viennent après celles de la ligne)
pub fn spread<T: serde::Serialize>(row: &T) -> serde_json::Map<String, serde_json::Value> {
    match serde_json::to_value(row) {
        Ok(serde_json::Value::Object(fields)) => fields,
        _ => serde_json::Map::new(),
    }
}

/// stripSmtpPassword (server/sanitize.ts), appliqué par Node à toute réponse /api :
/// une clé smtpPassword ou smtp_password devient smtpPasswordSet: Boolean(valeur),
/// à la même place. À appliquer aux réponses qui joignent la ligne complète d'un
/// magasin (getDlcProduct, getSavTicket…).
pub fn strip_smtp_password(value: serde_json::Value) -> serde_json::Value {
    strip_at_depth(value, 0)
}

fn strip_at_depth(value: serde_json::Value, depth: usize) -> serde_json::Value {
    use serde_json::Value;
    // Même profondeur maximale que Node
    if depth > 8 {
        return value;
    }
    match value {
        Value::Array(items) => Value::Array(
            items
                .into_iter()
                .map(|item| strip_at_depth(item, depth + 1))
                .collect(),
        ),
        Value::Object(entries) => Value::Object(
            entries
                .into_iter()
                .map(|(key, entry)| {
                    if key == "smtpPassword" || key == "smtp_password" {
                        (
                            "smtpPasswordSet".to_string(),
                            Value::Bool(crate::js::truthy(&entry)),
                        )
                    } else {
                        (key, strip_at_depth(entry, depth + 1))
                    }
                })
                .collect(),
        ),
        other => other,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::NaiveDate;

    #[test]
    fn montants_avec_l_echelle_de_la_colonne() {
        #[derive(serde::Serialize)]
        struct Row {
            #[serde(serialize_with = "numeric_opt::<2, _>")]
            amount: Option<Decimal>,
        }
        let text = |amount| serde_json::to_string(&Row { amount }).unwrap();
        assert_eq!(text(Some(Decimal::ZERO)), r#"{"amount":"0.00"}"#);
        assert_eq!(text(Some(Decimal::new(1250, 2))), r#"{"amount":"12.50"}"#);
        assert_eq!(text(None), r#"{"amount":null}"#);
    }

    #[test]
    fn mot_de_passe_smtp_masque() {
        let group =
            serde_json::json!({ "id": 1, "smtpUser": "u", "smtpPassword": "enc:v1:x", "name": "Nancy" });
        let stripped = strip_smtp_password(serde_json::json!([{ "group": group }, { "smtp_password": "" }]));
        assert_eq!(
            serde_json::to_string(&stripped).unwrap(),
            r#"[{"group":{"id":1,"smtpUser":"u","smtpPasswordSet":true,"name":"Nancy"}},{"smtpPasswordSet":false}]"#
        );
    }

    #[test]
    fn formats() {
        let date = NaiveDate::from_ymd_opt(2026, 10, 15)
            .unwrap()
            .and_hms_micro_opt(8, 30, 0, 123_400)
            .unwrap();
        assert_eq!(format_ts(&date), "2026-10-15T08:30:00.123Z");
        assert_eq!(format_pg_text(&date), "2026-10-15 08:30:00.1234");
        let whole = NaiveDate::from_ymd_opt(2026, 10, 15)
            .unwrap()
            .and_hms_opt(8, 0, 0)
            .unwrap();
        assert_eq!(format_pg_text(&whole), "2026-10-15 08:00:00");
    }
}
