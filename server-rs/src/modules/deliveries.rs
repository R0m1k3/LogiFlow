// Livraisons : /api/deliveries (server/routes.ts, « Deliveries routes »,
// validation et contrôle ; storage.ts getDeliveries à markDeliveryControlValidated).
//
// Formes de Node reproduites :
// - liste : champs dans l'ordre du select de Drizzle, fournisseur complet, magasin
//   réduit (groupReconciliationColumns), créateur réduit, commande associée (sans
//   ses livraisons, absente si elle est d'un autre magasin) et nombre de
//   commentaires de rapprochement ;
// - GET /:id : sans les champs du contrôle, magasin complet (mot de passe SMTP
//   remplacé par smtpPasswordSet), commande complète (getOrder).
//
// Effets de bord de Node reproduits, dans le même ordre (mêmes requêtes) :
// - lier une commande « pending » la fait passer à « planned » (création et
//   modification) ; valider une livraison passe sa commande à « delivered » ;
// - fournisseur en rapprochement automatique : livraison livrée avec un BL
//   rapprochée d'office (seconde mise à jour, la réponse reste la première ligne) ;
// - changer la référence de facture relit l'échéance dans NocoDB (sans cache) ;
// - valider marque « rapprochées » les entrées du cache de l'ancienne référence et
//   de l'ancien numéro de BL.
//
// Défauts de Node reproduits :
// - un directeur ou un manager sans ?storeId ne voit que son premier magasin ;
// - la validation ne contrôle le magasin que pour un manager (un directeur valide
//   les livraisons de tout magasin) ; le contrôle (PUT /:id/control) ne contrôle
//   jamais le magasin ;
// - PUT accepte groupId, createdBy, reconciled… (schéma d'insertion partiel) : une
//   livraison peut changer de magasin ; un corps invalide donne un 500 ;
// - POST : erreurs de validation rendues en 500 (pas de 400 zod).

use std::collections::HashMap;

use axum::extract::{Path, State};
use axum::response::IntoResponse;
use axum::routing::{get, post, put};
use axum::{Json, Router};
use serde_json::{Map, Value, json};
use sqlx::{PgPool, Postgres, QueryBuilder};

use crate::AppState;
use crate::access::has_permission;
use crate::auth::CurrentUser;
use crate::db::{self, columns_of};
use crate::error::{ApiResult, AppError, OrInternal, json_or_empty};
use crate::js;
use crate::json::{spread, strip_smtp_password};
use crate::modules::orders::{self, OrderItem, date_range, listed_groups, spread_body};
use crate::projections::{GroupReconciliation, UserSummary};
use crate::request::{JsQuery, JsonBody, int_id};
use crate::schema::{DeliveriesRow, GroupsRow, OrdersRow, SuppliersRow};
use crate::services::dates;
use crate::services::invoice_verification as verification;
use crate::zod::Parsed;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/deliveries", get(list).post(create))
        .route("/api/deliveries/{id}", get(show).put(update).delete(remove))
        .route("/api/deliveries/{id}/validate", post(validate))
        .route("/api/deliveries/{id}/control", put(control))
}

/// Champs d'une livraison dans l'ordre du select de getDeliveries
const DELIVERY_FIELDS: &[&str] = &[
    "id",
    "orderId",
    "supplierId",
    "groupId",
    "scheduledDate",
    "deliveredDate",
    "status",
    "quantity",
    "unit",
    "blNumber",
    "blAmount",
    "invoiceReference",
    "invoiceAmount",
    "invoiceAmountTTC",
    "dueDate",
    "reconciled",
    "validatedAt",
    "controlValidated",
    "controlValidatedBy",
    "controlValidatedAt",
    "notes",
    "createdBy",
    "createdAt",
    "updatedAt",
];

/// Statuts acceptés par le filtre ?status de la liste
const LISTED_STATUSES: [&str; 3] = ["pending", "planned", "delivered"];

/// Les champs `keys` d'un objet, dans cet ordre (projection d'un select de Drizzle)
pub fn fields_in_order(fields: &Map<String, Value>, keys: &[&str]) -> Map<String, Value> {
    keys.iter()
        .filter_map(|key| fields.get(*key).map(|value| (key.to_string(), value.clone())))
        .collect()
}

/// groupReconciliationColumns des magasins `ids`, par identifiant (seconde
/// moitié d'un leftJoin(groups))
pub async fn group_reconciliations(
    db: &PgPool,
    ids: &[i32],
) -> Result<HashMap<i32, GroupReconciliation>, sqlx::Error> {
    let rows: Vec<GroupReconciliation> = sqlx::query_as(&format!(
        "SELECT {} FROM groups g WHERE g.id = ANY($1)",
        GroupReconciliation::columns("g")
    ))
    .bind(ids)
    .fetch_all(db)
    .await?;
    Ok(rows.into_iter().map(|group| (group.id, group)).collect())
}

