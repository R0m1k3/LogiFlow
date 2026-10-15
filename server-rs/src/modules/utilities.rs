// Paramètres généraux : /api/utilities (server/routes.ts, « Routes pour
// configuration utilities ») : adresse de l'analyse des ventes et sauvegardes
// automatiques. Une seule ligne, lue ou mise à jour (créée si la table est vide).
//
// Comme Node : les erreurs sont au format { error, details } ; une erreur de
// validation n'est pas un 400 mais un 500 dont le détail est le message de
// ZodError (ses erreurs en JSON indenté).

use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::{Json, Router, routing::get};
use serde_json::{Value, json};

use crate::AppState;
use crate::auth::CurrentUser;
use crate::db::{self, Table};
use crate::error::{ApiResult, AppError};
use crate::request::JsonBody;
use crate::schema::UtilitiesRow;

pub fn routes() -> Router<AppState> {
    Router::new().route("/api/utilities", get(read).post(save))
}

fn forbidden() -> AppError {
    AppError::with_body(
        StatusCode::FORBIDDEN,
        json!({ "error": "Accès refusé - Admin ou Directeur uniquement" }),
    )
}

/// { error: 'Erreur serveur', details: error.message }
fn server_error(details: &str) -> AppError {
    AppError::with_body(
        StatusCode::INTERNAL_SERVER_ERROR,
        json!({ "error": "Erreur serveur", "details": details }),
    )
}

/// error.message d'une erreur de la base (node-pg : le message de PostgreSQL)
fn database_error(error: sqlx::Error) -> AppError {
    tracing::error!(%error, "paramètres généraux");
    match &error {
        sqlx::Error::Database(database) => server_error(database.message()),
        other => server_error(&other.to_string()),
    }
}

fn can_access(user: &CurrentUser) -> Result<(), AppError> {
    if ["admin", "directeur"].contains(&user.role()) {
        Ok(())
    } else {
        Err(forbidden())
    }
}

/// storage.getUtilities : première ligne (sans tri, comme Node)
async fn current(state: &AppState) -> Result<Option<UtilitiesRow>, AppError> {
    sqlx::query_as(&UtilitiesRow::select("LIMIT 1"))
        .fetch_optional(&state.db)
        .await
        .map_err(database_error)
}

async fn read(State(state): State<AppState>, user: CurrentUser) -> ApiResult {
    can_access(&user)?;
    // res.json(config || null)
    Ok(match current(&state).await? {
        Some(config) => Json(config).into_response(),
        None => Json(Value::Null).into_response(),
    })
}

async fn save(State(state): State<AppState>, user: CurrentUser, JsonBody(body): JsonBody) -> ApiResult {
    can_access(&user)?;
    let data = UtilitiesRow::insert_schema()
        .omit(&["id", "createdAt", "updatedAt"])
        .parse(&body)
        .map_err(|issues| {
            // ZodError.message : JSON.stringify(issues, null, 2)
            server_error(&serde_json::to_string_pretty(&issues).unwrap_or_default())
        })?;
    let config = match current(&state).await? {
        Some(existing) => db::update_by_id::<UtilitiesRow>(&state.db, existing.id, &data, true)
            .await
            .map_err(database_error)?,
        None => Some(
            db::insert::<UtilitiesRow>(&state.db, &data)
                .await
                .map_err(database_error)?,
        ),
    };
    Ok(Json(config).into_response())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detail_d_une_erreur_de_validation_comme_node() {
        let issues = UtilitiesRow::insert_schema()
            .omit(&["id", "createdAt", "updatedAt"])
            .parse(&json!({ "salesAnalysisUrl": 5 }))
            .unwrap_err();
        // Réponse de Node à POST /api/utilities { "salesAnalysisUrl": 5 }
        assert_eq!(
            serde_json::to_string_pretty(&issues).unwrap(),
            "[\n  {\n    \"code\": \"invalid_type\",\n    \"expected\": \"string\",\n    \"received\": \"number\",\n    \"path\": [\n      \"salesAnalysisUrl\"\n    ],\n    \"message\": \"Expected string, received number\"\n  }\n]"
        );
    }
}
