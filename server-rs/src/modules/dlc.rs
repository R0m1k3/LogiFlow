// Produits DLC : /api/dlc-products (server/routes.ts, « DLC Products routes » ;
// storage.ts getDlcProducts à getDlcStats). Comme Node aujourd'hui :
// - un compte sans magasin voit les produits et les compteurs de tous les magasins ;
// - création et modification sans schéma zod : les champs connus de la table sont
//   écrits tels quels, les erreurs de la base deviennent des 500 ;
// - la modification ne contrôle que le magasin d'origine du produit : elle peut le
//   déplacer vers un magasin de l'utilisateur ou non, et changer son créateur ;
// - GET /:id joint la ligne complète du magasin (adresse, logo, configuration
//   NocoDB et SMTP ; le mot de passe SMTP remplacé par smtpPasswordSet) ;
// - les compteurs sont rendus en texte ("3"), tels que node-pg lit un COUNT.

use std::collections::HashMap;

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::{Json, Router, routing::get, routing::post, routing::put};
use chrono::{Days, NaiveDate};
use serde_json::{Value, json};
use sqlx::{Postgres, QueryBuilder};

use crate::AppState;
use crate::auth::CurrentUser;
use crate::db::{self, columns_of, drizzle_values};
use crate::error::{ApiResult, AppError, OrInternal, json_or_empty};
use crate::js;
use crate::json::{spread, strip_smtp_password};
use crate::modules::now_iso;
use crate::projections::GroupSummary;
use crate::request::{JsQuery, JsonBody, int_id};
use crate::schema::{DlcProductsRow, GroupsRow, SuppliersRow};
use crate::zod::Parsed;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/dlc-products", get(list).post(create))
        .route("/api/dlc-products/stats", get(stats))
        .route("/api/dlc-products/{id}", get(show).put(update).delete(remove))
        .route("/api/dlc-products/{id}/validate", post(validate))
        .route("/api/dlc-products/{id}/stock-epuise", put(stock_epuise))
        .route("/api/dlc-products/{id}/restore-stock", put(restore_stock))
        .route("/api/dlc-products/{id}/mark-processed", put(mark_processed))
        .route("/api/dlc-products/{id}/unmark-processed", put(unmark_processed))
}

const VALIDATORS: [&str; 3] = ["admin", "directeur", "manager"];
const GROUP_DENIED: &str = "Access denied to this group's DLC products";

/// Jour courant et J+15 (dates UTC, heure du serveur Node)
fn today_and_alert() -> (NaiveDate, NaiveDate) {
    let today = crate::clock::today();
    (today, today + Days::new(15))
}

/// Magasins lus (vide : tous). Admin : ?storeId s'il est donné ; hors admin :
/// ?storeId s'il est l'un des siens, sinon tous les siens (aucun pour un compte
/// sans magasin, donc tous les produits). Err : ?storeId illisible pour l'admin,
/// [NaN] fait échouer la requête de Node.
fn scope(user: &CurrentUser, query: &JsQuery) -> Result<Vec<i32>, ()> {
    let store = query.truthy("storeId");
    if user.is_admin() {
        return match store {
            Some(store) => int_id(store, "").map(|id| vec![id]).map_err(|_| ()),
            None => Ok(Vec::new()),
        };
    }
    let mine = user.group_ids();
    match store.and_then(js::parse_int) {
        Some(requested) if mine.iter().any(|id| f64::from(*id) == requested) => Ok(vec![requested as i32]),
        _ => Ok(mine),
    }
}

/// Ajoute « WHERE » ou « AND » avant une condition
fn and(sql: &mut QueryBuilder<'_, Postgres>, count: &mut usize) {
    sql.push(if *count == 0 { " WHERE " } else { " AND " });
    *count += 1;
}

