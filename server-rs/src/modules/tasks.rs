// Tâches : /api/tasks (server/routes.ts, « Tasks routes » ; storage.ts getTasks à
// completeTask). Comme Node aujourd'hui :
// - les corps ne passent par aucun schéma zod : les champs connus de la table sont
//   écrits tels quels, les erreurs de la base deviennent des 500 ;
// - seul le magasin est contrôlé pour modifier, terminer ou supprimer une tâche :
//   un employé peut modifier ou supprimer celles de son magasin ;
// - un compte sans magasin qui aurait le droit de créer passerait le contrôle du
//   magasin (« userGroupIds.length > 0 && … ») : inatteignable avec la matrice actuelle.

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::{Json, Router, routing::get, routing::post, routing::put};
use chrono::{DateTime, Datelike, NaiveDateTime, Timelike, Utc};
use serde_json::{Value, json};
use sqlx::{Postgres, QueryBuilder};

use crate::AppState;
use crate::access;
use crate::auth::CurrentUser;
use crate::db::{self, Table, columns_of, drizzle_values, node_pg_value};
use crate::error::{ApiResult, AppError, OrInternal};
use crate::js;
use crate::json::spread;
use crate::projections::GroupSummary;
use crate::request::{JsQuery, JsonBody, int_id};
use crate::schema::TasksRow;
use crate::zod::Parsed;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/tasks", get(list).post(create))
        .route("/api/tasks/{id}", put(update).delete(remove))
        .route("/api/tasks/{id}/complete", post(complete))
}

/// Minuit du jour courant à Paris (décision R5), comparé aux dates de début
/// enregistrées à minuit : today.setHours(0, 0, 0, 0)
fn today_midnight() -> NaiveDateTime {
    crate::clock::today().and_hms_opt(0, 0, 0).expect("minuit existe")
}

async fn list(State(state): State<AppState>, user: CurrentUser, query: JsQuery) -> ApiResult {
    // Toute erreur : 500 avec une liste vide
    let failed = || AppError::with_body(StatusCode::INTERNAL_SERVER_ERROR, json!([]));
    let empty = || Ok(Json(json!([])).into_response());

    let group_ids: Option<Vec<i32>> = if user.is_admin() {
        // ?storeId illisible : [NaN] fait échouer la requête de Node
        match query.truthy("storeId") {
            Some(store) => Some(vec![int_id(store, "").map_err(|_| failed())?]),
            None => None,
        }
    } else {
        // Hors admin, un magasin doit être choisi, et être l'un des siens
        let Some(store) = query.truthy("storeId") else {
            return empty();
        };
        match js::parse_int(store) {
            Some(requested) if user.group_ids().iter().any(|id| f64::from(*id) == requested) => {
                Some(vec![requested as i32])
            }
            _ => return empty(),
        }
    };

    let today = today_midnight();
    let mut sql = QueryBuilder::<Postgres>::new(format!(
        "SELECT {} FROM tasks LEFT JOIN groups ON tasks.group_id = groups.id",
        columns_of::<TasksRow>("tasks")
    ));
    let filtered = group_ids.is_some();
    if let Some(ids) = group_ids {
        sql.push(" WHERE tasks.group_id = ANY(").push_bind(ids).push(")");
    }
    // Managers et employés : seulement les tâches dont la date de départ est atteinte
    if ["manager", "employee"].contains(&user.role()) {
        sql.push(if filtered { " AND " } else { " WHERE " })
            .push("(tasks.start_date IS NULL OR tasks.start_date <= ")
            .push_bind(today)
            .push(")");
    }
    sql.push(" ORDER BY tasks.created_at DESC");
    let tasks: Vec<TasksRow> = sql
        .build_query_as()
        .fetch_all(&state.db)
        .await
        .map_err(|_| failed())?;

    let ids: Vec<i32> = tasks.iter().map(|task| task.group_id).collect();
    let groups = GroupSummary::by_ids(&state.db, &ids)
        .await
        .map_err(|_| failed())?;
    // { ...tâche, group, isFutureTask } : date de départ après minuit aujourd'hui
    let out: Vec<Value> = tasks
        .iter()
        .map(|task| {
            let mut entry = spread(task);
            entry.insert("group".into(), json!(groups.get(&task.group_id)));
            entry.insert(
                "isFutureTask".into(),
                Value::Bool(task.start_date.is_some_and(|start| start > today)),
            );
            Value::Object(entry)
        })
        .collect();
    Ok(Json(out).into_response())
}

