// Publicités : /api/ad-campaigns (server/routes.ts, « Publicity routes » ;
// storage.getPublicities, getPublicity, createPublicity, updatePublicity,
// deletePublicity, setPublicityParticipations).
// Comme Node aujourd'hui :
// - la liste ignore le magasin et les magasins de l'utilisateur (PUB-01) ;
// - PUT écrit le corps tel quel, sans validation, et aucune écriture n'est
//   transactionnelle : une participation refusée laisse la publicité créée ou
//   ses anciennes participations effacées (PUB-17) ;
// - /api/ad-campaigns/debug reste exposée (PUB-06).
// Les identifiants et l'année passent à PostgreSQL sous la forme texte que
// node-pg leur donne (String(parseInt(…))), pour les mêmes refus et les mêmes
// messages d'erreur, renvoyés par la suppression et par /debug.

use std::cmp::Ordering;
use std::collections::HashMap;

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::{Json, Router, routing::get, routing::post};
use serde::Serialize;
use serde_json::{Map, Value, json};
use sqlx::PgPool;
use sqlx::postgres::PgArguments;
use sqlx::{Arguments, Postgres};

use crate::AppState;
use crate::access::has_permission;
use crate::auth::CurrentUser;
use crate::db::{self, Table, node_pg_text, parse_int4};
use crate::error::{ApiResult, AppError, OrInternal, json_or_empty};
use crate::js;
use crate::projections::GroupSummary;
use crate::request::{JsQuery, JsonBody};
use crate::schema::PublicitiesRow;
use crate::zod::Object;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/ad-campaigns", get(list).post(create))
        .route("/api/ad-campaigns/debug", get(debug))
        .route("/api/ad-campaigns/{id}", get(get_one).put(update).delete(remove))
        .route("/api/ad-campaigns/{id}/delete", post(remove))
}

/// insertPublicitySchema
fn insert_schema() -> Object {
    PublicitiesRow::insert_schema().omit(&["id", "createdAt", "updatedAt"])
}

/// PublicityWithRelations
#[derive(Serialize)]
struct Publicity {
    #[serde(flatten)]
    publicity: PublicitiesRow,
    participations: Vec<Participation>,
}

#[derive(Serialize)]
struct Participation {
    #[serde(rename = "publicityId")]
    publicity_id: i32,
    #[serde(rename = "groupId")]
    group_id: i32,
    group: Option<GroupSummary>,
}

type ParticipationRow = (i32, i32, Option<i32>, Option<String>, Option<String>);

impl From<ParticipationRow> for Participation {
    fn from((publicity_id, group_id, id, name, color): ParticipationRow) -> Self {
        // Magasin joint par LEFT JOIN : null quand groups.id l'est (Drizzle)
        let group = id.map(|id| GroupSummary {
            id,
            name: name.unwrap_or_default(),
            color,
        });
        Self {
            publicity_id,
            group_id,
            group,
        }
    }
}

const PARTICIPATIONS_SQL: &str =
    "SELECT publicity_participations.publicity_id, publicity_participations.group_id,
        groups.id, groups.name, groups.color
   FROM publicity_participations
   LEFT JOIN groups ON publicity_participations.group_id = groups.id";

/// Message d'erreur tel que node-pg le transmet (error.message)
fn error_message(error: &sqlx::Error) -> String {
    match error {
        sqlx::Error::Database(database) => database.message().to_string(),
        other => other.to_string(),
    }
}

/// String(parseInt(texte)) : forme sous laquelle Node envoie l'identifiant
fn js_id(raw: &str) -> String {
    js::number_string(js::parse_int(raw).unwrap_or(f64::NAN))
}

/// parseInt(pubNumber) || 0 : clé du tri numérique fait en JavaScript
fn number_key(pub_number: &str) -> f64 {
    js::parse_int(pub_number)
        .filter(|number| *number != 0.0)
        .unwrap_or(0.0)
}

