// Informations du tableau de bord : /api/announcements (server/routes.ts,
// « Announcement routes », branche production ; table dashboard_messages).
// Les replis de Node sur erreur SQL passent par server/announcementStorage.ts
// (AnnouncementDatabaseStorage) : ils sont reproduits.
// Comme Node aujourd'hui : un non-admin voit les informations de tous les
// magasins (DASH-13), et un magasin illisible (?storeId=abc) fait retomber sur
// toutes les informations, sans limite, avec l'auteur sous une autre forme.

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::{Json, Router, routing::get, routing::put};
use chrono::NaiveDateTime;
use serde_json::{Map, Value, json};
use sqlx::PgPool;

use crate::AppState;
use crate::auth::CurrentUser;
use crate::db::{self, parse_int4};
use crate::error::{ApiResult, AppError, OrInternal};
use crate::js::truthy;
use crate::request::{JsQuery, JsonBody};
use crate::schema::DashboardMessagesRow;
use crate::zod::Object;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/announcements", get(list).post(create))
        .route("/api/announcements/{id}", put(update).delete(remove))
}

/// insertAnnouncementSchema (insertDashboardMessageSchema)
fn insert_schema() -> Object {
    DashboardMessagesRow::insert_schema().omit(&["id", "createdAt"])
}

/// Information lue avec son auteur (users.username = created_by) et son magasin
#[derive(sqlx::FromRow)]
struct MessageRow {
    id: i32,
    title: String,
    content: String,
    #[sqlx(rename = "type")]
    type_: String,
    store_id: Option<i32>,
    created_by: String,
    created_at: Option<NaiveDateTime>,
    author_id: Option<String>,
    author_username: Option<String>,
    author_first_name: Option<String>,
    author_last_name: Option<String>,
    author_name: Option<String>,
    group_id: Option<i32>,
    group_name: Option<String>,
}

const MESSAGE_COLUMNS: &str = "dashboard_messages.id, dashboard_messages.title, dashboard_messages.content,
       dashboard_messages.type, dashboard_messages.store_id, dashboard_messages.created_by,
       dashboard_messages.created_at, users.id AS author_id, users.username AS author_username,
       users.first_name AS author_first_name, users.last_name AS author_last_name,
       users.name AS author_name, groups.id AS group_id, groups.name AS group_name";

/// Liste de la branche production : 5 dernières, filtrées par magasin pour l'admin
fn latest_sql(filtered: bool) -> String {
    let filter = if filtered {
        "WHERE (dashboard_messages.store_id = $1 OR dashboard_messages.store_id IS NULL)"
    } else {
        ""
    };
    format!(
        "SELECT {MESSAGE_COLUMNS}
           FROM dashboard_messages
           LEFT JOIN users ON users.username = dashboard_messages.created_by
           LEFT JOIN groups ON groups.id = dashboard_messages.store_id
           {filter}
          ORDER BY dashboard_messages.created_at DESC LIMIT 5"
    )
}

/// AnnouncementDatabaseStorage.getAnnouncements() : toutes, sans limite
fn stored_sql() -> String {
    format!(
        "SELECT {MESSAGE_COLUMNS}
           FROM dashboard_messages
           LEFT JOIN users ON dashboard_messages.created_by = users.username
           LEFT JOIN groups ON dashboard_messages.store_id = groups.id
          ORDER BY dashboard_messages.created_at DESC"
    )
}

impl MessageRow {
    /// Champs de dashboard_messages, dans l'ordre de la table
    fn message(&self) -> Map<String, Value> {
        let mut message = Map::new();
        message.insert("id".into(), json!(self.id));
        message.insert("title".into(), json!(self.title));
        message.insert("content".into(), json!(self.content));
        message.insert("type".into(), json!(self.type_));
        message.insert("storeId".into(), json!(self.store_id));
        message.insert("createdBy".into(), json!(self.created_by));
        let created_at = self.created_at.as_ref().map(crate::json::format_ts);
        message.insert("createdAt".into(), json!(created_at));
        message
    }

    /// Forme de la liste (branche production de GET /api/announcements)
    fn listed(&self) -> Value {
        let mut message = self.message();
        message.insert("author".into(), self.author());
        // message.storeId && groupId ? { id, name } : null
        let group = match (self.store_id, self.group_id) {
            (Some(store_id), Some(group_id)) if store_id != 0 && group_id != 0 => {
                json!({ "id": group_id, "name": self.group_name })
            }
            _ => Value::Null,
        };
        message.insert("group".into(), group);
        Value::Object(message)
    }

