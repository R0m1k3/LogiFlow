// Validation des corps de requête, au comportement de zod 3 (schémas de
// shared/schema.ts) : mêmes contrôles dans le même ordre, mêmes erreurs au même
// format ({ code, expected, received, path, message }), champs inconnus retirés.
// L'interface affiche ces erreurs ; les reproduire évite tout écart visible.

use serde_json::{Map, Value, json};

use crate::js;

const INT32_MIN: f64 = -2_147_483_648.0;
const INT32_MAX: f64 = 2_147_483_647.0;
const SAFE_INTEGER: f64 = 9_007_199_254_740_991.0;

#[derive(Clone, Debug)]
pub enum Kind {
    String,
    Number,
    /// z.coerce.number() : Number(valeur)
    CoerceNumber,
    Boolean,
    /// z.date() : jamais satisfait par du JSON
    Date,
    /// z.coerce.date() : new Date(valeur), rendu en chaîne ISO
    CoerceDate,
    Enum(&'static [&'static str]),
    /// N'importe quelle valeur JSON (colonnes jsonb, z.any())
    Json,
    /// z.union([…]) : options essayées dans l'ordre (leurs noms et leurs
    /// .optional() / .nullable() ne servent pas : z.null() s'écrit Field::null)
    Union(Vec<Field>),
    /// z.literal(valeur)
    Literal(Value),
    /// z.null()
    Null,
}

#[derive(Clone, Debug)]
enum Check {
    MinLen(usize),
    MaxLen(usize),
    Email,
    Min(f64, bool),
    Max(f64, bool),
    Int,
    /// .min(n, "message") d'une chaîne
    MinLenMessage(usize, String),
}

#[derive(Clone, Debug)]
pub struct Field {
    name: String,
    kind: Kind,
    checks: Vec<Check>,
    optional: bool,
    nullable: bool,
    default: Option<Value>,
}

impl Field {
    pub fn new(name: &str, kind: Kind) -> Self {
        Self {
            name: name.to_string(),
            kind,
            checks: Vec::new(),
            optional: false,
            nullable: false,
            default: None,
        }
    }
    pub fn string(name: &str) -> Self {
        Self::new(name, Kind::String)
    }
    pub fn number(name: &str) -> Self {
        Self::new(name, Kind::Number)
    }
    pub fn coerce_number(name: &str) -> Self {
        Self::new(name, Kind::CoerceNumber)
    }
    pub fn boolean(name: &str) -> Self {
        Self::new(name, Kind::Boolean)
    }
    pub fn date(name: &str) -> Self {
        Self::new(name, Kind::Date)
    }
    pub fn coerce_date(name: &str) -> Self {
        Self::new(name, Kind::CoerceDate)
    }
    pub fn json(name: &str) -> Self {
        Self::new(name, Kind::Json)
    }
    pub fn union(name: &str, options: Vec<Field>) -> Self {
        Self::new(name, Kind::Union(options))
    }
    pub fn literal(name: &str, value: Value) -> Self {
        Self::new(name, Kind::Literal(value))
    }
    pub fn null(name: &str) -> Self {
        Self::new(name, Kind::Null)
    }
    pub fn enumeration(name: &str, values: &'static [&'static str]) -> Self {
        Self::new(name, Kind::Enum(values))
    }
    /// Colonne integer / serial pour drizzle-zod : number().min().max().int()
    pub fn int32(name: &str) -> Self {
        Self::number(name).min(INT32_MIN).max(INT32_MAX).int()
    }
    /// Colonne bigint (mode number) pour drizzle-zod
    pub fn safe_integer(name: &str) -> Self {
        Self::number(name).min(-SAFE_INTEGER).max(SAFE_INTEGER).int()
    }

    pub fn min_len(mut self, length: usize) -> Self {
        self.checks.push(Check::MinLen(length));
        self
    }
    /// .min(n, "message") : message choisi au lieu de celui de zod
    pub fn min_len_message(mut self, length: usize, message: &str) -> Self {
        self.checks
            .push(Check::MinLenMessage(length, message.to_string()));
        self
    }
    pub fn max_len(mut self, length: usize) -> Self {
        self.checks.push(Check::MaxLen(length));
        self
    }
    pub fn email(mut self) -> Self {
        self.checks.push(Check::Email);
        self
    }
    pub fn min(mut self, value: f64) -> Self {
        self.checks.push(Check::Min(value, true));
        self
    }
    pub fn max(mut self, value: f64) -> Self {
        self.checks.push(Check::Max(value, true));
        self
    }
    pub fn positive(mut self) -> Self {
        self.checks.push(Check::Min(0.0, false));
        self
    }
    pub fn int(mut self) -> Self {
        self.checks.push(Check::Int);
        self
    }
    pub fn optional(mut self) -> Self {
        self.optional = true;
        self
    }
    pub fn nullable(mut self) -> Self {
        self.nullable = true;
        self
    }
    /// .default(valeur) : appliquée quand le champ est absent
    pub fn default(mut self, value: Value) -> Self {
        self.default = Some(value);
        self
    }
}

