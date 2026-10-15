// Avoirs : /api/avoirs (server/routes.ts, « Avoir routes » ; storage.ts getAvoirs à
// updateAvoirNocodbVerification). La création et le passage au statut « Reçu »
// envoient l'avoir au webhook du magasin (node-fetch, sans délai maximal) ; s'il
// répond 2xx, l'avoir est marqué « webhook envoyé ».
//
// Défauts de Node reproduits :
// - GET /api/avoirs : un directeur voit les avoirs de tous les magasins, et un
//   compte sans magasin, sans storeId, voit tous les avoirs (liste de magasins vide
//   = aucun filtre) (AVOIRS-API-08) ;
// - PUT : montant, référence et commentaire absents du corps sont effacés
//   (AVOIRS-API-06) ; magasin, fournisseur et créateur modifiables sans contrôle,
//   ni règle de rôle pour « Reçu » ni protection des avoirs validés (AVOIRS-API-07) ;
// - webhook-status et nocodb-verification ne contrôlent pas le magasin (directeur
//   compris) et acceptent un identifiant inexistant (AVOIRS-API-08) ;
// - le webhook porte un nom de fournisseur factice (AVOIRS-API-05) ;
// - GET /:id joint la ligne complète du magasin (mot de passe SMTP remplacé par
//   smtpPasswordSet), la liste sa projection de rapprochement.

use std::collections::HashMap;

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::routing::{get, post, put};
use axum::{Json, Router};
use serde_json::{Map, Value, json};
use sqlx::PgPool;

use crate::AppState;
use crate::access::has_permission;
use crate::auth::CurrentUser;
use crate::db::{self, Table};
use crate::error::{ApiResult, AppError, OrInternal, json_or_empty};
use crate::js;
use crate::json::{spread, strip_smtp_password};
use crate::modules::bap::node_fetch_post;
use crate::modules::now_iso;
use crate::projections::{GroupReconciliation, UserSummary};
use crate::request::{JsQuery, JsonBody, int_id};
use crate::schema::{AvoirsRow, GroupsRow, SuppliersRow};
use crate::services::invoice_verification as verification;
use crate::services::nocodb::{database_message, not_a_string_error, truthy};
use crate::zod::{Field, Object, Parsed};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/avoirs", get(list).post(create))
        .route("/api/avoirs/{id}", get(show).put(update).delete(remove))
        .route("/api/avoirs/{id}/verify-invoice", post(verify_invoice))
        .route("/api/avoirs/{id}/webhook-status", put(webhook_status))
        .route("/api/avoirs/{id}/nocodb-verification", put(nocodb_verification))
}

const STATUSES: &[&str] = &["En attente de demande", "Demandé", "Reçu"];
const RECEIVED: &str = "Reçu";

/// insertAvoirSchema (shared/schema.ts)
fn avoir_schema() -> Object {
    AvoirsRow::insert_schema()
        .omit(&[
            "id",
            "createdAt",
            "updatedAt",
            "webhookSent",
            "nocodbVerified",
            "nocodbVerifiedAt",
            "processedAt",
        ])
        .extend(vec![
            Field::enumeration("status", STATUSES).default(json!("En attente de demande")),
            Field::coerce_number("amount").optional().nullable(),
            Field::string("invoiceReference").optional(),
            Field::string("comment").optional(),
            Field::boolean("commercialProcessed").default(json!(false)),
        ])
}

/// Admin et directeur voient tous les magasins ; les autres, les leurs
fn sees_all_stores(user: &CurrentUser) -> bool {
    ["admin", "directeur"].contains(&user.role())
}

/// storage.getAvoir : l'avoir de l'identifiant de l'adresse (parseInt, envoyé en
/// texte : un identifiant illisible fait échouer la requête, comme dans Node)
async fn find_avoir(db: &PgPool, raw_id: &str) -> Result<Option<AvoirsRow>, sqlx::Error> {
    let id = js::parse_int(raw_id).map_or_else(|| "NaN".to_string(), js::number_to_string);
    sqlx::query_as(&AvoirsRow::select("WHERE id = $1::int4"))
        .bind(id)
        .fetch_optional(db)
        .await
}

