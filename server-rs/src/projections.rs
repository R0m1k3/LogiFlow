// Formes réduites jointes aux réponses, comme les projections de server/storage.ts :
// jamais le logo ni la configuration SMTP d'un magasin, jamais l'empreinte d'un
// mot de passe.

use chrono::NaiveDateTime;
use serde::Serialize;
use sqlx::FromRow;

/// groupSummaryColumns : { id, name, color }
#[derive(Debug, Clone, Serialize, FromRow)]
pub struct GroupSummary {
    pub id: i32,
    pub name: String,
    pub color: Option<String>,
}

impl GroupSummary {
    /// Colonnes à sélectionner, préfixées par l'alias de la table groups
    pub fn columns(alias: &str) -> String {
        format!("{alias}.id, {alias}.name, {alias}.color")
    }
}

/// groupReconciliationColumns : résumé + configuration NocoDB et webhook
#[derive(Debug, Clone, Serialize, FromRow)]
pub struct GroupReconciliation {
    pub id: i32,
    pub name: String,
    pub color: Option<String>,
    #[serde(rename = "nocodbConfigId")]
    pub nocodb_config_id: Option<i32>,
    #[serde(rename = "nocodbTableName")]
    pub nocodb_table_name: Option<String>,
    #[serde(rename = "webhookUrl")]
    pub webhook_url: Option<String>,
}

impl GroupReconciliation {
    pub fn columns(alias: &str) -> String {
        format!(
            "{alias}.id, {alias}.name, {alias}.color, {alias}.nocodb_config_id, {alias}.nocodb_table_name, {alias}.webhook_url"
        )
    }
}

/// userSummaryColumns : créateur ou auteur joint à une ligne
#[derive(Debug, Clone, Serialize, FromRow)]
pub struct UserSummary {
    pub id: String,
    #[serde(rename = "firstName")]
    pub first_name: Option<String>,
    #[serde(rename = "lastName")]
    pub last_name: Option<String>,
    pub username: String,
    pub email: Option<String>,
}

impl UserSummary {
    pub fn columns(alias: &str) -> String {
        format!("{alias}.id, {alias}.first_name, {alias}.last_name, {alias}.username, {alias}.email")
    }
}

/// publicUserColumns : toutes les colonnes de users sauf password
#[derive(Debug, Clone, Serialize, FromRow)]
pub struct PublicUser {
    pub id: String,
    pub username: String,
    pub email: Option<String>,
    pub name: Option<String>,
    #[serde(rename = "firstName")]
    pub first_name: Option<String>,
    #[serde(rename = "lastName")]
    pub last_name: Option<String>,
    #[serde(rename = "profileImageUrl")]
    pub profile_image_url: Option<String>,
    pub role: String,
    #[serde(rename = "passwordChanged")]
    pub password_changed: Option<bool>,
    #[serde(rename = "createdAt", serialize_with = "crate::json::ts_opt")]
    pub created_at: Option<NaiveDateTime>,
    #[serde(rename = "updatedAt", serialize_with = "crate::json::ts_opt")]
    pub updated_at: Option<NaiveDateTime>,
}

impl PublicUser {
    pub fn columns(alias: &str) -> String {
        [
            "id",
            "username",
            "email",
            "name",
            "first_name",
            "last_name",
            "profile_image_url",
            "role",
            "password_changed",
            "created_at",
            "updated_at",
        ]
        .iter()
        .map(|column| format!("{alias}.{column}"))
        .collect::<Vec<_>>()
        .join(", ")
    }
}
