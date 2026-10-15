// En-têtes des réponses de l'API servies par Rust, identiques à celles d'Express :
// - Cache-Control: private, no-cache (server/routes.ts, middleware /api), sauf
//   sous /api/ext/v1 (API externe, enregistrée avant ce middleware) ;
// - JSON en « application/json; charset=utf-8 » ;
// - ETag faible calculé sur le corps (paquet etag d'Express) et 304 si le
//   navigateur a déjà la même réponse.

use axum::body::{Body, to_bytes};
use axum::extract::Request;
use axum::http::{HeaderMap, HeaderValue, Method, StatusCode, header};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};
use base64::Engine;
use sha1::{Digest, Sha1};

// Au-delà, le corps n'est pas mis en mémoire pour l'ETag (exports volumineux)
const ETAG_MAX_BODY: usize = 50 * 1024 * 1024;

pub async fn api_response_headers(request: Request, next: Next) -> Response {
    let method = request.method().clone();
    let request_headers = request.headers().clone();
    let external_api = is_external_api(request.uri().path());
    let response = next.run(request).await;
    let (mut parts, body) = response.into_parts();

    if !external_api {
        parts
            .headers
            .entry(header::CACHE_CONTROL)
            .or_insert(HeaderValue::from_static("private, no-cache"));
    }
    if parts
        .headers
        .get(header::CONTENT_TYPE)
        .is_some_and(|v| v == "application/json")
    {
        parts.headers.insert(
            header::CONTENT_TYPE,
            HeaderValue::from_static("application/json; charset=utf-8"),
        );
    }
    if parts.headers.contains_key(header::ETAG) || parts.headers.contains_key(header::CONTENT_DISPOSITION) {
        return Response::from_parts(parts, body);
    }

    let bytes = match to_bytes(body, ETAG_MAX_BODY).await {
        Ok(bytes) => bytes,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Réponse trop volumineuse").into_response(),
    };
    let etag = express_etag(&bytes);
    if let Ok(value) = HeaderValue::from_str(&etag) {
        parts.headers.insert(header::ETAG, value);
    }
    if matches!(method, Method::GET | Method::HEAD)
        && (parts.status.is_success() || parts.status == StatusCode::NOT_MODIFIED)
        && is_fresh(&request_headers, &etag)
    {
        parts.status = StatusCode::NOT_MODIFIED;
        for name in [
            header::CONTENT_TYPE,
            header::CONTENT_LENGTH,
            header::TRANSFER_ENCODING,
        ] {
            parts.headers.remove(name);
        }
        return Response::from_parts(parts, Body::empty());
    }
    Response::from_parts(parts, Body::from(bytes))
}

/// Adresse de l'API externe (/api/ext/v1…) : Node l'enregistre avant son
/// middleware /api, ses réponses n'ont donc pas de Cache-Control
fn is_external_api(path: &str) -> bool {
    let prefix = crate::modules::external_api::EXTERNAL_API_PREFIX;
    path.strip_prefix(prefix)
        .is_some_and(|rest| rest.is_empty() || rest.starts_with('/'))
}

/// W/"<taille en hexadécimal>-<SHA-1 base64, 27 caractères>", comme etag(body, { weak: true })
pub fn express_etag(body: &[u8]) -> String {
    let hash = base64::engine::general_purpose::STANDARD.encode(Sha1::digest(body));
    format!("W/\"{:x}-{}\"", body.len(), &hash[..27])
}

fn is_fresh(request: &HeaderMap, etag: &str) -> bool {
    let cache_control = request
        .get(header::CACHE_CONTROL)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    if cache_control.contains("no-cache") {
        return false;
    }
    let Some(none_match) = request.get(header::IF_NONE_MATCH).and_then(|v| v.to_str().ok()) else {
        return false;
    };
    let bare = etag.trim_start_matches("W/");
    none_match.trim() == "*"
        || none_match
            .split(',')
            .any(|candidate| candidate.trim().trim_start_matches("W/") == bare)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn etag_identique_a_express() {
        // Valeurs produites par require('etag')(…, { weak: true }) dans Node
        assert_eq!(express_etag(b""), "W/\"0-2jmj7l5rSw0yVb/vlWAYkK/YBwk\"");
        assert_eq!(
            express_etag(b"{\"showDefault\":false}"),
            express_etag(b"{\"showDefault\":false}")
        );
    }
}
