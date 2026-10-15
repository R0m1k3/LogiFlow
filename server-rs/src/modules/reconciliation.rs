// Rapprochement BL / factures (server/routes.ts) : commentaires de rapprochement,
// courriel de demande de documents au fournisseur et son historique, vérification
// d'une facture dans NocoDB, diagnostic et marquage du cache des factures.
//
// Laissée à Node (décision R3, audit RAPPRO-21) : POST /api/reconciliation/send-invoice,
// qui envoie le fichier reçu à une adresse de webhook fournie par le navigateur.
//
// Défauts de Node reproduits :
// - un commentaire modifié peut changer de livraison, de magasin ou d'auteur
//   (deliveryId, groupId, authorId acceptés par le PUT) ;
// - POST /api/verify-invoice, /api/verify-invoices et /api/cache/mark-reconciled
//   ne contrôlent pas le magasin : tout compte connecté (directeur ou admin pour le
//   marquage) agit sur n'importe quel magasin ;
// - /api/cache/diagnosis cherche des clés de cache au mauvais format
//   (`référence_magasin` au lieu de `magasin_référence`) : il ne trouve rien, mais
//   supprime au passage une entrée expirée qui aurait cette clé ;
// - /api/supplier-mail-logs ignore storeId pour un directeur.

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::routing::{get, post, put};
use axum::{Json, Router};
use chrono::{NaiveDate, NaiveDateTime};
use rust_decimal::Decimal;
use serde_json::{Map, Value, json};
use sqlx::FromRow;

use crate::AppState;
use crate::access::has_permission;
use crate::auth::CurrentUser;
use crate::db::{self, Table};
use crate::error::{ApiResult, AppError, OrInternal, json_or_empty};
use crate::js;
use crate::request::{JsQuery, JsonBody, int_id};
use crate::schema::{GroupsRow, ReconciliationCommentsRow, SupplierMailLogsRow};
use crate::services::invoice_verification::{self as verification, JsField, Verification};
use crate::services::mail::{self, MailDelivery, MailLog};
use crate::services::nocodb::{self, truthy};
use crate::zod::{Field, Object};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route(
            "/api/deliveries/{id}/reconciliation-comments",
            get(list_comments).post(create_comment),
        )
        .route(
            "/api/reconciliation-comments/{id}",
            put(update_comment).delete(delete_comment),
        )
        .route(
            "/api/deliveries/{id}/send-supplier-mail",
            post(send_supplier_mail),
        )
        .route("/api/supplier-mail-logs", get(supplier_mail_logs))
        .route(
            "/api/deliveries/{id}/verify-invoice",
            post(verify_delivery_invoice),
        )
        .route("/api/verify-invoice", post(verify_invoice))
        .route("/api/verify-invoices", post(verify_invoices))
        .route("/api/cache/diagnosis", get(cache_diagnosis))
        .route("/api/cache/update-reconciled", post(cache_update_reconciled))
        .route("/api/cache/mark-reconciled", post(cache_mark_reconciled))
}

const COMMENT_TYPES: &[&str] = &["info", "warning", "error", "success"];

/// insertReconciliationCommentSchema
fn comment_schema() -> Object {
    ReconciliationCommentsRow::insert_schema()
        .omit(&["id", "createdAt", "updatedAt"])
        .extend(vec![
            Field::enumeration("type", COMMENT_TYPES).default(json!("info")),
        ])
}

/// Hors admin, l'utilisateur doit appartenir au magasin
fn check_group(user: &CurrentUser, group_id: i32) -> Result<(), AppError> {
    if user.is_admin() || user.group_ids().contains(&group_id) {
        Ok(())
    } else {
        Err(AppError::forbidden("Access denied to this group"))
    }
}

// ---------- Livraison lue pour les contrôles (storage.getDelivery) ----------

