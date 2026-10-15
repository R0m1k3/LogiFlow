// Commandes fournisseurs : /api/orders, /api/sync-order-delivery-status
// (server/routes.ts, « Orders routes » ; storage.ts getOrders à deleteOrder).
//
// Formes de Node reproduites :
// - liste : champs dans l'ordre du select de Drizzle (statut avant quantité),
//   fournisseur complet, magasin réduit (groupReconciliationColumns), créateur
//   réduit, puis les livraisons de chaque commande ;
// - GET /:id : magasin complet (adresse, logo, configuration NocoDB et SMTP, le
//   mot de passe SMTP remplacé par smtpPasswordSet).
//
// Défauts de Node reproduits :
// - un directeur ou un manager sans ?storeId ne voit que son premier magasin ;
//   un employé sans ?storeId ne voit rien ;
// - PUT accepte groupId et createdBy (schéma d'insertion partiel) : une commande
//   peut être déplacée vers un magasin de l'utilisateur ou non, et changer de
//   créateur ; un corps invalide donne un 500 (l'erreur zod n'est pas renvoyée) ;
// - POST /api/sync-order-delivery-status lit les commandes de tous les magasins.

use std::collections::HashMap;

use axum::extract::{Path, State};
use axum::response::IntoResponse;
use axum::routing::{get, post};
use axum::{Json, Router};
use serde_json::{Map, Value, json};
use sqlx::{PgPool, Postgres, QueryBuilder};

use crate::AppState;
use crate::access::has_permission;
use crate::auth::CurrentUser;
use crate::db::{self, columns_of};
use crate::error::{ApiResult, AppError, OrInternal};
use crate::js;
use crate::json::{spread, strip_smtp_password};
use crate::modules::deliveries::{self, DeliveryItem, fields_in_order, group_reconciliations};
use crate::projections::{GroupReconciliation, UserSummary};
use crate::request::{JsQuery, JsonBody, int_id};
use crate::schema::{GroupsRow, OrdersRow, SuppliersRow};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/orders", get(list).post(create))
        .route("/api/orders/{id}", get(show).put(update).delete(remove))
        .route("/api/sync-order-delivery-status", post(sync_statuses))
}

/// Champs d'une commande dans l'ordre du select de getOrders / getOrder
const ORDER_FIELDS: &[&str] = &[
    "id",
    "supplierId",
    "groupId",
    "plannedDate",
    "status",
    "quantity",
    "unit",
    "notes",
    "createdBy",
    "createdAt",
    "updatedAt",
];

/// Jointures de getOrders, loadOrdersByIds et getOrder
const ORDER_JOINS: &str = "FROM orders
    LEFT JOIN suppliers ON orders.supplier_id = suppliers.id
    LEFT JOIN groups ON orders.group_id = groups.id
    LEFT JOIN users ON orders.created_by = users.id";

/// Début de la requête jointe de Drizzle : les colonnes de la commande, et
/// celles des tables jointes qui gardent les jointures (même plan que Node,
/// donc même ordre des lignes à égalité de tri)
fn order_select() -> String {
    format!(
        "SELECT {}, suppliers.id AS joined_supplier_id, groups.id AS joined_group_id, users.id AS joined_user_id {ORDER_JOINS}",
        columns_of::<OrdersRow>("orders")
    )
}

/// Commande d'une liste, avec ses relations (fournisseur, magasin réduit, créateur)
#[derive(Debug, Clone)]
pub struct OrderItem {
    pub row: OrdersRow,
    pub supplier: Option<SuppliersRow>,
    pub group: Option<GroupReconciliation>,
    pub creator: Option<UserSummary>,
}

impl OrderItem {
    pub fn to_json(&self) -> Map<String, Value> {
        let mut out = fields_in_order(&spread(&self.row), ORDER_FIELDS);
        out.insert("supplier".into(), json!(self.supplier));
        out.insert("group".into(), json!(self.group));
        out.insert("creator".into(), json!(self.creator));
        out
    }
}

