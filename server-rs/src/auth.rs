// Session partagée avec Node : cookie connect.sid signé par express-session,
// session stockée par connect-pg-simple dans la table sessions
// (docs/PLAN-MIGRATION-RUST.md, « Sessions partagées entre Node et Rust »).
// L'utilisateur est relu à chaque requête, avec ses magasins, comme
// deserializeUser → storage.getUserWithGroups (server/storage.ts).

use axum::extract::FromRequestParts;
use axum::http::HeaderMap;
use axum::http::request::Parts;
use base64::Engine;
use chrono::NaiveDateTime;
use hmac::{Hmac, Mac};
use serde::Serialize;
use sha2::Sha256;
use subtle::ConstantTimeEq;

use crate::AppState;
use crate::db::Table;
use crate::error::AppError;
use crate::schema::UsersRow;

pub const SESSION_COOKIE: &str = "connect.sid";

/// Magasin joint aux affectations (userGroupColumns : dates en valeur brute du pilote)
#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct GroupBrief {
    pub id: i32,
    pub name: String,
    pub color: Option<String>,
    #[serde(rename = "createdAt", serialize_with = "crate::json::pg_text_opt")]
    pub created_at: Option<NaiveDateTime>,
    #[serde(rename = "updatedAt", serialize_with = "crate::json::pg_text_opt")]
    pub updated_at: Option<NaiveDateTime>,
}

#[derive(Debug, Clone, Serialize)]
pub struct UserGroup {
    #[serde(rename = "userId")]
    pub user_id: String,
    #[serde(rename = "groupId")]
    pub group_id: i32,
    pub group: GroupBrief,
}

/// Utilisateur connecté (UserWithGroups)
#[derive(Debug, Clone)]
pub struct CurrentUser {
    pub user: UsersRow,
    pub user_groups: Vec<UserGroup>,
}

impl CurrentUser {
    pub fn id(&self) -> &str {
        &self.user.id
    }
    pub fn role(&self) -> &str {
        &self.user.role
    }
    pub fn is_admin(&self) -> bool {
        self.user.role == "admin"
    }
    /// (user.userGroups || []).map(ug => ug.groupId)
    pub fn group_ids(&self) -> Vec<i32> {
        self.user_groups
            .iter()
            .map(|membership| membership.group_id)
            .collect()
    }
}

/// Utilisateur connecté obligatoire : sinon 401 « Authentification requise »
impl FromRequestParts<AppState> for CurrentUser {
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> Result<Self, Self::Rejection> {
        load_current_user(&parts.headers, state)
            .await?
            .ok_or_else(AppError::unauthorized)
    }
}

/// Utilisateur connecté s'il y en a un (routes publiques qui changent selon la session)
pub struct MaybeUser(pub Option<CurrentUser>);

impl FromRequestParts<AppState> for MaybeUser {
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> Result<Self, Self::Rejection> {
        Ok(Self(load_current_user(&parts.headers, state).await?))
    }
}

async fn load_current_user(headers: &HeaderMap, state: &AppState) -> Result<Option<CurrentUser>, AppError> {
    let Some(sid) = session_id(headers, &state.config.session_secret) else {
        return Ok(None);
    };
    let session: Option<(serde_json::Value,)> =
        sqlx::query_as("SELECT sess FROM sessions WHERE sid = $1 AND expire >= now()")
            .bind(&sid)
            .fetch_optional(&state.db)
            .await
            .map_err(server_error)?;
    let Some(user_id) = session
        .as_ref()
        .and_then(|(sess,)| sess.pointer("/passport/user"))
        .and_then(|user| user.as_str())
    else {
        return Ok(None);
    };
    user_with_groups(&state.db, user_id).await.map_err(server_error)
}

fn server_error(error: sqlx::Error) -> AppError {
    tracing::error!(%error, "lecture de la session");
    AppError::internal("Internal Server Error")
}

/// storage.getUserWithGroups : l'utilisateur et ses magasins, en une requête
pub async fn user_with_groups(db: &sqlx::PgPool, user_id: &str) -> Result<Option<CurrentUser>, sqlx::Error> {
    let Some(user) = sqlx::query_as::<_, UsersRow>(&UsersRow::select("WHERE id = $1"))
        .bind(user_id)
        .fetch_optional(db)
        .await?
    else {
        return Ok(None);
    };
    // Même jointure que Node (sans tri) : les affectations vers un magasin
    // inexistant sont ignorées
    let rows: Vec<(i32, GroupBrief)> = sqlx::query_as::<_, (i32, i32, String, Option<String>, Option<NaiveDateTime>, Option<NaiveDateTime>)>(
        "SELECT user_groups.group_id, groups.id, groups.name, groups.color, groups.created_at, groups.updated_at
           FROM users
           LEFT JOIN user_groups ON user_groups.user_id = users.id
           LEFT JOIN groups ON user_groups.group_id = groups.id
          WHERE users.id = $1 AND groups.id IS NOT NULL",
    )
    .bind(user_id)
    .fetch_all(db)
    .await?
    .into_iter()
    .map(|(group_id, id, name, color, created_at, updated_at)| {
        (group_id, GroupBrief { id, name, color, created_at, updated_at })
    })
    .collect();
    let user_groups = rows
        .into_iter()
        .map(|(group_id, group)| UserGroup {
            user_id: user_id.to_string(),
            group_id,
            group,
        })
        .collect();
    Ok(Some(CurrentUser { user, user_groups }))
}

