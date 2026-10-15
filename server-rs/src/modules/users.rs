// Utilisateurs : /api/users (server/routes.ts, « Users management routes » et
// « User-Group management routes »).
//
// Les adresses POST /api/users/:id/groups et DELETE /api/users/:id/groups/:groupId
// déclarées une seconde fois plus bas dans routes.ts (« Access denied ») ne sont
// jamais atteintes : seules les premières sont reprises (décision R3).
//
// Écart voulu (audit USERS-02) : l'empreinte du mot de passe n'est jamais
// renvoyée. Node la renvoie encore après une création ou une modification ;
// Rust répond avec la projection publique (projections::PublicUser).
//
// Comme Node aujourd'hui : managers et directeurs voient tous les comptes ; une
// adresse électronique vide dans une modification ne l'efface pas ; un mot de
// passe vide dans une modification est enregistré tel quel (le compte ne peut
// plus se connecter) ; affectations et suppression sans transaction.

use std::collections::HashMap;

use axum::extract::{Path, State};
use axum::response::IntoResponse;
use axum::{Json, Router, routing::delete, routing::get, routing::post, routing::put};
use chrono::NaiveDateTime;
use rand::Rng;
use serde_json::{Map, Value, json};
use sqlx::postgres::PgArguments;
use sqlx::{Arguments, PgPool};

use crate::AppState;
use crate::auth::{CurrentUser, GroupBrief, UserGroup};
use crate::db::{self, Table};
use crate::error::{ApiResult, AppError, OrInternal, empty_json};
use crate::modules::session_routes::hash_password;
use crate::projections::PublicUser;
use crate::request::{JsonBody, int_id};
use crate::schema::{UserGroupsRow, UsersRow};
use crate::zod::{Field, Object, Parsed};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/users", get(list).post(create))
        .route("/api/users/{id}", put(update).delete(remove))
        .route("/api/users/{id}/groups", post(assign_group))
        .route("/api/users/{id}/groups/{group_id}", delete(remove_group))
}

const ROLES: &[&str] = &["admin", "directeur", "manager", "employee"];

fn access_denied() -> AppError {
    AppError::forbidden("Access denied")
}

/// z.union([z.string().email(), z.literal(""), z.null()]).optional()
fn email_field() -> Field {
    Field::union(
        "email",
        vec![
            Field::string("").email(),
            Field::literal("", json!("")),
            Field::null(""),
        ],
    )
    .optional()
}

/// createUserSchema (POST /api/users)
fn create_schema() -> Object {
    Object::new(vec![
        Field::string("id").optional(),
        Field::string("username").min_len_message(1, "L'identifiant est obligatoire"),
        email_field(),
        Field::string("firstName").optional(),
        Field::string("lastName").optional(),
        Field::string("password").min_len_message(1, "Le mot de passe est obligatoire"),
        Field::enumeration("role", ROLES).optional(),
    ])
}

/// updateUserSchema (PUT /api/users/:id)
fn update_schema() -> Object {
    let name = |field: &str| {
        Field::union(
            field,
            vec![Field::string(""), Field::literal("", json!("")), Field::null("")],
        )
        .optional()
    };
    Object::new(vec![
        Field::string("username").optional(),
        Field::enumeration("role", ROLES).optional(),
        name("firstName"),
        name("lastName"),
        email_field(),
        Field::string("password").optional(),
    ])
}

/// Projection publique d'une ligne users : jamais l'empreinte du mot de passe
fn public(user: UsersRow) -> PublicUser {
    PublicUser {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        first_name: user.first_name,
        last_name: user.last_name,
        profile_image_url: user.profile_image_url,
        role: user.role,
        password_changed: user.password_changed,
        created_at: user.created_at,
        updated_at: user.updated_at,
    }
}

fn text(data: &Parsed, key: &str) -> Option<String> {
    data.get(key).and_then(Value::as_str).map(str::to_string)
}