/// Jointures des livraisons (fournisseur, magasin, créateur)
const DELIVERY_JOINS: &str = "FROM deliveries
    LEFT JOIN suppliers ON deliveries.supplier_id = suppliers.id
    LEFT JOIN groups ON deliveries.group_id = groups.id
    LEFT JOIN users ON deliveries.created_by = users.id";

/// Début de la requête jointe de Drizzle : les colonnes de la livraison, et celles
/// des tables jointes qui gardent les jointures (même plan que Node, donc même
/// ordre des lignes quand il n'y a pas de tri)
fn delivery_select() -> String {
    format!(
        "SELECT {}, suppliers.id AS joined_supplier_id, groups.id AS joined_group_id, users.id AS joined_user_id {DELIVERY_JOINS}",
        columns_of::<DeliveriesRow>("deliveries")
    )
}

/// Livraison d'une liste, avec ses relations (fournisseur, magasin réduit, créateur)
#[derive(Debug, Clone)]
pub struct DeliveryItem {
    pub row: DeliveriesRow,
    pub supplier: Option<SuppliersRow>,
    pub group: Option<GroupReconciliation>,
    pub creator: Option<UserSummary>,
}

impl DeliveryItem {
    pub fn to_json(&self) -> Map<String, Value> {
        let mut out = fields_in_order(&spread(&self.row), DELIVERY_FIELDS);
        out.insert("supplier".into(), json!(self.supplier));
        out.insert("group".into(), json!(self.group));
        out.insert("creator".into(), json!(self.creator));
        out
    }
}

/// Lignes de la requête jointe, complétées par leurs relations (lues par identifiant)
async fn joined_deliveries(
    db: &PgPool,
    mut sql: QueryBuilder<'_, Postgres>,
) -> Result<Vec<DeliveryItem>, sqlx::Error> {
    let rows: Vec<DeliveriesRow> = sql.build_query_as().fetch_all(db).await?;
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
        .map(|row| DeliveryItem {
            supplier: suppliers.get(&row.supplier_id).cloned(),
            group: groups.get(&row.group_id).cloned(),
            creator: creators.get(&row.created_by).cloned(),
            row,
        })
        .collect())
}

/// loadDeliveriesByOrderIds : livraisons jointes, par commande (dans l'ordre de la requête)
pub async fn deliveries_by_order_ids(
    db: &PgPool,
    order_ids: &[i32],
) -> Result<HashMap<i32, Vec<DeliveryItem>>, sqlx::Error> {
    let mut by_order: HashMap<i32, Vec<DeliveryItem>> = HashMap::new();
    if order_ids.is_empty() {
        return Ok(by_order);
    }
    let mut sql = QueryBuilder::new(delivery_select());
    sql.push(" WHERE deliveries.order_id = ANY(")
        .push_bind(order_ids.to_vec())
        .push(")");
    for item in joined_deliveries(db, sql).await? {
        if let Some(order_id) = item.row.order_id {
            by_order.entry(order_id).or_default().push(item);
        }
    }
    Ok(by_order)
}

/// Livraisons jointes d'une commande (getOrder)
pub async fn deliveries_of_order(db: &PgPool, order_id: i32) -> Result<Vec<DeliveryItem>, sqlx::Error> {
    let mut sql = QueryBuilder::new(delivery_select());
    sql.push(" WHERE deliveries.order_id = ").push_bind(order_id);
    joined_deliveries(db, sql).await
}

/// Livraison de getDeliveries : avec sa commande (même magasin) et son nombre de commentaires
#[derive(Debug, Clone)]
pub struct ListedDelivery {
    pub item: DeliveryItem,
    pub order: Option<OrderItem>,
    pub comments: i64,
}

impl ListedDelivery {
    pub fn to_json(&self) -> Value {
        let mut out = self.item.to_json();
        if let Some(order) = &self.order {
            out.insert("order".into(), Value::Object(order.to_json()));
        }
        out.insert("reconciliationCommentsCount".into(), json!(self.comments));
        Value::Object(out)
    }
}

