// Fiches fournisseurs : /api/suppliers (server/routes.ts, « Suppliers routes »).

use axum::extract::{Path, State};
use axum::response::IntoResponse;
use axum::{Json, Router, routing::get, routing::put};
use serde_json::json;

use crate::AppState;
use crate::auth::CurrentUser;
use crate::db::{self, Table};
use crate::error::{ApiResult, AppError, OrInternal, json_or_empty};
use crate::request::{JsQuery, JsonBody, int_id};
use crate::schema::SuppliersRow;
use crate::zod::Object;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/suppliers", get(list).post(create))
        .route("/api/suppliers/{id}", put(update).delete(remove))
}

/// insertSupplierSchema
fn insert_schema() -> Object {
    SuppliersRow::insert_schema().omit(&["id", "createdAt", "updatedAt"])
}

fn forbidden() -> AppError {
    AppError::forbidden("Insufficient permissions")
}

async fn list(State(state): State<AppState>, user: CurrentUser, query: JsQuery) -> ApiResult {
    if !["admin", "manager", "directeur", "employee"].contains(&user.role()) {
        return Err(forbidden());
    }
    let suppliers: Vec<SuppliersRow> = sqlx::query_as(&SuppliersRow::select("ORDER BY name"))
        .fetch_all(&state.db)
        .await
        .or_500("Failed to fetch suppliers")?;
    // ?dlc=true : fournisseurs gérés en DLC seulement
    let suppliers: Vec<SuppliersRow> = if query.get("dlc") == Some("true") {
        suppliers
            .into_iter()
            .filter(|s| s.has_dlc == Some(true))
            .collect()
    } else {
        suppliers
    };
    Ok(Json(suppliers).into_response())
}

async fn create(State(state): State<AppState>, user: CurrentUser, JsonBody(body): JsonBody) -> ApiResult {
    if !["admin", "manager", "directeur"].contains(&user.role()) {
        return Err(forbidden());
    }
    let data = insert_schema()
        .parse(&body)
        .map_err(|issues| AppError::validation("Validation failed", issues))?;
    let supplier: SuppliersRow = db::insert(&state.db, &data)
        .await
        .or_500("Failed to create supplier")?;
    Ok(Json(supplier).into_response())
}

async fn update(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<String>,
    JsonBody(body): JsonBody,
) -> ApiResult {
    const FAILED: &str = "Failed to update supplier";
    if !["admin", "manager", "directeur"].contains(&user.role()) {
        return Err(forbidden());
    }
    let id = int_id(&id, FAILED)?;
    let data = insert_schema()
        .partial()
        .parse(&body)
        .map_err(|_| AppError::internal(FAILED))?;
    let supplier = db::update_by_id::<SuppliersRow>(&state.db, id, &data, true)
        .await
        .or_500(FAILED)?;
    Ok(json_or_empty(supplier))
}

async fn remove(State(state): State<AppState>, user: CurrentUser, Path(id): Path<String>) -> ApiResult {
    const FAILED: &str = "Failed to delete supplier";
    if !["admin", "directeur"].contains(&user.role()) {
        return Err(forbidden());
    }
    let id = int_id(&id, FAILED)?;
    db::delete_by_id::<SuppliersRow>(&state.db, id)
        .await
        .or_500(FAILED)?;
    Ok(Json(json!({ "message": "Supplier deleted successfully" })).into_response())
}