/// Doublon d'identifiant ou d'adresse (23505) : 409 avec le message de Node ;
/// base injoignable : 503 ; autre erreur : 500 avec le message donné
fn write_error(error: sqlx::Error, email_message: &str, failed: &str) -> AppError {
    use axum::http::StatusCode;
    tracing::error!(%error, "{failed}");
    match &error {
        sqlx::Error::Database(database) if database.code().as_deref() == Some("23505") => {
            match database.constraint() {
                Some("users_username_key") => AppError::new(
                    StatusCode::CONFLICT,
                    "Un utilisateur avec ce nom d'utilisateur existe déjà. Veuillez choisir un autre nom d'utilisateur.",
                ),
                Some("users_email_key") => AppError::new(StatusCode::CONFLICT, email_message),
                _ => AppError::internal(failed),
            }
        }
        sqlx::Error::Io(io)
            if matches!(
                io.kind(),
                std::io::ErrorKind::ConnectionRefused | std::io::ErrorKind::NotFound
            ) =>
        {
            AppError::new(StatusCode::SERVICE_UNAVAILABLE, "Database connection error")
        }
        _ => AppError::internal(failed),
    }
}

/// storage.getUsersWithGroups : tous les comptes sans mot de passe (dans l'ordre
/// de la table), avec leurs magasins
async fn list(State(state): State<AppState>, user: CurrentUser) -> ApiResult {
    if !["admin", "directeur", "manager"].contains(&user.role()) {
        return Err(access_denied());
    }
    let users: Vec<PublicUser> =
        match sqlx::query_as(&format!("SELECT {} FROM users", PublicUser::columns("users")))
            .fetch_all(&state.db)
            .await
        {
            Ok(users) => users,
            Err(error) => {
                // Node renvoie une liste vide avec le code 500
                tracing::error!(%error, "liste des utilisateurs");
                return Err(AppError::with_body(
                    axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                    json!([]),
                ));
            }
        };
    let memberships = memberships(&state.db).await.unwrap_or_else(|error| {
        tracing::error!(%error, "magasins des utilisateurs");
        Vec::new()
    });
    let mut by_user: HashMap<String, Vec<UserGroup>> = HashMap::new();
    for membership in memberships {
        by_user
            .entry(membership.user_id.clone())
            .or_default()
            .push(membership);
    }
    let users: Vec<Value> = users
        .into_iter()
        .map(|user| {
            let groups = by_user.remove(&user.id).unwrap_or_default();
            let mut object = match serde_json::to_value(user) {
                Ok(Value::Object(object)) => object,
                _ => Map::new(),
            };
            object.insert("userGroups".into(), json!(groups));
            object.insert("userRoles".into(), json!([]));
            Value::Object(object)
        })
        .collect();
    Ok(Json(users).into_response())
}

/// Affectations jointes à leur magasin (même requête que Node, sans tri)
async fn memberships(db: &PgPool) -> Result<Vec<UserGroup>, sqlx::Error> {
    type Row = (
        String,
        i32,
        i32,
        String,
        Option<String>,
        Option<NaiveDateTime>,
        Option<NaiveDateTime>,
    );
    let rows: Vec<Row> = sqlx::query_as(
        "SELECT user_groups.user_id, user_groups.group_id, groups.id, groups.name, groups.color,
                groups.created_at, groups.updated_at
           FROM user_groups
          INNER JOIN groups ON user_groups.group_id = groups.id",
    )
    .fetch_all(db)
    .await?;
    Ok(rows
        .into_iter()
        .map(
            |(user_id, group_id, id, name, color, created_at, updated_at)| UserGroup {
                user_id,
                group_id,
                group: GroupBrief {
                    id,
                    name,
                    color,
                    created_at,
                    updated_at,
                },
            },
        )
        .collect())
}

/// manual_<millisecondes>_<9 caractères en base 36>, comme Math.random().toString(36)
fn generated_id() -> String {
    const BASE36: &[u8] = b"0123456789abcdefghijklmnopqrstuvwxyz";
    let mut rng = rand::thread_rng();
    let suffix: String = (0..9)
        .map(|_| BASE36[rng.gen_range(0..BASE36.len())] as char)
        .collect();
    format!("manual_{}_{suffix}", chrono::Utc::now().timestamp_millis())
}

