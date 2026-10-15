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

/// Blancs retirés par String.prototype.trim() (WhiteSpace et LineTerminator) :
/// U+FEFF en fait partie, U+0085 non, à l'inverse de str::trim
fn is_js_whitespace(c: char) -> bool {
    matches!(
        c,
        '\t' | '\n' | '\u{0B}' | '\u{0C}' | '\r' | ' ' | '\u{A0}' | '\u{1680}' | '\u{2000}'
            ..='\u{200A}' | '\u{2028}' | '\u{2029}' | '\u{202F}' | '\u{205F}' | '\u{3000}' | '\u{FEFF}'
    )
}

/// texte.trim()
pub fn trim(text: &str) -> &str {
    text.trim_matches(is_js_whitespace)
}

/// String(valeur) : texte tel quel, nombre sans « .0 », tableau joint par « , »,
/// objet « [object Object] » (gabarits `${…}`, clés d'objet)
pub fn to_js_string(value: &Value) -> String {
    match value {
        Value::Null => "null".into(),
        Value::Bool(flag) => flag.to_string(),
        Value::Number(number) => match number.as_f64() {
            Some(float) => number_to_string(float),
            None => number.to_string(),
        },
        Value::String(text) => text.clone(),
        Value::Array(items) => items
            .iter()
            .map(|item| match item {
                Value::Null => String::new(),
                other => to_js_string(other),
            })
            .collect::<Vec<_>>()
            .join(","),
        Value::Object(_) => "[object Object]".into(),
    }
}

/// parseFloat(texte) : plus long préfixe décimal après les blancs de tête, NaN sinon
pub fn parse_float(text: &str) -> f64 {
    let text = text.trim_start_matches(is_js_whitespace);
    let (sign, unsigned) = match text.as_bytes().first() {
        Some(b'-') => (-1.0, &text[1..]),
        Some(b'+') => (1.0, &text[1..]),
        _ => (1.0, text),
    };
    if unsigned.starts_with("Infinity") {
        return sign * f64::INFINITY;
    }
    let bytes = unsigned.as_bytes();
    let mut end = 0;
    let mut digits = 0;
    while end < bytes.len() && bytes[end].is_ascii_digit() {
        end += 1;
        digits += 1;
    }
    if end < bytes.len() && bytes[end] == b'.' {
        let mut fraction_end = end + 1;
        while fraction_end < bytes.len() && bytes[fraction_end].is_ascii_digit() {
            fraction_end += 1;
            digits += 1;
        }
        end = fraction_end;
    }
    if digits == 0 {
        return f64::NAN;
    }
    // Exposant seulement s'il a au moins un chiffre (« 1e » vaut 1)
    if end < bytes.len() && matches!(bytes[end], b'e' | b'E') {
        let mut exponent_end = end + 1;
        if exponent_end < bytes.len() && matches!(bytes[exponent_end], b'+' | b'-') {
            exponent_end += 1;
        }
        let start = exponent_end;
        while exponent_end < bytes.len() && bytes[exponent_end].is_ascii_digit() {
            exponent_end += 1;
        }
        if exponent_end > start {
            end = exponent_end;
        }
    }
    unsigned[..end]
        .parse::<f64>()
        .map(|n| sign * n)
        .unwrap_or(f64::NAN)
}

/// encodeURIComponent(texte) : tout sauf A-Z a-z 0-9 - _ . ! ~ * ' ( ) en %XX (UTF-8)
pub fn encode_uri_component(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    for byte in text.bytes() {
        if byte.is_ascii_alphanumeric() || b"-_.!~*'()".contains(&byte) {
            out.push(byte as char);
        } else {
            out.push_str(&format!("%{byte:02X}"));
        }
    }
    out
}

/// Buffer.from(texte, 'base64') : alphabets standard et « url » acceptés, autres
/// caractères ignorés, lecture arrêtée au premier « = »
pub fn buffer_from_base64(text: &str) -> Vec<u8> {
    let mut out = Vec::with_capacity(text.len() * 3 / 4);
    let (mut bits, mut count) = (0u32, 0u32);
    for c in text.chars() {
        let value = match c {
            'A'..='Z' => c as u32 - 'A' as u32,
            'a'..='z' => c as u32 - 'a' as u32 + 26,
            '0'..='9' => c as u32 - '0' as u32 + 52,
            '+' | '-' => 62,
            '/' | '_' => 63,
            '=' => break,
            _ => continue,
        };
        bits = (bits << 6) | value;
        count += 6;
        if count >= 8 {
            count -= 8;
            out.push((bits >> count) as u8);
            bits &= (1 << count) - 1;
        }
    }
    out
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
    fn parse_float_comme_javascript() {
        // Valeurs relevées avec parseFloat() dans Node 22
        assert_eq!(parse_float("1250.5"), 1250.5);
        assert_eq!(parse_float("  12.5abc"), 12.5);
        assert_eq!(parse_float("1 234,56"), 1.0);
        assert!(parse_float("abc").is_nan());
        assert!(parse_float("").is_nan());
        assert_eq!(parse_float(".5"), 0.5);
        assert_eq!(parse_float("-Infinity x"), f64::NEG_INFINITY);
        assert_eq!(parse_float("1e3"), 1000.0);
        assert_eq!(parse_float("0x10"), 0.0);
        assert_eq!(parse_float("1e"), 1.0);
        assert_eq!(parse_float("+3."), 3.0);
        assert_eq!(parse_float("1.2.3"), 1.2);
        assert_eq!(parse_float("\u{a0} 7"), 7.0);
    }

    #[test]
    fn chaines_comme_javascript() {
        assert_eq!(trim(" \u{a0}\u{feff}x\u{85}"), "x\u{85}");
        assert_eq!(to_js_string(&json!(1.0)), "1");
        assert_eq!(to_js_string(&json!([1, null, "a"])), "1,,a");
        assert_eq!(to_js_string(&json!({})), "[object Object]");
        assert_eq!(
            encode_uri_component("FAC 2001/é?&=#+()!*'~-_."),
            "FAC%202001%2F%C3%A9%3F%26%3D%23%2B()!*'~-_."
        );
    }

    #[test]
    fn base64_comme_buffer_from() {
        // Buffer.from(texte, 'base64').toString('hex') dans Node 22
        let hex = |text: &str| {
            buffer_from_base64(text)
                .iter()
                .map(|b| format!("{b:02x}"))
                .collect::<String>()
        };
        assert_eq!(hex("ab!cd"), "69b71d");
        assert_eq!(hex("QU JD"), "414243");
        assert_eq!(hex("Q=UJD"), "");
        assert_eq!(hex("QUJ=D"), "4142");
        assert_eq!(hex("QU-_"), "414fbf");
        assert_eq!(hex("QUJDRA==x"), "41424344");
        assert_eq!(hex("Q\u{e9}UJD"), "414243");
        assert_eq!(buffer_from_base64("JVBE Ri0x\nLjQ=").len(), 8);
        assert_eq!(buffer_from_base64("a").len(), 0);
        assert_eq!(buffer_from_base64("AA=A").len(), 1);
    }

    #[test]
    fn longueur_utf16() {
        assert_eq!(length("été"), 3);
        assert_eq!(length("😀"), 2);
    }
}