/// Avoir existant, sinon 404 ; une erreur de la base donne le 500 de l'adresse
async fn existing_avoir(db: &PgPool, raw_id: &str, failed: &str) -> Result<AvoirsRow, AppError> {
    find_avoir(db, raw_id)
        .await
        .or_500(failed)?
        .ok_or_else(|| AppError::not_found("Avoir not found"))
}

/// Hors admin et directeur, l'avoir doit être d'un magasin de l'utilisateur
fn check_store(user: &CurrentUser, avoir: &AvoirsRow, denied: &str) -> Result<(), AppError> {
    if sees_all_stores(user) || user.group_ids().contains(&avoir.group_id) {
        Ok(())
    } else {
        Err(AppError::forbidden(denied))
    }
}

// ---------- Lecture ----------

/// Magasins dont les avoirs sont lus
enum Scope {
    /// Aucun filtre
    All,
    Stores(Vec<i32>),
    /// Magasin demandé hors des siens : [] sans requête
    Nothing,
}

/// storeId de l'adresse : admin et directeur, ce magasin ; les autres, ce magasin
/// s'il est l'un des leurs, sinon rien ; sans storeId, les leurs (aucun pour un
/// compte sans magasin, donc tous les avoirs)
fn scope(user: &CurrentUser, query: &JsQuery) -> Result<Scope, AppError> {
    let store = query.truthy("storeId");
    if sees_all_stores(user) {
        return Ok(match store {
            Some(store) => Scope::Stores(vec![int_id(store, "Failed to fetch avoirs")?]),
            None => Scope::All,
        });
    }
    let mine = user.group_ids();
    Ok(match store {
        None if mine.is_empty() => Scope::All,
        None => Scope::Stores(mine),
        Some(store) => match js::parse_int(store) {
            Some(requested) if mine.iter().any(|id| f64::from(*id) == requested) => {
                Scope::Stores(vec![requested as i32])
            }
            _ => Scope::Nothing,
        },
    })
}

/// Fiches jointes à des avoirs, par identifiant (seconde moitié des leftJoin)
struct Relations {
    suppliers: HashMap<i32, SuppliersRow>,
    groups: HashMap<i32, GroupReconciliation>,
    creators: HashMap<String, UserSummary>,
}

impl Relations {
    async fn load(db: &PgPool, avoirs: &[AvoirsRow]) -> Result<Self, sqlx::Error> {
        let supplier_ids: Vec<i32> = avoirs.iter().map(|avoir| avoir.supplier_id).collect();
        let suppliers = db::find_by_ids::<SuppliersRow>(db, &supplier_ids)
            .await?
            .into_iter()
            .map(|supplier| (supplier.id, supplier))
            .collect();
        let group_ids: Vec<i32> = avoirs.iter().map(|avoir| avoir.group_id).collect();
        let groups: Vec<GroupReconciliation> = sqlx::query_as(&format!(
            "SELECT {} FROM groups g WHERE g.id = ANY($1)",
            GroupReconciliation::columns("g")
        ))
        .bind(&group_ids)
        .fetch_all(db)
        .await?;
        let creator_ids: Vec<String> = avoirs.iter().map(|avoir| avoir.created_by.clone()).collect();
        Ok(Self {
            suppliers,
            groups: groups.into_iter().map(|group| (group.id, group)).collect(),
            creators: UserSummary::by_ids(db, &creator_ids).await?,
        })
    }

    /// { ...avoir, supplier, group, creator } (null quand la ligne jointe manque)
    fn attach(&self, avoir: &AvoirsRow) -> Value {
        let mut entry = spread(avoir);
        entry.insert("supplier".into(), json!(self.suppliers.get(&avoir.supplier_id)));
        entry.insert("group".into(), json!(self.groups.get(&avoir.group_id)));
        entry.insert("creator".into(), json!(self.creators.get(&avoir.created_by)));
        Value::Object(entry)
    }
}

