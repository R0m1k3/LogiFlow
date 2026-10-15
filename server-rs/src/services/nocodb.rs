// Client NocoDB (table des factures), au comportement du serveur Node :
// - recherche d'une facture par colonne (searchInNocoDB, server/invoiceVerification.ts) :
//   GET {baseUrl}/api/v1/db/data/v1/{projectId}/{tableId}?where=(colonne,eq,valeur),
//   jeton dans l'en-tête xc-token, délai maximal de 10 s ;
// - configuration active et déchiffrement du jeton (storage.getActiveNocodbConfig,
//   decryptNocodbConfig) ;
// - ancien client de server/nocodbService.ts (POST /api/verify-invoices), qui lit
//   toute la table et compare les références sans tenir compte de la casse.
//
// Node appelle NocoDB avec le fetch intégré (undici) : toute erreur réseau donne
// « fetch failed », un délai dépassé « Timeout - API NocoDB non accessible ».
// Les proxys de l'environnement sont ignorés, comme par Node.

use std::sync::LazyLock;
use std::time::Duration;

use serde::Serialize;
use serde_json::{Map, Value};
use sqlx::PgPool;

use crate::AppState;
use crate::db::Table;
use crate::schema::{GroupsRow, NocodbConfigRow};

/// Délai maximal d'un appel NocoDB (AbortController de searchInNocoDB)
pub const TIMEOUT: Duration = Duration::from_secs(10);

static CLIENT: LazyLock<reqwest::Client> = LazyLock::new(|| {
    reqwest::Client::builder()
        .no_proxy()
        .build()
        .expect("client HTTP NocoDB")
});

/// decryptNocodbConfig : jeton en clair ; illisible, il devient une chaîne vide
pub fn decrypt_config(mut config: NocodbConfigRow, encryption_key: &str) -> NocodbConfigRow {
    config.api_token = crate::crypto::decrypt(&config.api_token, encryption_key).unwrap_or_else(|error| {
        tracing::error!(config = config.id, error, "jeton NocoDB illisible");
        String::new()
    });
    config
}

/// storage.getActiveNocodbConfig : première configuration active (sans ordre,
/// comme Node), jeton déchiffré ; None aussi en cas d'erreur de base
pub async fn active_config(state: &AppState) -> Option<NocodbConfigRow> {
    let row =
        sqlx::query_as::<_, NocodbConfigRow>(&NocodbConfigRow::select("WHERE is_active = true LIMIT 1"))
            .fetch_optional(&state.db)
            .await;
    match row {
        Ok(row) => row.map(|config| decrypt_config(config, &state.config.encryption_key)),
        Err(error) => {
            tracing::error!(%error, "lecture de la configuration NocoDB active");
            None
        }
    }
}

/// Résultat d'une recherche dans la table des factures
#[derive(Debug, Clone, PartialEq)]
pub enum Search {
    /// Première ligne trouvée, telle que NocoDB la renvoie
    Found(Value),
    NotFound,
    /// Message d'erreur repris dans le résultat de la vérification
    Error(String),
}

/// Message de JSON.parse (V8) pour une réponse illisible, dans les cas simples
fn json_parse_error(text: &str) -> String {
    let trimmed = text.trim_start();
    match trimmed.chars().next() {
        None => "Unexpected end of JSON input".to_string(),
        Some(first) => {
            let excerpt: String = text.chars().take(10).collect();
            let more = if text.chars().count() > 10 { "..." } else { "" };
            format!("Unexpected token '{first}', \"{excerpt}\"{more} is not valid JSON")
        }
    }
}

/// Réponse JSON de NocoDB, ou le message d'erreur que Node en tirerait
async fn read_json(response: reqwest::Response) -> Result<Value, String> {
    let text = response.text().await.map_err(|_| "fetch failed".to_string())?;
    serde_json::from_str(&text).map_err(|_| json_parse_error(&text))
}

