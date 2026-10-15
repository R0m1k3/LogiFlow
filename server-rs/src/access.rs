// Droits par rôle et par module : même matrice que l'interface et Node
// (shared/permissions.json, lue par shared/permissions.ts).

use std::collections::HashMap;
use std::sync::LazyLock;

type Matrix = HashMap<String, HashMap<String, Vec<String>>>;

static PERMISSIONS: LazyLock<Matrix> = LazyLock::new(|| {
    serde_json::from_str(include_str!("../../shared/permissions.json"))
        .expect("shared/permissions.json valide")
});

/// hasPermission(role, module, action)
pub fn has_permission(role: &str, module: &str, action: &str) -> bool {
    PERMISSIONS
        .get(module)
        .and_then(|roles| roles.get(&role.to_lowercase()))
        .is_some_and(|actions| actions.iter().any(|a| a == action))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn matrice_partagee() {
        assert!(has_permission("manager", "deliveries", "validate"));
        assert!(!has_permission("manager", "deliveries", "delete"));
        assert!(has_permission("Admin", "avoir", "delete"));
        assert!(!has_permission("employee", "orders", "view"));
        assert!(!has_permission("employee", "avoir", "view"));
        assert!(!has_permission("admin", "inconnu", "view"));
    }
}