/// Ce que ces adresses lisent de storage.getDelivery : la livraison, sa fiche
/// fournisseur et le nom de son magasin (jointures externes, comme Node)
#[derive(Debug, FromRow)]
struct DeliveryAccess {
    id: i32,
    group_id: i32,
    supplier_id: i32,
    reconciled: Option<bool>,
    bl_number: Option<String>,
    bl_amount: Option<Decimal>,
    invoice_reference: Option<String>,
    scheduled_date: NaiveDate,
    delivered_date: Option<NaiveDateTime>,
    supplier_row: Option<i32>,
    supplier_name: Option<String>,
    supplier_email: Option<String>,
    group_row: Option<i32>,
    group_name: Option<String>,
}

impl DeliveryAccess {
    fn mail_delivery(&self) -> MailDelivery {
        MailDelivery {
            bl_number: self.bl_number.clone(),
            bl_amount: self.bl_amount,
            invoice_reference: self.invoice_reference.clone(),
            scheduled_date: Some(self.scheduled_date),
            delivered_date: self.delivered_date,
            supplier_name: self.supplier_name.clone(),
            group_name: self.group_name.clone(),
        }
    }
}

/// Livraison par l'identifiant de l'adresse, converti comme parseInt puis envoyé
/// en texte à PostgreSQL : un identifiant illisible donne l'erreur SQL de Node
async fn load_delivery(db: &sqlx::PgPool, raw_id: &str) -> Result<Option<DeliveryAccess>, sqlx::Error> {
    let id = js::parse_int(raw_id).map_or_else(|| "NaN".to_string(), js::number_to_string);
    sqlx::query_as(
        "SELECT d.id, d.group_id, d.supplier_id, d.reconciled, d.bl_number, d.bl_amount, d.invoice_reference,
                d.scheduled_date, d.delivered_date, s.id AS supplier_row, s.name AS supplier_name,
                s.email AS supplier_email, g.id AS group_row, g.name AS group_name
           FROM deliveries d
           LEFT JOIN suppliers s ON d.supplier_id = s.id
           LEFT JOIN groups g ON d.group_id = g.id
          WHERE d.id = $1::int4",
    )
    .bind(id)
    .fetch_optional(db)
    .await
}

// ---------- Commentaires ----------

/// Commentaire avec son auteur, son magasin et une copie de sa livraison
/// (storage.getReconciliationComments)
#[derive(Debug, FromRow)]
struct CommentWithRelations {
    id: i32,
    delivery_id: i32,
    group_id: i32,
    content: String,
    #[sqlx(rename = "type")]
    type_: String,
    author_id: String,
    created_at: Option<NaiveDateTime>,
    updated_at: Option<NaiveDateTime>,
    a_id: Option<String>,
    a_first_name: Option<String>,
    a_last_name: Option<String>,
    a_username: Option<String>,
    a_email: Option<String>,
    a_role: Option<String>,
    g_id: Option<i32>,
    g_name: Option<String>,
    g_color: Option<String>,
    d_id: Option<i32>,
    d_order_id: Option<i32>,
    d_supplier_id: Option<i32>,
    d_group_id: Option<i32>,
    d_scheduled_date: Option<NaiveDate>,
    d_delivered_date: Option<NaiveDateTime>,
    d_quantity: Option<i32>,
    d_unit: Option<String>,
    d_status: Option<String>,
    d_notes: Option<String>,
    d_bl_number: Option<String>,
    d_bl_amount: Option<Decimal>,
    d_invoice_reference: Option<String>,
    d_invoice_amount: Option<Decimal>,
    d_reconciled: Option<bool>,
    d_validated_at: Option<NaiveDateTime>,
    d_created_by: Option<String>,
    d_created_at: Option<NaiveDateTime>,
    d_updated_at: Option<NaiveDateTime>,
}

fn ts(value: &Option<NaiveDateTime>) -> Value {
    value
        .as_ref()
        .map_or(Value::Null, |date| Value::String(crate::json::format_ts(date)))
}

