// Connexion et session : POST /api/login, GET et POST /api/logout, GET /api/user,
// GET /api/default-credentials-check (server/localAuth.ts : c'est lui que la
// production exécute ; localAuth.production.ts n'est jamais chargé).
//
// Les sessions restent celles d'express-session + connect-pg-simple, dans les
// deux sens tant que les deux serveurs tournent : même ligne dans la table
// sessions, même cookie connect.sid signé (docs/PLAN-MIGRATION-RUST.md,
// « Sessions partagées entre Node et Rust »). La lecture de la session est dans
// crate::auth.
//
// Non reporté (décision R3, audit AUTH-04) : le mot de passe de développement
// « admin.salt » accepté pour « admin », et la création du compte admin/admin au
// démarrage. Non reporté non plus : la sauvegarde quotidienne lancée après
// chaque connexion (backupService.checkAndPerformDailyBackup) ; la vérification
// horaire de Node continue de la faire.

use axum::extract::State;
use axum::http::{HeaderMap, HeaderValue, StatusCode, Uri, header};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use base64::Engine;
use chrono::{DateTime, Duration, Utc};
use rand::RngCore;
use serde_json::{Value, json};
use subtle::ConstantTimeEq;

use crate::AppState;
use crate::auth::{self, MaybeUser, SESSION_COOKIE};
use crate::db::{self, Table};
use crate::error::{ApiResult, AppError};
use crate::js;
use crate::request::JsonBody;
use crate::schema::UsersRow;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/login", post(login))
        .route("/api/logout", get(logout).post(logout))
        .route("/api/user", get(current_user))
        .route("/api/default-credentials-check", get(default_credentials_check))
}

const REFUSED: &str = "Identifiant ou mot de passe incorrect";

// ---------- Mots de passe (crypto.scrypt de Node) ----------

/// N = 16384, r = 8, p = 1, clé de 64 octets : les valeurs par défaut de crypto.scrypt
const SCRYPT_LOG_N: u8 = 14;
const KEY_LEN: usize = 64;

fn derive(password: &str, salt: &str) -> [u8; KEY_LEN] {
    let params = scrypt::Params::new(SCRYPT_LOG_N, 8, 1, KEY_LEN).expect("paramètres scrypt valides");
    let mut key = [0u8; KEY_LEN];
    scrypt::scrypt(password.as_bytes(), salt.as_bytes(), &params, &mut key).expect("longueur de clé valide");
    key
}

