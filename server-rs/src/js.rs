// Conversions au comportement de JavaScript, sur lesquelles le code Node s'appuie
// (Number(), parseInt(), new Date(), longueur d'une chaîne, toISOString()).
// Le serveur Node tourne en UTC (image Docker sans TZ) : l'heure locale est l'UTC.

use chrono::{DateTime, NaiveDate, NaiveDateTime, TimeZone, Utc};
use serde_json::{Number, Value};

const MAX_DATE_MS: f64 = 8.64e15;

/// Number(valeur)
pub fn to_number(value: &Value) -> f64 {
    match value {
        Value::Null => 0.0,
        Value::Bool(true) => 1.0,
        Value::Bool(false) => 0.0,
        Value::Number(number) => number.as_f64().unwrap_or(f64::NAN),
        Value::String(text) => string_to_number(text),
        Value::Array(items) => match items.as_slice() {
            [] => 0.0,
            [single] if !single.is_array() && !single.is_object() => match single {
                Value::Null => 0.0,
                other => to_number(&Value::String(display(other))),
            },
            _ => f64::NAN,
        },
        Value::Object(_) => f64::NAN,
    }
}

fn display(value: &Value) -> String {
    match value {
        Value::String(text) => text.clone(),
        other => other.to_string(),
    }
}

fn string_to_number(text: &str) -> f64 {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return 0.0;
    }
    let (sign, unsigned) = match trimmed.as_bytes()[0] {
        b'-' => (-1.0, &trimmed[1..]),
        b'+' => (1.0, &trimmed[1..]),
        _ => (1.0, trimmed),
    };
    if unsigned == "Infinity" {
        return sign * f64::INFINITY;
    }
    // Préfixes 0x / 0o / 0b : sans signe en JavaScript
    if sign == 1.0 && trimmed.len() > 2 && !trimmed.starts_with(['+', '-']) {
        let radix = match &trimmed[..2] {
            "0x" | "0X" => Some(16),
            "0o" | "0O" => Some(8),
            "0b" | "0B" => Some(2),
            _ => None,
        };
        if let Some(radix) = radix {
            return u64::from_str_radix(&trimmed[2..], radix)
                .map(|n| n as f64)
                .unwrap_or(f64::NAN);
        }
    }
    let valid = {
        let bytes = unsigned.as_bytes();
        let mut i = 0;
        let mut digits = 0;
        while i < bytes.len() && bytes[i].is_ascii_digit() {
            i += 1;
            digits += 1;
        }
        if i < bytes.len() && bytes[i] == b'.' {
            i += 1;
            while i < bytes.len() && bytes[i].is_ascii_digit() {
                i += 1;
                digits += 1;
            }
        }
        if digits > 0 && i < bytes.len() && (bytes[i] == b'e' || bytes[i] == b'E') {
            i += 1;
            if i < bytes.len() && (bytes[i] == b'+' || bytes[i] == b'-') {
                i += 1;
            }
            let start = i;
            while i < bytes.len() && bytes[i].is_ascii_digit() {
                i += 1;
            }
            if start == i {
                return f64::NAN;
            }
        }
        digits > 0 && i == bytes.len()
    };
    if !valid {
        return f64::NAN;
    }
    unsigned.parse::<f64>().map(|n| sign * n).unwrap_or(f64::NAN)
}

/// Valeur « vraie » en JavaScript (`if (x)`, `x || défaut`, `Boolean(x)`) :
/// fausse pour null, false, 0, NaN et la chaîne vide
pub fn truthy(value: &Value) -> bool {
    match value {
        Value::Null => false,
        Value::Bool(flag) => *flag,
        Value::Number(number) => number.as_f64().is_some_and(|n| n != 0.0 && !n.is_nan()),
        Value::String(text) => !text.is_empty(),
        Value::Array(_) | Value::Object(_) => true,
    }
}

/// parseInt(texte, 10) : chiffres de tête, None si aucun (NaN)
pub fn parse_int(text: &str) -> Option<f64> {
    let trimmed = text.trim_start();
    let (sign, rest) = match trimmed.chars().next() {
        Some('-') => (-1.0, &trimmed[1..]),
        Some('+') => (1.0, &trimmed[1..]),
        _ => (1.0, trimmed),
    };
    let digits: String = rest.chars().take_while(|c| c.is_ascii_digit()).collect();
    if digits.is_empty() {
        return None;
    }
    digits.parse::<f64>().ok().map(|n| sign * n)
}

/// Nombre JSON tel que JSON.stringify l'écrirait (entier sans « .0 »)
pub fn number_value(number: f64) -> Value {
    if number.fract() == 0.0 && number.abs() <= 9_007_199_254_740_991.0 {
        Value::Number(Number::from(number as i64))
    } else {
        Number::from_f64(number).map(Value::Number).unwrap_or(Value::Null)
    }
}

/// String(nombre) pour les messages
pub fn number_to_string(number: f64) -> String {
    if number.fract() == 0.0 && number.abs() < 1e21 {
        format!("{number:.0}")
    } else {
        number.to_string()
    }
}

/// Longueur d'une chaîne en JavaScript (unités UTF-16)
pub fn length(text: &str) -> usize {
    text.encode_utf16().count()
}