impl CommentWithRelations {
    /// Forme JSON de Node : objets joints à null quand la ligne jointe manque
    /// (Drizzle), livraison complétée de supplier et creator vides
    fn to_json(&self) -> Value {
        let author = match &self.a_id {
            Some(id) => json!({
                "id": id,
                "firstName": self.a_first_name,
                "lastName": self.a_last_name,
                "username": self.a_username,
                "email": self.a_email,
                "role": self.a_role,
            }),
            None => Value::Null,
        };
        let group = match self.g_id {
            Some(id) => json!({ "id": id, "name": self.g_name, "color": self.g_color }),
            None => Value::Null,
        };
        let mut delivery = match self.d_id {
            Some(id) => json!({
                "id": id,
                "orderId": self.d_order_id,
                "supplierId": self.d_supplier_id,
                "groupId": self.d_group_id,
                "scheduledDate": self.d_scheduled_date,
                "deliveredDate": ts(&self.d_delivered_date),
                "quantity": self.d_quantity,
                "unit": self.d_unit,
                "status": self.d_status,
                "notes": self.d_notes,
                "blNumber": self.d_bl_number,
                "blAmount": self.d_bl_amount,
                "invoiceReference": self.d_invoice_reference,
                "invoiceAmount": self.d_invoice_amount,
                "reconciled": self.d_reconciled,
                "validatedAt": ts(&self.d_validated_at),
                "createdBy": self.d_created_by,
                "createdAt": ts(&self.d_created_at),
                "updatedAt": ts(&self.d_updated_at),
            }),
            None => json!({}),
        };
        if let Some(object) = delivery.as_object_mut() {
            object.insert("supplier".into(), json!({}));
            object.insert("group".into(), group.clone());
            object.insert("creator".into(), json!({}));
        }
        json!({
            "id": self.id,
            "deliveryId": self.delivery_id,
            "groupId": self.group_id,
            "content": self.content,
            "type": self.type_,
            "authorId": self.author_id,
            "createdAt": ts(&self.created_at),
            "updatedAt": ts(&self.updated_at),
            "author": author,
            "group": group,
            "delivery": delivery,
        })
    }
}

async fn list_comments(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<String>,
) -> ApiResult {
    const FAILED: &str = "Failed to fetch reconciliation comments";
    let delivery_id = int_id(&id, FAILED)?;
    let delivery = load_delivery(&state.db, &id)
        .await
        .or_500(FAILED)?
        .ok_or_else(|| AppError::not_found("Delivery not found"))?;
    if !has_permission(user.role(), "deliveries", "view") {
        return Err(AppError::forbidden("Insufficient permissions"));
    }
    check_group(&user, delivery.group_id)?;
    let comments: Vec<CommentWithRelations> = sqlx::query_as(
        "SELECT c.id, c.delivery_id, c.group_id, c.content, c.type, c.author_id, c.created_at, c.updated_at,
                u.id AS a_id, u.first_name AS a_first_name, u.last_name AS a_last_name, u.username AS a_username,
                u.email AS a_email, u.role AS a_role,
                g.id AS g_id, g.name AS g_name, g.color AS g_color,
                d.id AS d_id, d.order_id AS d_order_id, d.supplier_id AS d_supplier_id, d.group_id AS d_group_id,
                d.scheduled_date AS d_scheduled_date, d.delivered_date AS d_delivered_date, d.quantity AS d_quantity,
                d.unit AS d_unit, d.status AS d_status, d.notes AS d_notes, d.bl_number AS d_bl_number,
                d.bl_amount AS d_bl_amount, d.invoice_reference AS d_invoice_reference,
                d.invoice_amount AS d_invoice_amount, d.reconciled AS d_reconciled,
                d.validated_at AS d_validated_at, d.created_by AS d_created_by,
                d.created_at AS d_created_at, d.updated_at AS d_updated_at
           FROM reconciliation_comments c
           LEFT JOIN users u ON c.author_id = u.id
           LEFT JOIN groups g ON c.group_id = g.id
           LEFT JOIN deliveries d ON c.delivery_id = d.id
          WHERE c.delivery_id = $1
          ORDER BY c.created_at DESC",
    )
    .bind(delivery_id)
    .fetch_all(&state.db)
    .await
    .or_500(FAILED)?;
    let comments: Vec<Value> = comments.iter().map(CommentWithRelations::to_json).collect();
    Ok(Json(comments).into_response())
}