async fn create(State(state): State<AppState>, user: CurrentUser, JsonBody(body): JsonBody) -> ApiResult {
    const FAILED: &str = "Failed to create user";
    if !user.is_admin() {
        return Err(access_denied());
    }
    let data = create_schema()
        .parse(&body)
        .map_err(|issues| AppError::validation("Invalid user data", issues))?;

    let password = hash_password(text(&data, "password").unwrap_or_default()).await;
    let id = text(&data, "id")
        .filter(|id| !id.is_empty())
        .unwrap_or_else(generated_id);
    let mut row = Parsed::new();
    row.insert("id".into(), Value::String(id));
    row.insert(
        "username".into(),
        data.get("username").cloned().unwrap_or(Value::Null),
    );
    // Adresse vide ou blanche : non renseignée
    if let Some(email) = text(&data, "email").filter(|email| !email.trim().is_empty()) {
        row.insert("email".into(), Value::String(email));
    }
    for key in ["firstName", "lastName"] {
        row.insert(key.into(), Value::String(text(&data, key).unwrap_or_default()));
    }
    row.insert("password".into(), Value::String(password));
    row.insert(
        "role".into(),
        Value::String(text(&data, "role").unwrap_or_else(|| "employee".into())),
    );

    let created: UsersRow = db::insert(&state.db, &row).await.map_err(|error| {
        write_error(
            error,
            "Un utilisateur avec cette adresse email existe déjà.",
            FAILED,
        )
    })?;
    Ok(Json(public(created)).into_response())
}

/// storage.updateUser : UPDATE … SET …, updatedAt WHERE id (texte) RETURNING
pub(crate) async fn update_user(
    db: &PgPool,
    id: &str,
    data: &Parsed,
) -> Result<Option<UsersRow>, sqlx::Error> {
    let mut sets = Vec::new();
    let mut arguments = PgArguments::default();
    for col in UsersRow::FIELDS {
        let value = if col.key == "updatedAt" {
            Some(Value::String(crate::modules::now_iso()))
        } else {
            data.get(col.key).cloned()
        };
        if let Some(value) = value {
            arguments.add(db::pg_text(&value)).map_err(sqlx::Error::Encode)?;
            sets.push(format!(
                "\"{}\" = ${}::{}",
                col.column,
                sets.len() + 1,
                col.sql_type
            ));
        }
    }
    arguments.add(id).map_err(sqlx::Error::Encode)?;
    let sql = format!(
        "UPDATE users SET {} WHERE id = ${} RETURNING {}",
        sets.join(", "),
        sets.len() + 1,
        UsersRow::COLUMNS
    );
    sqlx::query_as_with::<_, UsersRow, _>(&sql, arguments)
        .fetch_optional(db)
        .await
}

async fn update(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<String>,
    JsonBody(body): JsonBody,
) -> ApiResult {
    const FAILED: &str = "Failed to update user";
    if !user.is_admin() {
        return Err(access_denied());
    }
    let mut data = update_schema()
        .parse(&body)
        .map_err(|issues| AppError::validation("Invalid user data", issues))?;

    // Adresse vide, blanche ou null : laissée telle quelle en base
    if data.contains_key("email")
        && text(&data, "email")
            .filter(|email| !email.trim().is_empty())
            .is_none()
    {
        data.remove("email");
    }
    if let Some(password) = text(&data, "password").filter(|password| !password.is_empty()) {
        data.insert("password".into(), Value::String(hash_password(password).await));
        data.insert("passwordChanged".into(), Value::Bool(true));
    }

    let updated = update_user(&state.db, &id, &data).await.map_err(|error| {
        write_error(
            error,
            "Un utilisateur avec cette adresse email existe déjà. Veuillez utiliser une autre adresse email ou laisser le champ vide.",
            FAILED,
        )
    })?;
    Ok(match updated {
        Some(updated) => Json(public(updated)).into_response(),
        None => empty_json(),
    })
}