/// loadReconciliationCommentCounts
async fn comment_counts(db: &PgPool, delivery_ids: &[i32]) -> Result<HashMap<i32, i64>, sqlx::Error> {
    if delivery_ids.is_empty() {
        return Ok(HashMap::new());
    }
    let rows: Vec<(i32, i64)> = sqlx::query_as(
        "SELECT delivery_id, count(*) FROM reconciliation_comments WHERE delivery_id = ANY($1) GROUP BY delivery_id",
    )
    .bind(delivery_ids)
    .fetch_all(db)
    .await?;
    Ok(rows.into_iter().collect())
}

/// attachOrdersAndCommentCounts : une commande d'un autre magasin n'est jamais jointe
async fn attach_orders_and_counts(
    db: &PgPool,
    items: Vec<DeliveryItem>,
) -> Result<Vec<ListedDelivery>, sqlx::Error> {
    let mut order_ids: Vec<i32> = items.iter().filter_map(|item| item.row.order_id).collect();
    order_ids.sort_unstable();
    order_ids.dedup();
    let delivery_ids: Vec<i32> = items.iter().map(|item| item.row.id).collect();
    let orders = orders::orders_by_ids(db, &order_ids).await?;
    let counts = comment_counts(db, &delivery_ids).await?;
    Ok(items
        .into_iter()
        .map(|item| {
            let order = item
                .row
                .order_id
                .filter(|id| *id != 0)
                .and_then(|id| orders.get(&id))
                .filter(|order| {
                    let same_store = order.row.group_id == item.row.group_id;
                    if !same_store {
                        tracing::error!(
                            delivery = item.row.id,
                            order = order.row.id,
                            "livraison liée à une commande d'un autre magasin"
                        );
                    }
                    same_store
                })
                .cloned();
            let comments = counts.get(&item.row.id).copied().unwrap_or(0);
            ListedDelivery {
                item,
                order,
                comments,
            }
        })
        .collect())
}

/// storage.getDeliveries : livraisons (de ces magasins si la liste n'est pas vide,
/// de ce statut s'il est donné), les plus récentes d'abord
pub async fn get_deliveries(
    db: &PgPool,
    group_ids: &[i32],
    status: Option<&str>,
) -> Result<Vec<ListedDelivery>, sqlx::Error> {
    let mut sql = QueryBuilder::new(delivery_select());
    let mut conditions = 0;
    if !group_ids.is_empty() {
        sql.push(" WHERE deliveries.group_id = ANY(")
            .push_bind(group_ids.to_vec())
            .push(")");
        conditions += 1;
    }
    if let Some(status) = status {
        sql.push(if conditions == 0 { " WHERE " } else { " AND " })
            .push("deliveries.status = ")
            .push_bind(status.to_string());
    }
    sql.push(" ORDER BY deliveries.created_at DESC");
    let items = joined_deliveries(db, sql).await?;
    attach_orders_and_counts(db, items).await
}

/// storage.getDeliveriesByDateRange : date prévue dans la période, la plus tardive d'abord
async fn get_deliveries_by_date_range(
    db: &PgPool,
    start: &str,
    end: &str,
    group_ids: &[i32],
) -> Result<Vec<ListedDelivery>, sqlx::Error> {
    let mut sql = QueryBuilder::new(delivery_select());
    sql.push(" WHERE deliveries.scheduled_date >= ")
        .push_bind(start.to_string())
        .push("::date AND deliveries.scheduled_date <= ")
        .push_bind(end.to_string())
        .push("::date");
    if !group_ids.is_empty() {
        sql.push(" AND deliveries.group_id = ANY(")
            .push_bind(group_ids.to_vec())
            .push(")");
    }
    sql.push(" ORDER BY deliveries.scheduled_date DESC");
    let items = joined_deliveries(db, sql).await?;
    attach_orders_and_counts(db, items).await
}

/// Champs de getDelivery : ceux de la liste sans le contrôle
const DETAIL_FIELDS: &[&str] = &[
    "id",
    "orderId",
    "supplierId",
    "groupId",
    "scheduledDate",
    "deliveredDate",
    "status",
    "quantity",
    "unit",
    "blNumber",
    "blAmount",
    "invoiceReference",
    "invoiceAmount",
    "invoiceAmountTTC",
    "dueDate",
    "reconciled",
    "validatedAt",
    "notes",
    "createdBy",
    "createdAt",
    "updatedAt",
];

/// Livraison de getDelivery : magasin complet, créateur, commande complète
/// (même magasin) et nombre de commentaires
#[derive(Debug, Clone)]
pub struct DeliveryDetail {
    pub row: DeliveriesRow,
    pub supplier: Option<SuppliersRow>,
    pub group: Option<GroupsRow>,
    creator: Option<UserSummary>,
    order: Option<orders::OrderDetail>,
    comments: i64,
}