async fn create_comment(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<String>,
    JsonBody(body): JsonBody,
) -> ApiResult {
    const FAILED: &str = "Failed to create reconciliation comment";
    let delivery_id = int_id(&id, FAILED)?;
    let delivery = load_delivery(&state.db, &id)
        .await
        .or_500(FAILED)?
        .ok_or_else(|| AppError::not_found("Delivery not found"))?;
    if !has_permission(user.role(), "deliveries", "edit") {
        return Err(AppError::forbidden("Insufficient permissions to create comments"));
    }
    check_group(&user, delivery.group_id)?;
    // { ...req.body, deliveryId, authorId, groupId } : ces trois champs ne viennent
    // jamais du corps ; une erreur de validation donne un 500, comme Node
    let mut input = body.as_object().cloned().unwrap_or_default();
    input.insert("deliveryId".into(), json!(delivery_id));
    input.insert("authorId".into(), json!(user.id()));
    input.insert("groupId".into(), json!(delivery.group_id));
    let data = comment_schema()
        .parse(&Value::Object(input))
        .map_err(|_| AppError::internal(FAILED))?;
    let comment: ReconciliationCommentsRow = db::insert(&state.db, &data).await.or_500(FAILED)?;
    Ok((StatusCode::CREATED, Json(comment)).into_response())
}

/// Auteur et magasin d'un commentaire (storage.getReconciliationCommentById)
async fn comment_owner(db: &sqlx::PgPool, id: i32, failed: &str) -> Result<(String, i32), AppError> {
    let comment: Option<(String, i32)> =
        sqlx::query_as("SELECT author_id, group_id FROM reconciliation_comments WHERE id = $1")
            .bind(id)
            .fetch_optional(db)
            .await
            .or_500(failed)?;
    comment.ok_or_else(|| AppError::not_found("Comment not found"))
}

/// Seuls l'auteur ou un admin agissent sur un commentaire, dans un magasin de l'utilisateur
fn check_comment_owner(
    user: &CurrentUser,
    author_id: &str,
    group_id: i32,
    action: &str,
) -> Result<(), AppError> {
    if !user.is_admin() && author_id != user.id() {
        return Err(AppError::forbidden(&format!(
            "Only comment author or admin can {action} comments"
        )));
    }
    check_group(user, group_id)
}

async fn update_comment(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<String>,
    JsonBody(body): JsonBody,
) -> ApiResult {
    const FAILED: &str = "Failed to update reconciliation comment";
    let id = int_id(&id, FAILED)?;
    let (author_id, group_id) = comment_owner(&state.db, id, FAILED).await?;
    check_comment_owner(&user, &author_id, group_id, "edit")?;
    let data = comment_schema()
        .partial()
        .parse(&body)
        .map_err(|_| AppError::internal(FAILED))?;
    let comment = db::update_by_id::<ReconciliationCommentsRow>(&state.db, id, &data, true)
        .await
        .or_500(FAILED)?;
    Ok(json_or_empty(comment))
}

async fn delete_comment(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<String>,
) -> ApiResult {
    const FAILED: &str = "Failed to delete reconciliation comment";
    let id = int_id(&id, FAILED)?;
    let (author_id, group_id) = comment_owner(&state.db, id, FAILED).await?;
    check_comment_owner(&user, &author_id, group_id, "delete")?;
    db::delete_by_id::<ReconciliationCommentsRow>(&state.db, id)
        .await
        .or_500(FAILED)?;
    Ok(Json(json!({ "message": "Comment deleted successfully" })).into_response())
}

