// Correspondance des adresses à la manière d'Express : insensible à la casse, et une
// barre oblique finale tolérée (« /api/Orders/ » sert « /api/orders »), alors
// qu'axum compare exactement. Quand aucune route ne correspond, on cherche celle
// qu'Express aurait choisie et on rejoue la requête sur l'adresse canonique ; les
// paramètres gardent leur casse d'origine, comme req.params.

use std::sync::{LazyLock, OnceLock};

use axum::Router;
use axum::extract::Request;
use axum::http::Uri;
use axum::response::Response;
use tower::ServiceExt;

include!(concat!(env!("OUT_DIR"), "/route_patterns.rs"));

/// Motif en minuscules → motif déclaré
static MATCHER: LazyLock<matchit::Router<&'static str>> = LazyLock::new(|| {
    let mut matcher = matchit::Router::new();
    for pattern in ROUTE_PATTERNS {
        if let Err(error) = matcher.insert(lowercase_static(pattern), *pattern) {
            tracing::warn!(%error, pattern, "motif d'adresse ignoré");
        }
    }
    matcher
});

/// Adresse demandée, avant sa réécriture en adresse canonique
#[derive(Clone)]
pub struct OriginalPath(pub String);

/// Routeur de l'API, pour rejouer une requête sur l'adresse canonique
static API: OnceLock<Router> = OnceLock::new();

pub fn install(api: Router) {
    let _ = API.set(api);
}

/// Segments fixes en minuscules, paramètres ({id}) inchangés
fn lowercase_static(pattern: &str) -> String {
    pattern
        .split('/')
        .map(|segment| {
            if segment.starts_with('{') {
                segment.to_string()
            } else {
                segment.to_ascii_lowercase()
            }
        })
        .collect::<Vec<_>>()
        .join("/")
}

/// Adresse qu'Express servirait pour `path`, si elle diffère de `path`
pub fn canonical_path(path: &str) -> Option<String> {
    let trimmed = match path.strip_suffix('/') {
        Some(stripped) if !stripped.is_empty() && !stripped.ends_with('/') => stripped,
        _ => path,
    };
    let lowered = trimmed.to_ascii_lowercase();
    let matched = MATCHER.at(&lowered).ok()?;
    let canonical = matched
        .value
        .split('/')
        .zip(trimmed.split('/'))
        .map(|(pattern, original)| {
            if pattern.starts_with('{') {
                original
            } else {
                pattern
            }
        })
        .collect::<Vec<_>>()
        .join("/");
    (canonical != path).then_some(canonical)
}

/// Rejoue la requête sur l'adresse canonique ; rend la requête intacte s'il n'y en a pas
pub async fn redispatch(mut request: Request) -> Result<Response, Request> {
    let Some(api) = API.get() else {
        return Err(request);
    };
    let Some(path) = canonical_path(request.uri().path()) else {
        return Err(request);
    };
    let path_and_query = match request.uri().query() {
        Some(query) => format!("{path}?{query}"),
        None => path,
    };
    let Ok(uri) = path_and_query.parse::<Uri>() else {
        return Err(request);
    };
    let original = request.uri().path().to_string();
    request.extensions_mut().insert(OriginalPath(original));
    *request.uri_mut() = uri;
    Ok(api
        .clone()
        .oneshot(request)
        .await
        .unwrap_or_else(|never| match never {}))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn adresses_comme_express() {
        assert_eq!(
            canonical_path("/api/ext/v1/stores/").as_deref(),
            Some("/api/ext/v1/stores")
        );
        assert_eq!(
            canonical_path("/api/ext/v1/SUPPLIERS").as_deref(),
            Some("/api/ext/v1/suppliers")
        );
        assert_eq!(
            canonical_path("/api/ext/v1/Deliveries/5/").as_deref(),
            Some("/api/ext/v1/deliveries/5")
        );
        assert_eq!(
            canonical_path("/API/Backups/Backup_A.SQL/download").as_deref(),
            Some("/api/backups/Backup_A.SQL/download")
        );
        // Déjà canonique, ou deux barres finales (refusées par Express) : rien à faire
        assert_eq!(canonical_path("/api/orders"), None);
        assert_eq!(canonical_path("/api/orders//"), None);
        assert_eq!(canonical_path("/api/inconnue/"), None);
    }

    #[test]
    fn motifs_extraits_des_modules() {
        assert!(ROUTE_PATTERNS.contains(&"/api/orders"));
        assert!(ROUTE_PATTERNS.contains(&"/api/dlc-products/{id}/stock-epuise"));
        assert!(ROUTE_PATTERNS.contains(&"/api/health"));
        // Une entrée par adresse, toutes méthodes confondues
        assert!(ROUTE_PATTERNS.len() > 80, "{} motifs", ROUTE_PATTERNS.len());
    }
}