async fn list(State(state): State<AppState>, user: CurrentUser, query: JsQuery) -> ApiResult {
    const FAILED: &str = "Failed to fetch avoirs";
    let group_ids = match scope(&user, &query)? {
        Scope::Nothing => return Ok(Json(json!([])).into_response()),
        Scope::All => None,
        Scope::Stores(ids) => Some(ids),
    };
    let avoirs: Vec<AvoirsRow> = sqlx::query_as(&AvoirsRow::select(
        "WHERE ($1::int4[] IS NULL OR group_id = ANY($1)) ORDER BY created_at DESC",
    ))
    .bind(group_ids)
    .fetch_all(&state.db)
    .await
    .or_500(FAILED)?;
    let relations = Relations::load(&state.db, &avoirs).await.or_500(FAILED)?;
    let out: Vec<Value> = avoirs.iter().map(|avoir| relations.attach(avoir)).collect();
    Ok(Json(out).into_response())
}

async fn show(State(state): State<AppState>, user: CurrentUser, Path(id): Path<String>) -> ApiResult {
    const FAILED: &str = "Failed to fetch avoir";
    let avoir = existing_avoir(&state.db, &id, FAILED).await?;
    check_store(&user, &avoir, "Access denied")?;
    let supplier = db::find_by_id::<SuppliersRow>(&state.db, avoir.supplier_id)
        .await
        .or_500(FAILED)?;
    // getAvoir joint la ligne complète du magasin
    let group = db::find_by_id::<GroupsRow>(&state.db, avoir.group_id)
        .await
        .or_500(FAILED)?;
    let creators = UserSummary::by_ids(&state.db, std::slice::from_ref(&avoir.created_by))
        .await
        .or_500(FAILED)?;
    let mut body = spread(&avoir);
    body.insert("supplier".into(), json!(supplier));
    body.insert("group".into(), json!(group));
    body.insert("creator".into(), json!(creators.get(&avoir.created_by)));
    Ok(Json(strip_smtp_password(Value::Object(body))).into_response())
}

// ---------- Webhook du magasin ----------

/// Nom affiché du créateur : « prénom nom » s'il a les deux, sinon l'identifiant
fn display_name(user: &CurrentUser) -> String {
    let account = &user.user;
    match (account.first_name.as_deref(), account.last_name.as_deref()) {
        (Some(first), Some(last)) if !first.is_empty() && !last.is_empty() => format!("{first} {last}"),
        _ => account.username.clone(),
    }
}

/// storage.updateAvoirWebhookStatus
async fn set_webhook_sent(db: &PgPool, id: i32, sent: Value) -> Result<(), sqlx::Error> {
    let mut data = Parsed::new();
    data.insert("webhookSent".into(), db::node_pg_value(&sent));
    db::update_by_id::<AvoirsRow>(db, id, &data, true)
        .await
        .map(|_| ())
}

/// Envoie l'avoir au webhook de son magasin s'il en a un ; une réponse 2xx marque
/// l'avoir « webhook envoyé ». Toute erreur est seulement journalisée, comme Node.
async fn notify_store(db: &PgPool, avoir_id: i32, group_id: i32, payload: impl FnOnce(&GroupsRow) -> Value) {
    let group = match db::find_by_id::<GroupsRow>(db, group_id).await {
        Ok(Some(group)) => group,
        Ok(None) => return,
        Err(error) => {
            tracing::error!(%error, avoir_id, "webhook avoir : lecture du magasin");
            return;
        }
    };
    let Some(url) = group.webhook_url.clone().filter(|url| !url.is_empty()) else {
        return;
    };
    let body = payload(&group).to_string();
    let response = node_fetch_post(
        &url,
        |request| request.header("Content-Type", "application/json").body(body),
        None,
    )
    .await;
    match response {
        Ok((status, _)) if status.is_success() => {
            if let Err(error) = set_webhook_sent(db, avoir_id, Value::Bool(true)).await {
                tracing::error!(%error, avoir_id, "webhook avoir : marquage");
            }
        }
        Ok((status, _)) => tracing::error!(avoir_id, %status, "webhook avoir refusé"),
        Err(error) => tracing::error!(avoir_id, message = error.message, "webhook avoir en échec"),
    }
}