    /// Auteur affiché : nom d'affichage, sinon prénom et nom, sinon identifiant ;
    /// « Utilisateur Inconnu » si le compte n'existe plus
    fn author(&self) -> Value {
        let Some(author_id) = self.author_id.as_deref().filter(|id| !id.is_empty()) else {
            return json!({
                "id": self.created_by,
                "firstName": "Utilisateur",
                "lastName": "Inconnu",
                "username": self.created_by,
            });
        };
        let non_empty = |name: &Option<String>| name.clone().filter(|name| !name.is_empty());
        let username = self.author_username.clone().unwrap_or_default();
        let (first_name, last_name) = (
            non_empty(&self.author_first_name),
            non_empty(&self.author_last_name),
        );
        let full_name = match (&first_name, &last_name) {
            (Some(first), Some(last)) => Some(format!("{first} {last}")),
            _ => None,
        };
        let display_name = non_empty(&self.author_name)
            .or(full_name)
            .unwrap_or_else(|| username.clone());
        let mut words = display_name.split(' ');
        let first_word = words.next().map(str::to_string).filter(|word| !word.is_empty());
        let other_words = Some(words.collect::<Vec<_>>().join(" ")).filter(|words| !words.is_empty());
        json!({
            "id": author_id,
            "firstName": first_name.or(first_word).unwrap_or_else(|| username.clone()),
            "lastName": last_name.or(other_words).unwrap_or_default(),
            "username": username,
        })
    }

    /// Forme de storage.getAnnouncements() : auteur et magasin joints tels quels
    /// (null quand la jointure ne trouve rien, comme Drizzle)
    fn stored(&self) -> Value {
        let mut message = self.message();
        let author = match &self.author_id {
            Some(id) => json!({
                "id": id,
                "firstName": self.author_first_name,
                "lastName": self.author_last_name,
                "username": self.author_username,
            }),
            None => Value::Null,
        };
        let group = match self.group_id {
            Some(id) => json!({ "id": id, "name": self.group_name }),
            None => Value::Null,
        };
        message.insert("author".into(), author);
        message.insert("group".into(), group);
        Value::Object(message)
    }
}

/// None quand la requête de Node échoue (magasin illisible, base indisponible)
async fn latest(db: &PgPool, store_filter: Option<&str>) -> Option<Vec<MessageRow>> {
    let result = match store_filter {
        None => {
            sqlx::query_as(&latest_sql(false))
                .persistent(false)
                .fetch_all(db)
                .await
        }
        Some(raw) => {
            // parseInt illisible ou hors limites : PostgreSQL refuse le paramètre
            let store_id = parse_int4(raw)?;
            sqlx::query_as(&latest_sql(true))
                .bind(store_id)
                .persistent(false)
                .fetch_all(db)
                .await
        }
    };
    result
        .map_err(|error| tracing::warn!(%error, "informations : repli sur la lecture complète"))
        .ok()
}

async fn list(State(state): State<AppState>, user: CurrentUser, query: JsQuery) -> ApiResult {
    // Admin avec ?storeId : informations de ce magasin et informations globales
    let store_filter = if user.is_admin() {
        query.truthy("storeId")
    } else {
        None
    };
    let announcements: Vec<Value> = match latest(&state.db, store_filter).await {
        Some(rows) => rows.iter().map(MessageRow::listed).collect(),
        None => {
            let rows: Vec<MessageRow> = sqlx::query_as(&stored_sql())
                .persistent(false)
                .fetch_all(&state.db)
                .await
                .or_500("Failed to fetch announcements")?;
            rows.iter().map(MessageRow::stored).collect()
        }
    };
    Ok(Json(announcements).into_response())
}

async fn create(State(state): State<AppState>, user: CurrentUser, JsonBody(body): JsonBody) -> ApiResult {
    const FAILED: &str = "Failed to create announcement";
    if !user.is_admin() {
        return Err(AppError::forbidden(
            "Only administrators can create announcements",
        ));
    }
    // Champs repris un par un du corps : type « info » et magasin null à défaut
    let mut candidate = Map::new();
    for key in ["title", "content"] {
        if let Some(value) = body.get(key) {
            candidate.insert(key.into(), value.clone());
        }
    }
    let given = |key: &str| body.get(key).filter(|value| truthy(value)).cloned();
    candidate.insert("type".into(), given("type").unwrap_or_else(|| json!("info")));
    candidate.insert("storeId".into(), given("storeId").unwrap_or(Value::Null));
    candidate.insert("createdBy".into(), json!(user.user.username));
    let data = insert_schema()
        .parse(&Value::Object(candidate))
        .map_err(|issues| AppError::validation("Validation error", issues))?;

    let created: DashboardMessagesRow = match db::insert(&state.db, &data).await {
        Ok(row) => row,
        Err(error) => {
            // Repli de Node : storage.createAnnouncement refait l'insertion et
            // rend la ligne seule
            tracing::warn!(%error, "information : nouvel essai d'enregistrement");
            let row: DashboardMessagesRow = db::insert(&state.db, &data).await.or_500(FAILED)?;
            return Ok((StatusCode::CREATED, Json(row)).into_response());
        }
    };
    let mut announcement = match serde_json::to_value(created).or_500(FAILED)? {
        Value::Object(fields) => fields,
        _ => Map::new(),
    };
    let author =
        json!({ "id": user.id(), "firstName": user.user.first_name, "lastName": user.user.last_name });
    announcement.insert("author".into(), author);
    announcement.insert("group".into(), Value::Null);
    Ok((StatusCode::CREATED, Json(announcement)).into_response())
}