/// Identifiant de session du cookie signé, si la signature est bonne
pub fn session_id(headers: &HeaderMap, secret: &str) -> Option<String> {
    let raw = cookie_value(headers, SESSION_COOKIE)?;
    unsign(&percent_decode(&raw)?, secret)
}

/// Premier cookie de ce nom, comme le paquet cookie utilisé par express-session
fn cookie_value(headers: &HeaderMap, name: &str) -> Option<String> {
    headers
        .get_all(axum::http::header::COOKIE)
        .iter()
        .filter_map(|value| value.to_str().ok())
        .flat_map(|value| value.split(';'))
        .filter_map(|pair| pair.split_once('='))
        .find(|(key, _)| key.trim() == name)
        .map(|(_, value)| value.trim().trim_matches('"').to_string())
}

/// decodeURIComponent ; valeur brute si l'encodage est invalide (paquet cookie)
fn percent_decode(input: &str) -> Option<String> {
    let bytes = input.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' {
            let decoded = bytes
                .get(i + 1..i + 3)
                .and_then(|hex| std::str::from_utf8(hex).ok())
                .and_then(|hex| u8::from_str_radix(hex, 16).ok());
            match decoded {
                Some(byte) => {
                    out.push(byte);
                    i += 3;
                }
                None => return Some(input.to_string()),
            }
        } else {
            out.push(bytes[i]);
            i += 1;
        }
    }
    Some(String::from_utf8(out).unwrap_or_else(|_| input.to_string()))
}

/// « s:<sid>.<signature> », signature = HMAC-SHA256(secret, sid) en base64 sans « = »
/// (paquet cookie-signature)
fn unsign(value: &str, secret: &str) -> Option<String> {
    let signed = value.strip_prefix("s:")?;
    let (sid, signature) = signed.rsplit_once('.')?;
    let expected = sign(sid, secret);
    if expected.as_bytes().ct_eq(signature.as_bytes()).into() {
        Some(sid.to_string())
    } else {
        None
    }
}

pub fn sign(sid: &str, secret: &str) -> String {
    let mut mac = Hmac::<Sha256>::new_from_slice(secret.as_bytes()).expect("HMAC accepte toute clé");
    mac.update(sid.as_bytes());
    base64::engine::general_purpose::STANDARD
        .encode(mac.finalize().into_bytes())
        .trim_end_matches('=')
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::HeaderValue;

    // Valeur produite par Node : encodeURIComponent('s:' + cookieSignature.sign(sid, secret))
    const SID: &str = "wWepyClqhhFUoW9EuP9PHnH9zV0N0SHv";
    const SECRET: &str = "banc-secret-de-session";
    const NODE_COOKIE: &str =
        "s%3AwWepyClqhhFUoW9EuP9PHnH9zV0N0SHv.9iMe%2BgwWTIz9RKnc97t6VsEcCzLrdYtWzVPRpG3dTT0";

    fn headers(cookie: &str) -> HeaderMap {
        let mut headers = HeaderMap::new();
        headers.insert(axum::http::header::COOKIE, HeaderValue::from_str(cookie).unwrap());
        headers
    }

    #[test]
    fn lit_le_cookie_signe_par_node() {
        let cookies = headers(&format!("autre=1; connect.sid={NODE_COOKIE}"));
        assert_eq!(session_id(&cookies, SECRET).as_deref(), Some(SID));
        assert_eq!(
            format!("{SID}.{}", sign(SID, SECRET)),
            "wWepyClqhhFUoW9EuP9PHnH9zV0N0SHv.9iMe+gwWTIz9RKnc97t6VsEcCzLrdYtWzVPRpG3dTT0"
        );
    }

    #[test]
    fn refuse_un_autre_secret_ou_une_signature_falsifiee() {
        assert_eq!(
            session_id(&headers(&format!("connect.sid={NODE_COOKIE}")), "autre-secret"),
            None
        );
        assert_eq!(session_id(&headers("connect.sid=s%3Aabc.ZmF1c3Nl"), SECRET), None);
        assert_eq!(session_id(&headers("connect.sid=abc"), SECRET), None);
    }
}