/// Envoi d'une requête GET avec le jeton ; erreurs au format d'undici
async fn get(url: &str, token: &str, timeout: Option<Duration>) -> Result<reqwest::Response, String> {
    let parsed = reqwest::Url::parse(url).map_err(|_| format!("Failed to parse URL from {url}"))?;
    if !matches!(parsed.scheme(), "http" | "https") {
        return Err("fetch failed".to_string());
    }
    let mut request = CLIENT
        .get(parsed)
        .header("Content-Type", "application/json")
        .header("xc-token", token);
    if let Some(timeout) = timeout {
        request = request.timeout(timeout);
    }
    request.send().await.map_err(|error| {
        if error.is_timeout() {
            "Timeout - API NocoDB non accessible".to_string()
        } else {
            tracing::warn!(%error, "appel NocoDB");
            "fetch failed".to_string()
        }
    })
}

/// searchInNocoDB : première ligne dont la colonne vaut exactement la valeur
pub async fn search(config: &NocodbConfigRow, table_id: &str, column: &str, value: &str) -> Search {
    if value.is_empty() || column.is_empty() || table_id.is_empty() {
        return Search::Error("Paramètres invalides".to_string());
    }
    tracing::debug!(table_id, column, "recherche NocoDB");
    let url = format!(
        "{}/api/v1/db/data/v1/{}/{}?where=({},eq,{})",
        config.base_url,
        config.project_id,
        table_id,
        column,
        crate::js::encode_uri_component(value)
    );
    let response = match get(&url, &config.api_token, Some(TIMEOUT)).await {
        Ok(response) => response,
        Err(message) => return Search::Error(message),
    };
    let status = response.status();
    if !status.is_success() {
        return Search::Error(format!(
            "HTTP {}: {}",
            status.as_u16(),
            status.canonical_reason().unwrap_or_default()
        ));
    }
    let result = match read_json(response).await {
        Ok(result) => result,
        Err(message) => return Search::Error(message),
    };
    // result.list && result.list.length > 0
    match &result {
        Value::Null => Search::Error("Cannot read properties of null (reading 'list')".to_string()),
        _ => match result.get("list") {
            Some(Value::Array(list)) if !list.is_empty() => Search::Found(list[0].clone()),
            Some(Value::String(text)) if !text.is_empty() => {
                Search::Found(Value::String(text.chars().take(1).collect()))
            }
            _ => Search::NotFound,
        },
    }
}

// ---------- Ancien client (server/nocodbService.ts) ----------

