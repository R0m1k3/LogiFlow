// Commandes clients : /api/customer-orders (server/routes.ts, « Customer Orders
// routes » et « Client call tracking routes » ; storage.ts getCustomerOrders à
// markClientCalled). Comme Node aujourd'hui :
// - un compte sans magasin voit les commandes de tous les magasins ;
// - création et modification sans schéma zod (insertCustomerOrderSchema n'est pas
//   appliqué) : les champs connus de la table sont écrits tels quels, les erreurs de
//   la base deviennent des 500 ;
// - la modification ne contrôle que le magasin d'origine de la commande : elle peut
//   la déplacer vers un autre magasin ;
// - les appels à passer ignorent les commandes dont customer_notified est NULL.

use std::collections::HashMap;

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::{Json, Router, routing::get, routing::patch, routing::put};
use serde_json::{Value, json};
use sqlx::{Postgres, QueryBuilder};

use crate::AppState;
use crate::auth::CurrentUser;
use crate::db::{self, columns_of, drizzle_values, node_pg_value};
use crate::error::{ApiResult, AppError, OrInternal, json_or_empty};
use crate::js;
use crate::json::spread;
use crate::modules::now_iso;
use crate::projections::GroupSummary;
use crate::request::{JsQuery, JsonBody, int_id};
use crate::schema::{CustomerOrdersRow, SuppliersRow};
use crate::zod::Parsed;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/customer-orders", get(list).post(create))
        .route("/api/customer-orders/pending-calls", get(pending_calls))
        .route("/api/customer-orders/{id}", put(update).delete(remove))
        .route("/api/customer-orders/{id}/mark-called", patch(mark_called))
}

/// Statuts d'une commande arrivée en magasin, client à prévenir
const ARRIVED: [&str; 6] = ["Disponible", "disponible", "Arrivé", "arrivé", "Prêt", "prêt"];

/// Créateur joint par getCustomerOrders (jamais lu : toujours « unknown »)
fn unknown_creator(order: &CustomerOrdersRow) -> Value {
    json!({ "id": order.created_by, "username": "unknown" })
}

/// Commandes de la requête principale (jointures et tri de Node), complétées comme
/// { ...commande, supplier, group, creator }
async fn with_relations(
    state: &AppState,
    sql: &mut QueryBuilder<'_, Postgres>,
    creator: fn(&CustomerOrdersRow) -> Value,
) -> Result<Vec<Value>, sqlx::Error> {
    let orders: Vec<CustomerOrdersRow> = sql.build_query_as().fetch_all(&state.db).await?;
    let supplier_ids: Vec<i32> = orders.iter().map(|order| order.supplier_id).collect();
    let suppliers: HashMap<i32, SuppliersRow> = db::find_by_ids::<SuppliersRow>(&state.db, &supplier_ids)
        .await?
        .into_iter()
        .map(|supplier| (supplier.id, supplier))
        .collect();
    let group_ids: Vec<i32> = orders.iter().map(|order| order.group_id).collect();
    let groups = GroupSummary::by_ids(&state.db, &group_ids).await?;
    Ok(orders
        .iter()
        .map(|order| {
            let mut entry = spread(order);
            entry.insert("supplier".into(), json!(suppliers.get(&order.supplier_id)));
            entry.insert("group".into(), json!(groups.get(&order.group_id)));
            entry.insert("creator".into(), creator(order));
            Value::Object(entry)
        })
        .collect())
}

fn select_with_joins() -> QueryBuilder<'static, Postgres> {
    QueryBuilder::new(format!(
        "SELECT {} FROM customer_orders
           LEFT JOIN suppliers ON customer_orders.supplier_id = suppliers.id
           LEFT JOIN groups ON customer_orders.group_id = groups.id",
        columns_of::<CustomerOrdersRow>("customer_orders")
    ))
}

async fn list(State(state): State<AppState>, user: CurrentUser, query: JsQuery) -> ApiResult {
    // Toute erreur : 500 avec une liste vide
    let failed = || AppError::with_body(StatusCode::INTERNAL_SERVER_ERROR, json!([]));
    let store = query.truthy("storeId");
    // Admin : ?storeId ou tous ; hors admin : ?storeId s'il est l'un des siens,
    // sinon tous les siens (aucun pour un compte sans magasin : toutes les commandes)
    let group_ids: Vec<i32> = if user.is_admin() {
        match store {
            Some(store) => vec![int_id(store, "").map_err(|_| failed())?],
            None => Vec::new(),
        }
    } else {
        let mine = user.group_ids();
        match store.and_then(js::parse_int) {
            Some(requested) if mine.iter().any(|id| f64::from(*id) == requested) => vec![requested as i32],
            _ => mine,
        }
    };
    let mut sql = select_with_joins();
    if !group_ids.is_empty() {
        sql.push(" WHERE customer_orders.group_id = ANY(")
            .push_bind(group_ids)
            .push(")");
    }
    sql.push(" ORDER BY customer_orders.created_at DESC");
    let orders = with_relations(&state, &mut sql, unknown_creator)
        .await
        .map_err(|_| failed())?;
    Ok(Json(orders).into_response())
}