async fn list(State(state): State<AppState>, user: CurrentUser, query: JsQuery) -> ApiResult {
    // Toute erreur : 500 avec une liste vide
    let failed = || AppError::with_body(StatusCode::INTERNAL_SERVER_ERROR, json!([]));
    let group_ids = scope(&user, &query).map_err(|_| failed())?;
    let (today, alert) = today_and_alert();

    let mut sql = QueryBuilder::<Postgres>::new(format!(
        "SELECT {} FROM dlc_products
           LEFT JOIN suppliers ON dlc_products.supplier_id = suppliers.id
           LEFT JOIN groups ON dlc_products.group_id = groups.id",
        columns_of::<DlcProductsRow>("dlc_products")
    ));
    let mut count = 0;
    if !group_ids.is_empty() {
        and(&mut sql, &mut count);
        sql.push("dlc_products.group_id = ANY(")
            .push_bind(group_ids)
            .push(")");
    }
    // Statut calculé d'après la date (les produits traités sortent des alertes)
    const NOT_PROCESSED: &str =
        "(dlc_products.processed_until_expiry IS NULL OR dlc_products.processed_until_expiry = false)";
    match query.truthy("status").filter(|status| *status != "all") {
        Some("expires_soon") => {
            and(&mut sql, &mut count);
            sql.push("(dlc_products.expiry_date > ")
                .push_bind(today)
                .push(" AND dlc_products.expiry_date <= ")
                .push_bind(alert)
                .push(" AND dlc_products.status <> 'valides' AND ")
                .push(NOT_PROCESSED)
                .push(")");
        }
        Some("expires") => {
            and(&mut sql, &mut count);
            sql.push("(dlc_products.expiry_date <= ")
                .push_bind(today)
                .push(" AND dlc_products.status <> 'valides' AND ")
                .push(NOT_PROCESSED)
                .push(")");
        }
        Some("en_cours") => {
            and(&mut sql, &mut count);
            sql.push("(dlc_products.expiry_date > ")
                .push_bind(alert)
                .push(" AND dlc_products.status <> 'valides')");
        }
        Some("valides") => {
            and(&mut sql, &mut count);
            sql.push("dlc_products.status = 'valides'");
        }
        _ => {}
    }
    // parseInt(supplierId) : NaN et 0 ne filtrent pas, hors limites fait échouer la requête
    if let Some(supplier) = query
        .truthy("supplierId")
        .filter(|supplier| *supplier != "all")
        .filter(|supplier| js::parse_int(supplier).is_some_and(|n| n != 0.0))
    {
        let supplier = int_id(supplier, "").map_err(|_| failed())?;
        and(&mut sql, &mut count);
        sql.push("dlc_products.supplier_id = ").push_bind(supplier);
    }
    if let Some(search) = query.truthy("search") {
        let pattern = format!("%{search}%");
        and(&mut sql, &mut count);
        sql.push("(LOWER(dlc_products.product_name) LIKE LOWER(")
            .push_bind(pattern.clone())
            .push(") OR LOWER(suppliers.name) LIKE LOWER(")
            .push_bind(pattern)
            .push("))");
    }
    // Actifs, puis traités, stock épuisé, validés ; à l'intérieur, date croissante
    sql.push(
        " ORDER BY CASE
            WHEN dlc_products.status != 'valides'
                 AND (dlc_products.processed_until_expiry IS NULL OR dlc_products.processed_until_expiry = false)
                 AND (dlc_products.stock_epuise IS NULL OR dlc_products.stock_epuise = false) THEN 1
            WHEN dlc_products.processed_until_expiry = true THEN 2
            WHEN dlc_products.stock_epuise = true THEN 3
            WHEN dlc_products.status = 'valides' THEN 4
            ELSE 1
          END, dlc_products.expiry_date ASC",
    );
    let products: Vec<DlcProductsRow> = sql
        .build_query_as()
        .fetch_all(&state.db)
        .await
        .map_err(|_| failed())?;

    let supplier_ids: Vec<i32> = products.iter().map(|p| p.supplier_id).collect();
    let suppliers: HashMap<i32, SuppliersRow> = db::find_by_ids::<SuppliersRow>(&state.db, &supplier_ids)
        .await
        .map_err(|_| failed())?
        .into_iter()
        .map(|supplier| (supplier.id, supplier))
        .collect();
    let group_ids: Vec<i32> = products.iter().map(|p| p.group_id).collect();
    let groups = GroupSummary::by_ids(&state.db, &group_ids)
        .await
        .map_err(|_| failed())?;

    let out: Vec<Value> = products
        .iter()
        .map(|product| {
            with_relations(
                product,
                json!(suppliers.get(&product.supplier_id)),
                json!(groups.get(&product.group_id)),
            )
        })
        .collect();
    Ok(Json(out).into_response())
}

/// { ...produit, dlcDate: expiryDate, supplier, group, creator } de getDlcProducts / getDlcProduct
fn with_relations(product: &DlcProductsRow, supplier: Value, group: Value) -> Value {
    let mut entry = spread(product);
    let expiry = entry.get("expiryDate").cloned().unwrap_or(Value::Null);
    entry.insert("dlcDate".into(), expiry);
    entry.insert("supplier".into(), supplier);
    entry.insert("group".into(), group);
    entry.insert(
        "creator".into(),
        json!({ "id": product.created_by, "username": "unknown" }),
    );
    Value::Object(entry)
}