/// x dans (user.userGroups || []).map(ug => ug.groupId) : égalité stricte de JavaScript
fn in_groups(user: &CurrentUser, value: Option<&Value>) -> bool {
    value
        .and_then(Value::as_f64)
        .is_some_and(|requested| user.group_ids().iter().any(|id| f64::from(*id) == requested))
}

async fn create(State(state): State<AppState>, user: CurrentUser, JsonBody(body): JsonBody) -> ApiResult {
    const FAILED: &str = "Failed to create task";
    if !access::has_permission(user.role(), "tasks", "create") {
        return Err(AppError::forbidden("Permission denied: cannot create tasks"));
    }
    let mut data = body.as_object().cloned().unwrap_or_default();
    data.insert("createdBy".into(), json!(user.id()));
    // Magasin par défaut : 1 pour l'admin, sinon le premier des siens (ou 1)
    if !data.get("groupId").is_some_and(js::truthy) {
        let default = if user.is_admin() {
            1
        } else {
            user.group_ids().first().copied().unwrap_or(1)
        };
        data.insert("groupId".into(), json!(default));
    }
    if !user.is_admin() && !user.group_ids().is_empty() && !in_groups(&user, data.get("groupId")) {
        return Err(AppError::forbidden("Access denied to this group"));
    }

    // createTask : startDate et dueDate convertis en Date (null si absents ou vides)
    let start = match data.remove("startDate") {
        Some(value) if js::truthy(&value) => match js::new_date(&value) {
            Some(date) => Value::String(js::iso(&date)),
            // toISOString d'une date invalide : RangeError avant la requête
            None => return Err(AppError::internal(FAILED)),
        },
        _ => Value::Null,
    };
    let due = match data.remove("dueDate") {
        Some(value) if js::truthy(&value) => Value::String(node_pg_date(js::new_date(&value).as_ref())),
        _ => Value::Null,
    };
    let mut values = drizzle_values::<TasksRow>(&data).map_err(|_| AppError::internal(FAILED))?;
    values.insert("startDate".into(), start);
    values.insert("dueDate".into(), due);
    let task: TasksRow = db::insert(&state.db, &values).await.or_500(FAILED)?;
    Ok(Json(task).into_response())
}

/// Date JavaScript envoyée par node-pg dans une colonne date (dateToString, heure
/// locale du serveur Node = UTC) ; une date invalide donne le texte que node-pg
/// produit, refusé par PostgreSQL avec le même message
fn node_pg_date(date: Option<&DateTime<Utc>>) -> String {
    let Some(date) = date else {
        return "0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN".into();
    };
    let year = date.year();
    let (year, era) = if year < 1 { (1 - year, " BC") } else { (year, "") };
    format!(
        "{year:04}-{:02}-{:02}T{:02}:{:02}:{:02}.{:03}+00:00{era}",
        date.month(),
        date.day(),
        date.hour(),
        date.minute(),
        date.second(),
        date.timestamp_subsec_millis()
    )
}

/// storage.getTask(parseInt(id)) : l'identifiant part en texte, comme node-pg, pour
/// que PostgreSQL rende la même erreur (NaN, hors limites) que Node affiche
async fn find_task(db: &sqlx::PgPool, raw_id: &str) -> Result<Option<TasksRow>, sqlx::Error> {
    let id = js::parse_int(raw_id).map_or_else(|| "NaN".to_string(), js::number_to_string);
    sqlx::query_as::<_, TasksRow>(&TasksRow::select("WHERE id = $1::int4"))
        .bind(id)
        .fetch_optional(db)
        .await
}

/// error.message de node-pg : le message de PostgreSQL
fn pg_message(error: &sqlx::Error) -> String {
    match error.as_database_error() {
        Some(database) => database.message().to_string(),
        None => error.to_string(),
    }
}

