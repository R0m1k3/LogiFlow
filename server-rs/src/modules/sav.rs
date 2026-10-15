// SAV : /api/sav/tickets et /api/sav/stats (server/routes.ts, « SAV routes » ;
// storage.ts getSavTickets à getSavTicketStats). Comme Node aujourd'hui :
// - un compte sans magasin voit les tickets et les compteurs de tous les magasins ;
// - la suppression ne contrôle pas le magasin : un directeur supprime les tickets
//   de n'importe quel magasin ;
// - la modification (schéma zod partiel) peut déplacer le ticket vers un autre
//   magasin et changer son créateur ;
// - l'historique est désactivé dans storage.ts : POST …/history n'enregistre rien et
//   renvoie null, history vaut toujours [] ;
// - numéro de ticket « nombre de tickets de l'année + 1 », mais le COUNT est lu en
//   texte par node-pg, donc concaténé : 5 tickets donnent « 51 », SAV-2026-0051.
//   Reproduit tel quel (doublons possibles, docs/PLAN-MIGRATION-RUST.md) ;
// - GET /:id joint la ligne complète du magasin (mot de passe SMTP remplacé par
//   smtpPasswordSet).

use std::collections::HashMap;

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::{Json, Router, routing::get, routing::post};
use chrono::{Datelike, Utc};
use serde_json::{Value, json};
use sqlx::{Postgres, QueryBuilder};

use crate::AppState;
use crate::auth::CurrentUser;
use crate::db::{self, columns_of};
use crate::error::{ApiResult, AppError, OrInternal, json_or_empty};
use crate::js;
use crate::json::{spread, strip_smtp_password};
use crate::projections::{GroupSummary, UserSummary};
use crate::request::{JsQuery, JsonBody, int_id};
use crate::schema::{GroupsRow, SavTicketsRow, SuppliersRow};
use crate::zod::{Field, Object};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/sav/tickets", get(list).post(create))
        .route("/api/sav/tickets/{id}", get(show).patch(update).delete(remove))
        .route("/api/sav/tickets/{id}/history", post(add_history))
        .route("/api/sav/stats", get(stats))
}

const PRIORITIES: [&str; 4] = ["faible", "normale", "haute", "critique"];
const STATUSES: [&str; 6] = [
    "nouveau",
    "en_cours",
    "attente_pieces",
    "attente_echange",
    "resolu",
    "ferme",
];
const PROBLEM_TYPES: [&str; 4] = ["defectueux", "pieces_manquantes", "non_conforme", "autre"];
const EDITORS: [&str; 3] = ["admin", "manager", "directeur"];

/// insertSavTicketSchema
fn insert_schema() -> Object {
    SavTicketsRow::insert_schema()
        .omit(&[
            "id",
            "ticketNumber",
            "createdAt",
            "updatedAt",
            "resolvedAt",
            "closedAt",
        ])
        .extend(vec![
            Field::enumeration("priority", &PRIORITIES).default(json!("normale")),
            Field::enumeration("status", &STATUSES).default(json!("nouveau")),
            Field::enumeration("problemType", &PROBLEM_TYPES).default(json!("defectueux")),
        ])
}

/// Nombre lu par parseInt utilisé comme entier : hors limites, la requête de Node échoue
fn int4(number: f64, failed: &str) -> Result<i32, AppError> {
    if number >= f64::from(i32::MIN) && number <= f64::from(i32::MAX) {
        Ok(number as i32)
    } else {
        Err(AppError::internal(failed))
    }
}

/// Magasins lus (vide : tous). Admin : ?groupId s'il se lit comme un nombre non nul ;
/// les autres : leurs magasins (aucun pour un compte sans magasin, donc tous)
fn scope(user: &CurrentUser, query: &JsQuery, failed: &str) -> Result<Vec<i32>, AppError> {
    if !user.is_admin() {
        return Ok(user.group_ids());
    }
    match query.truthy("groupId").and_then(js::parse_int) {
        Some(group) if group != 0.0 => Ok(vec![int4(group, failed)?]),
        _ => Ok(Vec::new()),
    }
}

