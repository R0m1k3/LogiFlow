// Dates reçues de NocoDB, au comportement du serveur Node :
// - normalize_date_string : server/dateUtils.ts (normalizeDateString), échéance
//   ramenée à AAAA-MM-JJ, jour avant mois quand l'ordre est ambigu ;
// - parse_js_date / js_date : new Date(valeur) de V8 (Node 22), formats ISO et
//   « anciens » (10/25/2026, 2026/10/25, Oct 25 2026, …), utilisé pour les
//   échéances écrites en base. Le serveur Node tourne en UTC : l'heure locale
//   de V8 est ici l'UTC.

use chrono::{DateTime, Datelike, Duration, NaiveDate, TimeZone, Utc};
use serde_json::Value;

/// normalizeDateString(valeur) : None pour tout ce qui n'est pas une chaîne
pub fn normalize_date_value(value: &Value) -> Option<String> {
    value.as_str().and_then(normalize_date_string)
}

/// normalizeDateString(texte) : AAAA-MM-JJ, ou None si la date n'est pas reconnue.
/// Une chaîne déjà au format AAAA-MM-JJ est rendue telle quelle, même invalide
/// (« 2026-13-45 »), comme Node.
pub fn normalize_date_string(text: &str) -> Option<String> {
    let trimmed = crate::js::trim(text);
    if trimmed.is_empty() {
        return None;
    }
    if is_iso_day(trimmed) {
        return Some(trimmed.to_string());
    }
    if let Some((first, second, year)) = split_numeric_date(trimmed) {
        let first_num: u32 = first.parse().ok()?;
        let second_num: u32 = second.parse().ok()?;
        if first_num > 31 || second_num > 31 || first_num == 0 || second_num == 0 {
            return None;
        }
        // Premier nombre > 12 : JJ/MM ; second > 12 : MM/JJ ; sinon JJ/MM par défaut
        let (day, month) = if first_num <= 12 && second_num > 12 {
            (second, first)
        } else {
            (first, second)
        };
        let (day, month) = (format!("{day:0>2}"), format!("{month:0>2}"));
        let month_num: u32 = month.parse().ok()?;
        if !(1..=12).contains(&month_num) {
            return None;
        }
        return Some(format!("{year}-{month}-{day}"));
    }
    let date = parse_js_date(trimmed)?;
    Some(format!("{}-{:02}-{:02}", date.year(), date.month(), date.day()))
}

/// /^\d{4}-\d{2}-\d{2}$/
fn is_iso_day(text: &str) -> bool {
    let bytes = text.as_bytes();
    bytes.len() == 10
        && bytes[4] == b'-'
        && bytes[7] == b'-'
        && bytes
            .iter()
            .enumerate()
            .all(|(i, b)| i == 4 || i == 7 || b.is_ascii_digit())
}

/// /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/
fn split_numeric_date(text: &str) -> Option<(&str, &str, &str)> {
    let mut parts = text.split(['/', '-']);
    let (first, second, year) = (parts.next()?, parts.next()?, parts.next()?);
    let digits = |part: &str, min: usize, max: usize| {
        (min..=max).contains(&part.len()) && part.bytes().all(|b| b.is_ascii_digit())
    };
    (parts.next().is_none() && digits(first, 1, 2) && digits(second, 1, 2) && digits(year, 4, 4))
        .then_some((first, second, year))
}

/// new Date(valeur) : None pour « Invalid Date »
pub fn js_date(value: &Value) -> Option<DateTime<Utc>> {
    match value {
        Value::String(text) => parse_js_date(text),
        Value::Array(_) => parse_js_date(&crate::js::to_js_string(value)),
        Value::Object(_) => None,
        other => crate::js::new_date(other),
    }
}

// ---------- Analyse des dates de V8 (src/date/dateparser-inl.h) ----------

const NONE: i64 = i64::MIN;
const MAX_TIME_MS: f64 = 8.64e15;

#[derive(Debug, Clone, Copy, PartialEq)]
enum Keyword {
    Month(i64),
    AmPm(i64),
    TimeZone(i64),
    TimeSeparator,
    Invalid,
}

#[derive(Debug, Clone, Copy, PartialEq)]
enum Token {
    End,
    Number { value: i64, length: usize },
    Symbol(char),
    Word { keyword: Keyword, length: usize },
    WhiteSpace,
    Unknown,
}