impl DeliveryDetail {
    /// Réponse de Node (mot de passe SMTP masqué)
    pub fn to_json(&self) -> Value {
        let mut out = fields_in_order(&spread(&self.row), DETAIL_FIELDS);
        out.insert("supplier".into(), json!(self.supplier));
        out.insert("group".into(), json!(self.group));
        out.insert("creator".into(), json!(self.creator));
        if let Some(order) = &self.order {
            out.insert("order".into(), order.to_json());
        }
        out.insert("reconciliationCommentsCount".into(), json!(self.comments));
        strip_smtp_password(Value::Object(out))
    }
}

/// storage.getDelivery. Créateur, commande et commentaires sont lus chacun avec
/// son repli de Node (null, absente, 0) en cas d'erreur
pub async fn get_delivery(db: &PgPool, id: i32) -> Result<Option<DeliveryDetail>, sqlx::Error> {
    let row = sqlx::query_as::<_, DeliveriesRow>(&format!(
        "SELECT {}, suppliers.id AS joined_supplier_id, groups.id AS joined_group_id
           FROM deliveries
           LEFT JOIN suppliers ON deliveries.supplier_id = suppliers.id
           LEFT JOIN groups ON deliveries.group_id = groups.id
          WHERE deliveries.id = $1",
        columns_of::<DeliveriesRow>("deliveries")
    ))
    .bind(id)
    .fetch_optional(db)
    .await?;
    let Some(row) = row else {
        return Ok(None);
    };
    let supplier = db::find_by_id::<SuppliersRow>(db, row.supplier_id).await?;
    let group = db::find_by_id::<GroupsRow>(db, row.group_id).await?;
    let creator = UserSummary::by_ids(db, std::slice::from_ref(&row.created_by))
        .await
        .ok()
        .and_then(|mut found| found.remove(&row.created_by));
    let order = match row.order_id.filter(|order_id| *order_id != 0) {
        None => None,
        Some(order_id) => orders::get_order(db, order_id)
            .await
            .ok()
            .flatten()
            .filter(|order| {
                let same_store = order.row.group_id == row.group_id;
                if !same_store {
                    tracing::error!(delivery = id, order = order_id, "commande d'un autre magasin");
                }
                same_store
            }),
    };
    let comments = comment_counts(db, &[id])
        .await
        .ok()
        .and_then(|counts| counts.get(&id).copied())
        .unwrap_or(0);
    Ok(Some(DeliveryDetail {
        row,
        supplier,
        group,
        creator,
        order,
        comments,
    }))
}

/// updateDelivery : mise à jour (avec updatedAt) ; une commande liée encore
/// « pending » passe à « planned »
async fn update_delivery(db: &PgPool, id: i32, data: &Parsed) -> Result<Option<DeliveriesRow>, sqlx::Error> {
    let updated = db::update_by_id::<DeliveriesRow>(db, id, data, true).await?;
    if let Some(order_id) = data.get("orderId").filter(|value| js::truthy(value)) {
        plan_linked_order(db, order_id).await;
    }
    Ok(updated)
}

/// Commande liée à une livraison créée ou modifiée : « pending » devient
/// « planned ». Les erreurs sont journalisées, comme Node
async fn plan_linked_order(db: &PgPool, order_id: &Value) {
    let Some(order_id) = order_id.as_i64().and_then(|id| i32::try_from(id).ok()) else {
        return;
    };
    match db::find_by_id::<OrdersRow>(db, order_id).await {
        Ok(Some(order)) if order.status == "pending" => {
            if let Err(error) = orders::set_order_status(db, order_id, "planned").await {
                tracing::error!(%error, order_id, "commande liée : passage à planned");
            }
        }
        Ok(_) => {}
        Err(error) => tracing::error!(%error, order_id, "commande liée : lecture"),
    }
}

/// { reconciled: true, validatedAt: new Date() } : rapprochement automatique
async fn auto_reconcile(db: &PgPool, id: i32) {
    let mut data = Map::new();
    data.insert("reconciled".into(), Value::Bool(true));
    data.insert("validatedAt".into(), Value::String(crate::modules::now_iso()));
    if let Err(error) = update_delivery(db, id, &data).await {
        tracing::error!(%error, delivery = id, "rapprochement automatique");
    }
}