/// Tâche existante et du magasin de l'utilisateur (hors admin)
async fn check_access(
    state: &AppState,
    user: &CurrentUser,
    raw_id: &str,
    failed: &str,
) -> Result<TasksRow, AppError> {
    let task = find_task(&state.db, raw_id)
        .await
        .or_500(failed)?
        .ok_or_else(|| AppError::not_found("Task not found"))?;
    if !user.is_admin() && !user.group_ids().contains(&task.group_id) {
        return Err(AppError::forbidden("Access denied"));
    }
    Ok(task)
}

async fn update(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<String>,
    JsonBody(body): JsonBody,
) -> ApiResult {
    // 500 avec le message de l'erreur en détail
    let failed = |details: String| {
        AppError::with_body(
            StatusCode::INTERNAL_SERVER_ERROR,
            json!({ "message": "Failed to update task", "details": details }),
        )
    };
    let task = find_task(&state.db, &id)
        .await
        .map_err(|error| failed(pg_message(&error)))?
        .ok_or_else(|| AppError::not_found("Task not found"))?;
    if !user.is_admin() && !user.group_ids().contains(&task.group_id) {
        return Err(AppError::forbidden("Access denied"));
    }

    // Champs retenus par la route puis par storage.updateTask
    let body = body.as_object().cloned().unwrap_or_default();
    let in_database = |message: &str| failed(format!("Failed to update task in database: {message}"));
    let mut values = Parsed::new();
    for key in ["title", "description", "priority", "status", "assignedTo"] {
        if let Some(value) = body.get(key) {
            values.insert(key.into(), node_pg_value(value));
        }
    }
    if let Some(value) = body.get("startDate") {
        let start = if value.is_null() || value == "" {
            Value::Null
        } else {
            match js::new_date(value) {
                Some(date) => Value::String(js::iso(&date)),
                None => return Err(in_database("Invalid time value")),
            }
        };
        values.insert("startDate".into(), start);
    }
    if let Some(value) = body.get("dueDate") {
        let due = if value.is_null() || value == "" {
            Value::Null
        } else {
            Value::String(node_pg_date(js::new_date(value).as_ref()))
        };
        values.insert("dueDate".into(), due);
    }

    match db::update_by_id::<TasksRow>(&state.db, task.id, &values, true).await {
        Ok(Some(task)) => Ok(Json(task).into_response()),
        // Ligne disparue entre-temps : task.id lu sur undefined dans Node
        Ok(None) => Err(in_database("Cannot read properties of undefined (reading 'id')")),
        Err(error) => Err(in_database(&pg_message(&error))),
    }
}

async fn remove(State(state): State<AppState>, user: CurrentUser, Path(id): Path<String>) -> ApiResult {
    const FAILED: &str = "Failed to delete task";
    let task = check_access(&state, &user, &id, FAILED).await?;
    db::delete_by_id::<TasksRow>(&state.db, task.id)
        .await
        .or_500(FAILED)?;
    Ok(Json(json!({ "message": "Task deleted successfully" })).into_response())
}

async fn complete(State(state): State<AppState>, user: CurrentUser, Path(id): Path<String>) -> ApiResult {
    const FAILED: &str = "Failed to complete task";
    let task = check_access(&state, &user, &id, FAILED).await?;
    let mut values = Parsed::new();
    values.insert("status".into(), json!("completed"));
    values.insert("completedAt".into(), json!(crate::modules::now_iso()));
    values.insert("completedBy".into(), json!(user.id()));
    db::update_by_id::<TasksRow>(&state.db, task.id, &values, true)
        .await
        .or_500(FAILED)?;
    Ok(Json(json!({ "message": "Task completed successfully" })).into_response())
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    #[test]
    fn date_comme_node_pg() {
        let date = Utc.with_ymd_and_hms(2026, 10, 20, 8, 5, 3).unwrap();
        assert_eq!(node_pg_date(Some(&date)), "2026-10-20T08:05:03.000+00:00");
        assert_eq!(node_pg_date(None), "0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN");
    }
}