impl Token {
    fn is_fixed_number(&self, length: usize) -> bool {
        matches!(self, Token::Number { length: l, .. } if *l == length)
    }
    fn number(&self) -> i64 {
        match self {
            Token::Number { value, .. } => *value,
            _ => NONE,
        }
    }
    fn is_sign(&self) -> bool {
        matches!(self, Token::Symbol('+' | '-'))
    }
    fn sign(&self) -> i64 {
        if matches!(self, Token::Symbol('-')) { -1 } else { 1 }
    }
    fn is_keyword_z(&self) -> bool {
        matches!(
            self,
            Token::Word {
                keyword: Keyword::TimeZone(0),
                length: 1
            }
        )
    }
}

const KEYWORDS: [(&str, Keyword); 27] = [
    ("jan", Keyword::Month(1)),
    ("feb", Keyword::Month(2)),
    ("mar", Keyword::Month(3)),
    ("apr", Keyword::Month(4)),
    ("may", Keyword::Month(5)),
    ("jun", Keyword::Month(6)),
    ("jul", Keyword::Month(7)),
    ("aug", Keyword::Month(8)),
    ("sep", Keyword::Month(9)),
    ("oct", Keyword::Month(10)),
    ("nov", Keyword::Month(11)),
    ("dec", Keyword::Month(12)),
    ("am", Keyword::AmPm(0)),
    ("pm", Keyword::AmPm(12)),
    ("ut", Keyword::TimeZone(0)),
    ("utc", Keyword::TimeZone(0)),
    ("z", Keyword::TimeZone(0)),
    ("gmt", Keyword::TimeZone(0)),
    ("cdt", Keyword::TimeZone(-5)),
    ("cst", Keyword::TimeZone(-6)),
    ("edt", Keyword::TimeZone(-4)),
    ("est", Keyword::TimeZone(-5)),
    ("mdt", Keyword::TimeZone(-6)),
    ("mst", Keyword::TimeZone(-7)),
    ("pdt", Keyword::TimeZone(-7)),
    ("pst", Keyword::TimeZone(-8)),
    ("t", Keyword::TimeSeparator),
];

/// KeywordTable::Lookup : les 3 premières lettres ; un mot plus long n'est
/// reconnu que pour un nom de mois
fn lookup_keyword(prefix: &str, length: usize) -> Keyword {
    KEYWORDS
        .iter()
        .find(|(name, keyword)| *name == prefix && (length <= 3 || matches!(keyword, Keyword::Month(_))))
        .map(|(_, keyword)| *keyword)
        .unwrap_or(Keyword::Invalid)
}

/// Blancs pour V8 (IsWhiteSpaceChar) : blancs Unicode et fins de ligne
fn is_v8_whitespace(c: char) -> bool {
    c.is_whitespace() || c == '\u{FEFF}'
}

struct Tokenizer {
    chars: Vec<char>,
    pos: usize,
    next: Token,
}

impl Tokenizer {
    fn new(text: &str) -> Self {
        let mut tokenizer = Self {
            chars: text.chars().collect(),
            pos: 0,
            next: Token::End,
        };
        tokenizer.next = tokenizer.scan();
        tokenizer
    }

    fn peek(&self) -> Token {
        self.next
    }

    fn next(&mut self) -> Token {
        let current = self.next;
        self.next = self.scan();
        current
    }

    fn skip_symbol(&mut self, symbol: char) -> bool {
        if self.next == Token::Symbol(symbol) {
            self.next();
            true
        } else {
            false
        }
    }

