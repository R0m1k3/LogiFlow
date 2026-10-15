// Contacts des magasins : /api/contacts (server/routes.ts, « Contacts routes »).
// Comme Node aujourd'hui : un compte sans magasin voit tous les contacts (CONT-02)
// et un manager peut modifier ceux d'un autre magasin (CONT-03).

use axum::extract::{Path, State};
use axum::response::IntoResponse;
use axum::{Json, Router, routing::get, routing::put};
use serde_json::json;

use crate::AppState;
use crate::auth::CurrentUser;
use crate::db::{self, Table};
use crate::error::{ApiResult, AppError, OrInternal, json_or_empty};
use crate::request::{JsQuery, JsonBody, int_id};
use crate::schema::ContactsRow;
use crate::zod::Object;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/contacts", get(list).post(create))
        .route("/api/contacts/{id}", put(update).delete(remove))
}

/// insertContactSchema
fn insert_schema() -> Object {
    ContactsRow::insert_schema().omit(&["id", "createdAt", "updatedAt"])
}

fn can_write(user: &CurrentUser) -> Result<(), AppError> {
    if ["admin", "directeur", "manager"].contains(&user.role()) {
        Ok(())
    } else {
        Err(AppError::forbidden("Insufficient permissions"))
    }
}

async fn list(State(state): State<AppState>, user: CurrentUser, query: JsQuery) -> ApiResult {
    const FAILED: &str = "Failed to fetch contacts";
    // Hors admin : les magasins de l'utilisateur ; admin : ?groupId s'il est donné
    let group_ids: Vec<i32> = if !user.is_admin() {
        user.group_ids()
    } else if let Some(group_id) = query.truthy("groupId") {
        vec![int_id(group_id, FAILED)?]
    } else {
        Vec::new()
    };
    let contacts: Vec<ContactsRow> = if group_ids.is_empty() {
        sqlx::query_as(&ContactsRow::select("ORDER BY name"))
            .fetch_all(&state.db)
            .await
    } else {
        sqlx::query_as(&ContactsRow::select("WHERE group_id = ANY($1) ORDER BY name"))
            .bind(&group_ids)
            .fetch_all(&state.db)
            .await
    }
    .or_500(FAILED)?;
    Ok(Json(contacts).into_response())
}

async fn create(State(state): State<AppState>, user: CurrentUser, JsonBody(body): JsonBody) -> ApiResult {
    can_write(&user)?;
    let data = insert_schema()
        .parse(&body)
        .map_err(|issues| AppError::validation("Validation failed", issues))?;
    let contact: ContactsRow = db::insert(&state.db, &data)
        .await
        .or_500("Failed to create contact")?;
    Ok(Json(contact).into_response())
}

async fn update(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<String>,
    JsonBody(body): JsonBody,
) -> ApiResult {
    const FAILED: &str = "Failed to update contact";
    can_write(&user)?;
    let id = int_id(&id, FAILED)?;
    let data = insert_schema()
        .partial()
        .parse(&body)
        .map_err(|_| AppError::internal(FAILED))?;
    let contact = db::update_by_id::<ContactsRow>(&state.db, id, &data, true)
        .await
        .or_500(FAILED)?;
    Ok(json_or_empty(contact))
}

async fn remove(State(state): State<AppState>, user: CurrentUser, Path(id): Path<String>) -> ApiResult {
    const FAILED: &str = "Failed to delete contact";
    can_write(&user)?;
    let id = int_id(&id, FAILED)?;
    db::delete_by_id::<ContactsRow>(&state.db, id)
        .await
        .or_500(FAILED)?;
    Ok(Json(json!({ "message": "Contact deleted successfully" })).into_response())
}