async fn create(State(state): State<AppState>, user: CurrentUser, JsonBody(body): JsonBody) -> ApiResult {
    const FAILED: &str = "Failed to create customer order";
    let mut data = body.as_object().cloned().unwrap_or_default();
    data.insert("createdBy".into(), json!(user.id()));
    if !user.is_admin() {
        // Magasin en texte converti par parseInt ; tout autre type ne correspond à aucun magasin
        let requested = match data.get("groupId") {
            Some(Value::String(text)) => js::parse_int(text),
            Some(Value::Number(number)) => number.as_f64(),
            _ => None,
        };
        if !["manager", "directeur", "employee"].contains(&user.role()) {
            return Err(AppError::forbidden(
                "Insufficient permissions to create customer orders",
            ));
        }
        if !requested.is_some_and(|requested| user.group_ids().iter().any(|id| f64::from(*id) == requested)) {
            return Err(AppError::forbidden("Access denied to this group"));
        }
    }
    let values = drizzle_values::<CustomerOrdersRow>(&data).map_err(|_| AppError::internal(FAILED))?;
    let order: CustomerOrdersRow = db::insert(&state.db, &values).await.or_500(FAILED)?;
    Ok(Json(order).into_response())
}

/// Commande existante et du magasin de l'utilisateur (hors admin)
async fn find_for(
    state: &AppState,
    user: &CurrentUser,
    raw_id: &str,
    failed: &str,
    denied: &str,
) -> Result<CustomerOrdersRow, AppError> {
    let id = int_id(raw_id, failed)?;
    let order = db::find_by_id::<CustomerOrdersRow>(&state.db, id)
        .await
        .or_500(failed)?
        .ok_or_else(|| AppError::not_found("Customer order not found"))?;
    if !user.is_admin() && !user.group_ids().contains(&order.group_id) {
        return Err(AppError::forbidden(denied));
    }
    Ok(order)
}

async fn update(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<String>,
    JsonBody(body): JsonBody,
) -> ApiResult {
    const FAILED: &str = "Failed to update customer order";
    let order = find_for(&state, &user, &id, FAILED, "Access denied").await?;
    let mut data = body.as_object().cloned().unwrap_or_default();
    // updatedAt du corps remplacé par new Date()
    data.remove("updatedAt");
    let values = drizzle_values::<CustomerOrdersRow>(&data).map_err(|_| AppError::internal(FAILED))?;
    let updated = db::update_by_id::<CustomerOrdersRow>(&state.db, order.id, &values, true)
        .await
        .or_500(FAILED)?;
    Ok(json_or_empty(updated))
}

async fn remove(State(state): State<AppState>, user: CurrentUser, Path(id): Path<String>) -> ApiResult {
    const FAILED: &str = "Failed to delete customer order";
    let order = find_for(&state, &user, &id, FAILED, "Access denied").await?;
    db::delete_by_id::<CustomerOrdersRow>(&state.db, order.id)
        .await
        .or_500(FAILED)?;
    Ok(Json(json!({ "message": "Customer order deleted successfully" })).into_response())
}

async fn pending_calls(State(state): State<AppState>, user: CurrentUser, query: JsQuery) -> ApiResult {
    const FAILED: &str = "Failed to fetch pending client calls";
    if user.role() == "employee" {
        return Err(AppError::forbidden("Insufficient permissions"));
    }
    // Admin : ?storeId s'il est donné ; directeur et manager : leurs magasins
    let group_ids: Vec<i32> = if user.is_admin() {
        match query.truthy("storeId") {
            Some(store) => vec![int_id(store, FAILED)?],
            None => Vec::new(),
        }
    } else {
        user.group_ids()
    };
    let mut sql = select_with_joins();
    sql.push(" WHERE customer_orders.customer_notified = false AND customer_orders.status = ANY(")
        .push_bind(ARRIVED.map(String::from).to_vec())
        .push(")");
    if !group_ids.is_empty() {
        sql.push(" AND customer_orders.group_id = ANY(")
            .push_bind(group_ids)
            .push(")");
    }
    sql.push(" ORDER BY customer_orders.created_at DESC");
    let orders = with_relations(&state, &mut sql, |_| Value::Null)
        .await
        .or_500(FAILED)?;
    Ok(Json(orders).into_response())
}

async fn mark_called(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<String>,
    JsonBody(body): JsonBody,
) -> ApiResult {
    const FAILED: &str = "Failed to mark client as called";
    if user.role() == "employee" {
        return Err(AppError::forbidden("Insufficient permissions"));
    }
    let order = find_for(&state, &user, &id, FAILED, "Access denied to this customer order").await?;
    // comment || null
    let comment = body
        .get("comment")
        .filter(|comment| js::truthy(comment))
        .map_or(Value::Null, node_pg_value);
    let mut values = Parsed::new();
    values.insert("customerNotified".into(), Value::Bool(true));
    values.insert("notifiedAt".into(), json!(now_iso()));
    values.insert("notifiedComment".into(), comment);
    let updated = db::update_by_id::<CustomerOrdersRow>(&state.db, order.id, &values, true)
        .await
        .or_500(FAILED)?;
    Ok(json_or_empty(updated))
}
