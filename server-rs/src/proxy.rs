// Relais vers le serveur Node pour toutes les adresses que Rust ne sert pas
// encore. Méthode, adresse, en-têtes et corps passent tels quels, en flux ; la
// réponse revient telle quelle (Set-Cookie, redirections comprises).

use std::time::Duration;

use axum::body::Body;
use axum::extract::{ConnectInfo, Request, State};
use axum::http::{HeaderName, HeaderValue, StatusCode, Uri, header};
use axum::response::{IntoResponse, Response};
use hyper_util::client::legacy::Client;
use hyper_util::client::legacy::connect::HttpConnector;
use hyper_util::rt::TokioExecutor;
use std::net::SocketAddr;

use crate::AppState;

pub type ProxyClient = Client<HttpConnector, Body>;

// Certains appels attendent NocoDB ou un webhook jusqu'à 60 s côté Node
const UPSTREAM_TIMEOUT: Duration = Duration::from_secs(120);

// En-têtes propres à une connexion, à ne pas transmettre (RFC 9110, § 7.6.1)
const HOP_BY_HOP: [&str; 8] = [
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
];

pub fn client() -> ProxyClient {
    let mut connector = HttpConnector::new();
    connector.set_nodelay(true);
    Client::builder(TokioExecutor::new()).build(connector)
}

pub async fn forward(State(state): State<AppState>, request: Request) -> Response {
    let peer = request
        .extensions()
        .get::<ConnectInfo<SocketAddr>>()
        .map(|info| info.0.ip());
    let (mut parts, body) = request.into_parts();

    let path = parts.uri.path_and_query().map(|pq| pq.as_str()).unwrap_or("/");
    parts.uri = match format!("{}{}", state.config.node_upstream, path).parse::<Uri>() {
        Ok(uri) => uri,
        Err(_) => return StatusCode::BAD_REQUEST.into_response(),
    };
    for name in HOP_BY_HOP {
        parts.headers.remove(name);
    }
    if let Some(ip) = peer {
        let forwarded = match parts.headers.get("x-forwarded-for").and_then(|v| v.to_str().ok()) {
            Some(existing) => format!("{existing}, {ip}"),
            None => ip.to_string(),
        };
        if let Ok(value) = HeaderValue::from_str(&forwarded) {
            parts
                .headers
                .insert(HeaderName::from_static("x-forwarded-for"), value);
        }
    }

    let upstream = Request::from_parts(parts, body);
    match tokio::time::timeout(UPSTREAM_TIMEOUT, state.proxy.request(upstream)).await {
        Ok(Ok(response)) => {
            let (mut parts, body) = response.into_parts();
            for name in HOP_BY_HOP {
                parts.headers.remove(name);
            }
            Response::from_parts(parts, Body::new(body))
        }
        Ok(Err(error)) => {
            tracing::error!(%error, "serveur Node injoignable");
            unavailable("Service momentanément indisponible")
        }
        Err(_) => {
            tracing::error!("serveur Node : délai dépassé");
            (
                StatusCode::GATEWAY_TIMEOUT,
                json_message("Le serveur met trop de temps à répondre"),
            )
                .into_response()
        }
    }
}

fn unavailable(message: &str) -> Response {
    (StatusCode::BAD_GATEWAY, json_message(message)).into_response()
}

fn json_message(message: &str) -> ([(header::HeaderName, &'static str); 1], String) {
    (
        [(header::CONTENT_TYPE, "application/json; charset=utf-8")],
        serde_json::json!({ "message": message }).to_string(),
    )
}