// ---------- Courriel au fournisseur ----------

/// Erreur imprévue de l'envoi : son message, à défaut celui de Node
fn mail_failure(message: &str) -> AppError {
    let message = if message.is_empty() {
        "Impossible d'envoyer le mail au fournisseur"
    } else {
        message
    };
    AppError::internal(message)
}

async fn send_supplier_mail(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<String>,
) -> ApiResult {
    let delivery = load_delivery(&state.db, &id)
        .await
        .map_err(|error| mail_failure(&nocodb::database_message(&error)))?
        .ok_or_else(|| AppError::not_found("Livraison introuvable"))?;
    if !has_permission(user.role(), "deliveries", "view") {
        return Err(AppError::forbidden("Insufficient permissions"));
    }
    check_group(&user, delivery.group_id)?;

    // Adresse du fournisseur : celle de sa fiche
    let supplier_email = delivery
        .supplier_email
        .as_deref()
        .map(js::trim)
        .unwrap_or_default()
        .to_string();
    if supplier_email.is_empty() {
        let name = delivery
            .supplier_name
            .clone()
            .filter(|name| !name.is_empty())
            .unwrap_or_else(|| "ce fournisseur".to_string());
        return Err(AppError::bad_request(&format!(
            "Aucune adresse email renseignée pour {name}"
        )));
    }

    // Configuration SMTP du magasin (mot de passe chiffré : lu ici seulement)
    let group: GroupsRow = db::find_by_id(&state.db, delivery.group_id)
        .await
        .map_err(|error| mail_failure(&nocodb::database_message(&error)))?
        .ok_or_else(|| AppError::not_found("Magasin de la livraison introuvable"))?;
    if group.smtp_enabled != Some(true) {
        return Err(AppError::bad_request(&format!(
            "L'envoi de mails n'est pas activé pour le magasin {}. Renseignez la configuration SMTP sur sa fiche.",
            group.name
        )));
    }
    let missing = mail::missing_smtp_fields(&group);
    if !missing.is_empty() {
        return Err(AppError::bad_request(&format!(
            "Configuration SMTP incomplète pour {} : {}",
            group.name,
            missing.join(", ")
        )));
    }

    // Tentative journalisée, réussie ou non ; un échec du journal n'annule pas l'envoi
    let account = &user.user;
    let sender_name = [account.first_name.as_deref(), account.last_name.as_deref()]
        .into_iter()
        .flatten()
        .filter(|name| !name.is_empty())
        .collect::<Vec<_>>()
        .join(" ");
    let sender_name = Some(js::trim(&sender_name).to_string())
        .filter(|name| !name.is_empty())
        .or_else(|| Some(account.username.clone()).filter(|name| !name.is_empty()))
        .unwrap_or_else(|| account.id.clone());
    let mail_delivery = delivery.mail_delivery();
    let supplier_name = delivery.supplier_name.clone().filter(|name| !name.is_empty());
    let sent = mail::send_supplier_document_request(
        &group,
        &mail_delivery,
        &supplier_email,
        &state.config.encryption_key,
    )
    .await;

    let (status, message_id, error_message) = match &sent {
        Ok(message_id) => ("sent", Some(message_id.clone()), None),
        Err(message) if message.is_empty() => ("failed", None, Some("Erreur inconnue".to_string())),
        Err(message) => ("failed", None, Some(message.clone())),
    };
    let entry = MailLog {
        delivery_id: delivery.id,
        group_id: delivery.group_id,
        supplier_id: Some(delivery.supplier_id),
        supplier_name: supplier_name.clone(),
        sent_to: supplier_email.clone(),
        subject: mail::subject(&mail_delivery),
        status,
        error_message,
        message_id,
        sent_by: account.id.clone(),
        sent_by_name: sender_name,
    };
    if let Err(error) = mail::record_mail_log(&state.db, &entry).await {
        tracing::error!(%error, "historisation du mail fournisseur impossible");
    }

    match sent {
        Ok(message_id) => Ok(Json(json!({
            "success": true,
            "sentTo": supplier_email,
            "supplierName": supplier_name,
            "messageId": message_id,
        }))
        .into_response()),
        Err(message) => Err(mail_failure(&message)),
    }
}

