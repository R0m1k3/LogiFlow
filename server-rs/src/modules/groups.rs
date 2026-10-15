// Magasins : /api/groups (server/routes.ts, « Groups routes »).
//
// Le mot de passe SMTP ne sort jamais : comme stripSmtpPassword
// (server/sanitize.ts, appliqué par Node à toute réponse JSON de /api), il est
// remplacé par smtpPasswordSet, à la même place. Il est chiffré à l'écriture
// (crate::crypto, comme storage.createGroup / updateGroup).
//
// POST /api/groups/:id/test-smtp reste servi par Node pour l'instant (le service
// SMTP est porté à part).
//
// Comme Node aujourd'hui : un manager peut créer, modifier et supprimer
// n'importe quel magasin, pas seulement le sien.

use axum::extract::{Path, State};
use axum::response::{IntoResponse, Response};
use axum::{Json, Router, routing::get, routing::put};
use serde_json::{Map, Value, json};

use crate::AppState;
use crate::auth::CurrentUser;
use crate::crypto;
use crate::db::{self, Table};
use crate::error::{ApiResult, AppError, OrInternal, empty_json};
use crate::request::{JsonBody, int_id};
use crate::schema::GroupsRow;
use crate::zod::{Field, Object, Parsed};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/groups", get(list).post(create))
        .route("/api/groups/{id}", put(update).delete(remove))
}

/// insertGroupSchema (shared/schema.ts) : le formulaire envoie "" pour les
/// champs vides, d'où les champs texte élargis
fn insert_schema() -> Object {
    GroupsRow::insert_schema()
        .omit(&["id", "createdAt", "updatedAt"])
        .extend(vec![
            Field::string("address").optional().nullable(),
            Field::string("phone").optional().nullable(),
            Field::string("logo").optional().nullable(),
            Field::string("smtpHost").optional().nullable(),
            Field::coerce_number("smtpPort")
                .int()
                .min(1.0)
                .max(65535.0)
                .optional()
                .nullable(),
            Field::string("smtpUser").optional().nullable(),
            Field::string("smtpPassword").optional().nullable(),
            Field::union(
                "smtpSenderEmail",
                vec![Field::string("").email(), Field::literal("", json!(""))],
            )
            .optional()
            .nullable(),
            Field::string("smtpSenderName").optional().nullable(),
        ])
}

/// stripSmtpPassword : smtpPassword (ou smtp_password) remplacé par
/// smtpPasswordSet, à la même place, dans tout l'objet (8 niveaux au plus)
pub fn strip_smtp_password(value: Value) -> Value {
    fn strip(value: Value, depth: usize) -> Value {
        if depth > 8 {
            return value;
        }
        match value {
            Value::Array(items) => {
                Value::Array(items.into_iter().map(|item| strip(item, depth + 1)).collect())
            }
            Value::Object(object) => {
                let mut out = Map::with_capacity(object.len());
                for (key, entry) in object {
                    if key == "smtpPassword" || key == "smtp_password" {
                        out.insert("smtpPasswordSet".into(), Value::Bool(js_truthy(&entry)));
                    } else {
                        out.insert(key, strip(entry, depth + 1));
                    }
                }
                Value::Object(out)
            }
            other => other,
        }
    }
    strip(value, 0)
}

/// Boolean(valeur) de JavaScript
fn js_truthy(value: &Value) -> bool {
    match value {
        Value::Null => false,
        Value::Bool(flag) => *flag,
        Value::Number(number) => number.as_f64().is_some_and(|n| n != 0.0),
        Value::String(text) => !text.is_empty(),
        Value::Array(_) | Value::Object(_) => true,
    }
}

/// Réponse JSON d'un magasin complet, sans son mot de passe SMTP
fn group_json<T: serde::Serialize>(group: T) -> Response {
    match serde_json::to_value(group) {
        Ok(value) => Json(strip_smtp_password(value)).into_response(),
        Err(_) => AppError::internal("Internal Server Error").into_response(),
    }
}

/// encryptSecret sur le mot de passe SMTP fourni (vide ou déjà chiffré : inchangé)
fn encrypt_smtp_password(data: &mut Parsed, secret: &str) {
    if let Some(Value::String(password)) = data.get("smtpPassword") {
        let sealed = crypto::encrypt(password, secret);
        data.insert("smtpPassword".into(), Value::String(sealed));
    }
}