/// new Date(valeur), None si « Invalid Date »
pub fn new_date(value: &Value) -> Option<DateTime<Utc>> {
    let millis = match value {
        Value::Null => 0.0,
        Value::Bool(flag) => f64::from(u8::from(*flag)),
        Value::Number(number) => number.as_f64()?,
        Value::String(text) => return parse_date(text),
        _ => return None,
    };
    from_millis(millis)
}

fn from_millis(millis: f64) -> Option<DateTime<Utc>> {
    if !millis.is_finite() || millis.abs() > MAX_DATE_MS {
        return None;
    }
    Utc.timestamp_millis_opt(millis.trunc() as i64).single()
}

/// Date.parse pour les formats envoyés par l'interface : ISO 8601 (date seule = UTC
/// minuit, date et heure sans fuseau = heure locale, donc UTC ici), et « AAAA-MM-JJ HH:MM:SS »
pub fn parse_date(text: &str) -> Option<DateTime<Utc>> {
    let text = text.trim();
    if let Ok(date) = DateTime::parse_from_rfc3339(text) {
        return Some(date.with_timezone(&Utc));
    }
    if let Ok(date) = NaiveDate::parse_from_str(text, "%Y-%m-%d") {
        return Some(Utc.from_utc_datetime(&date.and_hms_opt(0, 0, 0)?));
    }
    for format in [
        "%Y-%m-%dT%H:%M:%S%.f",
        "%Y-%m-%dT%H:%M",
        "%Y-%m-%d %H:%M:%S%.f",
        "%Y-%m-%d %H:%M",
    ] {
        if let Ok(naive) = NaiveDateTime::parse_from_str(text, format) {
            return Some(Utc.from_utc_datetime(&naive));
        }
    }
    for format in [
        "%Y-%m-%dT%H:%M:%S%.f%:z",
        "%Y-%m-%dT%H:%M%:z",
        "%Y-%m-%dT%H:%M:%S%.fZ",
        "%Y-%m-%dT%H:%MZ",
    ] {
        if let Ok(date) = DateTime::parse_from_str(text, format) {
            return Some(date.with_timezone(&Utc));
        }
        if let Ok(naive) = NaiveDateTime::parse_from_str(text, format) {
            return Some(Utc.from_utc_datetime(&naive));
        }
    }
    if let Ok(date) = NaiveDate::parse_from_str(text, "%Y-%m") {
        return Some(Utc.from_utc_datetime(&date.and_hms_opt(0, 0, 0)?));
    }
    DateTime::parse_from_rfc2822(text)
        .ok()
        .map(|date| date.with_timezone(&Utc))
}

/// date.toISOString()
pub fn iso(date: &DateTime<Utc>) -> String {
    date.format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn number_comme_javascript() {
        assert_eq!(to_number(&json!("")), 0.0);
        assert_eq!(to_number(&json!(" 12 ")), 12.0);
        assert_eq!(to_number(&json!("1e3")), 1000.0);
        assert_eq!(to_number(&json!("0x1A")), 26.0);
        assert!(to_number(&json!("12abc")).is_nan());
        assert!(to_number(&json!("abc")).is_nan());
        assert_eq!(to_number(&json!(null)), 0.0);
        assert_eq!(to_number(&json!(true)), 1.0);
        assert_eq!(to_number(&json!([])), 0.0);
        assert_eq!(to_number(&json!(["7"])), 7.0);
        assert!(to_number(&json!({})).is_nan());
        assert_eq!(to_number(&json!("-3.5")), -3.5);
        assert_eq!(to_number(&json!(".5")), 0.5);
    }

    #[test]
    fn verite_comme_javascript() {
        for falsy in [json!(null), json!(false), json!(0), json!(0.0), json!("")] {
            assert!(!truthy(&falsy), "{falsy}");
        }
        for truthy_value in [json!(true), json!(-1), json!("0"), json!([]), json!({})] {
            assert!(truthy(&truthy_value), "{truthy_value}");
        }
    }

    #[test]
    fn parse_int_comme_javascript() {
        assert_eq!(parse_int("12abc"), Some(12.0));
        assert_eq!(parse_int("  -4"), Some(-4.0));
        assert_eq!(parse_int("abc"), None);
        assert_eq!(parse_int(""), None);
    }

    #[test]
    fn dates_comme_javascript() {
        assert_eq!(
            iso(&new_date(&json!("2026-10-15")).unwrap()),
            "2026-10-15T00:00:00.000Z"
        );
        assert_eq!(
            iso(&new_date(&json!("2026-10-15T08:30")).unwrap()),
            "2026-10-15T08:30:00.000Z"
        );
        assert_eq!(
            iso(&new_date(&json!("2026-10-15T08:30:00.123+02:00")).unwrap()),
            "2026-10-15T06:30:00.123Z"
        );
        assert_eq!(iso(&new_date(&json!(null)).unwrap()), "1970-01-01T00:00:00.000Z");
        assert!(new_date(&json!("pas une date")).is_none());
    }

    #[test]
    fn longueur_utf16() {
        assert_eq!(length("été"), 3);
        assert_eq!(length("😀"), 2);
    }
}