async fn stats(State(state): State<AppState>, user: CurrentUser, query: JsQuery) -> ApiResult {
    let failed = || {
        AppError::with_body(
            StatusCode::INTERNAL_SERVER_ERROR,
            json!({ "active": 0, "expiringSoon": 0, "expired": 0 }),
        )
    };
    let group_ids = scope(&user, &query).map_err(|_| failed())?;
    let (today, alert) = today_and_alert();
    const ACTIVE_ROW: &str = "status != 'valides'
        AND (processed_until_expiry IS NULL OR processed_until_expiry = false)
        AND (stock_epuise IS NULL OR stock_epuise = false)";
    let mut sql = QueryBuilder::<Postgres>::new("SELECT COUNT(CASE WHEN expiry_date > ");
    sql.push_bind(today)
        .push(format!(
            " AND {ACTIVE_ROW} THEN 1 END), COUNT(CASE WHEN expiry_date BETWEEN "
        ))
        .push_bind(today)
        .push(" AND ")
        .push_bind(alert)
        .push(format!(
            " AND {ACTIVE_ROW} THEN 1 END), COUNT(CASE WHEN expiry_date <= "
        ))
        .push_bind(today)
        .push(format!(" AND {ACTIVE_ROW} THEN 1 END) FROM dlc_products WHERE "));
    if group_ids.is_empty() {
        sql.push("1 = 1");
    } else {
        sql.push("group_id = ANY(").push_bind(group_ids).push(")");
    }
    let (active, expiring_soon, expired): (i64, i64, i64) = sql
        .build_query_as()
        .fetch_one(&state.db)
        .await
        .map_err(|_| failed())?;
    // COUNT lu en texte par node-pg (bigint)
    Ok(Json(json!({
        "active": active.to_string(),
        "expiringSoon": expiring_soon.to_string(),
        "expired": expired.to_string(),
    }))
    .into_response())
}

/// Produit existant et du magasin de l'utilisateur (hors admin)
async fn find_for(
    state: &AppState,
    user: &CurrentUser,
    raw_id: &str,
    failed: &str,
    denied: &str,
) -> Result<DlcProductsRow, AppError> {
    let id = int_id(raw_id, failed)?;
    let product = db::find_by_id::<DlcProductsRow>(&state.db, id)
        .await
        .or_500(failed)?
        .ok_or_else(|| AppError::not_found("DLC Product not found"))?;
    if !user.is_admin() && !user.group_ids().contains(&product.group_id) {
        return Err(AppError::forbidden(denied));
    }
    Ok(product)
}

async fn show(State(state): State<AppState>, user: CurrentUser, Path(id): Path<String>) -> ApiResult {
    const FAILED: &str = "Failed to fetch DLC product";
    let product = find_for(&state, &user, &id, FAILED, "Access denied").await?;
    let supplier = db::find_by_id::<SuppliersRow>(&state.db, product.supplier_id)
        .await
        .or_500(FAILED)?;
    let group = db::find_by_id::<GroupsRow>(&state.db, product.group_id)
        .await
        .or_500(FAILED)?;
    let body = with_relations(&product, json!(supplier), strip_smtp_password(json!(group)));
    Ok(Json(body).into_response())
}

async fn create(State(state): State<AppState>, user: CurrentUser, JsonBody(body): JsonBody) -> ApiResult {
    const FAILED: &str = "Failed to create DLC product";
    let mut data = body.as_object().cloned().unwrap_or_default();
    data.insert("createdBy".into(), json!(user.id()));
    // userGroupIds.includes(data.groupId) : un nombre, jamais un texte
    let allowed = data
        .get("groupId")
        .and_then(Value::as_f64)
        .is_some_and(|requested| user.group_ids().iter().any(|id| f64::from(*id) == requested));
    if !user.is_admin() && !allowed {
        return Err(AppError::forbidden("Access denied to this group"));
    }
    let values = drizzle_values::<DlcProductsRow>(&data).map_err(|_| AppError::internal(FAILED))?;
    let product: DlcProductsRow = db::insert(&state.db, &values).await.or_500(FAILED)?;
    // { ...produit, dlcDate: new Date(expiryDate) } : minuit UTC
    let mut entry = spread(&product);
    entry.insert(
        "dlcDate".into(),
        json!(format!(
            "{}T00:00:00.000Z",
            product.expiry_date.format("%Y-%m-%d")
        )),
    );
    Ok(Json(entry).into_response())
}