/// Ajoute « WHERE » ou « AND » avant une condition
fn and(sql: &mut QueryBuilder<'_, Postgres>, count: &mut usize) {
    sql.push(if *count == 0 { " WHERE " } else { " AND " });
    *count += 1;
}

async fn list(State(state): State<AppState>, user: CurrentUser, query: JsQuery) -> ApiResult {
    const FAILED: &str = "Failed to fetch tickets";
    let group_ids = scope(&user, &query, FAILED)?;
    let mut sql = QueryBuilder::<Postgres>::new(format!(
        "SELECT {} FROM sav_tickets
           LEFT JOIN suppliers ON sav_tickets.supplier_id = suppliers.id
           LEFT JOIN groups ON sav_tickets.group_id = groups.id
           LEFT JOIN users ON sav_tickets.created_by = users.id",
        columns_of::<SavTicketsRow>("sav_tickets")
    ));
    let mut count = 0;
    if !group_ids.is_empty() {
        and(&mut sql, &mut count);
        sql.push("sav_tickets.group_id = ANY(")
            .push_bind(group_ids)
            .push(")");
    }
    if let Some(status) = query.truthy("status") {
        and(&mut sql, &mut count);
        sql.push("sav_tickets.status = ").push_bind(status.to_string());
    }
    // parseInt(supplierId) : NaN et 0 ne filtrent pas
    if let Some(supplier) = query
        .truthy("supplierId")
        .and_then(js::parse_int)
        .filter(|supplier| *supplier != 0.0)
    {
        let supplier = int4(supplier, FAILED)?;
        and(&mut sql, &mut count);
        sql.push("sav_tickets.supplier_id = ").push_bind(supplier);
    }
    if let Some(priority) = query.truthy("priority") {
        and(&mut sql, &mut count);
        sql.push("sav_tickets.priority = ")
            .push_bind(priority.to_string());
    }
    // new Date(…) : une date invalide fait échouer toISOString
    for (key, operator) in [("startDate", " >= "), ("endDate", " <= ")] {
        if let Some(text) = query.truthy(key) {
            let date = js::parse_date(text).ok_or_else(|| AppError::internal(FAILED))?;
            and(&mut sql, &mut count);
            sql.push("sav_tickets.created_at")
                .push(operator)
                .push_bind(date.naive_utc());
        }
    }
    sql.push(" ORDER BY sav_tickets.created_at DESC");
    let tickets: Vec<SavTicketsRow> = sql.build_query_as().fetch_all(&state.db).await.or_500(FAILED)?;

    let supplier_ids: Vec<i32> = tickets.iter().map(|ticket| ticket.supplier_id).collect();
    let suppliers: HashMap<i32, SuppliersRow> = db::find_by_ids::<SuppliersRow>(&state.db, &supplier_ids)
        .await
        .or_500(FAILED)?
        .into_iter()
        .map(|supplier| (supplier.id, supplier))
        .collect();
    let group_ids: Vec<i32> = tickets.iter().map(|ticket| ticket.group_id).collect();
    let groups = GroupSummary::by_ids(&state.db, &group_ids).await.or_500(FAILED)?;
    let creator_ids: Vec<String> = tickets.iter().map(|ticket| ticket.created_by.clone()).collect();
    let creators = UserSummary::by_ids(&state.db, &creator_ids)
        .await
        .or_500(FAILED)?;

    let out: Vec<Value> = tickets
        .iter()
        .map(|ticket| {
            with_relations(
                ticket,
                json!(suppliers.get(&ticket.supplier_id)),
                json!(groups.get(&ticket.group_id)),
                json!(creators.get(&ticket.created_by)),
            )
        })
        .collect();
    Ok(Json(out).into_response())
}

/// { ...ticket, supplier, group, creator, history: [] }
fn with_relations(ticket: &SavTicketsRow, supplier: Value, group: Value, creator: Value) -> Value {
    let mut entry = spread(ticket);
    entry.insert("supplier".into(), supplier);
    entry.insert("group".into(), group);
    entry.insert("creator".into(), creator);
    entry.insert("history".into(), json!([]));
    Value::Object(entry)
}

