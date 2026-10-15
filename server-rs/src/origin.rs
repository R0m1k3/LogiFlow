// Protection des requêtes d'écriture contre les sites tiers (décision R4).
//
// Le cookie de session est SameSite=Lax : un autre site ne peut pas l'envoyer
// dans un POST de formulaire ou un fetch. Ce contrôle ajoute une seconde
// barrière sans rien changer à l'interface : toute requête /api qui n'est pas
// une lecture est refusée (403) si le navigateur indique qu'elle vient d'un
// autre site.
//
// - Sec-Fetch-Site (navigateurs récents) : « same-origin » ou « none » acceptés ;
//   ne dépend pas de l'en-tête Host, que nginx peut réécrire.
// - Sinon, en-tête Origin : accepté s'il est absent (outils, n8n, curl), ou si
//   son hôte est celui de la requête (Host ou X-Forwarded-Host).
// - Dans les deux cas, les origines de ALLOWED_ORIGINS sont acceptées.
// - /api/ext/ (API externe, clé d'API sans cookie) n'est pas concerné.

use axum::extract::{Request, State};
use axum::http::{HeaderMap, HeaderValue, Method, StatusCode, header};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};

use crate::AppState;

pub async fn check(State(state): State<AppState>, request: Request, next: Next) -> Response {
    let path = request.uri().path();
    let guarded = !matches!(*request.method(), Method::GET | Method::HEAD | Method::OPTIONS)
        && is_api(path)
        && !is_external_api(path);
    if guarded && !allowed(request.headers(), &state.config.allowed_origins) {
        tracing::warn!(
            method = %request.method(),
            path,
            origin = ?request.headers().get(header::ORIGIN),
            "requête d'écriture d'une autre origine refusée"
        );
        return refused();
    }
    next.run(request).await
}

fn is_api(path: &str) -> bool {
    let lowered = path.to_ascii_lowercase();
    lowered == "/api" || lowered.starts_with("/api/")
}

fn is_external_api(path: &str) -> bool {
    path.to_ascii_lowercase().starts_with("/api/ext/")
}

fn allowed(headers: &HeaderMap, allowed_origins: &[String]) -> bool {
    let origin =
        header_text(headers, header::ORIGIN.as_str()).map(|o| o.trim_end_matches('/').to_ascii_lowercase());
    if origin.as_ref().is_some_and(|o| allowed_origins.contains(o)) {
        return true;
    }
    if let Some(site) = header_text(headers, "sec-fetch-site") {
        return matches!(site.to_ascii_lowercase().as_str(), "same-origin" | "none");
    }
    let Some(origin) = origin else {
        return true;
    };
    let Some(origin_host) = origin.split_once("://").map(|(_, host)| host) else {
        // « null » (iframe isolée, fichier local) ou valeur illisible
        return false;
    };
    ["x-forwarded-host", header::HOST.as_str()]
        .into_iter()
        .filter_map(|name| header_text(headers, name))
        .flat_map(|value| value.split(','))
        .any(|host| host.trim().eq_ignore_ascii_case(origin_host))
}

fn header_text<'a>(headers: &'a HeaderMap, name: &str) -> Option<&'a str> {
    headers.get(name).and_then(|value| value.to_str().ok())
}

fn refused() -> Response {
    (
        StatusCode::FORBIDDEN,
        [
            (
                header::CACHE_CONTROL,
                HeaderValue::from_static("private, no-cache"),
            ),
            (
                header::CONTENT_TYPE,
                HeaderValue::from_static("application/json; charset=utf-8"),
            ),
        ],
        r#"{"message":"Origine de la requête non autorisée"}"#,
    )
        .into_response()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn headers(pairs: &[(&'static str, &'static str)]) -> HeaderMap {
        let mut map = HeaderMap::new();
        for (name, value) in pairs {
            map.insert(*name, HeaderValue::from_static(value));
        }
        map
    }

    #[test]
    fn sec_fetch_site() {
        assert!(allowed(&headers(&[("sec-fetch-site", "same-origin")]), &[]));
        assert!(allowed(&headers(&[("sec-fetch-site", "none")]), &[]));
        assert!(!allowed(
            &headers(&[
                ("sec-fetch-site", "cross-site"),
                ("origin", "https://evil.example")
            ]),
            &[]
        ));
        assert!(!allowed(
            &headers(&[
                ("sec-fetch-site", "same-site"),
                ("origin", "https://autre.logiflow.fr")
            ]),
            &[]
        ));
        // Origine déclarée dans ALLOWED_ORIGINS
        assert!(allowed(
            &headers(&[
                ("sec-fetch-site", "same-site"),
                ("origin", "https://autre.logiflow.fr/")
            ]),
            &["https://autre.logiflow.fr".to_string()]
        ));
    }

    #[test]
    fn en_tete_origin() {
        // Sans Origin : outils et services (n8n, curl)
        assert!(allowed(&headers(&[]), &[]));
        assert!(allowed(
            &headers(&[("origin", "https://logiflow.fr"), ("host", "logiflow.fr")]),
            &[]
        ));
        assert!(allowed(
            &headers(&[("origin", "http://localhost:3000"), ("host", "localhost:3000")]),
            &[]
        ));
        // nginx qui réécrit Host mais transmet X-Forwarded-Host
        assert!(allowed(
            &headers(&[
                ("origin", "https://LogiFlow.fr"),
                ("host", "logiflow:3000"),
                ("x-forwarded-host", "logiflow.fr")
            ]),
            &[]
        ));
        assert!(!allowed(
            &headers(&[("origin", "https://evil.example"), ("host", "logiflow.fr")]),
            &[]
        ));
        assert!(!allowed(
            &headers(&[("origin", "null"), ("host", "logiflow.fr")]),
            &[]
        ));
    }

    #[test]
    fn adresses_concernees() {
        assert!(is_api("/api/orders"));
        assert!(is_api("/API/Orders"));
        assert!(!is_api("/apiculture"));
        assert!(is_external_api("/api/ext/v1/deliveries"));
        assert!(is_external_api("/API/Ext/v1/deliveries"));
    }
}