fn to_hex(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

/// Buffer.from(texte, "hex") : paires décodées jusqu'au premier caractère non
/// hexadécimal, demi-octet final ignoré
fn node_hex(text: &str) -> Vec<u8> {
    let digit = |c: u8| (c as char).to_digit(16).map(|d| d as u8);
    let mut out = Vec::with_capacity(text.len() / 2);
    for pair in text.as_bytes().chunks_exact(2) {
        match (digit(pair[0]), digit(pair[1])) {
            (Some(high), Some(low)) => out.push((high << 4) | low),
            _ => break,
        }
    }
    out
}

fn hash_with_salt(password: &str, salt: &str) -> String {
    format!("{}.{salt}", to_hex(&derive(password, salt)))
}

/// hashPassword (server/localAuth.ts) : « empreinte_hex.sel_hex », le sel
/// hexadécimal (16 octets aléatoires) servant tel quel de texte. Calcul de
/// plusieurs dizaines de millisecondes : hors des fils de tokio.
pub async fn hash_password(password: String) -> String {
    let mut salt = [0u8; 16];
    rand::thread_rng().fill_bytes(&mut salt);
    let salt = to_hex(&salt);
    tokio::task::spawn_blocking(move || hash_with_salt(&password, &salt))
        .await
        .expect("calcul scrypt")
}

/// comparePasswords (server/localAuth.ts), sans l'accès de développement
/// « admin.salt » (AUTH-04) ; comparaison en temps constant
fn verify_password(supplied: &str, stored: &str) -> bool {
    let mut parts = stored.split('.');
    let (Some(hashed), Some(salt)) = (parts.next(), parts.next()) else {
        return false;
    };
    if hashed.is_empty() || salt.is_empty() {
        return false;
    }
    let expected = node_hex(hashed);
    // timingSafeEqual lève une erreur quand les longueurs diffèrent : refus
    if expected.len() != KEY_LEN {
        return false;
    }
    expected.ct_eq(&derive(supplied, salt)).into()
}

// ---------- Session d'express-session ----------

/// cookie.maxAge de localAuth.ts : 24 heures
const MAX_AGE_MS: i64 = 24 * 60 * 60 * 1000;

/// uid-safe(24), comme express-session : 32 caractères base64url
fn new_session_id() -> String {
    let mut bytes = [0u8; 24];
    rand::thread_rng().fill_bytes(&mut bytes);
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(bytes)
}

/// Colonne sess : la session d'express-session (cookie) et l'utilisateur de passport
fn session_json(user_id: &str, expires: &DateTime<Utc>) -> Value {
    json!({
        "cookie": {
            "originalMaxAge": MAX_AGE_MS,
            "expires": js::iso(expires),
            "secure": false,
            "httpOnly": true,
            "path": "/",
            "sameSite": "lax",
        },
        "passport": { "user": user_id },
    })
}

/// Colonne expire : connect-pg-simple écrit to_timestamp(Math.ceil(expires / 1000))
fn expire_seconds(expires: &DateTime<Utc>) -> i64 {
    let millis = expires.timestamp_millis();
    millis.div_euclid(1000) + i64::from(millis.rem_euclid(1000) != 0)
}

/// Date.prototype.toUTCString
fn http_date(date: &DateTime<Utc>) -> String {
    date.format("%a, %d %b %Y %H:%M:%S GMT").to_string()
}

/// encodeURIComponent, utilisé par le paquet cookie pour la valeur
fn encode_uri_component(text: &str) -> String {
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

/// Set-Cookie d'express-session : s:<sid>.<signature>, mêmes attributs
fn session_cookie(sid: &str, secret: &str, expires: &DateTime<Utc>) -> String {
    let value = encode_uri_component(&format!("s:{sid}.{}", auth::sign(sid, secret)));
    format!(
        "{SESSION_COOKIE}={value}; Path=/; Expires={}; HttpOnly; SameSite=Lax",
        http_date(expires)
    )
}

/// res.clearCookie('connect.sid', { path: '/' }) d'Express 4
fn cleared_cookie() -> String {
    format!("{SESSION_COOKIE}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT")
}

/// Erreur transmise à next(err) : le gestionnaire d'erreurs de Node renvoie son message
fn server_error(error: sqlx::Error) -> AppError {
    tracing::error!(%error, "session");
    let message = match &error {
        sqlx::Error::Database(database) => database.message().to_string(),
        _ => "Internal Server Error".to_string(),
    };
    AppError::internal(&message)
}

/// Session détruite par req.session.regenerate / destroy. express-session n'a
/// chargé (donc ne détruit) que la session encore valide du cookie.
async fn destroy_session(state: &AppState, headers: &HeaderMap) -> Result<(), AppError> {
    if let Some(sid) = auth::session_id(headers, &state.config.session_secret) {
        sqlx::query("DELETE FROM sessions WHERE sid = $1 AND expire >= now()")
            .bind(sid)
            .execute(&state.db)
            .await
            .map_err(server_error)?;
    }
    Ok(())
}

// ---------- Connexion ----------

/// lookup(req.body, champ) || lookup(req.query, champ) de passport-local : une
/// valeur simple (texte, nombre, booléen) non vide ; un objet, un tableau ou null
/// ne compte pas
fn credential(body: &Value, query: Option<&str>, field: &str) -> Option<Value> {
    let truthy = |value: &&Value| match value {
        Value::String(text) => !text.is_empty(),
        Value::Number(number) => number.as_f64().is_some_and(|n| n != 0.0),
        Value::Bool(flag) => *flag,
        _ => false,
    };
    body.as_object()
        .and_then(|object| object.get(field))
        .filter(truthy)
        .cloned()
        .or_else(|| query_value(query, field).map(Value::String))
}

/// req.query[champ] (analyseur qs d'Express) : une seule occurrence donne du
/// texte ; répété ou entre crochets, c'est un tableau ou un objet, ignoré
fn query_value(query: Option<&str>, field: &str) -> Option<String> {
    let mut found = None;
    let mut count = 0;
    let bracketed = format!("{field}[");
    for (key, value) in form_urlencoded::parse(query?.as_bytes()) {
        if key == field {
            count += 1;
            found = Some(value.into_owned());
        } else if key.starts_with(&bracketed) {
            return None;
        }
    }
    found.filter(|value| count == 1 && !value.is_empty())
}

async fn login(
    State(state): State<AppState>,
    headers: HeaderMap,
    uri: Uri,
    JsonBody(body): JsonBody,
) -> ApiResult {
    let (Some(username), Some(password)) = (
        credential(&body, uri.query(), "username"),
        credential(&body, uri.query(), "password"),
    ) else {
        return Err(AppError::bad_request("Missing credentials"));
    };

    // storage.getUserByUsername : un nombre ou un booléen part en texte (node-pg)
    let user: Option<UsersRow> = sqlx::query_as(&UsersRow::select("WHERE username = $1"))
        .bind(db::pg_text(&username))
        .fetch_optional(&state.db)
        .await
        .map_err(server_error)?;
    let Some((user, stored)) = user.and_then(|user| {
        let stored = user.password.clone().filter(|password| !password.is_empty())?;
        Some((user, stored))
    }) else {
        return Err(AppError::bad_request(REFUSED));
    };
    // Un mot de passe qui n'est pas du texte fait échouer crypto.scrypt : refusé
    let valid = match password {
        Value::String(password) => tokio::task::spawn_blocking(move || verify_password(&password, &stored))
            .await
            .unwrap_or(false),
        _ => false,
    };
    if !valid {
        return Err(AppError::bad_request(REFUSED));
    }

    // req.login : passport régénère la session (l'ancienne est détruite), puis
    // express-session l'enregistre et envoie le cookie
    destroy_session(&state, &headers).await?;
    let sid = new_session_id();
    let expires = Utc::now() + Duration::milliseconds(MAX_AGE_MS);
    sqlx::query(
        "INSERT INTO sessions (sess, expire, sid) VALUES ($1, to_timestamp($2), $3)
         ON CONFLICT (sid) DO UPDATE SET sess = EXCLUDED.sess, expire = EXCLUDED.expire",
    )
    .bind(sqlx::types::Json(session_json(&user.id, &expires)))
    .bind(expire_seconds(&expires) as f64)
    .bind(&sid)
    .execute(&state.db)
    .await
    .map_err(server_error)?;

    let mut response = Json(json!({
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "firstName": user.first_name,
        "lastName": user.last_name,
        "role": user.role,
        "passwordChanged": user.password_changed,
    }))
    .into_response();
    if let Ok(cookie) = HeaderValue::from_str(&session_cookie(&sid, &state.config.session_secret, &expires)) {
        response.headers_mut().insert(header::SET_COOKIE, cookie);
    }
    Ok(response)
}

// ---------- Déconnexion ----------

/// Corps de res.redirect : celui que le client accepte (res.format avec text,
/// html et default, paquets accepts / negotiator)
#[derive(Debug, PartialEq)]
enum RedirectBody {
    Text,
    Html,
    Empty,
}

/// Une entrée de l'en-tête Accept (negotiator, parseMediaType)
struct AcceptSpec {
    kind: String,
    subtype: String,
    params: Vec<(String, String)>,
    q: f64,
    index: usize,
}

fn parse_accept(accept: &str) -> Vec<AcceptSpec> {
    split_unquoted(accept, ',')
        .iter()
        .enumerate()
        .filter_map(|(index, entry)| {
            let entry = entry.trim();
            let (media, rest) = match entry.split_once(';') {
                Some((media, rest)) => (media.trim_end(), Some(rest)),
                None => (entry, None),
            };
            let (kind, subtype) = media.split_once('/')?;
            if kind.is_empty() || subtype.is_empty() || media.contains(char::is_whitespace) {
                return None;
            }
            let mut params = Vec::new();
            let mut q = 1.0;
            for pair in rest.map(|rest| split_unquoted(rest, ';')).unwrap_or_default() {
                let pair = pair.trim();
                let (key, value) = match pair.split_once('=') {
                    Some((key, value)) => (key.to_lowercase(), value),
                    None => (pair.to_lowercase(), ""),
                };
                let value = if value.len() >= 2 && value.starts_with('"') && value.ends_with('"') {
                    &value[1..value.len() - 1]
                } else {
                    value
                };
                if key == "q" {
                    q = parse_float(value);
                    break;
                }
                params.push((key, value.to_string()));
            }
            Some(AcceptSpec {
                kind: kind.to_string(),
                subtype: subtype.to_string(),
                params,
                q,
                index,
            })
        })
        .collect()
}

/// Découpe sur un séparateur hors des guillemets
fn split_unquoted(text: &str, separator: char) -> Vec<String> {
    let mut parts = vec![String::new()];
    let mut quoted = false;
    for c in text.chars() {
        if c == '"' {
            quoted = !quoted;
        }
        if c == separator && !quoted {
            parts.push(String::new());
        } else {
            parts.last_mut().expect("au moins une partie").push(c);
        }
    }
    parts
}

/// parseFloat : nombre décimal de tête, NaN sinon
fn parse_float(text: &str) -> f64 {
    let text = text.trim_start();
    let end = text
        .char_indices()
        .take_while(|(i, c)| c.is_ascii_digit() || *c == '.' || (*i == 0 && (*c == '-' || *c == '+')))
        .map(|(i, c)| i + c.len_utf8())
        .last()
        .unwrap_or(0);
    text[..end].parse().unwrap_or(f64::NAN)
}

/// accepts(req).types(['text', 'html']) : text/plain ou text/html, ou aucun
fn negotiate(accept: Option<&str>) -> RedirectBody {
    let Some(accept) = accept.filter(|accept| !accept.is_empty()) else {
        return RedirectBody::Text;
    };
    let specs = parse_accept(accept);
    // (q, spécificité, index de l'entrée Accept, index du type proposé)
    let mut ranked: Vec<(f64, u8, i64, usize)> = ["plain", "html"]
        .iter()
        .enumerate()
        .map(|(candidate, subtype)| {
            // getMediaTypePriority : l'entrée la plus spécifique, puis de plus
            // grand q, puis la dernière ; un q illisible (NaN) ne départage pas
            let mut best = (0.0, 0u8, -1i64);
            for spec in &specs {
                let mut s = 0u8;
                if spec.kind.eq_ignore_ascii_case("text") {
                    s |= 4;
                } else if spec.kind != "*" {
                    continue;
                }
                if spec.subtype.eq_ignore_ascii_case(subtype) {
                    s |= 2;
                } else if spec.subtype != "*" {
                    continue;
                }
                if !spec.params.is_empty() {
                    // Les types proposés n'ont pas de paramètre
                    if spec
                        .params
                        .iter()
                        .all(|(_, value)| value == "*" || value.is_empty())
                    {
                        s |= 1;
                    } else {
                        continue;
                    }
                }
                let o = spec.index as i64;
                let replaces = if s != best.1 {
                    s > best.1
                } else if spec.q != best.0 && !spec.q.is_nan() && !best.0.is_nan() {
                    spec.q > best.0
                } else {
                    o > best.2
                };
                if replaces {
                    best = (spec.q, s, o);
                }
            }
            (best.0, best.1, best.2, candidate)
        })
        .filter(|(q, ..)| *q > 0.0)
        .collect();
    ranked.sort_by(|a, b| {
        b.0.partial_cmp(&a.0)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then(b.1.cmp(&a.1))
            .then(a.2.cmp(&b.2))
            .then(a.3.cmp(&b.3))
    });
    match ranked.first().map(|best| best.3) {
        Some(0) => RedirectBody::Text,
        Some(_) => RedirectBody::Html,
        None => RedirectBody::Empty,
    }
}

/// res.clearCookie puis res.redirect('/auth') d'Express 4
fn redirect_to_auth(headers: &HeaderMap) -> Response {
    let accept = headers.get(header::ACCEPT).and_then(|value| value.to_str().ok());
    let (content_type, body) = match negotiate(accept) {
        RedirectBody::Text => (Some("text/plain; charset=utf-8"), "Found. Redirecting to /auth"),
        RedirectBody::Html => (
            Some("text/html; charset=utf-8"),
            "<p>Found. Redirecting to /auth</p>",
        ),
        RedirectBody::Empty => (None, ""),
    };
    let mut response = (StatusCode::FOUND, body).into_response();
    let out = response.headers_mut();
    out.remove(header::CONTENT_TYPE);
    if let Some(content_type) = content_type {
        out.insert(header::CONTENT_TYPE, HeaderValue::from_static(content_type));
    }
    out.insert(header::LOCATION, HeaderValue::from_static("/auth"));
    out.insert(header::VARY, HeaderValue::from_static("Accept"));
    if let Ok(cookie) = HeaderValue::from_str(&cleared_cookie()) {
        out.insert(header::SET_COOKIE, cookie);
    }
    response
}

/// req.logout puis req.session.destroy : la session du cookie disparaît, que
/// Node ou Rust l'ait ouverte
async fn logout(State(state): State<AppState>, headers: HeaderMap) -> ApiResult {
    destroy_session(&state, &headers).await?;
    Ok(redirect_to_auth(&headers))
}

// ---------- Utilisateur connecté ----------

async fn current_user(MaybeUser(user): MaybeUser) -> ApiResult {
    let Some(current) = user else {
        return Err(AppError::new(StatusCode::UNAUTHORIZED, "Non authentifié"));
    };
    let user = &current.user;
    Ok(Json(json!({
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "firstName": user.first_name,
        "lastName": user.last_name,
        "role": user.role,
        "passwordChanged": user.password_changed,
        "userGroups": current.user_groups,
    }))
    .into_response())
}

/// Identifiants par défaut à afficher : compte « admin » dont le mot de passe n'a
/// pas été changé (true aussi en cas d'erreur)
async fn default_credentials_check(State(state): State<AppState>) -> Response {
    let admin: Result<Option<(Option<bool>,)>, sqlx::Error> =
        sqlx::query_as("SELECT password_changed FROM users WHERE username = 'admin'")
            .fetch_optional(&state.db)
            .await;
    let show_default = match admin {
        Ok(Some((changed,))) => changed != Some(true),
        Ok(None) => false,
        Err(error) => {
            tracing::error!(%error, "identifiants par défaut");
            true
        }
    };
    Json(json!({ "showDefault": show_default })).into_response()
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    // Produit par hashPassword de server/localAuth.ts (Node 20)
    const NODE_HASH: &str = "b72e456b13b111145d2092d3d54bb640795e2635232a2d87227c38456ee4adca56d349fb141f212c51954c8f86b39975aabb3067ca8527bc8197e808f76fadd7.a6e8e83d32cdaaf698eca9e18fb65909";

    #[test]
    fn verifie_une_empreinte_produite_par_node() {
        assert!(verify_password("mot-de-passe-été", NODE_HASH));
        assert!(!verify_password("mot-de-passe-ete", NODE_HASH));
        assert!(!verify_password("", NODE_HASH));
    }

    #[test]
    fn empreinte_identique_a_celle_de_node() {
        // crypto.scryptSync('banc-admin', '0123456789abcdef0123456789abcdef', 64)
        assert_eq!(
            hash_with_salt("banc-admin", "0123456789abcdef0123456789abcdef"),
            "b03c7493b9f7715b6936bf0197882c85221196dfbddd7800c99e9175e85f1697c65cbd4fcb9cd175e6612075eeddfb5056728b15d45d0fd4602310c2b48791d7.0123456789abcdef0123456789abcdef"
        );
    }

    #[tokio::test]
    async fn nouvelle_empreinte_verifiable() {
        let stored = hash_password("secret".into()).await;
        let (hash, salt) = stored.split_once('.').unwrap();
        assert_eq!((hash.len(), salt.len()), (128, 32));
        assert!(verify_password("secret", &stored));
    }

    #[test]
    fn empreintes_mal_formees_refusees() {
        // L'accès de développement de Node (AUTH-04) n'est pas reporté
        assert!(!verify_password("admin", "admin.salt"));
        assert!(!verify_password("x", "sans-point"));
        assert!(!verify_password("x", ".sel"));
        assert!(!verify_password("x", "abcd."));
        // Buffer.from(…, "hex") s'arrête au premier caractère invalide
        assert_eq!(node_hex("admin").len(), 1);
        assert_eq!(node_hex("abc").len(), 1);
        assert_eq!(node_hex("0g12").len(), 0);
        assert_eq!(node_hex("aabbz1"), vec![0xaa, 0xbb]);
    }

    #[test]
    fn session_au_format_d_express_session() {
        // Connexion de « manager » sur Node : cookie et ligne de la table sessions
        let sid = "BulI376e_Tsc2DIl_gcIiFo4700H27-7";
        let expires = Utc.timestamp_millis_opt(1_792_151_360_449).unwrap();
        assert_eq!(js::iso(&expires), "2026-10-16T11:49:20.449Z");
        assert_eq!(
            session_cookie(sid, "banc-secret-de-session", &expires),
            "connect.sid=s%3ABulI376e_Tsc2DIl_gcIiFo4700H27-7.RnXJIMwqvuD90YKAO4k0RQnTWgzTi%2BzRdqTrrY5cvho; Path=/; Expires=Fri, 16 Oct 2026 11:49:20 GMT; HttpOnly; SameSite=Lax"
        );
        let node_sess: Value = serde_json::from_str(
            r#"{"cookie": {"path": "/", "secure": false, "expires": "2026-10-16T11:49:20.449Z", "httpOnly": true, "sameSite": "lax", "originalMaxAge": 86400000}, "passport": {"user": "bench_manager"}}"#,
        )
        .unwrap();
        assert_eq!(session_json("bench_manager", &expires), node_sess);
        // expire = 2026-10-16 11:49:21 (arrondi à la seconde supérieure)
        assert_eq!(
            expire_seconds(&expires),
            Utc.with_ymd_and_hms(2026, 10, 16, 11, 49, 21)
                .unwrap()
                .timestamp()
        );
        let whole = Utc.timestamp_millis_opt(1_792_151_360_000).unwrap();
        assert_eq!(expire_seconds(&whole), 1_792_151_360);
        assert_eq!(new_session_id().len(), 32);
    }

    #[test]
    fn cookie_efface_comme_express() {
        assert_eq!(
            cleared_cookie(),
            "connect.sid=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT"
        );
        assert_eq!(encode_uri_component("s:abc+/=.def"), "s%3Aabc%2B%2F%3D.def");
    }

    #[test]
    fn corps_de_la_redirection_selon_accept() {
        assert_eq!(negotiate(None), RedirectBody::Text);
        assert_eq!(negotiate(Some("*/*")), RedirectBody::Text);
        assert_eq!(
            negotiate(Some("text/html,application/xhtml+xml,*/*;q=0.8")),
            RedirectBody::Html
        );
        assert_eq!(negotiate(Some("application/json")), RedirectBody::Empty);
        assert_eq!(negotiate(Some("text/*")), RedirectBody::Text);
        assert_eq!(negotiate(Some("text/plain;q=0.5, text/html")), RedirectBody::Html);
        assert_eq!(negotiate(Some("text/html;q=0")), RedirectBody::Empty);
    }

    #[test]
    fn identifiants_comme_passport_local() {
        let body = json!({ "username": "manager", "password": 123, "vide": "", "liste": ["x"] });
        assert_eq!(credential(&body, None, "username"), Some(json!("manager")));
        assert_eq!(credential(&body, None, "password"), Some(json!(123)));
        assert_eq!(credential(&body, None, "vide"), None);
        assert_eq!(credential(&body, None, "liste"), None);
        assert_eq!(
            credential(&json!([]), Some("username=a&x=1"), "username"),
            Some(json!("a"))
        );
        assert_eq!(
            credential(&json!({}), Some("username=a&username=b"), "username"),
            None
        );
        assert_eq!(credential(&json!({}), Some("username[0]=a"), "username"), None);
    }
}
