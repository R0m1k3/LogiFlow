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

/// String(nombre) complet (Number.prototype.toString) : -0 → « 0 », notation
/// exponentielle au-delà de 1e21 et en deçà de 1e-6, NaN et Infinity
pub fn number_string(number: f64) -> String {
    if number.is_nan() {
        return "NaN".into();
    }
    if number.is_infinite() {
        return if number > 0.0 { "Infinity" } else { "-Infinity" }.into();
    }
    if number == 0.0 {
        return "0".into();
    }
    // Chiffres significatifs les plus courts et exposant, comme JavaScript
    let scientific = format!("{:e}", number.abs());
    let (mantissa, exponent) = scientific.split_once('e').unwrap_or((&scientific, "0"));
    let digits: String = mantissa.chars().filter(char::is_ascii_digit).collect();
    let k = digits.len() as i32;
    let n = exponent.parse::<i32>().unwrap_or(0) + 1;
    let body = if k <= n && n <= 21 {
        format!("{digits}{}", "0".repeat((n - k) as usize))
    } else if 0 < n && n <= 21 {
        format!("{}.{}", &digits[..n as usize], &digits[n as usize..])
    } else if -6 < n && n <= 0 {
        format!("0.{}{digits}", "0".repeat((-n) as usize))
    } else {
        let sign = if n > 0 { '+' } else { '-' };
        let (first, rest) = digits.split_at(1);
        let fraction = if rest.is_empty() {
            String::new()
        } else {
            format!(".{rest}")
        };
        format!("{first}{fraction}e{sign}{}", (n - 1).abs())
    };
    if number < 0.0 { format!("-{body}") } else { body }
}

/// String(valeur) d'une valeur JSON (gabarits `${…}`, Array.prototype.join)
pub fn string_of(value: &Value) -> String {
    match value {
        Value::Null => "null".into(),
        Value::Bool(flag) => flag.to_string(),
        Value::Number(number) => number_string(number.as_f64().unwrap_or(f64::NAN)),
        Value::String(text) => text.clone(),
        // [a, null, b].join(',') : null vide
        Value::Array(items) => items
            .iter()
            .map(|item| {
                if item.is_null() {
                    String::new()
                } else {
                    string_of(item)
                }
            })
            .collect::<Vec<_>>()
            .join(","),
        Value::Object(_) => "[object Object]".into(),
    }
}

/// parseFloat(texte) : plus long préfixe décimal après les espaces de tête, NaN sinon
pub fn parse_float(text: &str) -> f64 {
    let trimmed = text.trim_start_matches(|c: char| c.is_whitespace() || c == '\u{feff}');
    let bytes = trimmed.as_bytes();
    let mut end = 0;
    if matches!(bytes.first(), Some(b'+' | b'-')) {
        end = 1;
    }
    if trimmed[end..].starts_with("Infinity") {
        return if trimmed.starts_with('-') {
            f64::NEG_INFINITY
        } else {
            f64::INFINITY
        };
    }
    let digits_start = end;
    while end < bytes.len() && bytes[end].is_ascii_digit() {
        end += 1;
    }
    let mut digits = end - digits_start;
    if end < bytes.len() && bytes[end] == b'.' {
        let fraction_start = end + 1;
        let mut fraction_end = fraction_start;
        while fraction_end < bytes.len() && bytes[fraction_end].is_ascii_digit() {
            fraction_end += 1;
        }
        digits += fraction_end - fraction_start;
        if digits > 0 {
            end = fraction_end;
        }
    }
    if digits == 0 {
        return f64::NAN;
    }
    if end < bytes.len() && matches!(bytes[end], b'e' | b'E') {
        let mut exponent_end = end + 1;
        if matches!(bytes.get(exponent_end), Some(b'+' | b'-')) {
            exponent_end += 1;
        }
        let exponent_digits = exponent_end;
        while exponent_end < bytes.len() && bytes[exponent_end].is_ascii_digit() {
            exponent_end += 1;
        }
        if exponent_end > exponent_digits {
            end = exponent_end;
        }
    }
    trimmed[..end].parse::<f64>().unwrap_or(f64::NAN)
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
    fn string_de_nombres_comme_javascript() {
        // Valeurs de String(n) dans Node
        for (number, expected) in [
            (0.0, "0"),
            (-0.0, "0"),
            (2026.0, "2026"),
            (-3.0, "-3"),
            (18.3, "18.3"),
            (0.1 + 0.2, "0.30000000000000004"),
            (1.2291666666666667, "1.2291666666666667"),
            (123456789012345680000.0, "123456789012345680000"),
            (1e21, "1e+21"),
            (1.5e300, "1.5e+300"),
            (0.000001, "0.000001"),
            (1e-7, "1e-7"),
            (-2.5e-8, "-2.5e-8"),
            (f64::NAN, "NaN"),
            (f64::NEG_INFINITY, "-Infinity"),
        ] {
            assert_eq!(number_string(number), expected, "{number}");
        }
    }

    #[test]
    fn string_et_verite_des_valeurs_json() {
        assert_eq!(string_of(&json!([1, null, "a", [2, 3]])), "1,,a,2,3");
        assert_eq!(string_of(&json!({ "a": 1 })), "[object Object]");
        assert_eq!(string_of(&json!(null)), "null");
        assert_eq!(string_of(&json!(48.5)), "48.5");
        assert!(!truthy(&json!(0)) && !truthy(&json!("")) && !truthy(&json!(null)));
        assert!(truthy(&json!("0")) && truthy(&json!([])) && truthy(&json!({})));
    }

    #[test]
    fn parse_float_comme_javascript() {
        assert_eq!(parse_float("18.3"), 18.3);
        assert_eq!(parse_float("  -2.50abc"), -2.5);
        assert_eq!(parse_float(".5"), 0.5);
        assert_eq!(parse_float("5."), 5.0);
        assert_eq!(parse_float("1e3x"), 1000.0);
        assert_eq!(parse_float("1e"), 1.0);
        assert_eq!(parse_float("-Infinityx"), f64::NEG_INFINITY);
        assert!(parse_float("abc").is_nan());
        assert!(parse_float(".").is_nan());
        assert!(parse_float("").is_nan());
    }

    #[test]
    fn longueur_utf16() {
        assert_eq!(length("été"), 3);
        assert_eq!(length("😀"), 2);
    }
}