/// Champs communs des messages du webhook (createdAt / status, processedAt à part)
fn webhook_fields(avoir: &AvoirsRow, supplier_name: &str, group: &GroupsRow) -> Map<String, Value> {
    let mut fields = Map::new();
    fields.insert("type".into(), json!("Avoir"));
    fields.insert("avoirId".into(), json!(avoir.id));
    let row = spread(avoir);
    fields.insert(
        "invoiceReference".into(),
        row.get("invoiceReference").cloned().unwrap_or(Value::Null),
    );
    fields.insert("amount".into(), row.get("amount").cloned().unwrap_or(Value::Null));
    fields.insert("supplierName".into(), json!(supplier_name));
    fields.insert("groupName".into(), json!(group.name));
    fields.insert("comment".into(), json!(avoir.comment.clone().unwrap_or_default()));
    fields.insert("commercialProcessed".into(), json!(avoir.commercial_processed));
    fields
}

// ---------- Écriture ----------

async fn create(State(state): State<AppState>, user: CurrentUser, JsonBody(body): JsonBody) -> ApiResult {
    const FAILED: &str = "Failed to create avoir";
    // { ...req.body, createdBy: user.id }
    let mut input = body.as_object().cloned().unwrap_or_default();
    input.insert("createdBy".into(), json!(user.id()));
    let data = avoir_schema()
        .parse(&Value::Object(input))
        .map_err(|issues| AppError::validation("Validation error", issues))?;
    let group_id = data.get("groupId").and_then(Value::as_f64).unwrap_or_default();
    if !sees_all_stores(&user) && !user.group_ids().iter().any(|id| f64::from(*id) == group_id) {
        return Err(AppError::forbidden("Access denied to this group"));
    }
    let avoir: AvoirsRow = db::insert(&state.db, &data).await.or_500(FAILED)?;
    tracing::info!(id = avoir.id, user = user.id(), "avoir créé");

    let created_by = display_name(&user);
    let row = spread(&avoir);
    notify_store(&state.db, avoir.id, avoir.group_id, |group| {
        let mut fields = webhook_fields(&avoir, "Unknown", group);
        fields.insert("createdBy".into(), json!(created_by));
        fields.insert(
            "createdAt".into(),
            row.get("createdAt").cloned().unwrap_or(Value::Null),
        );
        Value::Object(fields)
    })
    .await;
    // L'avoir tel qu'inséré, avant le marquage du webhook
    Ok(Json(avoir).into_response())
}