async fn supplier_mail_logs(State(state): State<AppState>, user: CurrentUser, query: JsQuery) -> ApiResult {
    const FAILED: &str = "Failed to fetch supplier mail logs";
    // Un identifiant illisible ne fait échouer que la requête SQL, après le contrôle des magasins
    let group_ids: Option<Vec<i32>> = if !user.is_admin() {
        let ids = user.group_ids();
        if ids.is_empty() {
            return Ok(Json(json!([])).into_response());
        }
        Some(ids)
    } else if let Some(store_id) = query.truthy("storeId") {
        Some(vec![int_id(store_id, FAILED)?])
    } else {
        None
    };
    let delivery_id = query
        .truthy("deliveryId")
        .map(|id| int_id(id, FAILED))
        .transpose()?;
    let logs: Vec<SupplierMailLogsRow> = sqlx::query_as(&SupplierMailLogsRow::select(
        "WHERE ($1::int4[] IS NULL OR group_id = ANY($1)) AND ($2::int4 IS NULL OR delivery_id = $2)
         ORDER BY created_at DESC LIMIT 500",
    ))
    .bind(group_ids)
    .bind(delivery_id)
    .fetch_all(&state.db)
    .await
    .or_500(FAILED)?;
    Ok(Json(logs).into_response())
}

// ---------- Vérification des factures ----------

/// TypeError de `valeur.trim()` sur une valeur qui n'est pas une chaîne
fn blank(name: &str, value: Option<&Value>) -> Result<bool, String> {
    match value {
        Some(value) if truthy(value) => match value.as_str() {
            Some(text) => Ok(js::trim(text).is_empty()),
            None => Err(nocodb::not_a_string_error(name, "trim", Some(value))),
        },
        _ => Ok(true),
    }
}

/// Après une vérification réussie, Node recopie sur la livraison la référence,
/// les montants et l'échéance trouvés ; une échéance que new Date() ne lit pas fait
/// échouer toute la mise à jour (erreur journalisée seulement)
async fn save_verification(db: &sqlx::PgPool, delivery_id: i32, result: &Verification) {
    let found_something = result.invoice_amount != JsField::Absent
        || result.invoice_amount_ttc != JsField::Absent
        || result.due_date != JsField::Absent
        || result.invoice_reference != JsField::Absent;
    if !result.exists || !found_something {
        return;
    }
    let mut data = Map::new();
    if let Some(reference) = result.invoice_reference.get().filter(|value| truthy(value)) {
        data.insert("invoiceReference".into(), reference.clone());
    }
    if let Some(amount) = result.invoice_amount.get() {
        data.insert(
            "invoiceAmount".into(),
            Value::String(verification::js_number_text(*amount)),
        );
    }
    if let Some(amount) = result.invoice_amount_ttc.get() {
        data.insert(
            "invoiceAmountTTC".into(),
            Value::String(verification::js_number_text(*amount)),
        );
    }
    if let Some(normalized) = result.normalized_due_date() {
        match crate::services::dates::parse_js_date(&normalized) {
            Some(date) => {
                data.insert("dueDate".into(), Value::String(js::iso(&date)));
            }
            None => {
                tracing::error!(delivery_id, "échéance illisible : livraison non mise à jour");
                return;
            }
        }
    }
    if data.is_empty() {
        return;
    }
    if let Err(error) = db::update_by_id::<crate::schema::DeliveriesRow>(db, delivery_id, &data, true).await {
        tracing::error!(%error, delivery_id, "sauvegarde des données de vérification");
    }
}