/// storage.getPublicities : année facultative (texte de parseInt), tri par N°
/// en SQL puis tri numérique stable comme en JavaScript
async fn publicities(db: &PgPool, year: Option<&str>) -> Result<Vec<Publicity>, sqlx::Error> {
    let mut rows: Vec<PublicitiesRow> = match year {
        Some(year) => {
            sqlx::query_as(&PublicitiesRow::select(
                "WHERE year = $1::int4 ORDER BY pub_number",
            ))
            .bind(year)
            .fetch_all(db)
            .await?
        }
        None => {
            sqlx::query_as(&PublicitiesRow::select("ORDER BY pub_number"))
                .fetch_all(db)
                .await?
        }
    };
    let participations: Vec<ParticipationRow> = if rows.is_empty() {
        Vec::new()
    } else {
        // inArray de Drizzle : un paramètre par identifiant, sans tri (ordre de la base)
        let placeholders: Vec<String> = (1..=rows.len()).map(|i| format!("${i}")).collect();
        let sql = format!(
            "{PARTICIPATIONS_SQL} WHERE publicity_participations.publicity_id IN ({})",
            placeholders.join(", ")
        );
        let mut query = sqlx::query_as::<Postgres, ParticipationRow>(&sql).persistent(false);
        for row in &rows {
            query = query.bind(row.id);
        }
        query.fetch_all(db).await?
    };
    rows.sort_by(|a, b| {
        number_key(&a.pub_number)
            .partial_cmp(&number_key(&b.pub_number))
            .unwrap_or(Ordering::Equal)
    });
    // Participations regroupées par publicité, dans l'ordre de la base
    let mut by_publicity: HashMap<i32, Vec<Participation>> = HashMap::new();
    for row in participations {
        let participation = Participation::from(row);
        by_publicity
            .entry(participation.publicity_id)
            .or_default()
            .push(participation);
    }
    Ok(rows
        .into_iter()
        .map(|publicity| {
            let participations = by_publicity.remove(&publicity.id).unwrap_or_default();
            Publicity {
                publicity,
                participations,
            }
        })
        .collect())
}

/// storage.getPublicity : identifiant sous sa forme texte JavaScript
async fn publicity(db: &PgPool, id: &str) -> Result<Option<Publicity>, sqlx::Error> {
    let Some(publicity) = sqlx::query_as::<_, PublicitiesRow>(&PublicitiesRow::select("WHERE id = $1::int4"))
        .bind(id)
        .fetch_optional(db)
        .await?
    else {
        return Ok(None);
    };
    let participations: Vec<ParticipationRow> = sqlx::query_as(&format!(
        "{PARTICIPATIONS_SQL} WHERE publicity_participations.publicity_id = $1"
    ))
    .bind(publicity.id)
    .persistent(false)
    .fetch_all(db)
    .await?;
    Ok(Some(Publicity {
        publicity,
        participations: participations.into_iter().map(Participation::from).collect(),
    }))
}

/// year ? parseInt(year) : undefined, puis if (year) dans getPublicities
fn year_filter(query: &JsQuery) -> Option<String> {
    let year = js::parse_int(query.truthy("year")?)?;
    (year != 0.0).then(|| js::number_string(year))
}

async fn list(State(state): State<AppState>, _user: CurrentUser, query: JsQuery) -> ApiResult {
    // ?storeId et les magasins de l'utilisateur ne filtrent rien (PUB-01)
    match publicities(&state.db, year_filter(&query).as_deref()).await {
        Ok(list) => Ok(Json(list).into_response()),
        Err(error) => {
            tracing::error!(%error, "Error fetching publicities");
            Ok((StatusCode::INTERNAL_SERVER_ERROR, Json(json!([]))).into_response())
        }
    }
}

async fn debug(State(state): State<AppState>, _user: CurrentUser, query: JsQuery) -> ApiResult {
    match publicities(&state.db, year_filter(&query).as_deref()).await {
        Ok(list) => Ok(Json(list).into_response()),
        Err(error) => Err(AppError::with_body(
            StatusCode::INTERNAL_SERVER_ERROR,
            json!({ "message": "Failed to fetch publicities", "error": error_message(&error) }),
        )),
    }
}

async fn get_one(State(state): State<AppState>, user: CurrentUser, Path(id): Path<String>) -> ApiResult {
    let publicity = publicity(&state.db, &js_id(&id))
        .await
        .or_500("Failed to fetch publicity")?
        .ok_or_else(|| AppError::not_found("Publicity not found"))?;
    if !user.is_admin() {
        let group_ids = user.group_ids();
        let has_access = publicity
            .participations
            .iter()
            .any(|participation| group_ids.contains(&participation.group_id));
        if !has_access {
            return Err(AppError::forbidden("Access denied"));
        }
    }
    Ok(Json(publicity).into_response())
}