    fn scan(&mut self) -> Token {
        let Some(&c) = self.chars.get(self.pos) else {
            return Token::End;
        };
        if c.is_ascii_digit() {
            // ReadUnsignedNumeral : zéros de tête ignorés, 9 chiffres significatifs au plus
            let start = self.pos;
            while self.chars.get(self.pos) == Some(&'0') {
                self.pos += 1;
            }
            let mut value: i64 = 0;
            let mut significant = 0;
            while let Some(d) = self.chars.get(self.pos).and_then(|c| c.to_digit(10)) {
                if significant < 9 {
                    value = value * 10 + i64::from(d);
                }
                significant += 1;
                self.pos += 1;
            }
            return Token::Number {
                value,
                length: self.pos - start,
            };
        }
        if matches!(c, ':' | '-' | '+' | '.' | ')') {
            self.pos += 1;
            return Token::Symbol(c);
        }
        if c >= 'A' && !is_v8_whitespace(c) {
            let start = self.pos;
            while self
                .chars
                .get(self.pos)
                .is_some_and(|c| *c >= 'A' && !is_v8_whitespace(*c))
            {
                self.pos += 1;
            }
            let length = self.pos - start;
            let prefix: String = self.chars[start..self.pos]
                .iter()
                .take(3)
                .map(|c| c.to_ascii_lowercase())
                .collect();
            return Token::Word {
                keyword: lookup_keyword(&prefix, length),
                length,
            };
        }
        if is_v8_whitespace(c) {
            while self.chars.get(self.pos).is_some_and(|c| is_v8_whitespace(*c)) {
                self.pos += 1;
            }
            return Token::WhiteSpace;
        }
        if c == '(' {
            // SkipParentheses : commentaire entre parenthèses, imbrications comprises
            let mut depth = 0;
            while let Some(&c) = self.chars.get(self.pos) {
                self.pos += 1;
                if c == '(' {
                    depth += 1;
                } else if c == ')' {
                    depth -= 1;
                    if depth == 0 {
                        break;
                    }
                }
            }
            return Token::Unknown;
        }
        self.pos += 1;
        Token::Unknown
    }
}

#[derive(Default)]
struct DayComposer {
    comp: Vec<i64>,
    named_month: Option<i64>,
    iso_date: bool,
}

impl DayComposer {
    fn add(&mut self, n: i64) -> bool {
        if self.comp.len() < 3 {
            self.comp.push(n);
            true
        } else {
            false
        }
    }

    fn write(&self) -> Option<(i64, i64, i64)> {
        if self.comp.is_empty() {
            return None;
        }
        let mut comp = self.comp.clone();
        comp.resize(3, 1);
        let is_day = |n: i64| (1..=31).contains(&n);
        let (mut year, month, day) = match self.named_month {
            None if self.iso_date || !is_day(comp[0]) => (comp[0], comp[1], comp[2]),
            None => (comp[2], comp[0], comp[1]),
            Some(month) if !is_day(comp[0]) => (comp[0], month, comp[1]),
            Some(month) => (comp[1], month, comp[0]),
        };
        if !self.iso_date {
            if (0..=49).contains(&year) {
                year += 2000;
            } else if (50..=99).contains(&year) {
                year += 1900;
            }
        }
        ((1..=12).contains(&month) && is_day(day)).then_some((year, month, day))
    }
}

#[derive(Default)]
struct TimeComposer {
    comp: Vec<i64>,
    hour_offset: Option<i64>,
}

impl TimeComposer {
    fn is_empty(&self) -> bool {
        self.comp.is_empty()
    }
    fn add(&mut self, n: i64) -> bool {
        if self.comp.len() < 4 {
            self.comp.push(n);
            true
        } else {
            false
        }
    }
    fn add_final(&mut self, n: i64) -> bool {
        if !self.add(n) {
            return false;
        }
        self.comp.resize(4, 0);
        true
    }
    fn is_expecting(&self, n: i64) -> bool {
        match self.comp.len() {
            1 => (0..=59).contains(&n),
            2 => (0..=59).contains(&n),
            3 => (0..=999).contains(&n),
            _ => false,
        }
    }
    fn write(&self) -> Option<(i64, i64, i64, i64)> {
        let mut comp = self.comp.clone();
        comp.resize(4, 0);
        let (mut hour, minute, second, ms) = (comp[0], comp[1], comp[2], comp[3]);
        if let Some(offset) = self.hour_offset {
            if !(0..=12).contains(&hour) {
                return None;
            }
            hour = hour % 12 + offset;
        }
        let valid = (0..=23).contains(&hour)
            && (0..=59).contains(&minute)
            && (0..=59).contains(&second)
            && (0..=999).contains(&ms);
        (valid || (hour == 24 && minute == 0 && second == 0 && ms == 0)).then_some((hour, minute, second, ms))
    }
}

#[derive(Default)]
struct TimeZoneComposer {
    sign: Option<i64>,
    hour: Option<i64>,
    minute: Option<i64>,
}

impl TimeZoneComposer {
    fn set(&mut self, offset_hours: i64) {
        self.sign = Some(if offset_hours < 0 { -1 } else { 1 });
        self.hour = Some(offset_hours.abs());
        self.minute = Some(0);
    }
    fn is_expecting(&self, n: i64) -> bool {
        self.hour.is_some() && self.minute.is_none() && (0..=59).contains(&n)
    }
    fn is_utc(&self) -> bool {
        self.hour == Some(0) && self.minute == Some(0)
    }
    fn is_empty(&self) -> bool {
        self.hour.is_none()
    }
    /// Décalage en secondes, None pour l'heure locale
    fn write(&self) -> Option<i64> {
        let sign = self.sign?;
        Some(sign * (self.hour.unwrap_or(0) * 3600 + self.minute.unwrap_or(0) * 60))
    }
}

