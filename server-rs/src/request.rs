// Lecture des requêtes au comportement d'Express :
// - corps : express.json() / express.urlencoded() ; autre type de contenu → {} ;
// - paramètres de l'adresse : req.query (valeurs répétées jointes par « , »,
//   comme String(tableau)) ;
// - identifiants : parseInt(req.params.id).

use std::collections::HashMap;

use axum::body::Bytes;
use axum::extract::{FromRequest, FromRequestParts, Request};
use axum::http::StatusCode;
use axum::http::header::CONTENT_TYPE;
use axum::http::request::Parts;
use serde_json::{Map, Value};

use crate::error::AppError;

/// req.body
pub struct JsonBody(pub Value);

impl<S: Send + Sync> FromRequest<S> for JsonBody {
    type Rejection = AppError;

    async fn from_request(request: Request, state: &S) -> Result<Self, Self::Rejection> {
        let content_type = request
            .headers()
            .get(CONTENT_TYPE)
            .and_then(|v| v.to_str().ok())
            .map(|v| v.split(';').next().unwrap_or("").trim().to_ascii_lowercase())
            .unwrap_or_default();
        let bytes = Bytes::from_request(request, state)
            .await
            .map_err(|_| AppError::new(StatusCode::PAYLOAD_TOO_LARGE, "request entity too large"))?;
        let body = match content_type.as_str() {
            "application/json" => parse_json(&bytes)?,
            "application/x-www-form-urlencoded" => Value::Object(
                form_urlencoded::parse(&bytes)
                    .map(|(key, value)| (key.into_owned(), Value::String(value.into_owned())))
                    .collect(),
            ),
            _ => Value::Object(Map::new()),
        };
        Ok(Self(body))
    }
}

/// body-parser en mode strict : objet ou tableau, corps vide → {}
fn parse_json(bytes: &[u8]) -> Result<Value, AppError> {
    let text = std::str::from_utf8(bytes).map_err(|_| AppError::bad_request("Invalid UTF-8"))?;
    let trimmed = text.trim_start();
    if trimmed.is_empty() {
        return Ok(Value::Object(Map::new()));
    }
    if !trimmed.starts_with(['{', '[']) {
        let token = trimmed.chars().next().unwrap_or(' ');
        return Err(AppError::bad_request(&format!(
            "Unexpected token '{token}', \"{}\" is not valid JSON",
            trimmed.chars().take(10).collect::<String>()
        )));
    }
    serde_json::from_str(trimmed).map_err(|error| AppError::bad_request(&error.to_string()))
}

/// req.query, aplati
pub struct JsQuery(pub HashMap<String, String>);

impl JsQuery {
    pub fn get(&self, key: &str) -> Option<&str> {
        self.0.get(key).map(String::as_str)
    }

    /// `if (req.query.x)` : présent et non vide
    pub fn truthy(&self, key: &str) -> Option<&str> {
        self.get(key).filter(|value| !value.is_empty())
    }
}

impl<S: Send + Sync> FromRequestParts<S> for JsQuery {
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        let mut values: HashMap<String, String> = HashMap::new();
        if let Some(query) = parts.uri.query() {
            for (key, value) in form_urlencoded::parse(query.as_bytes()) {
                values
                    .entry(key.into_owned())
                    .and_modify(|existing| {
                        existing.push(',');
                        existing.push_str(&value);
                    })
                    .or_insert_with(|| value.into_owned());
            }
        }
        Ok(Self(values))
    }
}

/// parseInt(texte) utilisé comme identifiant integer : NaN ou hors limites fait
/// échouer la requête SQL côté Node, d'où son message 500
pub fn int_id(raw: &str, message: &str) -> Result<i32, AppError> {
    crate::js::parse_int(raw)
        .filter(|n| *n >= f64::from(i32::MIN) && *n <= f64::from(i32::MAX))
        .map(|n| n as i32)
        .ok_or_else(|| AppError::internal(message))
}