/// Lignes de la requête jointe, complétées par leurs relations (lues par identifiant)
async fn joined_orders(
    db: &PgPool,
    mut sql: QueryBuilder<'_, Postgres>,
) -> Result<Vec<OrderItem>, sqlx::Error> {
    let rows: Vec<OrdersRow> = sql.build_query_as().fetch_all(db).await?;
    let supplier_ids: Vec<i32> = rows.iter().map(|row| row.supplier_id).collect();
    let suppliers: HashMap<i32, SuppliersRow> = db::find_by_ids::<SuppliersRow>(db, &supplier_ids)
        .await?
        .into_iter()
        .map(|supplier| (supplier.id, supplier))
        .collect();
    let group_ids: Vec<i32> = rows.iter().map(|row| row.group_id).collect();
    let groups = group_reconciliations(db, &group_ids).await?;
    let creator_ids: Vec<String> = rows.iter().map(|row| row.created_by.clone()).collect();
    let creators = UserSummary::by_ids(db, &creator_ids).await?;
    Ok(rows
        .into_iter()
        .map(|row| OrderItem {
            supplier: suppliers.get(&row.supplier_id).cloned(),
            group: groups.get(&row.group_id).cloned(),
            creator: creators.get(&row.created_by).cloned(),
            row,
        })
        .collect())
}

/// loadOrdersByIds : commandes jointes, par identifiant
pub async fn orders_by_ids(db: &PgPool, ids: &[i32]) -> Result<HashMap<i32, OrderItem>, sqlx::Error> {
    if ids.is_empty() {
        return Ok(HashMap::new());
    }
    let mut sql = QueryBuilder::new(order_select());
    sql.push(" WHERE orders.id = ANY(")
        .push_bind(ids.to_vec())
        .push(")");
    Ok(joined_orders(db, sql)
        .await?
        .into_iter()
        .map(|order| (order.row.id, order))
        .collect())
}

/// Période demandée (startDate, endDate), comparée à la date prévue
type DateRange<'a> = Option<(&'a str, &'a str)>;

/// getOrders / getOrdersByDateRange : commandes (de ces magasins si la liste
/// n'est pas vide) et leurs livraisons
async fn get_orders(
    db: &PgPool,
    group_ids: &[i32],
    range: DateRange<'_>,
) -> Result<Vec<(OrderItem, Vec<DeliveryItem>)>, sqlx::Error> {
    let mut sql = QueryBuilder::new(order_select());
    let mut conditions = 0;
    if let Some((start, end)) = range {
        sql.push(" WHERE orders.planned_date >= ")
            .push_bind(start.to_string())
            .push("::date AND orders.planned_date <= ")
            .push_bind(end.to_string())
            .push("::date");
        conditions += 1;
    }
    if !group_ids.is_empty() {
        sql.push(if conditions == 0 { " WHERE " } else { " AND " })
            .push("orders.group_id = ANY(")
            .push_bind(group_ids.to_vec())
            .push(")");
    }
    sql.push(if range.is_some() {
        " ORDER BY orders.planned_date DESC"
    } else {
        " ORDER BY orders.created_at DESC"
    });
    let orders = joined_orders(db, sql).await?;
    let ids: Vec<i32> = orders.iter().map(|order| order.row.id).collect();
    let mut deliveries = deliveries::deliveries_by_order_ids(db, &ids).await?;
    Ok(orders
        .into_iter()
        .map(|order| {
            let list = deliveries.remove(&order.row.id).unwrap_or_default();
            (order, list)
        })
        .collect())
}

/// Commande de getOrder : magasin complet et livraisons associées
#[derive(Debug, Clone)]
pub struct OrderDetail {
    pub row: OrdersRow,
    supplier: Option<SuppliersRow>,
    group: Option<GroupsRow>,
    creator: Option<UserSummary>,
    deliveries: Vec<DeliveryItem>,
}

impl OrderDetail {
    /// Forme de Node, avant le masquage du mot de passe SMTP
    pub fn to_json(&self) -> Value {
        let mut out = fields_in_order(&spread(&self.row), ORDER_FIELDS);
        out.insert("supplier".into(), json!(self.supplier));
        out.insert("group".into(), json!(self.group));
        out.insert("creator".into(), json!(self.creator));
        out.insert(
            "deliveries".into(),
            Value::Array(
                self.deliveries
                    .iter()
                    .map(|item| Value::Object(item.to_json()))
                    .collect(),
            ),
        );
        Value::Object(out)
    }
}

/// storage.getOrder
pub async fn get_order(db: &PgPool, id: i32) -> Result<Option<OrderDetail>, sqlx::Error> {
    let row = sqlx::query_as::<_, OrdersRow>(&format!("{} WHERE orders.id = $1", order_select()))
        .bind(id)
        .fetch_optional(db)
        .await?;
    let deliveries = deliveries::deliveries_of_order(db, id).await?;
    let Some(row) = row else {
        return Ok(None);
    };
    let supplier = db::find_by_id::<SuppliersRow>(db, row.supplier_id).await?;
    let group = db::find_by_id::<GroupsRow>(db, row.group_id).await?;
    let creator = UserSummary::by_ids(db, std::slice::from_ref(&row.created_by))
        .await?
        .remove(&row.created_by);
    Ok(Some(OrderDetail {
        row,
        supplier,
        group,
        creator,
        deliveries,
    }))
}