/// ReadMilliseconds : les trois premiers chiffres significatifs
fn read_milliseconds(token: Token) -> i64 {
    let Token::Number { value, length } = token else {
        return 0;
    };
    match length {
        1 => value * 100,
        2 => value * 10,
        3 => value,
        _ => {
            let length = length.min(9);
            value / 10_i64.pow((length - 3) as u32)
        }
    }
}

/// ParseES5DateTime : rend le premier jeton non traité, ou None (date invalide)
fn parse_es5(
    scanner: &mut Tokenizer,
    day: &mut DayComposer,
    time: &mut TimeComposer,
    tz: &mut TimeZoneComposer,
) -> Option<Token> {
    if scanner.peek().is_sign() {
        let sign_token = scanner.next();
        if !scanner.peek().is_fixed_number(6) {
            return Some(sign_token);
        }
        let year = scanner.next().number();
        if sign_token.sign() < 0 && year == 0 {
            return Some(sign_token);
        }
        day.add(sign_token.sign() * year);
    } else if scanner.peek().is_fixed_number(4) {
        day.add(scanner.next().number());
    } else {
        return Some(scanner.next());
    }
    if scanner.skip_symbol('-') {
        let month = scanner.peek();
        if !month.is_fixed_number(2) || !(1..=12).contains(&month.number()) {
            return Some(scanner.next());
        }
        day.add(scanner.next().number());
        if scanner.skip_symbol('-') {
            let day_token = scanner.peek();
            if !day_token.is_fixed_number(2) || !(1..=31).contains(&day_token.number()) {
                return Some(scanner.next());
            }
            day.add(scanner.next().number());
        }
    }
    if !matches!(
        scanner.peek(),
        Token::Word {
            keyword: Keyword::TimeSeparator,
            ..
        }
    ) {
        if scanner.peek() != Token::End {
            return Some(scanner.next());
        }
    } else {
        scanner.next();
        let hour = scanner.peek();
        if !hour.is_fixed_number(2) || !(0..=24).contains(&hour.number()) {
            return None;
        }
        let hour_is_24 = hour.number() == 24;
        time.add(scanner.next().number());
        if !scanner.skip_symbol(':') {
            return None;
        }
        let minute = scanner.peek();
        if !minute.is_fixed_number(2)
            || !(0..=59).contains(&minute.number())
            || (hour_is_24 && minute.number() > 0)
        {
            return None;
        }
        time.add(scanner.next().number());
        if scanner.skip_symbol(':') {
            let second = scanner.peek();
            if !second.is_fixed_number(2)
                || !(0..=59).contains(&second.number())
                || (hour_is_24 && second.number() > 0)
            {
                return None;
            }
            time.add(scanner.next().number());
            if scanner.skip_symbol('.') {
                let ms = scanner.peek();
                if !matches!(ms, Token::Number { .. }) || (hour_is_24 && ms.number() > 0) {
                    return None;
                }
                time.add(read_milliseconds(scanner.next()));
            }
        }
        if scanner.peek().is_keyword_z() {
            scanner.next();
            tz.set(0);
        } else if scanner.peek().is_sign() {
            tz.sign = Some(scanner.next().sign());
            if scanner.peek().is_fixed_number(4) {
                let hour_minute = scanner.next().number();
                let (hour, minute) = (hour_minute / 100, hour_minute % 100);
                if !(0..=23).contains(&hour) || !(0..=59).contains(&minute) {
                    return None;
                }
                tz.hour = Some(hour);
                tz.minute = Some(minute);
            } else {
                let hour = scanner.peek();
                if !hour.is_fixed_number(2) || !(0..=23).contains(&hour.number()) {
                    return None;
                }
                tz.hour = Some(scanner.next().number());
                if !scanner.skip_symbol(':') {
                    return None;
                }
                let minute = scanner.peek();
                if !minute.is_fixed_number(2) || !(0..=59).contains(&minute.number()) {
                    return None;
                }
                tz.minute = Some(scanner.next().number());
            }
        }
        if scanner.peek() != Token::End {
            return None;
        }
    }
    // Date seule sans fuseau : UTC ; date et heure sans fuseau : heure locale
    if tz.is_empty() && time.is_empty() {
        tz.set(0);
    }
    day.iso_date = true;
    Some(Token::End)
}