#[derive(Clone, Debug)]
pub struct Object {
    fields: Vec<Field>,
}

/// Corps validé : seuls les champs du schéma, avec leurs valeurs converties
pub type Parsed = Map<String, Value>;

impl Object {
    pub fn new(fields: Vec<Field>) -> Self {
        Self { fields }
    }

    /// .omit({ … })
    pub fn omit(mut self, names: &[&str]) -> Self {
        self.fields.retain(|field| !names.contains(&field.name.as_str()));
        self
    }

    /// .pick({ … }) : l'ordre reste celui du schéma
    pub fn pick(mut self, names: &[&str]) -> Self {
        self.fields.retain(|field| names.contains(&field.name.as_str()));
        self
    }

    /// .extend({ … }) : un champ existant garde sa place, un nouveau va à la fin
    pub fn extend(mut self, fields: Vec<Field>) -> Self {
        for field in fields {
            match self
                .fields
                .iter_mut()
                .find(|existing| existing.name == field.name)
            {
                Some(existing) => *existing = field,
                None => self.fields.push(field),
            }
        }
        self
    }

    /// .partial() : tout devient facultatif, et les valeurs par défaut ne s'appliquent plus
    pub fn partial(mut self) -> Self {
        for field in &mut self.fields {
            field.optional = true;
            field.default = None;
        }
        self
    }

    pub fn parse(&self, input: &Value) -> Result<Parsed, Vec<Value>> {
        let Some(object) = input.as_object() else {
            return Err(vec![invalid_type("object", input, &[])]);
        };
        let mut issues = Vec::new();
        let mut output = Map::new();
        for field in &self.fields {
            let path = [Value::String(field.name.clone())];
            let value = match object.get(&field.name) {
                None => match &field.default {
                    Some(default) => default.clone(),
                    None if field.optional => continue,
                    None => {
                        issues.push(json!({
                            "code": "invalid_type",
                            "expected": expected_name(&field.kind),
                            "received": "undefined",
                            "path": path,
                            "message": "Required",
                        }));
                        continue;
                    }
                },
                Some(value) => value.clone(),
            };
            if value.is_null() && field.nullable {
                output.insert(field.name.clone(), Value::Null);
                continue;
            }
            match check_value(field, &value, &path) {
                Ok(parsed) => {
                    output.insert(field.name.clone(), parsed);
                }
                Err(mut field_issues) => issues.append(&mut field_issues),
            }
        }
        if issues.is_empty() {
            Ok(output)
        } else {
            Err(issues)
        }
    }
}

