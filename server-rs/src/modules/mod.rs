// Un module par domaine de l'application, dans l'ordre des lots du plan.
pub mod health;

/// Instant présent au format de JavaScript : 2026-10-15T08:30:00.000Z
pub fn now_iso() -> String {
    chrono::Utc::now().format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string()
}