async fn verify_delivery_invoice(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<String>,
    JsonBody(body): JsonBody,
) -> ApiResult {
    let failed = |message: String| {
        AppError::with_body(
            StatusCode::INTERNAL_SERVER_ERROR,
            json!({ "message": "Failed to verify invoice", "error": message }),
        )
    };
    let delivery = load_delivery(&state.db, &id)
        .await
        .map_err(|error| failed(nocodb::database_message(&error)))?
        .ok_or_else(|| AppError::not_found("Delivery not found"))?;
    if !has_permission(user.role(), "deliveries", "view") {
        return Err(AppError::forbidden("Insufficient permissions"));
    }
    check_group(&user, delivery.group_id)?;
    if delivery.supplier_row.is_none() || delivery.group_row.is_none() {
        return Err(AppError::bad_request(
            "Delivery missing supplier or group information",
        ));
    }

    // Une référence de facture ou un numéro de BL non vide
    let invoice_reference = body.get("invoiceReference");
    let bl_number = body.get("blNumber");
    let reference_blank = blank("invoiceReference", invoice_reference).map_err(failed)?;
    if reference_blank && blank("blNumber", bl_number).map_err(failed)? {
        return Err(AppError::bad_request("Référence de facture ou numéro BL requis"));
    }
    let force_refresh = body.get("forceRefresh").is_some_and(truthy);
    let reconciled = delivery.reconciled == Some(true);
    let result = match (
        invoice_reference.and_then(Value::as_str),
        bl_number.and_then(Value::as_str),
    ) {
        (Some(reference), _) if !reference_blank => {
            verification::verify_invoice(&state, reference, delivery.group_id, force_refresh, reconciled)
                .await
        }
        (_, Some(bl)) => {
            let supplier = delivery.supplier_name.clone().unwrap_or_default();
            verification::verify_invoice_by_bl(
                &state,
                bl,
                &supplier,
                delivery.group_id,
                force_refresh,
                reconciled,
            )
            .await
        }
        _ => Verification::failure("Aucune référence de facture ou numéro BL fourni"),
    };
    save_verification(&state.db, delivery.id, &result).await;
    Ok(Json(result).into_response())
}

async fn verify_invoice(
    State(state): State<AppState>,
    _user: CurrentUser,
    JsonBody(body): JsonBody,
) -> ApiResult {
    let group_id = body.get("groupId").filter(|value| truthy(value));
    let invoice_reference = body.get("invoiceReference").filter(|value| truthy(value));
    let (Some(group_id), Some(invoice_reference)) = (group_id, invoice_reference) else {
        return Err(AppError::bad_request("groupId and invoiceReference are required"));
    };
    let result = verification::verify_invoice_raw(&state, invoice_reference, group_id, false, false).await;
    Ok(Json(result).into_response())
}

async fn verify_invoices(
    State(state): State<AppState>,
    _user: CurrentUser,
    JsonBody(body): JsonBody,
) -> ApiResult {
    let Some(references) = body.get("invoiceReferences").and_then(Value::as_array) else {
        return Err(AppError::bad_request("invoiceReferences must be an array"));
    };
    let results = nocodb::verify_multiple_invoice_references(&state, references)
        .await
        .ok_or_else(|| AppError::internal("Failed to verify invoices"))?;
    Ok(Json(results).into_response())
}

// ---------- Cache des factures ----------

fn admin_only(user: &CurrentUser) -> Result<(), AppError> {
    if user.is_admin() {
        Ok(())
    } else {
        Err(AppError::forbidden(
            "Seuls les admins peuvent exécuter cette opération",
        ))
    }
}