fn check_value(field: &Field, value: &Value, path: &[Value]) -> Result<Value, Vec<Value>> {
    let parsed = match &field.kind {
        Kind::String => match value {
            Value::String(_) => value.clone(),
            _ => return Err(vec![invalid_type("string", value, path)]),
        },
        Kind::Number => match value {
            Value::Number(_) => value.clone(),
            _ => return Err(vec![invalid_type("number", value, path)]),
        },
        Kind::CoerceNumber => {
            let number = js::to_number(value);
            if number.is_nan() {
                return Err(vec![issue_nan(path)]);
            }
            js::number_value(number)
        }
        Kind::Boolean => match value {
            Value::Bool(_) => value.clone(),
            _ => return Err(vec![invalid_type("boolean", value, path)]),
        },
        Kind::Date => return Err(vec![invalid_type("date", value, path)]),
        Kind::CoerceDate => match js::new_date(value) {
            Some(date) => Value::String(js::iso(&date)),
            None => {
                return Err(vec![
                    json!({ "code": "invalid_date", "path": path, "message": "Invalid date" }),
                ]);
            }
        },
        Kind::Enum(options) => match value {
            Value::String(text) if options.contains(&text.as_str()) => value.clone(),
            Value::String(text) => {
                return Err(vec![json!({
                    "received": text,
                    "code": "invalid_enum_value",
                    "options": options,
                    "path": path,
                    "message": format!("Invalid enum value. Expected {}, received '{}'", join_values(options), text),
                })]);
            }
            _ => return Err(vec![invalid_type(&join_values(options), value, path)]),
        },
        Kind::Json => value.clone(),
        Kind::Union(options) => return check_union(options, value, path),
        Kind::Literal(expected) => {
            if value != expected {
                return Err(vec![json!({
                    "received": value,
                    "code": "invalid_literal",
                    "expected": expected,
                    "path": path,
                    "message": format!("Invalid literal value, expected {expected}"),
                })]);
            }
            value.clone()
        }
        Kind::Null => match value {
            Value::Null => Value::Null,
            _ => return Err(vec![invalid_type("null", value, path)]),
        },
    };

    let mut issues = Vec::new();
    for check in &field.checks {
        match (check, &parsed) {
            (Check::MinLen(min), Value::String(text)) => {
                if js::length(text) < *min {
                    issues.push(json!({
                        "code": "too_small", "minimum": min, "type": "string", "inclusive": true, "exact": false,
                        "message": format!("String must contain at least {min} character(s)"), "path": path,
                    }));
                }
            }
            (Check::MaxLen(max), Value::String(text)) => {
                if js::length(text) > *max {
                    issues.push(json!({
                        "code": "too_big", "maximum": max, "type": "string", "inclusive": true, "exact": false,
                        "message": format!("String must contain at most {max} character(s)"), "path": path,
                    }));
                }
            }
            (Check::Email, Value::String(text)) => {
                if !is_email(text) {
                    issues.push(json!({
                        "validation": "email", "code": "invalid_string", "message": "Invalid email", "path": path,
                    }));
                }
            }
            (Check::Min(min, inclusive), Value::Number(number)) => {
                let number = number.as_f64().unwrap_or(f64::NAN);
                let too_small = if *inclusive { number < *min } else { number <= *min };
                if too_small {
                    let minimum = js::number_value(*min);
                    let message = if *inclusive {
                        format!(
                            "Number must be greater than or equal to {}",
                            js::number_to_string(*min)
                        )
                    } else {
                        format!("Number must be greater than {}", js::number_to_string(*min))
                    };
                    issues.push(json!({
                        "code": "too_small", "minimum": minimum, "type": "number", "inclusive": inclusive,
                        "exact": false, "message": message, "path": path,
                    }));
                }
            }
            (Check::Max(max, inclusive), Value::Number(number)) => {
                let number = number.as_f64().unwrap_or(f64::NAN);
                let too_big = if *inclusive { number > *max } else { number >= *max };
                if too_big {
                    let maximum = js::number_value(*max);
                    let message = if *inclusive {
                        format!(
                            "Number must be less than or equal to {}",
                            js::number_to_string(*max)
                        )
                    } else {
                        format!("Number must be less than {}", js::number_to_string(*max))
                    };
                    issues.push(json!({
                        "code": "too_big", "maximum": maximum, "type": "number", "inclusive": inclusive,
                        "exact": false, "message": message, "path": path,
                    }));
                }
            }
            (Check::Int, Value::Number(number)) => {
                let number = number.as_f64().unwrap_or(f64::NAN);
                if number.fract() != 0.0 {
                    issues.push(json!({
                        "code": "invalid_type", "expected": "integer", "received": "float",
                        "message": "Expected integer, received float", "path": path,
                    }));
                }
            }
            (Check::MinLenMessage(min, message), Value::String(text)) if js::length(text) < *min => {
                issues.push(json!({
                    "code": "too_small", "minimum": min, "type": "string", "inclusive": true, "exact": false,
                    "message": message, "path": path,
                }));
            }
            _ => {}
        }
    }
    if issues.is_empty() {
        Ok(parsed)
    } else {
        Err(issues)
    }
}

fn expected_name(kind: &Kind) -> String {
    match kind {
        Kind::String => "string".into(),
        Kind::Number | Kind::CoerceNumber => "number".into(),
        Kind::Boolean => "boolean".into(),
        Kind::Date | Kind::CoerceDate => "date".into(),
        Kind::Enum(options) => join_values(options),
        Kind::Json => "unknown".into(),
        // Champ union ou littéral obligatoire et absent : aucun schéma porté n'en
        // a (zod rendrait invalid_union / invalid_literal)
        Kind::Union(_) => "union".into(),
        Kind::Literal(value) => value.to_string(),
        Kind::Null => "null".into(),
    }
}