/// Échec d'une écriture : erreur SQL, ou TypeError de JavaScript sur un corps inattendu
#[derive(Debug)]
enum WriteError {
    Sql(sqlx::Error),
    TypeError(&'static str),
}

impl From<sqlx::Error> for WriteError {
    fn from(error: sqlx::Error) -> Self {
        Self::Sql(error)
    }
}

impl WriteError {
    fn into_500(self, message: &str) -> AppError {
        match self {
            Self::Sql(error) => tracing::error!(%error, "{message}"),
            Self::TypeError(reason) => tracing::error!(reason, "{message}"),
        }
        AppError::internal(message)
    }
}

/// valeur.length (TypeError sur null)
fn js_length(value: &Value) -> Result<Option<Value>, WriteError> {
    Ok(match value {
        Value::Null => {
            return Err(WriteError::TypeError(
                "Cannot read properties of null (reading 'length')",
            ));
        }
        Value::Array(items) => Some(json!(items.len())),
        Value::String(text) => Some(json!(js::length(text))),
        Value::Object(fields) => fields.get("length").cloned(),
        Value::Bool(_) | Value::Number(_) => None,
    })
}

/// valeur.length > 0
fn has_items(value: &Value) -> Result<bool, WriteError> {
    Ok(js_length(value)?.is_some_and(|length| js::to_number(&length) > 0.0))
}

/// storage.setPublicityParticipations : effacement puis insertion, sans transaction
async fn set_participations(db: &PgPool, publicity_id: i32, group_ids: &Value) -> Result<(), WriteError> {
    sqlx::query("DELETE FROM publicity_participations WHERE publicity_id = $1")
        .bind(publicity_id)
        .execute(db)
        .await?;
    if !has_items(group_ids)? {
        return Ok(());
    }
    let Value::Array(group_ids) = group_ids else {
        return Err(WriteError::TypeError("groupIds.map is not a function"));
    };
    // Une seule insertion de plusieurs lignes, valeurs envoyées comme node-pg
    let mut arguments = PgArguments::default();
    let mut rows = Vec::new();
    for (index, group_id) in group_ids.iter().enumerate() {
        arguments.add(publicity_id).map_err(sqlx::Error::Encode)?;
        arguments
            .add(node_pg_text(group_id))
            .map_err(sqlx::Error::Encode)?;
        rows.push(format!("(${}, ${}::int4)", 2 * index + 1, 2 * index + 2));
    }
    let sql = format!(
        "INSERT INTO publicity_participations (publicity_id, group_id) VALUES {}",
        rows.join(", ")
    );
    sqlx::query_with(&sql, arguments).execute(db).await?;
    Ok(())
}

async fn create(State(state): State<AppState>, user: CurrentUser, JsonBody(body): JsonBody) -> ApiResult {
    const FAILED: &str = "Failed to create publicity";
    if !has_permission(user.role(), "publicity", "create") {
        return Err(AppError::forbidden("Insufficient permissions"));
    }
    // { ...req.body, createdBy } ; une erreur de validation finit en 500
    let mut candidate = body.as_object().cloned().unwrap_or_default();
    candidate.insert("createdBy".into(), json!(user.id()));
    let data = insert_schema()
        .parse(&Value::Object(candidate))
        .map_err(|_| AppError::internal(FAILED))?;
    let created: PublicitiesRow = db::insert(&state.db, &data).await.or_500(FAILED)?;
    if let Some(groups) = body
        .get("participatingGroups")
        .filter(|groups| js::truthy(groups))
    {
        let added = match has_items(groups) {
            Ok(true) => set_participations(&state.db, created.id, groups).await,
            Ok(false) => Ok(()),
            Err(error) => Err(error),
        };
        added.map_err(|error| error.into_500(FAILED))?;
    }
    let publicity = publicity(&state.db, &created.id.to_string())
        .await
        .or_500(FAILED)?;
    Ok(json_or_empty(publicity))
}

/// storage.updatePublicity : colonnes du corps telles quelles (sans validation),
/// updatedAt toujours remplacé ; Drizzle lève une TypeError sur createdAt non
/// nul (value.toISOString), avant toute requête
async fn update_columns(db: &PgPool, id: &str, fields: &Map<String, Value>) -> Result<(), WriteError> {
    let mut arguments = PgArguments::default();
    let mut sets = Vec::new();
    for col in PublicitiesRow::FIELDS {
        let value = if col.key == "updatedAt" {
            Some(crate::modules::now_iso())
        } else {
            match fields.get(col.key) {
                None => continue,
                Some(value) if col.key == "createdAt" && !value.is_null() => {
                    return Err(WriteError::TypeError("value.toISOString is not a function"));
                }
                Some(value) => node_pg_text(value),
            }
        };
        arguments.add(value).map_err(sqlx::Error::Encode)?;
        sets.push(format!(
            "\"{}\" = ${}::{}",
            col.column,
            sets.len() + 1,
            col.sql_type
        ));
    }
    arguments.add(id).map_err(sqlx::Error::Encode)?;
    let sql = format!(
        "UPDATE publicities SET {} WHERE id = ${}::int4",
        sets.join(", "),
        sets.len() + 1
    );
    sqlx::query_with(&sql, arguments).execute(db).await?;
    Ok(())
}

async fn update(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<String>,
    JsonBody(body): JsonBody,
) -> ApiResult {
    const FAILED: &str = "Failed to update publicity";
    if !has_permission(user.role(), "publicity", "edit") {
        return Err(AppError::forbidden("Insufficient permissions"));
    }
    let id_text = js_id(&id);
    // { participatingGroups, ...publicityData } = req.body
    let fields = body.as_object().cloned().unwrap_or_default();
    update_columns(&state.db, &id_text, &fields)
        .await
        .map_err(|error| error.into_500(FAILED))?;
    if let Some(groups) = fields.get("participatingGroups") {
        // L'identifiant a été accepté par la mise à jour : c'est un entier
        let publicity_id = parse_int4(&id).ok_or_else(|| AppError::internal(FAILED))?;
        set_participations(&state.db, publicity_id, groups)
            .await
            .map_err(|error| error.into_500(FAILED))?;
    }
    let publicity = publicity(&state.db, &id_text).await.or_500(FAILED)?;
    Ok(json_or_empty(publicity))
}

/// DELETE /api/ad-campaigns/:id et POST /api/ad-campaigns/:id/delete
async fn remove(State(state): State<AppState>, user: CurrentUser, Path(id): Path<String>) -> ApiResult {
    if !user.is_admin() {
        return Err(AppError::forbidden("Insufficient permissions"));
    }
    let id_text = js_id(&id);
    match delete_publicity(&state.db, &id_text).await {
        Ok(()) => Ok(Json(json!({ "message": "Publicity deleted successfully" })).into_response()),
        Err(message) => Ok(failed_delete(&message)),
    }
}

/// storage.deletePublicity : participations, puis la publicité ; erreur si absente
async fn delete_publicity(db: &PgPool, id: &str) -> Result<(), String> {
    sqlx::query("DELETE FROM publicity_participations WHERE publicity_id = $1::int4")
        .bind(id)
        .execute(db)
        .await
        .map_err(|error| error_message(&error))?;
    let deleted = sqlx::query("DELETE FROM publicities WHERE id = $1::int4 RETURNING id")
        .bind(id)
        .fetch_all(db)
        .await
        .map_err(|error| error_message(&error))?;
    if deleted.is_empty() {
        return Err(format!("Publicity with ID {id} not found"));
    }
    Ok(())
}

fn failed_delete(message: &str) -> Response {
    tracing::error!(message, "Failed to delete publicity");
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(json!({ "message": "Failed to delete publicity", "error": message })),
    )
        .into_response()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tri_numerique_des_numeros() {
        assert_eq!(number_key("12"), 12.0);
        assert_eq!(number_key("3-bis"), 3.0);
        assert_eq!(number_key("PUB-01"), 0.0);
        assert_eq!(number_key("0"), 0.0);
    }

    #[test]
    fn identifiants_et_annees_sous_forme_javascript() {
        assert_eq!(js_id("12abc"), "12");
        assert_eq!(js_id("abc"), "NaN");
        assert_eq!(js_id("-0"), "0");
        assert_eq!(js_id("1234567890123456789012"), "1.2345678901234568e+21");
    }

    #[test]
    fn longueur_des_participations_comme_javascript() {
        assert!(has_items(&json!([1])).unwrap());
        assert!(!has_items(&json!([])).unwrap());
        assert!(has_items(&json!("12")).unwrap());
        assert!(!has_items(&json!(5)).unwrap());
        assert!(!has_items(&json!({})).unwrap());
        assert!(has_items(&json!({ "length": "2" })).unwrap());
        assert!(has_items(&json!(null)).is_err());
    }
}