async fn cache_diagnosis(State(state): State<AppState>, user: CurrentUser) -> ApiResult {
    admin_only(&user)?;
    let failed = |message: String| {
        AppError::with_body(
            StatusCode::INTERNAL_SERVER_ERROR,
            json!({ "message": "Erreur lors du diagnostic", "error": message }),
        )
    };
    // storage.getDeliveries() : mêmes jointures et même ordre que Node
    let deliveries: Vec<(i32, i32, Option<String>, Option<bool>)> = sqlx::query_as(
        "SELECT deliveries.id, deliveries.group_id, deliveries.invoice_reference, deliveries.reconciled
           FROM deliveries
           LEFT JOIN suppliers ON deliveries.supplier_id = suppliers.id
           LEFT JOIN groups ON deliveries.group_id = groups.id
           LEFT JOIN users ON deliveries.created_by = users.id
          ORDER BY deliveries.created_at DESC",
    )
    .fetch_all(&state.db)
    .await
    .map_err(|error| failed(nocodb::database_message(&error)))?;
    let reconciled: Vec<_> = deliveries
        .iter()
        .filter(|(_, _, _, reconciled)| *reconciled == Some(true))
        .collect();
    let mut samples = Vec::new();
    for (id, group_id, reference, _) in reconciled.iter().take(5) {
        let Some(reference) = reference.as_deref().filter(|r| !r.is_empty()) else {
            continue;
        };
        // Clé au format inversé, comme Node (défaut reproduit)
        let key = format!("{}_{group_id}", reference.to_lowercase());
        let cached = verification::read_cache(&state.db, &key)
            .await
            .map_err(|error| failed(nocodb::database_message(&error)))?;
        let mut sample = json!({
            "deliveryId": id,
            "invoiceRef": reference,
            "groupId": group_id,
            "reconciled": true,
            "cacheExists": cached.is_some(),
            "cacheReconciled": cached.as_ref().is_some_and(|c| c.is_reconciled == Some(true)),
        });
        if let Some(cached) = cached {
            sample["cacheExpires"] = Value::String(crate::json::format_ts(&cached.expires_at));
        }
        samples.push(sample);
    }
    let (total, count) = (deliveries.len(), reconciled.len());
    // Math.round(x / 0 * 100) : NaN, écrit null
    let percentage = if total == 0 {
        Value::Null
    } else {
        js::number_value((count as f64 / total as f64 * 100.0 + 0.5).floor())
    };
    Ok(Json(json!({
        "statistics": {
            "totalDeliveries": total,
            "reconciledDeliveries": count,
            "percentageReconciled": percentage,
        },
        "sampleCaches": samples,
        "message": "Diagnostic du cache terminé",
    }))
    .into_response())
}

async fn cache_update_reconciled(State(state): State<AppState>, user: CurrentUser) -> ApiResult {
    admin_only(&user)?;
    let updated = verification::update_existing_reconciled_caches(&state.db).await;
    tracing::info!(updated, "caches des livraisons validées marqués permanents");
    Ok(Json(json!({
        "message": "Mise à jour des caches permanents terminée avec succès",
        "success": true,
    }))
    .into_response())
}

async fn cache_mark_reconciled(
    State(state): State<AppState>,
    user: CurrentUser,
    JsonBody(body): JsonBody,
) -> ApiResult {
    let invoice_reference = body.get("invoiceReference").filter(|value| truthy(value));
    let group_id = body.get("groupId").filter(|value| truthy(value));
    let (Some(invoice_reference), Some(group_id)) = (invoice_reference, group_id) else {
        return Err(AppError::bad_request("Invoice reference and group ID required"));
    };
    if !["admin", "directeur"].contains(&user.role()) {
        return Err(AppError::forbidden("Insufficient permissions"));
    }
    verification::update_cache_as_reconciled_raw(&state.db, invoice_reference, group_id).await;
    Ok(Json(json!({ "message": "Cache marked as reconciled successfully" })).into_response())
}
