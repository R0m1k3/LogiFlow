// Erreurs de l'API : { "message": … } avec le code HTTP, comme les gestionnaires Node.

use axum::Json;
use axum::http::{HeaderValue, StatusCode, header};
use axum::response::{IntoResponse, Response};
use serde_json::{Value, json};

#[derive(Debug)]
pub struct AppError {
    pub status: StatusCode,
    pub body: Value,
}

pub type ApiResult<T = Response> = Result<T, AppError>;

impl AppError {
    pub fn new(status: StatusCode, message: &str) -> Self {
        Self {
            status,
            body: json!({ "message": message }),
        }
    }
    pub fn with_body(status: StatusCode, body: Value) -> Self {
        Self { status, body }
    }
    /// requireAuth (server/localAuth.ts)
    pub fn unauthorized() -> Self {
        Self::new(StatusCode::UNAUTHORIZED, "Authentification requise")
    }
    pub fn bad_request(message: &str) -> Self {
        Self::new(StatusCode::BAD_REQUEST, message)
    }
    pub fn forbidden(message: &str) -> Self {
        Self::new(StatusCode::FORBIDDEN, message)
    }
    pub fn not_found(message: &str) -> Self {
        Self::new(StatusCode::NOT_FOUND, message)
    }
    pub fn internal(message: &str) -> Self {
        Self::new(StatusCode::INTERNAL_SERVER_ERROR, message)
    }
    /// Erreur zod renvoyée telle quelle : { message, errors }
    pub fn validation(message: &str, issues: Vec<Value>) -> Self {
        Self::with_body(
            StatusCode::BAD_REQUEST,
            json!({ "message": message, "errors": issues }),
        )
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        (self.status, Json(self.body)).into_response()
    }
}

/// Erreur imprévue (base, réseau) : journalisée, puis le message 500 du gestionnaire Node
pub trait OrInternal<T> {
    fn or_500(self, message: &str) -> Result<T, AppError>;
}

impl<T, E: std::fmt::Display> OrInternal<T> for Result<T, E> {
    fn or_500(self, message: &str) -> Result<T, AppError> {
        self.map_err(|error| {
            tracing::error!(%error, "{message}");
            AppError::internal(message)
        })
    }
}

/// res.json(undefined) : 200, type JSON, corps vide (ligne absente après une mise à jour)
pub fn empty_json() -> Response {
    let mut response = StatusCode::OK.into_response();
    response.headers_mut().insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static("application/json; charset=utf-8"),
    );
    response
}

/// Réponse JSON d'une valeur sérialisable, ou corps vide si elle est absente
pub fn json_or_empty<T: serde::Serialize>(value: Option<T>) -> Response {
    match value {
        Some(value) => Json(value).into_response(),
        None => empty_json(),
    }
}