/// ZodUnion : la valeur de la première option valide ; sinon les erreurs de la
/// première option du bon type dont un contrôle échoue (résultat « dirty » de
/// zod) ; sinon invalid_union avec les erreurs de chaque option (ZodError
/// sérialisée : { issues, name })
fn check_union(options: &[Field], value: &Value, path: &[Value]) -> Result<Value, Vec<Value>> {
    let mut dirty: Option<Vec<Value>> = None;
    let mut union_errors = Vec::new();
    for option in options {
        match check_value(option, value, path) {
            Ok(parsed) => return Ok(parsed),
            Err(issues) => {
                if dirty.is_none() && type_matches(&option.kind, value) {
                    dirty = Some(issues.clone());
                }
                union_errors.push(json!({ "issues": issues, "name": "ZodError" }));
            }
        }
    }
    if let Some(issues) = dirty {
        return Err(issues);
    }
    Err(vec![json!({
        "code": "invalid_union",
        "unionErrors": union_errors,
        "path": path,
        "message": "Invalid input",
    })])
}

/// La valeur a-t-elle le type de l'option (seuls ses contrôles peuvent alors échouer) ?
fn type_matches(kind: &Kind, value: &Value) -> bool {
    match kind {
        Kind::String => value.is_string(),
        Kind::Number => value.is_number(),
        Kind::CoerceNumber => !js::to_number(value).is_nan(),
        Kind::Boolean => value.is_boolean(),
        Kind::Date => false,
        Kind::CoerceDate => js::new_date(value).is_some(),
        Kind::Enum(options) => value.as_str().is_some_and(|text| options.contains(&text)),
        Kind::Json => true,
        Kind::Union(options) => options.iter().any(|option| type_matches(&option.kind, value)),
        Kind::Literal(expected) => value == expected,
        Kind::Null => value.is_null(),
    }
}

/// Type reçu selon zod (getParsedType)
fn received_name(value: &Value) -> &'static str {
    match value {
        Value::Null => "null",
        Value::Bool(_) => "boolean",
        Value::Number(_) => "number",
        Value::String(_) => "string",
        Value::Array(_) => "array",
        Value::Object(_) => "object",
    }
}

fn invalid_type(expected: &str, value: &Value, path: &[Value]) -> Value {
    let received = received_name(value);
    json!({
        "code": "invalid_type",
        "expected": expected,
        "received": received,
        "path": path,
        "message": format!("Expected {expected}, received {received}"),
    })
}

fn issue_nan(path: &[Value]) -> Value {
    json!({
        "code": "invalid_type",
        "expected": "number",
        "received": "nan",
        "path": path,
        "message": "Expected number, received nan",
    })
}

/// util.joinValues de zod : 'a' | 'b'
fn join_values(options: &[&str]) -> String {
    options
        .iter()
        .map(|option| format!("'{option}'"))
        .collect::<Vec<_>>()
        .join(" | ")
}

