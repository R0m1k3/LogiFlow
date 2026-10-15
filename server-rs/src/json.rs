// Formats JSON de l'API Node, à reproduire à l'identique.

use chrono::NaiveDateTime;
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

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::NaiveDate;

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