/// Magasins lus par GET /api/orders et GET /api/deliveries, ou None quand Node
/// renvoie directement une liste vide. Admin : ?storeId s'il est donné (parseInt,
/// un texte illisible fait échouer la requête : Err) ; sinon ?storeId s'il est
/// l'un des siens, ou le premier de ses magasins pour un directeur ou un manager.
pub fn listed_groups(user: &CurrentUser, query: &JsQuery) -> Result<Option<Vec<i32>>, ()> {
    let store = query.truthy("storeId");
    if user.is_admin() {
        return match store {
            Some(store) => db::parse_int4(store).map(|id| Some(vec![id])).ok_or(()),
            None => Ok(Some(Vec::new())),
        };
    }
    let mine = user.group_ids();
    if let Some(store) = store {
        let requested = js::parse_int(store);
        return Ok(mine
            .iter()
            .find(|id| Some(f64::from(**id)) == requested)
            .map(|id| vec![*id]));
    }
    if matches!(user.role(), "directeur" | "manager") {
        return Ok(mine.first().map(|first| vec![*first]));
    }
    Ok(None)
}

/// startDate et endDate, tous deux renseignés
pub fn date_range(query: &JsQuery) -> DateRange<'_> {
    query.truthy("startDate").zip(query.truthy("endDate"))
}

async fn list(State(state): State<AppState>, user: CurrentUser, query: JsQuery) -> ApiResult {
    const FAILED: &str = "Failed to fetch orders";
    let Some(group_ids) = listed_groups(&user, &query).map_err(|_| AppError::internal(FAILED))? else {
        return Ok(Json(json!([])).into_response());
    };
    let orders = get_orders(&state.db, &group_ids, date_range(&query))
        .await
        .or_500(FAILED)?;
    let out: Vec<Value> = orders
        .into_iter()
        .map(|(order, deliveries)| {
            let mut entry = order.to_json();
            entry.insert(
                "deliveries".into(),
                Value::Array(
                    deliveries
                        .iter()
                        .map(|item| Value::Object(item.to_json()))
                        .collect(),
                ),
            );
            Value::Object(entry)
        })
        .collect();
    Ok(Json(out).into_response())
}

/// Hors admin : la commande doit être d'un magasin de l'utilisateur
fn check_group(user: &CurrentUser, group_id: i32) -> Result<(), AppError> {
    if user.is_admin() || user.group_ids().contains(&group_id) {
        Ok(())
    } else {
        Err(AppError::forbidden("Access denied"))
    }
}

/// Commande existante, ou 404 ; erreur de lecture (identifiant illisible) : 500
async fn existing_order(db: &PgPool, raw_id: &str, failed: &str) -> Result<OrderDetail, AppError> {
    let id = int_id(raw_id, failed)?;
    get_order(db, id)
        .await
        .or_500(failed)?
        .ok_or_else(|| AppError::not_found("Order not found"))
}

async fn show(State(state): State<AppState>, user: CurrentUser, Path(id): Path<String>) -> ApiResult {
    let order = existing_order(&state.db, &id, "Failed to fetch order").await?;
    check_group(&user, order.row.group_id)?;
    Ok(Json(strip_smtp_password(order.to_json())).into_response())
}

/// insertOrderSchema : createInsertSchema(orders) sans id, createdAt, updatedAt
fn order_schema() -> crate::zod::Object {
    OrdersRow::insert_schema().omit(&["id", "createdAt", "updatedAt"])
}

/// { ...req.body, champs } : un tableau devient un objet à clés numériques (que
/// le schéma ignore), toute autre valeur un objet vide
pub fn spread_body(body: &Value) -> Map<String, Value> {
    match body {
        Value::Object(fields) => fields.clone(),
        Value::Array(items) => items
            .iter()
            .enumerate()
            .map(|(index, item)| (index.to_string(), item.clone()))
            .collect(),
        _ => Map::new(),
    }
}

async fn create(State(state): State<AppState>, user: CurrentUser, JsonBody(body): JsonBody) -> ApiResult {
    const FAILED: &str = "Failed to create order";
    let mut input = spread_body(&body);
    input.insert("createdBy".into(), Value::String(user.id().to_string()));
    let data = order_schema()
        .parse(&Value::Object(input))
        .map_err(|issues| AppError::validation("Validation failed", issues))?;
    let group_id = data.get("groupId").and_then(Value::as_i64);
    if !user.is_admin() && !user.group_ids().iter().any(|id| Some(i64::from(*id)) == group_id) {
        return Err(AppError::forbidden("Access denied to this group"));
    }
    let order = db::insert_values_first::<OrdersRow>(&state.db, &data)
        .await
        .or_500(FAILED)?;
    Ok(Json(order).into_response())
}