/// Ticket existant ; `denied` : message si le magasin n'est pas celui de l'utilisateur
/// (None : pas de contrôle du magasin)
async fn find_ticket(
    state: &AppState,
    user: &CurrentUser,
    raw_id: &str,
    failed: &str,
    denied: Option<&str>,
) -> Result<SavTicketsRow, AppError> {
    let id = int_id(raw_id, failed)?;
    let ticket = db::find_by_id::<SavTicketsRow>(&state.db, id)
        .await
        .or_500(failed)?
        .ok_or_else(|| AppError::not_found("Ticket not found"))?;
    let foreign = !user.is_admin() && !user.group_ids().contains(&ticket.group_id);
    match denied {
        Some(denied) if foreign => Err(AppError::forbidden(denied)),
        _ => Ok(ticket),
    }
}

async fn show(State(state): State<AppState>, user: CurrentUser, Path(id): Path<String>) -> ApiResult {
    const FAILED: &str = "Failed to fetch ticket";
    let ticket = find_ticket(&state, &user, &id, FAILED, Some("Access denied to this ticket")).await?;
    let supplier = db::find_by_id::<SuppliersRow>(&state.db, ticket.supplier_id)
        .await
        .or_500(FAILED)?;
    let group = db::find_by_id::<GroupsRow>(&state.db, ticket.group_id)
        .await
        .or_500(FAILED)?;
    let creator = UserSummary::by_ids(&state.db, std::slice::from_ref(&ticket.created_by))
        .await
        .or_500(FAILED)?
        .remove(&ticket.created_by);
    let body = with_relations(
        &ticket,
        json!(supplier),
        strip_smtp_password(json!(group)),
        json!(creator),
    );
    Ok(Json(body).into_response())
}

async fn create(State(state): State<AppState>, user: CurrentUser, JsonBody(body): JsonBody) -> ApiResult {
    const FAILED: &str = "Failed to create ticket";
    if !EDITORS.contains(&user.role()) {
        return Err(AppError::forbidden("Insufficient permissions to create tickets"));
    }
    // Magasins possibles : tous (par nom) pour l'admin, les siens sinon
    let available: Vec<i32> = if user.is_admin() {
        sqlx::query_scalar("SELECT id FROM groups ORDER BY name")
            .fetch_all(&state.db)
            .await
            .or_500(FAILED)?
    } else {
        user.group_ids()
    };
    let Some(first) = available.first().copied() else {
        return Err(AppError::bad_request("No groups available for ticket creation"));
    };

    // { ...req.body, groupId: req.body.groupId || premier magasin, createdBy }
    let mut input = body.as_object().cloned().unwrap_or_default();
    if !input.get("groupId").is_some_and(js::truthy) {
        input.insert("groupId".into(), json!(first));
    }
    input.insert("createdBy".into(), json!(user.id()));
    let mut ticket = insert_schema()
        .parse(&Value::Object(input))
        .map_err(|issues| AppError::validation("Validation error", issues))?;
    let allowed = ticket
        .get("groupId")
        .and_then(Value::as_f64)
        .is_some_and(|group| available.iter().any(|id| f64::from(*id) == group));
    if !allowed {
        return Err(AppError::forbidden("Access denied to the specified group"));
    }

    // createSavTicket : tickets créés cette année (heure UTC du serveur Node)
    let year = Utc::now().year();
    let count: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM sav_tickets
          WHERE created_at >= make_date($1::int, 1, 1) AND created_at < make_date($2::int, 1, 1)",
    )
    .bind(year)
    .bind(year + 1)
    .fetch_one(&state.db)
    .await
    .or_500(FAILED)?;
    ticket.insert("ticketNumber".into(), json!(ticket_number(year, count)));
    let created: SavTicketsRow = db::insert(&state.db, &ticket).await.or_500(FAILED)?;
    Ok((StatusCode::CREATED, Json(created)).into_response())
}

/// `SAV-${année}-${String((count || 0) + 1).padStart(4, '0')}` avec count en texte :
/// « 5 » + 1 donne « 51 »
fn ticket_number(year: i32, count: i64) -> String {
    format!("SAV-{year}-{:0>4}", format!("{count}1"))
}