/// InvoiceVerificationResult de nocodbService : { exists, error? }
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct LegacyResult {
    pub exists: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

impl LegacyResult {
    fn error(message: impl Into<String>) -> Self {
        Self {
            exists: false,
            error: Some(message.into()),
        }
    }
}

/// Valeur « vraie » en JavaScript
pub fn truthy(value: &Value) -> bool {
    match value {
        Value::Null => false,
        Value::Bool(flag) => *flag,
        Value::Number(number) => number.as_f64().is_some_and(|n| n != 0.0 && !n.is_nan()),
        Value::String(text) => !text.is_empty(),
        Value::Array(_) | Value::Object(_) => true,
    }
}

/// TypeError de JavaScript pour `nom.methode()` appelé sur une valeur qui n'est pas une chaîne
pub fn not_a_string_error(name: &str, method: &str, value: Option<&Value>) -> String {
    match value {
        None => format!("Cannot read properties of undefined (reading '{method}')"),
        Some(Value::Null) => format!("Cannot read properties of null (reading '{method}')"),
        Some(_) => format!("{name}.{method} is not a function"),
    }
}

/// storage.getGroup avec l'identifiant tel que reçu (texte converti par PostgreSQL,
/// comme node-pg) : Err avec le message de PostgreSQL s'il n'est pas un entier
pub async fn group_by_raw_id(db: &PgPool, group_id: Option<&Value>) -> Result<Option<GroupsRow>, String> {
    group_by_text_id(db, group_id.and_then(crate::db::pg_text).as_deref()).await
}

/// storage.getGroup avec l'identifiant en texte (None : aucune ligne, comme `id = NULL`)
pub async fn group_by_text_id(db: &PgPool, group_id: Option<&str>) -> Result<Option<GroupsRow>, String> {
    sqlx::query_as::<_, GroupsRow>(&GroupsRow::select("WHERE id = $1::int4"))
        .bind(group_id)
        .fetch_optional(db)
        .await
        .map_err(|error| database_message(&error))
}

/// Message d'une erreur PostgreSQL tel que node-pg le donne (error.message)
pub fn database_message(error: &sqlx::Error) -> String {
    match error {
        sqlx::Error::Database(database) => database.message().to_string(),
        other => other.to_string(),
    }
}

/// verifyInvoiceReference : la référence existe-t-elle dans la table du magasin ?
pub async fn verify_invoice_reference(
    state: &AppState,
    group_id: Option<&Value>,
    invoice_reference: Option<&Value>,
    supplier_name: Option<&Value>,
) -> LegacyResult {
    let group = match group_by_raw_id(&state.db, group_id).await {
        Ok(group) => group,
        Err(message) => return LegacyResult::error(message),
    };
    let Some((group, config_id, table_id)) = group.and_then(|group| {
        let config_id = group.nocodb_config_id.filter(|id| *id != 0)?;
        let table_id = group.nocodb_table_id.clone().filter(|id| !id.is_empty())?;
        Some((group, config_id, table_id))
    }) else {
        return LegacyResult::error("No NocoDB configuration for this group");
    };
    let config = match crate::db::find_by_id::<NocodbConfigRow>(&state.db, config_id).await {
        Ok(Some(config)) => decrypt_config(config, &state.config.encryption_key),
        Ok(None) => return LegacyResult::error("NocoDB configuration not found"),
        Err(error) => return LegacyResult::error(database_message(&error)),
    };
    let column = group
        .invoice_column_name
        .clone()
        .filter(|name| !name.is_empty())
        .unwrap_or_else(|| "Ref Facture".to_string());
    let Some(reference) = invoice_reference.and_then(Value::as_str) else {
        return LegacyResult::error(not_a_string_error("invoiceReference", "trim", invoice_reference));
    };
    let normalized_reference = crate::js::trim(reference).to_lowercase();

    // Sans délai maximal côté Node : 10 s ici, comme tout appel NocoDB (plan, lot 2)
    let url = format!(
        "{}/api/v1/db/data/noco/{}/{}",
        config.base_url, config.project_id, table_id
    );
    let response = match get(&url, &config.api_token, Some(TIMEOUT)).await {
        Ok(response) => response,
        Err(message) => return LegacyResult::error(message),
    };
    if !response.status().is_success() {
        return LegacyResult::error(format!("NocoDB API error: {}", response.status().as_u16()));
    }
    let data = match read_json(response).await {
        Ok(Value::Null) => return LegacyResult::error("Cannot read properties of null (reading 'pageInfo')"),
        Ok(data) => data,
        Err(message) => return LegacyResult::error(message),
    };
    let records = match data.get("list") {
        Some(Value::Array(records)) => records.as_slice(),
        Some(Value::String(text)) if !text.is_empty() => {
            return LegacyResult::error("data.list.filter is not a function");
        }
        _ => &[],
    };
    let supplier = supplier_name.filter(|name| truthy(name));
    let mut exists = false;
    for record in records {
        let cell = match record {
            Value::Null => {
                return LegacyResult::error(format!("Cannot read properties of null (reading '{column}')"));
            }
            record => record.get(&column).filter(|cell| truthy(cell)),
        };
        let Some(cell) = cell else { continue };
        if crate::js::to_js_string(cell).to_lowercase() != normalized_reference {
            continue;
        }
        // Avec un fournisseur : l'un des deux noms doit contenir l'autre
        let record_supplier = ["Fournisseur", "Supplier", "fournisseur", "supplier"]
            .iter()
            .filter_map(|key| record.get(*key))
            .find(|value| truthy(value));
        let matched = match (supplier, record_supplier) {
            (Some(searched), Some(found)) => {
                let Some(searched) = searched.as_str() else {
                    return LegacyResult::error("supplierName.toLowerCase is not a function");
                };
                let (searched, found) = (
                    searched.to_lowercase(),
                    crate::js::to_js_string(found).to_lowercase(),
                );
                found.contains(&searched) || searched.contains(&found)
            }
            _ => true,
        };
        // Comme filter() : toutes les lignes sont lues, même après une correspondance
        exists |= matched;
    }
    LegacyResult { exists, error: None }
}

/// Clé d'objet JavaScript « indice de tableau » : rangée avant les autres, par ordre croissant
fn array_index(key: &str) -> Option<u32> {
    let index: u32 = key.parse().ok()?;
    (index != u32::MAX && index.to_string() == key).then_some(index)
}

/// verifyMultipleInvoiceReferences : résultats rangés par identifiant de livraison,
/// dans l'ordre des clés d'un objet JavaScript. Node traite les références en
/// parallèle ; elles le sont ici l'une après l'autre (même résultat, la dernière
/// référence d'un identifiant répété l'emportant). None si un élément est null
/// (TypeError côté Node, avant tout appel).
pub async fn verify_multiple_invoice_references(
    state: &AppState,
    references: &[Value],
) -> Option<Map<String, Value>> {
    if references.iter().any(Value::is_null) {
        return None;
    }
    let mut results: Vec<(String, Value)> = Vec::new();
    for reference in references {
        let field = |name: &str| reference.as_object().and_then(|object| object.get(name));
        let result = verify_invoice_reference(
            state,
            field("groupId"),
            field("invoiceReference"),
            field("supplierName"),
        )
        .await;
        let key = field("deliveryId")
            .map(crate::js::to_js_string)
            .unwrap_or_else(|| "undefined".to_string());
        let value = serde_json::to_value(result).unwrap_or(Value::Null);
        match results.iter_mut().find(|(existing, _)| *existing == key) {
            Some(entry) => entry.1 = value,
            None => results.push((key, value)),
        }
    }
    let (mut indexes, others): (Vec<_>, Vec<_>) = results
        .into_iter()
        .partition(|(key, _)| array_index(key).is_some());
    indexes.sort_by_key(|(key, _)| array_index(key));
    Some(indexes.into_iter().chain(others).collect())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn messages_d_erreur_de_node() {
        assert_eq!(json_parse_error(""), "Unexpected end of JSON input");
        assert_eq!(
            json_parse_error("abc"),
            "Unexpected token 'a', \"abc\" is not valid JSON"
        );
        assert_eq!(
            not_a_string_error("invoiceReference", "trim", Some(&json!(12))),
            "invoiceReference.trim is not a function"
        );
        assert_eq!(
            not_a_string_error("invoiceReference", "trim", None),
            "Cannot read properties of undefined (reading 'trim')"
        );
    }

    #[test]
    fn ordre_des_cles_d_un_objet_javascript() {
        assert_eq!(array_index("12"), Some(12));
        assert_eq!(array_index("012"), None);
        assert_eq!(array_index("1.5"), None);
        assert_eq!(array_index("undefined"), None);
        assert!(truthy(&json!("x")) && !truthy(&json!("")) && !truthy(&json!(0)) && truthy(&json!([])));
    }

    #[test]
    fn resultat_sans_erreur_omet_le_champ() {
        assert_eq!(
            serde_json::to_value(LegacyResult {
                exists: true,
                error: None
            })
            .unwrap(),
            json!({ "exists": true })
        );
    }
}