async fn list(State(state): State<AppState>, user: CurrentUser, query: JsQuery) -> ApiResult {
    const FAILED: &str = "Failed to fetch deliveries";
    let status = query
        .get("status")
        .filter(|status| LISTED_STATUSES.contains(status));
    let Some(group_ids) = listed_groups(&user, &query).map_err(|_| AppError::internal(FAILED))? else {
        return Ok(Json(json!([])).into_response());
    };
    let range = date_range(&query);
    let mut deliveries = match range {
        Some((start, end)) => get_deliveries_by_date_range(&state.db, start, end, &group_ids).await,
        None => get_deliveries(&state.db, &group_ids, status).await,
    }
    .or_500(FAILED)?;
    // La lecture par période ne filtre pas le statut en base
    if let (Some(status), Some(_)) = (status, range) {
        deliveries.retain(|delivery| delivery.item.row.status == status);
    }
    if query.get("withBL") == Some("true") {
        deliveries.retain(|delivery| {
            delivery
                .item
                .row
                .bl_number
                .as_deref()
                .is_some_and(|bl| !bl.is_empty())
                && delivery.item.row.status == "delivered"
        });
    }
    let out: Vec<Value> = deliveries.iter().map(ListedDelivery::to_json).collect();
    Ok(Json(out).into_response())
}

/// Hors admin : la livraison doit être d'un magasin de l'utilisateur
fn check_group(user: &CurrentUser, group_id: i32) -> Result<(), AppError> {
    if user.is_admin() || user.group_ids().contains(&group_id) {
        Ok(())
    } else {
        Err(AppError::forbidden("Access denied"))
    }
}

/// Livraison existante, ou 404 ; erreur de lecture (identifiant illisible) : 500
async fn existing_delivery(db: &PgPool, id: i32, failed: &str) -> Result<DeliveryDetail, AppError> {
    get_delivery(db, id)
        .await
        .or_500(failed)?
        .ok_or_else(|| AppError::not_found("Delivery not found"))
}

async fn show(State(state): State<AppState>, user: CurrentUser, Path(id): Path<String>) -> ApiResult {
    const FAILED: &str = "Failed to fetch delivery";
    let delivery = existing_delivery(&state.db, int_id(&id, FAILED)?, FAILED).await?;
    check_group(&user, delivery.row.group_id)?;
    Ok(Json(delivery.to_json()).into_response())
}

/// insertDeliverySchema : createInsertSchema(deliveries) sans id, createdAt, updatedAt
fn delivery_schema() -> crate::zod::Object {
    DeliveriesRow::insert_schema().omit(&["id", "createdAt", "updatedAt"])
}

/// Montant converti par le PUT : null ou '' → null, sinon valeur.toString()
fn amount_text(value: &Value) -> Value {
    match value {
        Value::Null => Value::Null,
        Value::String(text) if text.is_empty() => Value::Null,
        other => Value::String(js::string_of(other)),
    }
}

/// Horodatage converti par le PUT : null ou '' → null, sinon new Date(valeur).
/// Err : date invalide (refusée par z.date(), donc 500)
fn timestamp_value(value: &Value) -> Result<Value, ()> {
    match value {
        Value::Null => Ok(Value::Null),
        Value::String(text) if text.is_empty() => Ok(Value::Null),
        other => dates::js_date(other)
            .map(|date| Value::String(js::iso(&date)))
            .ok_or(()),
    }
}

/// Transformations du PUT avant la validation, puis insertDeliverySchema.partial().
/// Les dates converties en Date contournent z.date() (que du JSON ne satisfait jamais)
fn parse_update(body: &Value) -> Result<Parsed, ()> {
    if !body.is_object() {
        // { ...tableau } reste un objet : seuls ses indices s'y ajoutent
        return delivery_schema()
            .partial()
            .parse(&Value::Object(spread_body(body)))
            .map_err(|_| ());
    }
    let mut input = spread_body(body);
    for key in ["blAmount", "invoiceAmount"] {
        if let Some(value) = input.get_mut(key) {
            *value = amount_text(value);
        }
    }
    for key in ["invoiceReference", "blNumber"] {
        if let Some(value) = input.get_mut(key).filter(|value| value.as_str() == Some("")) {
            *value = Value::Null;
        }
    }
    let mut dates = Vec::new();
    for key in ["validatedAt", "dueDate"] {
        if let Some(value) = input.remove(key) {
            dates.push((key, timestamp_value(&value)?));
        }
    }
    let mut data = delivery_schema()
        .partial()
        .parse(&Value::Object(input))
        .map_err(|_| ())?;
    for (key, value) in dates {
        data.insert(key.to_string(), value);
    }
    Ok(data)
}