/// Expression régulière des courriels de zod 3.25, écrite à la main
/// (/^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i)
fn is_email(text: &str) -> bool {
    if text.starts_with('.') || text.contains("..") {
        return false;
    }
    let Some((local, domain)) = text.split_once('@') else {
        return false;
    };
    if domain.contains('@') {
        return false;
    }
    let local_ok = local
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || "_'+-.".contains(c))
        && local
            .chars()
            .last()
            .is_some_and(|c| c.is_ascii_alphanumeric() || "_+-".contains(c));
    let labels: Vec<&str> = domain.split('.').collect();
    if labels.len() < 2 {
        return false;
    }
    let (tld, rest) = labels.split_last().unwrap();
    let rest_ok = rest.iter().all(|label| {
        label.chars().next().is_some_and(|c| c.is_ascii_alphanumeric())
            && label.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
    });
    local_ok && rest_ok && tld.len() >= 2 && tld.chars().all(|c| c.is_ascii_alphabetic())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn contact_schema() -> Object {
        Object::new(vec![
            Field::int32("id").optional(),
            Field::int32("groupId"),
            Field::string("name").max_len(255),
            Field::string("email").max_len(255).nullable().optional(),
        ])
        .omit(&["id"])
    }

    #[test]
    fn champ_obligatoire_absent() {
        let issues = contact_schema().parse(&json!({ "groupId": 1 })).unwrap_err();
        assert_eq!(
            issues,
            vec![json!({
                "code": "invalid_type", "expected": "string", "received": "undefined",
                "path": ["name"], "message": "Required",
            })]
        );
    }

    #[test]
    fn champs_inconnus_retires_et_null_accepte() {
        let parsed = contact_schema()
            .parse(&json!({ "groupId": 2, "name": "Metz", "email": null, "autre": 1 }))
            .unwrap();
        assert_eq!(
            Value::Object(parsed),
            json!({ "groupId": 2, "name": "Metz", "email": null })
        );
    }

    #[test]
    fn entier_hors_limites_et_decimal() {
        let issues = contact_schema()
            .parse(&json!({ "groupId": 2.5, "name": "x" }))
            .unwrap_err();
        assert_eq!(issues[0]["message"], "Expected integer, received float");
        let issues = contact_schema()
            .parse(&json!({ "groupId": "1", "name": 3 }))
            .unwrap_err();
        assert_eq!(issues[0]["message"], "Expected number, received string");
        assert_eq!(issues[1]["message"], "Expected string, received number");
    }

    #[test]
    fn partiel_sans_valeur_par_defaut() {
        let schema = Object::new(vec![
            Field::coerce_number("quantity")
                .int()
                .positive()
                .default(json!(1)),
        ]);
        assert_eq!(
            Value::Object(schema.clone().parse(&json!({})).unwrap()),
            json!({ "quantity": 1 })
        );
        assert_eq!(
            Value::Object(schema.partial().parse(&json!({})).unwrap()),
            json!({})
        );
    }

    #[test]
    fn courriels() {
        assert!(is_email("paul@lactalis.test"));
        assert!(!is_email("paul@lactalis"));
        assert!(!is_email(".paul@x.fr"));
        assert!(!is_email("pa..ul@x.fr"));
    }

    // z.union([z.string().email(), z.literal(""), z.null()]).optional()
    fn email_union() -> Object {
        Object::new(vec![
            Field::union(
                "email",
                vec![
                    Field::string("").email(),
                    Field::literal("", json!("")),
                    Field::null(""),
                ],
            )
            .optional(),
        ])
    }

    #[test]
    fn union_premiere_option_valide() {
        for value in [json!("a@b.fr"), json!(""), json!(null)] {
            let parsed = email_union().parse(&json!({ "email": value })).unwrap();
            assert_eq!(parsed["email"], value);
        }
        assert!(email_union().parse(&json!({})).unwrap().is_empty());
    }

    #[test]
    fn union_option_du_bon_type_en_erreur() {
        // Le courriel invalide est une chaîne : seule l'erreur de format remonte
        let issues = email_union()
            .parse(&json!({ "email": "pas-un-courriel" }))
            .unwrap_err();
        assert_eq!(
            issues,
            vec![
                json!({ "validation": "email", "code": "invalid_string", "message": "Invalid email", "path": ["email"] })
            ]
        );
    }

    #[test]
    fn union_sans_option_possible() {
        // Valeur rendue par Node (POST /api/users, { "email": 5 })
        let issues = email_union().parse(&json!({ "email": 5 })).unwrap_err();
        let node: Value = serde_json::from_str(
            r#"[{"code":"invalid_union","unionErrors":[{"issues":[{"code":"invalid_type","expected":"string","received":"number","path":["email"],"message":"Expected string, received number"}],"name":"ZodError"},{"issues":[{"received":5,"code":"invalid_literal","expected":"","path":["email"],"message":"Invalid literal value, expected \"\""}],"name":"ZodError"},{"issues":[{"code":"invalid_type","expected":"null","received":"number","path":["email"],"message":"Expected null, received number"}],"name":"ZodError"}],"path":["email"],"message":"Invalid input"}]"#,
        )
        .unwrap();
        assert_eq!(serde_json::to_string(&issues).unwrap(), node.to_string());
    }

    #[test]
    fn longueur_minimale_avec_message() {
        let schema = Object::new(vec![
            Field::string("username").min_len_message(1, "L'identifiant est obligatoire"),
        ]);
        let issues = schema.parse(&json!({ "username": "" })).unwrap_err();
        assert_eq!(
            serde_json::to_string(&issues).unwrap(),
            r#"[{"code":"too_small","minimum":1,"type":"string","inclusive":true,"exact":false,"message":"L'identifiant est obligatoire","path":["username"]}]"#
        );
    }

    #[test]
    fn enumeration() {
        let schema = Object::new(vec![Field::enumeration("status", &["nouveau", "resolu"])]);
        let issues = schema.parse(&json!({ "status": "x" })).unwrap_err();
        assert_eq!(
            issues[0]["message"],
            "Invalid enum value. Expected 'nouveau' | 'resolu', received 'x'"
        );
    }
}