async fn update(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<String>,
    JsonBody(body): JsonBody,
) -> ApiResult {
    const FAILED: &str = "Failed to update order";
    let order = existing_order(&state.db, &id, FAILED).await?;
    if !has_permission(user.role(), "orders", "edit") {
        return Err(AppError::forbidden("Insufficient permissions to edit orders"));
    }
    check_group(&user, order.row.group_id)?;
    // ZodError interceptée comme toute autre erreur : 500
    let data = order_schema()
        .partial()
        .parse(&body)
        .map_err(|_| AppError::internal(FAILED))?;
    let updated = db::update_by_id::<OrdersRow>(&state.db, order.row.id, &data, true)
        .await
        .or_500(FAILED)?;
    Ok(crate::error::json_or_empty(updated))
}

async fn remove(State(state): State<AppState>, user: CurrentUser, Path(id): Path<String>) -> ApiResult {
    const FAILED: &str = "Failed to delete order";
    let order = existing_order(&state.db, &id, FAILED).await?;
    if !has_permission(user.role(), "orders", "delete") {
        return Err(AppError::forbidden("Insufficient permissions to delete orders"));
    }
    check_group(&user, order.row.group_id)?;
    // Une commande qui a des livraisons ne peut pas être supprimée (clé étrangère) : 500
    db::delete_by_id::<OrdersRow>(&state.db, order.row.id)
        .await
        .or_500(FAILED)?;
    Ok(Json(json!({ "message": "Order deleted successfully" })).into_response())
}

/// updateOrder(id, { status }) : la ligne mise à jour, si elle existe
pub async fn set_order_status(db: &PgPool, id: i32, status: &str) -> Result<Option<OrdersRow>, sqlx::Error> {
    let mut data = Map::new();
    data.insert("status".into(), Value::String(status.to_string()));
    db::update_by_id::<OrdersRow>(db, id, &data, true).await
}

/// Commandes qui ont une livraison livrée sans être elles-mêmes livrées : passées
/// à « delivered », une par une, dans l'ordre de la liste
async fn sync_statuses(State(state): State<AppState>, user: CurrentUser) -> ApiResult {
    if !user.is_admin() {
        return Err(AppError::forbidden("Access denied"));
    }
    let orders = get_orders(&state.db, &[], None).await.map_err(|error| {
        tracing::error!(%error, "synchronisation des statuts");
        AppError::with_body(
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            json!({ "message": "Failed to synchronize statuses", "error": error.to_string() }),
        )
    })?;
    let mut problematic = Vec::new();
    let mut fixed = Vec::new();
    for (order, deliveries) in &orders {
        let delivered = deliveries
            .iter()
            .filter(|item| item.row.status == "delivered")
            .count();
        if delivered == 0 || order.row.status == "delivered" {
            continue;
        }
        problematic.push(json!({
            "orderId": order.row.id,
            "currentStatus": order.row.status,
            "deliveredDeliveries": delivered,
            "totalDeliveries": deliveries.len(),
        }));
        match set_order_status(&state.db, order.row.id, "delivered").await {
            Ok(_) => fixed.push(order.row.id),
            Err(error) => tracing::error!(%error, order = order.row.id, "synchronisation du statut"),
        }
    }
    Ok(Json(json!({
        "message": "Synchronization completed",
        "diagnostics": {
            "problematicOrdersFound": problematic.len(),
            "ordersFixed": fixed.len(),
            "problematicOrders": problematic,
            "fixedOrders": fixed,
        },
    }))
    .into_response())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn corps_etale_comme_javascript() {
        assert_eq!(
            Value::Object(spread_body(&json!(["a", 2]))),
            json!({ "0": "a", "1": 2 })
        );
        assert_eq!(Value::Object(spread_body(&json!({ "x": 1 }))), json!({ "x": 1 }));
    }

    #[test]
    fn schema_de_commande() {
        let issues = order_schema().parse(&json!({ "createdBy": "u" })).unwrap_err();
        let paths: Vec<&Value> = issues.iter().map(|issue| &issue["path"][0]).collect();
        assert_eq!(
            paths,
            [&json!("supplierId"), &json!("groupId"), &json!("plannedDate")]
        );
    }
}