async fn update(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<String>,
    JsonBody(body): JsonBody,
) -> ApiResult {
    const FAILED: &str = "Failed to update ticket";
    if !EDITORS.contains(&user.role()) {
        return Err(AppError::forbidden("Insufficient permissions to modify tickets"));
    }
    let ticket = find_ticket(
        &state,
        &user,
        &id,
        FAILED,
        Some("Access denied to modify this ticket"),
    )
    .await?;
    let data = insert_schema()
        .partial()
        .parse(&body)
        .map_err(|issues| AppError::validation("Validation error", issues))?;
    let updated = db::update_by_id::<SavTicketsRow>(&state.db, ticket.id, &data, true)
        .await
        .or_500(FAILED)?;
    // Changement de statut : entrée d'historique désactivée dans storage.ts
    Ok(json_or_empty(updated))
}

async fn remove(State(state): State<AppState>, user: CurrentUser, Path(id): Path<String>) -> ApiResult {
    const FAILED: &str = "Failed to delete ticket";
    if !["admin", "directeur"].contains(&user.role()) {
        return Err(AppError::forbidden("Insufficient permissions to delete tickets"));
    }
    let ticket = find_ticket(&state, &user, &id, FAILED, None).await?;
    db::delete_by_id::<SavTicketsRow>(&state.db, ticket.id)
        .await
        .or_500(FAILED)?;
    Ok(StatusCode::NO_CONTENT.into_response())
}

async fn add_history(State(state): State<AppState>, user: CurrentUser, Path(id): Path<String>) -> ApiResult {
    const FAILED: &str = "Failed to add comment";
    if !EDITORS.contains(&user.role()) {
        return Err(AppError::forbidden("Insufficient permissions to add comments"));
    }
    find_ticket(
        &state,
        &user,
        &id,
        FAILED,
        Some("Access denied to add comments to this ticket"),
    )
    .await?;
    // addSavTicketHistory n'enregistre rien et renvoie null
    Ok((StatusCode::CREATED, Json(Value::Null)).into_response())
}

async fn stats(State(state): State<AppState>, user: CurrentUser, query: JsQuery) -> ApiResult {
    const FAILED: &str = "Failed to fetch stats";
    let group_ids = scope(&user, &query, FAILED)?;
    let mut sql = QueryBuilder::<Postgres>::new(
        "SELECT count(*),
                count(*) filter (where status = 'nouveau'),
                count(*) filter (where status in ('en_cours', 'attente_pieces', 'attente_echange')),
                count(*) filter (where status in ('resolu', 'ferme')),
                count(*) filter (where priority = 'critique')
           FROM sav_tickets",
    );
    if !group_ids.is_empty() {
        sql.push(" WHERE group_id = ANY(").push_bind(group_ids).push(")");
    }
    let (total, new, in_progress, resolved, critical): (i64, i64, i64, i64, i64) =
        sql.build_query_as().fetch_one(&state.db).await.or_500(FAILED)?;
    Ok(Json(json!({
        "totalTickets": total,
        "newTickets": new,
        "inProgressTickets": in_progress,
        "resolvedTickets": resolved,
        "criticalTickets": critical,
    }))
    .into_response())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn numero_de_ticket_comme_node() {
        assert_eq!(ticket_number(2026, 0), "SAV-2026-0001");
        assert_eq!(ticket_number(2026, 5), "SAV-2026-0051");
        assert_eq!(ticket_number(2026, 123), "SAV-2026-1231");
    }

    #[test]
    fn schema_de_creation() {
        let issues = insert_schema()
            .parse(&json!({ "priority": "urgente" }))
            .unwrap_err();
        let paths: Vec<&str> = issues
            .iter()
            .map(|issue| issue["path"][0].as_str().unwrap())
            .collect();
        assert_eq!(
            paths,
            [
                "supplierId",
                "groupId",
                "productGencode",
                "productDesignation",
                "problemDescription",
                "priority",
                "createdBy"
            ]
        );
    }
}