/// Commande liée : elle doit exister et être du même magasin que la livraison
async fn check_linked_order(db: &PgPool, order_id: i32, group_id: i32, failed: &str) -> Result<(), AppError> {
    let order = db::find_by_id::<OrdersRow>(db, order_id)
        .await
        .or_500(failed)?
        .ok_or_else(|| AppError::bad_request("La commande liée n'existe pas"))?;
    if order.group_id != group_id {
        return Err(AppError::bad_request(&format!(
            "Impossible de lier une livraison du magasin {group_id} avec une commande du magasin {}",
            order.group_id
        )));
    }
    Ok(())
}

/// Échéance d'une nouvelle référence de facture, relue dans NocoDB (sans cache) :
/// date normalisée, ou null. Err : échéance normalisée que new Date() ne lit pas
/// (toISOString échoue côté Node, d'où un 500). Sert aussi à l'API externe
/// (lookupDueDate)
pub async fn due_date_from_nocodb(
    state: &AppState,
    reference: &str,
    group_id: i32,
    reconciled: bool,
) -> Result<Value, ()> {
    let result = verification::verify_invoice(state, reference, group_id, true, reconciled).await;
    if !result.exists {
        return Ok(Value::Null);
    }
    match result.normalized_due_date() {
        None => Ok(Value::Null),
        Some(normalized) => dates::parse_js_date(&normalized)
            .map(|date| Value::String(js::iso(&date)))
            .ok_or(()),
    }
}

async fn update(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<String>,
    JsonBody(body): JsonBody,
) -> ApiResult {
    const FAILED: &str = "Failed to update delivery";
    let id = int_id(&id, FAILED)?;
    let delivery = existing_delivery(&state.db, id, FAILED).await?;
    if !has_permission(user.role(), "deliveries", "edit") {
        return Err(AppError::forbidden("Insufficient permissions to edit deliveries"));
    }
    check_group(&user, delivery.row.group_id)?;
    let mut data = parse_update(&body).map_err(|_| AppError::internal(FAILED))?;

    if let Some(order_id) = data.get("orderId").and_then(Value::as_i64) {
        let order_id = i32::try_from(order_id).map_err(|_| AppError::internal(FAILED))?;
        check_linked_order(&state.db, order_id, delivery.row.group_id, FAILED).await?;
    }

    // Référence de facture changée : échéance relue dans NocoDB, ou vidée
    if let Some(reference) = data.get("invoiceReference").cloned() {
        let current = delivery
            .row
            .invoice_reference
            .clone()
            .map_or(Value::Null, Value::String);
        if reference != current {
            let due_date = match reference.as_str().filter(|text| !js::trim(text).is_empty()) {
                Some(text) => due_date_from_nocodb(
                    &state,
                    text,
                    delivery.row.group_id,
                    delivery.row.reconciled == Some(true),
                )
                .await
                .map_err(|_| AppError::internal(FAILED))?,
                None => Value::Null,
            };
            data.insert("dueDate".into(), due_date);
        }
    }

    let updated = update_delivery(&state.db, id, &data).await.or_500(FAILED)?;

    // Rapprochement automatique : livraison livrée avec un BL, fournisseur en mode automatique
    if data.get("status").and_then(Value::as_str) == Some("delivered")
        || data.get("blNumber").is_some_and(js::truthy)
    {
        if let Some(updated) = &updated {
            let automatic = if updated.supplier_id == delivery.row.supplier_id && delivery.supplier.is_some()
            {
                delivery
                    .supplier
                    .as_ref()
                    .and_then(|supplier| supplier.automatic_reconciliation)
            } else {
                db::find_by_id::<SuppliersRow>(&state.db, updated.supplier_id)
                    .await
                    .ok()
                    .flatten()
                    .and_then(|supplier| supplier.automatic_reconciliation)
            };
            let has_bl = updated.bl_number.as_deref().is_some_and(|bl| !bl.is_empty());
            if automatic == Some(true) && updated.status == "delivered" && has_bl {
                auto_reconcile(&state.db, id).await;
            }
        }
    }
    Ok(json_or_empty(updated))
}

/// parseInt(orderId) de la création : chiffres de tête du texte de la valeur, NaN sinon
fn parse_order_id(value: &Value) -> Value {
    match js::parse_int(&js::string_of(value)) {
        Some(number) => js::number_value(number),
        // NaN : refusé par z.number() (« received nan »), comme une valeur non numérique
        None => Value::String("NaN".into()),
    }
}

