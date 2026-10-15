// Fichiers de l'interface (dist/public), comme server/index.production.ts :
// - /assets/… : noms hachés par Vite, cache d'un an ;
// - autres fichiers publics : revalidés à chaque visite (index.html : no-cache) ;
// - toute autre adresse hors /api : index.html, que l'application React route.
// Mêmes en-têtes qu'Express (type, ETag faible taille-date, Last-Modified, 304).

use std::path::{Component, Path, PathBuf};
use std::time::UNIX_EPOCH;

use axum::body::Body;
use axum::extract::{Request, State};
use axum::http::{HeaderMap, HeaderValue, Method, StatusCode, header};
use axum::response::{IntoResponse, Response};
use chrono::{DateTime, Utc};

use crate::{AppState, proxy};

const ASSETS_CACHE: &str = "public, max-age=31536000, immutable";
const DEFAULT_CACHE: &str = "public, max-age=0";
const NO_CACHE: &str = "no-cache";

/// Tout ce que le routeur ne sert pas : interface, ou relais vers Node
pub async fn fallback(state: State<AppState>, request: Request) -> Response {
    let path = request.uri().path().to_string();
    if path.starts_with("/api/") || path == "/api" || !matches!(*request.method(), Method::GET | Method::HEAD)
    {
        return proxy::forward(state, request).await;
    }
    serve(
        &state.config.static_dir,
        &path,
        request.method(),
        request.headers(),
    )
    .await
}

async fn serve(root: &Path, path: &str, method: &Method, headers: &HeaderMap) -> Response {
    if let Some(relative) = safe_relative(path) {
        let is_asset = relative.starts_with("assets");
        let file = root.join(&relative);
        if let Some(response) = send_file(&file, method, headers, |name| {
            if is_asset {
                ASSETS_CACHE
            } else if name.ends_with(".html") {
                NO_CACHE
            } else {
                DEFAULT_CACHE
            }
        })
        .await
        {
            return response;
        }
    }
    // Retour à l'application : index.html, jamais mis en cache
    send_file(&root.join("index.html"), method, headers, |_| NO_CACHE)
        .await
        .unwrap_or_else(|| (StatusCode::INTERNAL_SERVER_ERROR, "Error loading application").into_response())
}

/// Chemin relatif sûr : décodé, sans « .. », sans fichier caché (comme express.static)
fn safe_relative(path: &str) -> Option<PathBuf> {
    let decoded = percent_decode(path)?;
    let mut relative = PathBuf::new();
    for component in Path::new(&decoded).components() {
        match component {
            Component::RootDir => {}
            Component::Normal(part) => {
                if part.to_string_lossy().starts_with('.') {
                    return None;
                }
                relative.push(part);
            }
            _ => return None,
        }
    }
    if relative.as_os_str().is_empty() {
        None
    } else {
        Some(relative)
    }
}

fn percent_decode(input: &str) -> Option<String> {
    let bytes = input.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' {
            let hex = std::str::from_utf8(bytes.get(i + 1..i + 3)?).ok()?;
            out.push(u8::from_str_radix(hex, 16).ok()?);
            i += 3;
        } else {
            out.push(bytes[i]);
            i += 1;
        }
    }
    String::from_utf8(out).ok()
}

async fn send_file(
    file: &Path,
    method: &Method,
    request_headers: &HeaderMap,
    cache_control: impl Fn(&str) -> &'static str,
) -> Option<Response> {
    let metadata = tokio::fs::metadata(file).await.ok()?;
    if !metadata.is_file() {
        return None;
    }
    let name = file.file_name()?.to_string_lossy().to_string();
    let modified = metadata.modified().ok()?;
    let mtime_ms = modified.duration_since(UNIX_EPOCH).ok()?.as_millis();
    let etag = format!("W/\"{:x}-{:x}\"", metadata.len(), mtime_ms);
    let last_modified = DateTime::<Utc>::from(modified)
        .format("%a, %d %b %Y %H:%M:%S GMT")
        .to_string();

    let mut headers = HeaderMap::new();
    headers.insert(header::ACCEPT_RANGES, HeaderValue::from_static("bytes"));
    headers.insert(
        header::CACHE_CONTROL,
        HeaderValue::from_static(cache_control(&name)),
    );
    headers.insert(header::LAST_MODIFIED, HeaderValue::from_str(&last_modified).ok()?);
    headers.insert(header::ETAG, HeaderValue::from_str(&etag).ok()?);
    headers.insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static(content_type(&name)),
    );

    if is_fresh(request_headers, &etag, modified) {
        return Some((StatusCode::NOT_MODIFIED, headers).into_response());
    }
    headers.insert(header::CONTENT_LENGTH, HeaderValue::from(metadata.len()));
    if *method == Method::HEAD {
        return Some((StatusCode::OK, headers).into_response());
    }
    let content = tokio::fs::read(file).await.ok()?;
    Some((StatusCode::OK, headers, Body::from(content)).into_response())
}

/// Même règle que le paquet « fresh » d'Express : If-None-Match, sinon If-Modified-Since
fn is_fresh(request: &HeaderMap, etag: &str, modified: std::time::SystemTime) -> bool {
    let cache_control = request
        .get(header::CACHE_CONTROL)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    if cache_control.contains("no-cache") {
        return false;
    }
    if let Some(none_match) = request.get(header::IF_NONE_MATCH).and_then(|v| v.to_str().ok()) {
        let bare = etag.trim_start_matches("W/");
        return none_match.trim() == "*"
            || none_match
                .split(',')
                .any(|candidate| candidate.trim().trim_start_matches("W/") == bare);
    }
    if let Some(since) = request
        .get(header::IF_MODIFIED_SINCE)
        .and_then(|v| v.to_str().ok())
    {
        if let Ok(since) = DateTime::parse_from_rfc2822(since) {
            let modified = DateTime::<Utc>::from(modified);
            return modified.timestamp() <= since.timestamp();
        }
    }
    false
}

/// Types renvoyés par express.static (paquet mime 1.x, avec charset pour texte, JS et JSON)
fn content_type(name: &str) -> &'static str {
    match name.rsplit('.').next().unwrap_or("") {
        "html" | "htm" => "text/html; charset=UTF-8",
        "js" | "mjs" => "application/javascript; charset=UTF-8",
        "css" => "text/css; charset=UTF-8",
        "json" | "map" => "application/json; charset=UTF-8",
        "txt" => "text/plain; charset=UTF-8",
        "svg" => "image/svg+xml",
        "ico" => "image/x-icon",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "webmanifest" => "application/manifest+json",
        "woff" => "font/woff",
        "woff2" => "font/woff2",
        "pdf" => "application/pdf",
        _ => "application/octet-stream",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn refuse_les_chemins_hors_du_dossier() {
        assert_eq!(safe_relative("/../etc/passwd"), None);
        assert_eq!(safe_relative("/assets/%2e%2e/x"), None);
        assert_eq!(safe_relative("/.env"), None);
        assert_eq!(safe_relative("/"), None);
        assert_eq!(
            safe_relative("/assets/app.js"),
            Some(PathBuf::from("assets/app.js"))
        );
    }

    #[test]
    fn types_comme_express() {
        assert_eq!(
            content_type("index-abc.js"),
            "application/javascript; charset=UTF-8"
        );
        assert_eq!(content_type("favicon.ico"), "image/x-icon");
    }
}