async fn remove(State(state): State<AppState>, user: CurrentUser, Path(id): Path<String>) -> ApiResult {
    const FAILED: &str = "Failed to delete user";
    if !user.is_admin() {
        return Err(access_denied());
    }
    if id == user.id() {
        return Err(AppError::bad_request(
            "Vous ne pouvez pas supprimer votre propre compte",
        ));
    }
    // Retiré de ses magasins, puis supprimé (sans transaction, comme Node)
    sqlx::query("DELETE FROM user_groups WHERE user_id = $1")
        .bind(&id)
        .execute(&state.db)
        .await
        .or_500(FAILED)?;
    sqlx::query("DELETE FROM users WHERE id = $1")
        .bind(&id)
        .execute(&state.db)
        .await
        .or_500(FAILED)?;
    Ok(Json(json!({ "message": "Utilisateur supprimé avec succès" })).into_response())
}

fn insufficient_permissions() -> AppError {
    AppError::forbidden("Insufficient permissions")
}

/// insertUserGroupSchema.parse({ userId, groupId: req.body.groupId }) ; une
/// erreur de validation donne le 500 de Node
async fn assign_group(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<String>,
    JsonBody(body): JsonBody,
) -> ApiResult {
    const FAILED: &str = "Failed to assign user to group";
    if !user.is_admin() {
        return Err(insufficient_permissions());
    }
    let mut input = Map::new();
    input.insert("userId".into(), Value::String(id));
    if let Some(group_id) = body.as_object().and_then(|object| object.get("groupId")) {
        input.insert("groupId".into(), group_id.clone());
    }
    let data = UserGroupsRow::insert_schema()
        .omit(&["createdAt"])
        .parse(&Value::Object(input))
        .map_err(|_| AppError::internal(FAILED))?;
    let membership: UserGroupsRow = db::insert(&state.db, &data).await.or_500(FAILED)?;
    Ok(Json(membership).into_response())
}

async fn remove_group(
    State(state): State<AppState>,
    user: CurrentUser,
    Path((id, group_id)): Path<(String, String)>,
) -> ApiResult {
    const FAILED: &str = "Failed to remove user from group";
    if !user.is_admin() {
        return Err(insufficient_permissions());
    }
    let group_id = int_id(&group_id, FAILED)?;
    sqlx::query("DELETE FROM user_groups WHERE user_id = $1 AND group_id = $2")
        .bind(&id)
        .bind(group_id)
        .execute(&state.db)
        .await
        .or_500(FAILED)?;
    Ok(Json(json!({ "message": "User removed from group successfully" })).into_response())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn creation_invalide_comme_node() {
        // Réponse de Node à { "username": "", "password": "", "email": 5, "role": "chef" }
        let issues = create_schema()
            .parse(&json!({ "username": "", "password": "", "email": 5, "role": "chef" }))
            .unwrap_err();
        let node = r#"[{"code":"too_small","minimum":1,"type":"string","inclusive":true,"exact":false,"message":"L'identifiant est obligatoire","path":["username"]},{"code":"invalid_union","unionErrors":[{"issues":[{"code":"invalid_type","expected":"string","received":"number","path":["email"],"message":"Expected string, received number"}],"name":"ZodError"},{"issues":[{"received":5,"code":"invalid_literal","expected":"","path":["email"],"message":"Invalid literal value, expected \"\""}],"name":"ZodError"},{"issues":[{"code":"invalid_type","expected":"null","received":"number","path":["email"],"message":"Expected null, received number"}],"name":"ZodError"}],"path":["email"],"message":"Invalid input"},{"code":"too_small","minimum":1,"type":"string","inclusive":true,"exact":false,"message":"Le mot de passe est obligatoire","path":["password"]},{"received":"chef","code":"invalid_enum_value","options":["admin","directeur","manager","employee"],"path":["role"],"message":"Invalid enum value. Expected 'admin' | 'directeur' | 'manager' | 'employee', received 'chef'"}]"#;
        assert_eq!(serde_json::to_string(&issues).unwrap(), node);
    }

    #[test]
    fn modification_noms_vides_ou_nuls() {
        let data = update_schema()
            .parse(&json!({ "firstName": null, "lastName": "", "email": "", "autre": 1 }))
            .unwrap();
        assert_eq!(
            Value::Object(data),
            json!({ "firstName": null, "lastName": "", "email": "" })
        );
    }

    #[test]
    fn identifiant_genere() {
        let id = generated_id();
        let parts: Vec<&str> = id.split('_').collect();
        assert_eq!(parts[0], "manual");
        assert_eq!(parts[2].len(), 9);
    }
}