async fn update(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<String>,
    JsonBody(body): JsonBody,
) -> ApiResult {
    const FAILED: &str = "Failed to update avoir";
    let existing = existing_avoir(&state.db, &id, FAILED).await?;
    check_store(&user, &existing, "Access denied")?;
    let validated = avoir_schema()
        .partial()
        .parse(&body)
        .map_err(|issues| AppError::validation("Validation error", issues))?;
    // Absents du corps, montant, référence et commentaire sont effacés (AVOIRS-API-06)
    let mut data = validated.clone();
    for key in ["amount", "invoiceReference", "comment"] {
        data.entry(key).or_insert(Value::Null);
    }
    let updated = db::update_by_id::<AvoirsRow>(&state.db, existing.id, &data, true)
        .await
        .or_500(FAILED)?;
    tracing::info!(id = existing.id, user = user.id(), "avoir modifié");

    let becomes_received =
        validated.get("status").and_then(Value::as_str) == Some(RECEIVED) && existing.status != RECEIVED;
    let Some(updated) = updated else {
        // Ligne disparue entre-temps : updatedAvoir.groupId lève une TypeError
        return if becomes_received {
            Err(AppError::internal(FAILED))
        } else {
            Ok(json_or_empty(None::<AvoirsRow>))
        };
    };
    if becomes_received {
        // Magasin 1 par défaut pour l'admin si l'avoir n'en a pas (groupId à 0)
        let group_id = if updated.group_id == 0 && user.is_admin() {
            1
        } else {
            updated.group_id
        };
        let created_by = display_name(&user);
        notify_store(&state.db, updated.id, group_id, |group| {
            let mut fields = webhook_fields(&updated, "Fournisseur", group);
            fields.insert("status".into(), json!(RECEIVED));
            fields.insert("createdBy".into(), json!(created_by));
            fields.insert("processedAt".into(), json!(now_iso()));
            Value::Object(fields)
        })
        .await;
    }
    Ok(Json(updated).into_response())
}

async fn remove(State(state): State<AppState>, user: CurrentUser, Path(id): Path<String>) -> ApiResult {
    const FAILED: &str = "Failed to delete avoir";
    let avoir = existing_avoir(&state.db, &id, FAILED).await?;
    if !sees_all_stores(&user) {
        return Err(AppError::forbidden("Insufficient permissions to delete avoirs"));
    }
    if user.role() == "directeur" && !user.group_ids().contains(&avoir.group_id) {
        return Err(AppError::forbidden("Access denied"));
    }
    db::delete_by_id::<AvoirsRow>(&state.db, avoir.id)
        .await
        .or_500(FAILED)?;
    tracing::info!(id = avoir.id, user = user.id(), "avoir supprimé");
    Ok(Json(json!({ "message": "Avoir deleted successfully" })).into_response())
}

// ---------- Vérification et statuts ----------

async fn verify_invoice(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<String>,
    JsonBody(body): JsonBody,
) -> ApiResult {
    let failed = |message: String| {
        AppError::with_body(
            StatusCode::INTERNAL_SERVER_ERROR,
            json!({ "message": "Failed to verify avoir invoice", "error": message }),
        )
    };
    let avoir = find_avoir(&state.db, &id)
        .await
        .map_err(|error| failed(database_message(&error)))?
        .ok_or_else(|| AppError::not_found("Avoir not found"))?;
    if !has_permission(user.role(), "deliveries", "view") {
        return Err(AppError::forbidden("Insufficient permissions"));
    }
    // Ici, seul l'admin voit tous les magasins (directeur compris dans le contrôle)
    if !user.is_admin() && !user.group_ids().contains(&avoir.group_id) {
        return Err(AppError::forbidden("Access denied to this group"));
    }
    let supplier = db::find_by_id::<SuppliersRow>(&state.db, avoir.supplier_id)
        .await
        .map_err(|error| failed(database_message(&error)))?;
    let group = db::find_by_id::<GroupsRow>(&state.db, avoir.group_id)
        .await
        .map_err(|error| failed(database_message(&error)))?;
    if supplier.is_none() || group.is_none() {
        return Err(AppError::bad_request(
            "Avoir missing supplier or group information",
        ));
    }

    // !invoiceReference || !invoiceReference.trim()
    let reference = body.get("invoiceReference");
    let reference = match reference {
        Some(value) if truthy(value) => match value.as_str() {
            Some(text) => text,
            None => {
                return Err(failed(not_a_string_error(
                    "invoiceReference",
                    "trim",
                    Some(value),
                )));
            }
        },
        _ => return Err(AppError::bad_request("Référence de facture requise")),
    };
    if js::trim(reference).is_empty() {
        return Err(AppError::bad_request("Référence de facture requise"));
    }
    let force_refresh = body.get("forceRefresh").is_some_and(truthy);
    // Les avoirs ne sont jamais « rapprochés » comme les livraisons
    let result = verification::verify_invoice(&state, reference, avoir.group_id, force_refresh, false).await;
    Ok(Json(result).into_response())
}