/// new Date(texte) de V8 : None pour « Invalid Date »
pub fn parse_js_date(text: &str) -> Option<DateTime<Utc>> {
    let mut scanner = Tokenizer::new(text);
    let mut day = DayComposer::default();
    let mut time = TimeComposer::default();
    let mut tz = TimeZoneComposer::default();

    let mut token = parse_es5(&mut scanner, &mut day, &mut time, &mut tz)?;
    let mut has_read_number = !day.comp.is_empty();
    while token != Token::End {
        match token {
            Token::Number { value: n, .. } => {
                has_read_number = true;
                if scanner.skip_symbol(':') {
                    if scanner.skip_symbol(':') {
                        if !time.is_empty() {
                            return None;
                        }
                        time.add(n);
                        time.add(0);
                    } else {
                        if !time.add(n) {
                            return None;
                        }
                        if scanner.peek() == Token::Symbol('.') {
                            scanner.next();
                        }
                    }
                } else if scanner.skip_symbol('.') && time.is_expecting(n) {
                    // Comme V8, le point est consommé même si l'heure ne l'attend pas
                    time.add(n);
                    if !matches!(scanner.peek(), Token::Number { .. }) {
                        return None;
                    }
                    let ms = read_milliseconds(scanner.next());
                    time.add_final(ms);
                } else if tz.is_expecting(n) {
                    tz.minute = Some(n);
                } else if time.is_expecting(n) {
                    time.add_final(n);
                    let peek = scanner.peek();
                    if !matches!(peek, Token::End | Token::WhiteSpace)
                        && !peek.is_keyword_z()
                        && !peek.is_sign()
                    {
                        return None;
                    }
                } else {
                    if !day.add(n) {
                        return None;
                    }
                    scanner.skip_symbol('-');
                }
            }
            Token::Word { keyword, .. } => match keyword {
                Keyword::AmPm(offset) if !time.is_empty() => time.hour_offset = Some(offset),
                Keyword::Month(month) => {
                    day.named_month = Some(month);
                    scanner.skip_symbol('-');
                }
                Keyword::TimeZone(offset) if has_read_number => tz.set(offset),
                _ => {
                    // Mot inconnu : interdit après un nombre, ou collé à un nombre
                    if has_read_number || matches!(scanner.peek(), Token::Number { .. }) {
                        return None;
                    }
                }
            },
            Token::Symbol('+' | '-') if tz.is_utc() || !time.is_empty() => {
                tz.sign = Some(token.sign());
                let (mut n, mut length) = (0, 0);
                if let Token::Number { value, length: l } = scanner.peek() {
                    scanner.next();
                    n = value;
                    length = l;
                }
                has_read_number = true;
                if scanner.peek() == Token::Symbol(':') {
                    tz.hour = Some(n);
                    tz.minute = None;
                } else if length == 1 || length == 2 {
                    tz.hour = Some(n);
                    tz.minute = Some(0);
                } else if length == 3 || length == 4 {
                    tz.hour = Some(n / 100);
                    tz.minute = Some(n % 100);
                } else {
                    return None;
                }
            }
            Token::Symbol('+' | '-' | ')') if has_read_number => return None,
            _ => {}
        }
        token = scanner.next();
    }

    let (year, month, day) = day.write()?;
    let (hour, minute, second, ms) = time.write()?;
    let offset = tz.write();
    make_date(year, month, day, hour, minute, second, ms, offset)
}