fn can_write(user: &CurrentUser) -> Result<(), AppError> {
    if ["admin", "manager"].contains(&user.role()) {
        Ok(())
    } else {
        Err(AppError::forbidden("Insufficient permissions"))
    }
}

/// Admin : tous les magasins (fiches complètes, triées par nom) ; les autres :
/// leurs magasins, tels que chargés avec l'utilisateur
async fn list(State(state): State<AppState>, user: CurrentUser) -> ApiResult {
    if user.is_admin() {
        let groups: Vec<GroupsRow> = sqlx::query_as(&GroupsRow::select("ORDER BY name"))
            .fetch_all(&state.db)
            .await
            .or_500("Failed to fetch groups")?;
        return Ok(group_json(groups));
    }
    let groups: Vec<_> = user
        .user_groups
        .iter()
        .map(|membership| &membership.group)
        .collect();
    Ok(Json(groups).into_response())
}

async fn create(State(state): State<AppState>, user: CurrentUser, JsonBody(body): JsonBody) -> ApiResult {
    can_write(&user)?;
    let mut data = insert_schema()
        .parse(&body)
        .map_err(|issues| AppError::validation("Validation failed", issues))?;
    encrypt_smtp_password(&mut data, &state.config.encryption_key);
    let group: GroupsRow = db::insert(&state.db, &data)
        .await
        .or_500("Failed to create group")?;
    Ok(group_json(group))
}

async fn update(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<String>,
    JsonBody(body): JsonBody,
) -> ApiResult {
    const FAILED: &str = "Failed to update group";
    can_write(&user)?;
    let id = int_id(&id, FAILED)?;
    let mut data = insert_schema()
        .partial()
        .parse(&body)
        .map_err(|_| AppError::internal(FAILED))?;
    // Le mot de passe n'est jamais renvoyé au client : vide, il reste inchangé
    if !data.get("smtpPassword").is_some_and(js_truthy) {
        data.remove("smtpPassword");
    }
    encrypt_smtp_password(&mut data, &state.config.encryption_key);
    let group = db::update_by_id::<GroupsRow>(&state.db, id, &data, true)
        .await
        .or_500(FAILED)?;
    Ok(match group {
        Some(group) => group_json(group),
        None => empty_json(),
    })
}

async fn remove(State(state): State<AppState>, user: CurrentUser, Path(id): Path<String>) -> ApiResult {
    const FAILED: &str = "Failed to delete group";
    can_write(&user)?;
    let id = int_id(&id, FAILED)?;
    // Un magasin encore utilisé (commandes, livraisons…) fait échouer la suppression
    db::delete_by_id::<GroupsRow>(&state.db, id)
        .await
        .or_500(FAILED)?;
    Ok(Json(json!({ "message": "Group deleted successfully" })).into_response())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mot_de_passe_smtp_remplace_a_sa_place() {
        let value = json!([{ "id": 1, "smtpUser": "u", "smtpPassword": "enc:v1:x", "smtpSenderName": "n" },
                           { "group": { "smtp_password": "" } }]);
        assert_eq!(
            strip_smtp_password(value).to_string(),
            r#"[{"id":1,"smtpUser":"u","smtpPasswordSet":true,"smtpSenderName":"n"},{"group":{"smtpPasswordSet":false}}]"#
        );
    }

    #[test]
    fn courriel_d_expediteur_vide_ou_valide() {
        let schema = insert_schema();
        assert!(
            schema
                .parse(&json!({ "name": "X", "smtpSenderEmail": "" }))
                .is_ok()
        );
        assert!(
            schema
                .parse(&json!({ "name": "X", "smtpSenderEmail": null, "smtpPort": "587" }))
                .is_ok_and(|data| data["smtpPort"] == json!(587))
        );
        let issues = schema
            .parse(&json!({ "name": "X", "smtpSenderEmail": "abc", "smtpPort": "0" }))
            .unwrap_err();
        assert_eq!(
            serde_json::to_string(&issues).unwrap(),
            r#"[{"code":"too_small","minimum":1,"type":"number","inclusive":true,"exact":false,"message":"Number must be greater than or equal to 1","path":["smtpPort"]},{"validation":"email","code":"invalid_string","message":"Invalid email","path":["smtpSenderEmail"]}]"#
        );
    }
}