/// Seuls l'admin et le directeur changent l'état d'un avoir (sans contrôle du magasin)
fn admin_or_directeur(user: &CurrentUser) -> Result<(), AppError> {
    if sees_all_stores(user) {
        Ok(())
    } else {
        Err(AppError::forbidden("Insufficient permissions"))
    }
}

async fn webhook_status(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<String>,
    JsonBody(body): JsonBody,
) -> ApiResult {
    const FAILED: &str = "Failed to update webhook status";
    admin_or_directeur(&user)?;
    let id = int_id(&id, FAILED)?;
    // webhookSent absent : seule la date de modification change
    let mut data = Parsed::new();
    if let Some(sent) = body.get("webhookSent") {
        data.insert("webhookSent".into(), db::node_pg_value(sent));
    }
    db::update_by_id::<AvoirsRow>(&state.db, id, &data, true)
        .await
        .or_500(FAILED)?;
    Ok(Json(json!({ "message": "Webhook status updated successfully" })).into_response())
}

async fn nocodb_verification(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<String>,
    JsonBody(body): JsonBody,
) -> ApiResult {
    const FAILED: &str = "Failed to update verification status";
    admin_or_directeur(&user)?;
    let id = int_id(&id, FAILED)?;
    let verified = body.get("verified");
    let is_verified = verified.is_some_and(truthy);
    let mut data = Parsed::new();
    if let Some(verified) = verified {
        data.insert("nocodbVerified".into(), db::node_pg_value(verified));
    }
    data.insert(
        "nocodbVerifiedAt".into(),
        if is_verified {
            json!(now_iso())
        } else {
            Value::Null
        },
    );
    db::update_by_id::<AvoirsRow>(&state.db, id, &data, true)
        .await
        .or_500(FAILED)?;

    // Validé : l'entrée du cache de sa facture devient permanente (erreur ignorée)
    if is_verified {
        match db::find_by_id::<AvoirsRow>(&state.db, id).await {
            Ok(Some(avoir)) => {
                if let Some(reference) = avoir
                    .invoice_reference
                    .as_deref()
                    .filter(|reference| !js::trim(reference).is_empty())
                {
                    verification::update_cache_as_reconciled(&state.db, reference, avoir.group_id).await;
                }
            }
            Ok(None) => {}
            Err(error) => tracing::error!(%error, id, "marquage du cache de l'avoir validé"),
        }
    }
    tracing::info!(
        id,
        verified = is_verified,
        user = user.id(),
        "vérification NocoDB de l'avoir"
    );
    Ok(Json(json!({ "message": "NocoDB verification status updated successfully" })).into_response())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn schema_de_creation_comme_zod() {
        let schema = avoir_schema();
        let data = schema
            .parse(&json!({ "supplierId": 1, "groupId": 2, "amount": "", "createdBy": "u", "inconnu": 1 }))
            .unwrap();
        assert_eq!(
            Value::Object(data),
            json!({ "supplierId": 1, "groupId": 2, "amount": 0, "commercialProcessed": false,
                    "status": "En attente de demande", "createdBy": "u" })
        );
        let issues = schema
            .parse(&json!({ "supplierId": 1, "groupId": 1, "invoiceReference": null, "createdBy": "u" }))
            .unwrap_err();
        assert_eq!(issues[0]["path"], json!(["invoiceReference"]));
        assert_eq!(issues[0]["message"], json!("Expected string, received null"));
    }

    #[test]
    fn modification_partielle_sans_valeurs_par_defaut() {
        let data = avoir_schema()
            .partial()
            .parse(&json!({ "status": "Reçu" }))
            .unwrap();
        assert_eq!(Value::Object(data), json!({ "status": "Reçu" }));
    }
}