/// MakeDay / MakeTime / TimeClip : le jour peut déborder sur le mois suivant
/// (« 2026-02-31 » donne le 3 mars), l'heure 24 sur le lendemain
#[allow(clippy::too_many_arguments)]
fn make_date(
    year: i64,
    month: i64,
    day: i64,
    hour: i64,
    minute: i64,
    second: i64,
    ms: i64,
    offset_seconds: Option<i64>,
) -> Option<DateTime<Utc>> {
    let first = NaiveDate::from_ymd_opt(i32::try_from(year).ok()?, month as u32, 1)?;
    let date = first.checked_add_signed(Duration::days(day - 1))?;
    let millis = date.and_hms_opt(0, 0, 0)?.and_utc().timestamp_millis() as f64
        + ((hour * 3600 + minute * 60 + second) * 1000 + ms) as f64
        - offset_seconds.unwrap_or(0) as f64 * 1000.0;
    if millis.abs() > MAX_TIME_MS {
        return None;
    }
    Utc.timestamp_millis_opt(millis as i64).single()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn iso(text: &str) -> Option<String> {
        parse_js_date(text).map(|date| crate::js::iso(&date))
    }

    #[test]
    fn normalise_comme_node() {
        // Valeurs relevées avec normalizeDateString (server/dateUtils.ts) dans Node 22, TZ=UTC
        let cases = [
            ("2026-10-25", Some("2026-10-25")),
            (" 2026-10-25 ", Some("2026-10-25")),
            ("25/10/2026", Some("2026-10-25")),
            ("10/25/2026", Some("2026-10-25")),
            ("05/06/2026", Some("2026-06-05")),
            ("5-6-2026", Some("2026-06-05")),
            ("31/12/2026", Some("2026-12-31")),
            ("32/01/2026", None),
            ("00/12/2026", None),
            ("13/13/2026", None),
            ("12/31/2026", Some("2026-12-31")),
            ("2026-10-25T10:30:00.000Z", Some("2026-10-25")),
            ("2026-10-25T23:30:00+02:00", Some("2026-10-25")),
            ("2026-10-25 08:00:00", Some("2026-10-25")),
            ("2026/10/25", Some("2026-10-25")),
            ("Oct 25 2026", Some("2026-10-25")),
            ("25 Oct 2026", Some("2026-10-25")),
            ("Sun, 25 Oct 2026 10:00:00 GMT", Some("2026-10-25")),
            ("pas une date", None),
            ("", None),
            ("   ", None),
            ("2026-02-31", Some("2026-02-31")),
            ("2026-2-3", Some("2026-02-03")),
            ("1/2/2026", Some("2026-02-01")),
            ("2026-10", Some("2026-10-01")),
            ("2026", Some("2026-01-01")),
            ("20261025", None),
            ("2026-10-25T10:30", Some("2026-10-25")),
            ("10/25/2026 10:00", Some("2026-10-25")),
            ("2026-13-45", Some("2026-13-45")),
            ("2026-02-30T00:00:00Z", Some("2026-03-02")),
            ("2026/2/30", Some("2026-03-02")),
            ("99/99/2026", None),
            ("1/13/2026", Some("2026-01-13")),
        ];
        for (input, expected) in cases {
            assert_eq!(normalize_date_string(input).as_deref(), expected, "{input:?}");
        }
        assert_eq!(normalize_date_value(&json!(20261025)), None);
    }

    #[test]
    fn new_date_comme_v8() {
        // new Date(texte).toISOString() dans Node 22, TZ=UTC
        let cases = [
            ("2026-02-31", Some("2026-03-03T00:00:00.000Z")),
            ("2026-02-30T00:00:00Z", Some("2026-03-02T00:00:00.000Z")),
            ("2026/2/30", Some("2026-03-02T00:00:00.000Z")),
            ("2026-10-25 08:00", Some("2026-10-25T08:00:00.000Z")),
            ("10/25/2026", Some("2026-10-25T00:00:00.000Z")),
            ("2026/10/25 10:00:00", Some("2026-10-25T10:00:00.000Z")),
            ("Oct 25 2026", Some("2026-10-25T00:00:00.000Z")),
            ("2026-10-25T10:30:00.123456Z", Some("2026-10-25T10:30:00.123Z")),
            ("+002026-10-25", Some("2026-10-25T00:00:00.000Z")),
            ("2026-10-25T24:00:00Z", Some("2026-10-26T00:00:00.000Z")),
            ("2026-10-25T10:30:00Z ", None),
            ("2026-1-5", Some("2026-01-05T00:00:00.000Z")),
            ("2026-10-25T00:00:00.000Z", Some("2026-10-25T00:00:00.000Z")),
            ("2026-10-25T23:30:00+02:00", Some("2026-10-25T21:30:00.000Z")),
            ("25/10/2026", None),
            ("2026-13-45", None),
            ("pas une date", None),
        ];
        for (input, expected) in cases {
            assert_eq!(iso(input).as_deref(), expected, "{input:?}");
        }
        assert_eq!(
            js_date(&json!(0)).map(|d| crate::js::iso(&d)).as_deref(),
            Some("1970-01-01T00:00:00.000Z")
        );
        assert_eq!(js_date(&json!({})), None);
    }
}