async fn update(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<String>,
    JsonBody(body): JsonBody,
) -> ApiResult {
    const FAILED: &str = "Failed to update DLC product";
    let product = find_for(&state, &user, &id, FAILED, "Access denied").await?;
    let mut data = body.as_object().cloned().unwrap_or_default();
    // updatedAt du corps remplacé par new Date()
    data.remove("updatedAt");
    let values = drizzle_values::<DlcProductsRow>(&data).map_err(|_| AppError::internal(FAILED))?;
    let updated = db::update_by_id::<DlcProductsRow>(&state.db, product.id, &values, true)
        .await
        .or_500(FAILED)?;
    Ok(json_or_empty(updated))
}

async fn remove(State(state): State<AppState>, user: CurrentUser, Path(id): Path<String>) -> ApiResult {
    const FAILED: &str = "Failed to delete DLC product";
    let product = find_for(&state, &user, &id, FAILED, "Access denied").await?;
    db::delete_by_id::<DlcProductsRow>(&state.db, product.id)
        .await
        .or_500(FAILED)?;
    Ok(Json(json!({ "message": "DLC Product deleted successfully" })).into_response())
}

/// Réservé aux rôles qui valident (admin, directeur, manager)
fn require_validator(user: &CurrentUser, message: &str) -> Result<(), AppError> {
    if VALIDATORS.contains(&user.role()) {
        Ok(())
    } else {
        Err(AppError::forbidden(message))
    }
}

/// Mise à jour d'un produit, avec updatedAt ; ligne absente : réponse vide
async fn set_fields(state: &AppState, id: i32, fields: Value, failed: &str) -> ApiResult {
    let values: Parsed = fields.as_object().cloned().unwrap_or_default();
    let updated = db::update_by_id::<DlcProductsRow>(&state.db, id, &values, true)
        .await
        .or_500(failed)?;
    Ok(json_or_empty(updated))
}

async fn validate(State(state): State<AppState>, user: CurrentUser, Path(id): Path<String>) -> ApiResult {
    const FAILED: &str = "Failed to validate DLC product";
    require_validator(&user, "Insufficient permissions to validate DLC products")?;
    let product = find_for(&state, &user, &id, FAILED, GROUP_DENIED).await?;
    let fields = json!({ "validatedBy": user.id(), "validatedAt": now_iso(), "status": "valides" });
    set_fields(&state, product.id, fields, FAILED).await
}

async fn stock_epuise(State(state): State<AppState>, user: CurrentUser, Path(id): Path<String>) -> ApiResult {
    const FAILED: &str = "Failed to mark DLC product as stock épuisé";
    let product = find_for(&state, &user, &id, FAILED, GROUP_DENIED).await?;
    let fields = json!({ "stockEpuise": true, "stockEpuiseBy": user.id(), "stockEpuiseAt": now_iso() });
    set_fields(&state, product.id, fields, FAILED).await
}

async fn restore_stock(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<String>,
) -> ApiResult {
    const FAILED: &str = "Failed to restore DLC product stock";
    require_validator(&user, "Insufficient permissions to restore DLC product stock")?;
    let product = find_for(&state, &user, &id, FAILED, GROUP_DENIED).await?;
    let fields = json!({ "stockEpuise": false, "stockEpuiseBy": null, "stockEpuiseAt": null });
    set_fields(&state, product.id, fields, FAILED).await
}

/// markDlcProductAsProcessed / unmark : si la mise à jour échoue, Node se replie sur
/// la seule date de modification
async fn set_processed(state: &AppState, id: i32, fields: Value, failed: &str) -> ApiResult {
    let values: Parsed = fields.as_object().cloned().unwrap_or_default();
    let updated = match db::update_by_id::<DlcProductsRow>(&state.db, id, &values, true).await {
        Ok(updated) => updated,
        Err(error) => {
            tracing::warn!(%error, "repli sur la seule date de modification");
            db::update_by_id::<DlcProductsRow>(&state.db, id, &Parsed::new(), true)
                .await
                .or_500(failed)?
        }
    };
    Ok(json_or_empty(updated))
}

async fn mark_processed(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<String>,
) -> ApiResult {
    const FAILED: &str = "Failed to mark DLC product as processed";
    let product = find_for(&state, &user, &id, FAILED, GROUP_DENIED).await?;
    let fields = json!({ "processedAt": now_iso(), "processedBy": user.id(), "processedUntilExpiry": true });
    set_processed(&state, product.id, fields, FAILED).await
}

async fn unmark_processed(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<String>,
) -> ApiResult {
    const FAILED: &str = "Failed to unmark DLC product as processed";
    require_validator(
        &user,
        "Insufficient permissions to unmark DLC product as processed",
    )?;
    let product = find_for(&state, &user, &id, FAILED, GROUP_DENIED).await?;
    let fields = json!({ "processedAt": null, "processedBy": null, "processedUntilExpiry": false });
    set_processed(&state, product.id, fields, FAILED).await
}
