// Un module par domaine de l'application (lots de docs/PLAN-MIGRATION-RUST.md).
pub mod admin;
pub mod analytics;
pub mod announcements;
pub mod avoirs;
pub mod backups;
pub mod bap;
pub mod contacts;
pub mod customer_orders;
pub mod deliveries;
pub mod dlc;
pub mod external_api;
pub mod ffnancy;
pub mod groups;
pub mod health;
pub mod nocodb_config;
pub mod orders;
pub mod payment_schedule;
pub mod publicities;
pub mod reconciliation;
pub mod sav;
pub mod session_routes;
pub mod stats;
pub mod suppliers;
pub mod tasks;
pub mod users;
pub mod utilities;
pub mod weather;

/// Instant présent au format de JavaScript : 2026-10-15T08:30:00.000Z
pub fn now_iso() -> String {
    chrono::Utc::now().format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string()
}