async fn create(State(state): State<AppState>, user: CurrentUser, JsonBody(body): JsonBody) -> ApiResult {
    const FAILED: &str = "Failed to create delivery";
    let mut input = spread_body(&body);
    if let Some(order_id) = input.get_mut("orderId") {
        if matches!(order_id.as_str(), Some("none" | "")) {
            *order_id = Value::Null;
        } else if js::truthy(order_id) {
            *order_id = parse_order_id(order_id);
        }
    }
    input.insert("createdBy".into(), Value::String(user.id().to_string()));
    let mut data = delivery_schema()
        .parse(&Value::Object(input))
        .map_err(|_| AppError::internal(FAILED))?;
    let group_id = data.get("groupId").and_then(Value::as_i64);
    if !user.is_admin() && !user.group_ids().iter().any(|id| Some(i64::from(*id)) == group_id) {
        return Err(AppError::forbidden("Access denied to this group"));
    }
    let order_id = data.get("orderId").filter(|value| js::truthy(value)).cloned();
    if let Some(order_id) = order_id.as_ref().and_then(Value::as_i64) {
        let order_id = i32::try_from(order_id).map_err(|_| AppError::internal(FAILED))?;
        let group_id = group_id
            .and_then(|id| i32::try_from(id).ok())
            .ok_or_else(|| AppError::internal(FAILED))?;
        check_linked_order(&state.db, order_id, group_id, FAILED).await?;
    }
    // Statut « planned » par défaut (status || 'planned')
    if !data.get("status").is_some_and(js::truthy) {
        data.insert("status".into(), Value::String("planned".into()));
    }
    let delivery = db::insert_values_first::<DeliveriesRow>(&state.db, &data)
        .await
        .or_500(FAILED)?;
    if let Some(order_id) = &order_id {
        plan_linked_order(&state.db, order_id).await;
    }
    Ok(Json(delivery).into_response())
}

async fn remove(State(state): State<AppState>, user: CurrentUser, Path(id): Path<String>) -> ApiResult {
    const FAILED: &str = "Failed to delete delivery";
    let delivery = existing_delivery(&state.db, int_id(&id, FAILED)?, FAILED).await?;
    if !has_permission(user.role(), "deliveries", "delete") {
        return Err(AppError::forbidden(
            "Insufficient permissions to delete deliveries",
        ));
    }
    check_group(&user, delivery.row.group_id)?;
    db::delete_by_id::<DeliveriesRow>(&state.db, delivery.row.id)
        .await
        .or_500(FAILED)?;
    Ok(Json(json!({ "message": "Delivery deleted successfully" })).into_response())
}

/// Texte non vide après trim, comme `valeur && valeur.trim()`
fn filled(text: &Option<String>) -> Option<&str> {
    text.as_deref().filter(|text| !js::trim(text).is_empty())
}

async fn validate(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<String>,
    JsonBody(body): JsonBody,
) -> ApiResult {
    const FAILED: &str = "Failed to validate delivery";
    if !has_permission(user.role(), "deliveries", "validate") {
        return Err(AppError::forbidden(
            "Insufficient permissions to validate deliveries",
        ));
    }
    let id = int_id(&id, FAILED)?;
    let delivery = existing_delivery(&state.db, id, FAILED).await?;
    // Seul le manager est limité à ses magasins
    if user.role() == "manager" && !user.group_ids().contains(&delivery.row.group_id) {
        return Err(AppError::forbidden("Access denied"));
    }

    let field = |name: &str| body.as_object().and_then(|fields| fields.get(name));
    // blNumber.trim() sur une valeur « vraie » qui n'est pas une chaîne : TypeError, 500
    let bl_number = match field("blNumber") {
        Some(value) if js::truthy(value) => value.as_str().ok_or_else(|| AppError::internal(FAILED))?,
        _ => "",
    };
    let bl_number = js::trim(bl_number);
    if bl_number.is_empty() {
        return Err(AppError::bad_request(
            "Le numéro de bon de livraison est obligatoire pour valider une livraison",
        ));
    }

    // validateDelivery : statut, date de livraison, BL et montant (toString), sans returning
    let now = crate::modules::now_iso();
    let mut sql =
        QueryBuilder::<Postgres>::new("UPDATE deliveries SET status = 'delivered', delivered_date = ");
    sql.push_bind(now.clone())
        .push("::timestamp, updated_at = ")
        .push_bind(now)
        .push("::timestamp, bl_number = ")
        .push_bind(bl_number.to_string());
    if let Some(amount) = field("blAmount").filter(|amount| !amount.is_null() && amount.as_str() != Some(""))
    {
        sql.push(", bl_amount = ")
            .push_bind(js::string_of(amount))
            .push("::numeric");
    }
    sql.push(" WHERE id = ").push_bind(id);
    sql.build().execute(&state.db).await.or_500(FAILED)?;

    // Fournisseur en rapprochement automatique : rapprochement validé d'office
    if delivery
        .supplier
        .as_ref()
        .and_then(|supplier| supplier.automatic_reconciliation)
        == Some(true)
    {
        auto_reconcile(&state.db, id).await;
    }

    // Cache des factures : entrées de l'ancienne référence et de l'ancien BL rendues permanentes
    if let Some(reference) = filled(&delivery.row.invoice_reference) {
        verification::update_cache_as_reconciled(&state.db, reference, delivery.row.group_id).await;
    }
    if let Some(bl) = filled(&delivery.row.bl_number) {
        verification::update_cache_as_reconciled(&state.db, bl, delivery.row.group_id).await;
    }

    // La commande associée passe à « delivered »
    if let Some(order_id) = delivery.row.order_id.filter(|order_id| *order_id != 0) {
        if let Err(error) = orders::set_order_status(&state.db, order_id, "delivered").await {
            tracing::error!(%error, order_id, "commande de la livraison validée");
        }
    }
    Ok(Json(json!({ "message": "Delivery validated successfully" })).into_response())
}