async fn update(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<String>,
    JsonBody(body): JsonBody,
) -> ApiResult {
    const FAILED: &str = "Failed to update announcement";
    if !user.is_admin() {
        return Err(AppError::forbidden("Only administrators can edit announcements"));
    }
    // Identifiant illisible : la lecture de l'information échoue côté Node
    let id = parse_int4(&id).ok_or_else(|| AppError::internal(FAILED))?;
    let existing: Option<(i32,)> = sqlx::query_as("SELECT id FROM dashboard_messages WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await
        .or_500(FAILED)?;
    if existing.is_none() {
        return Err(AppError::not_found("Announcement not found"));
    }
    let data = insert_schema()
        .partial()
        .parse(&body)
        .map_err(|issues| AppError::validation("Validation error", issues))?;
    // Corps vide après validation : Drizzle refuse (« No values to set »)
    let updated = db::update_by_id::<DashboardMessagesRow>(&state.db, id, &data, false)
        .await
        .or_500(FAILED)?
        .ok_or_else(|| AppError::internal(FAILED))?;
    Ok(Json(updated).into_response())
}

async fn remove(State(state): State<AppState>, user: CurrentUser, Path(id): Path<String>) -> ApiResult {
    const FAILED: &str = "Failed to delete announcement";
    if !user.is_admin() {
        return Err(AppError::forbidden(
            "Only administrators can delete announcements",
        ));
    }
    let id = parse_int4(&id).ok_or_else(|| AppError::internal(FAILED))?;
    // Repli de Node sur erreur : storage.deleteAnnouncement refait la suppression
    let deleted = match db::delete_by_id::<DashboardMessagesRow>(&state.db, id).await {
        Ok(count) => count,
        Err(error) => {
            tracing::warn!(%error, "information : nouvel essai de suppression");
            db::delete_by_id::<DashboardMessagesRow>(&state.db, id)
                .await
                .or_500(FAILED)?
        }
    };
    if deleted == 0 {
        return Err(AppError::not_found("Announcement not found"));
    }
    Ok(Json(json!({ "message": "Announcement deleted successfully" })).into_response())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn row(name: Option<&str>, first: Option<&str>, last: Option<&str>) -> MessageRow {
        MessageRow {
            id: 1,
            title: "t".into(),
            content: "c".into(),
            type_: "info".into(),
            store_id: Some(0),
            created_by: "auteur".into(),
            created_at: None,
            author_id: Some("u1".into()),
            author_username: Some("auteur".into()),
            author_first_name: first.map(Into::into),
            author_last_name: last.map(Into::into),
            author_name: name.map(Into::into),
            group_id: Some(1),
            group_name: Some("Nancy".into()),
        }
    }

    fn names(row: MessageRow) -> (String, String) {
        let author = row.author();
        (
            author["firstName"].as_str().unwrap().to_string(),
            author["lastName"].as_str().unwrap().to_string(),
        )
    }

    #[test]
    fn auteur_affiche_comme_node() {
        assert_eq!(
            names(row(None, Some("Alice"), Some("Admin"))),
            ("Alice".into(), "Admin".into())
        );
        assert_eq!(
            names(row(Some("Équipe Rédaction Nancy"), None, None)),
            ("Équipe".into(), "Rédaction Nancy".into())
        );
        assert_eq!(
            names(row(None, Some("Paulette"), None)),
            ("Paulette".into(), "".into())
        );
        assert_eq!(
            names(row(None, None, Some("Martin"))),
            ("auteur".into(), "Martin".into())
        );
        let mut missing = row(None, None, None);
        missing.author_id = None;
        assert_eq!(missing.author()["lastName"], "Inconnu");
        assert_eq!(missing.stored()["author"], Value::Null);
    }

    #[test]
    fn magasin_joint_seulement_si_store_id_vrai() {
        // storeId 0 : pas de magasin dans la liste, même s'il existe
        assert_eq!(row(None, None, None).listed()["group"], Value::Null);
        let mut nancy = row(None, None, None);
        nancy.store_id = Some(1);
        assert_eq!(nancy.listed()["group"], json!({ "id": 1, "name": "Nancy" }));
    }
}