async fn control(State(state): State<AppState>, user: CurrentUser, Path(id): Path<String>) -> ApiResult {
    const FAILED: &str = "Failed to validate delivery control";
    let Some(id) = js::parse_int(&id) else {
        return Err(AppError::bad_request("Invalid delivery ID"));
    };
    let id = db::js_int4(id).ok_or_else(|| AppError::internal(FAILED))?;
    existing_delivery(&state.db, id, FAILED).await?;
    if !has_permission(user.role(), "deliveries", "edit") {
        return Err(AppError::forbidden("Insufficient permissions"));
    }
    // Contrôle effectué : sans contrôle du magasin, comme Node
    let now = crate::modules::now_iso();
    sqlx::query(
        "UPDATE deliveries SET control_validated = true, control_validated_by = $1, control_validated_at = $2::timestamp, updated_at = $3::timestamp WHERE id = $4",
    )
    .bind(user.id())
    .bind(&now)
    .bind(&now)
    .bind(id)
    .execute(&state.db)
    .await
    .or_500(FAILED)?;
    Ok(Json(json!({ "message": "Delivery control validated successfully" })).into_response())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn champs_dans_l_ordre_du_select() {
        let fields = json!({ "b": 2, "a": 1, "c": 3 });
        let ordered = fields_in_order(fields.as_object().unwrap(), &["a", "c", "absent", "b"]);
        assert_eq!(serde_json::to_string(&ordered).unwrap(), r#"{"a":1,"c":3,"b":2}"#);
    }

    #[test]
    fn transformations_du_put() {
        let data = parse_update(&json!({
            "blAmount": 12.5, "invoiceAmount": "", "invoiceReference": "", "blNumber": "BL-1",
            "dueDate": "2026-10-15", "validatedAt": null, "inconnu": 1
        }))
        .unwrap();
        assert_eq!(
            Value::Object(data),
            json!({
                "blNumber": "BL-1", "blAmount": "12.5", "invoiceReference": null, "invoiceAmount": null,
                "validatedAt": null, "dueDate": "2026-10-15T00:00:00.000Z"
            })
        );
        // Montant TTC non converti : z.string() refuse un nombre
        assert!(parse_update(&json!({ "invoiceAmountTTC": 5 })).is_err());
        // Date que new Date() ne lit pas, horodatage resté en texte
        assert!(parse_update(&json!({ "dueDate": "pas une date" })).is_err());
        assert!(parse_update(&json!({ "deliveredDate": "2026-10-15" })).is_err());
        // Tableau étalé : objet sans champ du schéma
        assert!(parse_update(&json!([1])).unwrap().is_empty());
    }

    #[test]
    fn montants_en_texte_comme_tostring() {
        assert_eq!(amount_text(&json!(1250.5)), json!("1250.5"));
        assert_eq!(amount_text(&json!(true)), json!("true"));
        assert_eq!(amount_text(&json!([1, 2])), json!("1,2"));
        assert_eq!(amount_text(&json!({})), json!("[object Object]"));
        assert_eq!(amount_text(&json!("")), Value::Null);
    }

    #[test]
    fn identifiant_de_commande_comme_parseint() {
        assert_eq!(parse_order_id(&json!("12abc")), json!(12));
        assert_eq!(parse_order_id(&json!(5.7)), json!(5));
        assert_eq!(parse_order_id(&json!([3])), json!(3));
        assert_eq!(parse_order_id(&json!(true)), json!("NaN"));
    }
}
