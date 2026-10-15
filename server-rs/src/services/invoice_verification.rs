// Vérification des factures dans NocoDB, avec son cache (server/invoiceVerification.ts).
//
// - verify_invoice : recherche par référence de facture (colonne du magasin, à
//   défaut « RefFacture »), puis, si le magasin a une colonne de BL, par numéro de BL ;
// - verify_invoice_by_bl : recherche par numéro de BL, le fournisseur trouvé devant
//   contenir le nom attendu (ou l'inverse) ;
// - cache dans invoice_verification_cache, mêmes clés et mêmes durées que Node :
//   facture trouvée 6 h, non trouvée ou en erreur 12 h, livraison validée 50 ans,
//   recherche par BL 24 h ; une entrée expirée est supprimée à sa lecture ;
// - update_cache_as_reconciled / update_existing_reconciled_caches : marquage
//   « rapproché » d'une entrée, ou de toutes celles des livraisons validées.
//
// Comportement de Node en production (NODE_ENV=production), le seul porté : la
// simulation du mode développement (références contenant « test » ou « bl ») ne
// l'est pas. Toute erreur devient un résultat { exists: false, errorMessage },
// jamais une erreur HTTP.

use chrono::{DateTime, Datelike, Duration, NaiveDate, Utc};
use serde::ser::{Serialize, SerializeMap, Serializer};
use serde_json::Value;
use sqlx::PgPool;
use sqlx::postgres::PgArguments;

use crate::AppState;
use crate::db::Table;
use crate::js;
use crate::schema::{GroupsRow, InvoiceVerificationCacheRow};
use crate::services::nocodb::{self, Search, truthy};

/// Table NocoDB lue quand le magasin n'en précise pas (repli codé en dur dans Node)
pub const FALLBACK_TABLE_ID: &str = "mrr733dfb8wtt9b";

pub const MATCH_INVOICE_REFERENCE: &str = "invoice_reference";
pub const MATCH_BL_NUMBER: &str = "bl_number";
pub const MATCH_NONE: &str = "none";

// ---------- Résultat ----------

/// Champ d'un objet JavaScript : absent (undefined, omis du JSON), null, ou une valeur
#[derive(Debug, Clone, PartialEq, Default)]
pub enum JsField<T> {
    #[default]
    Absent,
    Null,
    Set(T),
}

impl<T> JsField<T> {
    pub fn get(&self) -> Option<&T> {
        match self {
            JsField::Set(value) => Some(value),
            _ => None,
        }
    }
}

/// Résultat de verifyInvoice / verifyInvoiceByBL, sérialisé comme Node le renvoie.
/// Les champs lus dans NocoDB (référence, fournisseur, échéance) gardent leur
/// valeur JSON d'origine ; les montants sont des nombres JavaScript (NaN possible).
#[derive(Debug, Clone, PartialEq, Default)]
pub struct Verification {
    pub exists: bool,
    /// invoice_reference, bl_number ou none (texte lu en cache sinon)
    pub match_type: String,
    pub error_message: JsField<String>,
    pub invoice_reference: JsField<Value>,
    pub invoice_amount: JsField<f64>,
    pub invoice_amount_ttc: JsField<f64>,
    pub supplier_name: JsField<Value>,
    pub due_date: JsField<Value>,
    /// Présent (true) quand le résultat vient du cache
    pub from_cache: Option<bool>,
    /// Présent pour un résultat du cache par référence : entrée « rapprochée »
    pub permanent: Option<bool>,
}

impl Verification {
    /// { exists: false, matchType: 'none', errorMessage }
    pub fn failure(message: impl Into<String>) -> Self {
        Self {
            exists: false,
            match_type: MATCH_NONE.to_string(),
            error_message: JsField::Set(message.into()),
            ..Default::default()
        }
    }

    /// Référence de facture trouvée, en texte (String(valeur)) si elle est « vraie »
    pub fn invoice_reference_text(&self) -> Option<String> {
        self.invoice_reference
            .get()
            .filter(|value| truthy(value))
            .map(js::to_js_string)
    }

    /// normalizeDateString(result.dueDate) : échéance AAAA-MM-JJ, si c'est une chaîne reconnue
    pub fn normalized_due_date(&self) -> Option<String> {
        self.due_date
            .get()
            .filter(|value| truthy(value))
            .and_then(crate::services::dates::normalize_date_value)
    }
}

impl Serialize for Verification {
    /// Ordre des clés de Node : celui du cache (erreur, référence, fournisseur,
    /// montants, échéance, fromCache, permanent) ou celui d'une recherche (référence,
    /// montants, fournisseur, échéance)
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        fn put<M: SerializeMap, T, F: Fn(&T) -> Value>(
            map: &mut M,
            key: &str,
            field: &JsField<T>,
            to_json: F,
        ) -> Result<(), M::Error> {
            match field {
                JsField::Absent => Ok(()),
                JsField::Null => map.serialize_entry(key, &Value::Null),
                JsField::Set(value) => map.serialize_entry(key, &to_json(value)),
            }
        }
        let number = |n: &f64| {
            if n.is_finite() {
                js::number_value(*n)
            } else {
                Value::Null
            }
        };
        let mut map = serializer.serialize_map(None)?;
        map.serialize_entry("exists", &self.exists)?;
        map.serialize_entry("matchType", &self.match_type)?;
        put(&mut map, "errorMessage", &self.error_message, |m| {
            Value::String(m.clone())
        })?;
        put(
            &mut map,
            "invoiceReference",
            &self.invoice_reference,
            Value::clone,
        )?;
        if self.from_cache.is_some() {
            put(&mut map, "supplierName", &self.supplier_name, Value::clone)?;
            put(&mut map, "invoiceAmount", &self.invoice_amount, number)?;
            put(&mut map, "invoiceAmountTTC", &self.invoice_amount_ttc, number)?;
            put(&mut map, "dueDate", &self.due_date, Value::clone)?;
        } else {
            put(&mut map, "invoiceAmount", &self.invoice_amount, number)?;
            put(&mut map, "invoiceAmountTTC", &self.invoice_amount_ttc, number)?;
            put(&mut map, "supplierName", &self.supplier_name, Value::clone)?;
            put(&mut map, "dueDate", &self.due_date, Value::clone)?;
        }
        if let Some(from_cache) = self.from_cache {
            map.serialize_entry("fromCache", &from_cache)?;
        }
        if let Some(permanent) = self.permanent {
            map.serialize_entry("permanent", &permanent)?;
        }
        map.end()
    }
}

// ---------- Clés et durées du cache ----------

/// generateCacheKey : `${groupId}_${référence.trim().toLowerCase()}`
pub fn cache_key(invoice_reference: &str, group_key: &str) -> String {
    format!("{group_key}_{}", js::trim(invoice_reference).to_lowercase())
}

/// Clé du cache par BL : `bl_${groupId}_${bl.trim().toLowerCase()}_${fournisseur.toLowerCase()}`
pub fn bl_cache_key(bl_number: &str, group_key: &str, supplier_name: &str) -> String {
    format!(
        "bl_{group_key}_{}_{}",
        js::trim(bl_number).to_lowercase(),
        supplier_name.to_lowercase()
    )
}

/// Durée de vie d'une entrée du cache
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum CacheLifetime {
    /// Facture trouvée, pas encore validée : 6 h, pour permettre les corrections
    Found,
    /// Facture non trouvée ou erreur : 12 h, pour éviter de rappeler NocoDB
    NotFound,
    /// Livraison validée : 50 ans (« permanent »)
    Reconciled,
    /// Recherche par numéro de BL, quel qu'en soit le résultat : 24 h
    BlNumber,
}

/// Date d'expiration comme Node la calcule (setHours / setFullYear, en UTC) :
/// un 29 février plus 50 ans tombe le 1er mars d'une année non bissextile
pub fn expires_at(now: DateTime<Utc>, lifetime: CacheLifetime) -> DateTime<Utc> {
    match lifetime {
        CacheLifetime::Found => now + Duration::hours(6),
        CacheLifetime::NotFound => now + Duration::hours(12),
        CacheLifetime::BlNumber => now + Duration::hours(24),
        CacheLifetime::Reconciled => {
            let date = now.date_naive();
            NaiveDate::from_ymd_opt(date.year() + 50, date.month(), 1)
                .and_then(|first| first.checked_add_signed(Duration::days(i64::from(date.day()) - 1)))
                .map(|day| day.and_time(now.time()).and_utc())
                .unwrap_or(now)
        }
    }
}

/// storage.getInvoiceVerificationCache : l'entrée si elle n'a pas expiré ; une
/// entrée expirée est supprimée au passage
pub async fn read_cache(db: &PgPool, key: &str) -> Result<Option<InvoiceVerificationCacheRow>, sqlx::Error> {
    let cached = sqlx::query_as::<_, InvoiceVerificationCacheRow>(&InvoiceVerificationCacheRow::select(
        "WHERE cache_key = $1",
    ))
    .bind(key)
    .fetch_optional(db)
    .await?;
    match cached {
        Some(cached) if Utc::now().naive_utc() < cached.expires_at => Ok(Some(cached)),
        Some(_) => {
            sqlx::query("DELETE FROM invoice_verification_cache WHERE cache_key = $1")
                .bind(key)
                .execute(db)
                .await?;
            Ok(None)
        }
        None => Ok(None),
    }
}

/// checkCache : résultat en cache pour une référence de facture
async fn check_cache(db: &PgPool, key: &str) -> Option<Verification> {
    let cached = match read_cache(db, key).await {
        Ok(cached) => cached?,
        Err(error) => {
            tracing::error!(%error, "lecture du cache des factures");
            return None;
        }
    };
    if Utc::now().naive_utc() >= cached.expires_at {
        return None;
    }
    let amount = |amount: Option<rust_decimal::Decimal>| match amount {
        Some(amount) => JsField::Set(js::parse_float(&amount.to_string())),
        None => JsField::Absent,
    };
    let optional_text = |text: Option<String>| match text {
        Some(text) => JsField::Set(Value::String(text)),
        None => JsField::Null,
    };
    Some(Verification {
        exists: cached.exists,
        match_type: cached.match_type,
        error_message: match cached.error_message {
            Some(message) => JsField::Set(message),
            None => JsField::Null,
        },
        invoice_reference: JsField::Set(Value::String(cached.invoice_reference)),
        invoice_amount: amount(cached.invoice_amount),
        invoice_amount_ttc: amount(cached.invoice_amount_ttc),
        supplier_name: optional_text(cached.supplier_name),
        due_date: optional_text(cached.due_date.map(|date| crate::json::format_ts(&date))),
        from_cache: Some(true),
        // Facture validée (coche verte) : jamais revérifiée
        permanent: Some(cached.is_reconciled == Some(true) && cached.exists),
    })
}

/// Entrée à enregistrer ; un champ None n'est ni inséré ni mis à jour (undefined
/// pour Drizzle), Some(None) l'écrit à NULL
struct CacheEntry {
    key: String,
    group_param: Option<String>,
    invoice_reference: Option<String>,
    supplier_name: Option<String>,
    invoice_amount: Option<Option<String>>,
    invoice_amount_ttc: Option<Option<String>>,
    due_date: Option<Option<String>>,
    exists: bool,
    match_type: String,
    error_message: Option<String>,
    is_reconciled: bool,
    expires_at: DateTime<Utc>,
}

/// storage.saveInvoiceVerificationCache : insertion, ou mise à jour de l'entrée de
/// même clé. Comme l'upsert de Node, la mise à jour ne touche ni invoice_amount_ttc
/// ni expires_at. Une erreur est journalisée, jamais remontée.
async fn save_cache(db: &PgPool, entry: CacheEntry) {
    let now = crate::modules::now_iso();
    let mut columns: Vec<(&str, Option<String>, &str, bool)> = vec![
        ("cache_key", Some(entry.key), "varchar", false),
        ("group_id", entry.group_param, "int4", false),
        ("invoice_reference", entry.invoice_reference, "varchar", true),
        ("supplier_name", entry.supplier_name, "varchar", true),
    ];
    if let Some(amount) = entry.invoice_amount {
        columns.push(("invoice_amount", amount, "numeric", true));
    }
    if let Some(amount) = entry.invoice_amount_ttc {
        columns.push(("invoice_amount_ttc", amount, "numeric", false));
    }
    if let Some(due_date) = entry.due_date {
        columns.push(("due_date", due_date, "timestamp", true));
    }
    columns.extend([
        ("exists", Some(entry.exists.to_string()), "bool", true),
        ("match_type", Some(entry.match_type), "varchar", true),
        ("error_message", entry.error_message, "text", true),
        ("cache_hit", Some("false".to_string()), "bool", true),
        ("api_call_time", None, "int4", true),
        (
            "is_reconciled",
            Some(entry.is_reconciled.to_string()),
            "bool",
            true,
        ),
        ("expires_at", Some(js::iso(&entry.expires_at)), "timestamp", false),
    ]);
    let mut arguments = PgArguments::default();
    let mut names = Vec::new();
    let mut placeholders = Vec::new();
    let mut updates = Vec::new();
    for (index, (column, value, sql_type, updated)) in columns.into_iter().enumerate() {
        if let Err(error) = sqlx::Arguments::add(&mut arguments, value) {
            tracing::error!(%error, "cache des factures : paramètre");
            return;
        }
        names.push(format!("\"{column}\""));
        placeholders.push(format!("${}::{sql_type}", index + 1));
        if updated {
            updates.push(format!("\"{column}\" = EXCLUDED.\"{column}\""));
        }
    }
    let _ = sqlx::Arguments::add(&mut arguments, now);
    let sql = format!(
        "INSERT INTO invoice_verification_cache ({}) VALUES ({}) ON CONFLICT (cache_key) DO UPDATE SET {}, \"updated_at\" = ${}::timestamp",
        names.join(", "),
        placeholders.join(", "),
        updates.join(", "),
        names.len() + 1
    );
    if let Err(error) = sqlx::query_with(&sql, arguments).execute(db).await {
        tracing::error!(%error, "cache des factures : enregistrement");
    }
}

// ---------- Vérification ----------

/// Identifiant de magasin tel que reçu : texte de la clé de cache (String(groupId))
/// et paramètre SQL (texte converti par PostgreSQL, comme node-pg)
#[derive(Debug, Clone)]
struct GroupRef {
    key: String,
    param: Option<String>,
}

impl GroupRef {
    fn id(group_id: i32) -> Self {
        Self {
            key: group_id.to_string(),
            param: Some(group_id.to_string()),
        }
    }
    fn raw(value: &Value) -> Self {
        Self {
            key: js::to_js_string(value),
            param: crate::db::pg_text(value),
        }
    }
}

/// Texte d'un champ du magasin, ou sa valeur par défaut s'il est vide
fn column_or(value: &Option<String>, default: &str) -> String {
    value
        .clone()
        .filter(|name| !name.is_empty())
        .unwrap_or_else(|| default.to_string())
}

/// Le magasin a-t-il une configuration de rapprochement (NocoDB ou webhook) ?
fn has_reconciliation_config(group: &GroupsRow) -> bool {
    group.nocodb_config_id.is_some_and(|id| id != 0)
        || group
            .nocodb_table_name
            .as_deref()
            .is_some_and(|name| !name.is_empty())
        || group.webhook_url.as_deref().is_some_and(|url| !url.is_empty())
}

/// Ligne NocoDB → résultat trouvé : montants parseFloat(cellule || '0'),
/// échéance `cellule || null`, colonnes du magasin ou celles par défaut de Node
fn found_result(
    data: &Value,
    group: &GroupsRow,
    match_type: &str,
    reference: JsField<Value>,
    supplier_name: Value,
) -> Verification {
    let cell = |column: &Option<String>, default: &str| {
        data.get(column_or(column, default))
            .filter(|value| truthy(value))
            .cloned()
    };
    let amount = |column: &Option<String>, default: &str| {
        cell(column, default).map_or(0.0, |value| js::parse_float(&js::to_js_string(&value)))
    };
    Verification {
        exists: true,
        match_type: match_type.to_string(),
        invoice_reference: reference,
        invoice_amount: JsField::Set(amount(&group.nocodb_amount_column_name, "amount")),
        invoice_amount_ttc: JsField::Set(amount(
            &group.nocodb_invoice_amount_ttc_column_name,
            "Montant TTC",
        )),
        supplier_name: JsField::Set(supplier_name),
        due_date: JsField::Set(cell(&group.nocodb_due_date_column_name, "Echeance").unwrap_or(Value::Null)),
        ..Default::default()
    }
}

/// montant.toString() d'un nombre JavaScript, NaN et Infinity compris (texte
/// écrit en base pour une colonne numeric)
pub fn js_number_text(number: f64) -> String {
    if number.is_nan() {
        "NaN".to_string()
    } else if number.is_infinite() {
        if number > 0.0 { "Infinity" } else { "-Infinity" }.to_string()
    } else {
        js::number_to_string(number)
    }
}

/// Montant écrit en cache : `montant || null` (0 et NaN donnent null)
fn cached_amount(field: &JsField<f64>) -> Option<String> {
    field
        .get()
        .filter(|amount| **amount != 0.0 && !amount.is_nan())
        .map(|amount| js_number_text(*amount))
}

/// Paramètre texte d'une valeur JSON « vraie » (`valeur || null`)
fn truthy_param(value: Option<&Value>) -> Option<String> {
    value.filter(|value| truthy(value)).and_then(crate::db::pg_text)
}

/// saveToCache : durée selon le résultat ; une échéance que new Date() ne lit pas
/// fait échouer l'enregistrement (RangeError de toISOString côté Node)
async fn save_to_cache(
    db: &PgPool,
    invoice_reference: &str,
    group: &GroupRef,
    result: &Verification,
    is_reconciled: bool,
) {
    let due_date = match result.due_date.get().filter(|value| truthy(value)) {
        None => None,
        Some(value) => match crate::services::dates::js_date(value) {
            Some(date) => Some(js::iso(&date)),
            None => {
                tracing::error!("cache des factures : échéance illisible");
                return;
            }
        },
    };
    let lifetime = if is_reconciled {
        CacheLifetime::Reconciled
    } else if result.exists {
        CacheLifetime::Found
    } else {
        CacheLifetime::NotFound
    };
    let supplier_name = result.supplier_name.get();
    save_cache(
        db,
        CacheEntry {
            key: cache_key(invoice_reference, &group.key),
            group_param: group.param.clone(),
            invoice_reference: Some(invoice_reference.to_string()),
            supplier_name: truthy_param(supplier_name),
            invoice_amount: Some(cached_amount(&result.invoice_amount)),
            invoice_amount_ttc: Some(cached_amount(&result.invoice_amount_ttc)),
            due_date: Some(due_date),
            exists: result.exists,
            match_type: result.match_type.clone(),
            error_message: result.error_message.get().filter(|m| !m.is_empty()).cloned(),
            is_reconciled,
            expires_at: expires_at(Utc::now(), lifetime),
        },
    )
    .await;
}

/// Magasin, configuration NocoDB active et table : ou le résultat d'échec de Node
async fn reconciliation_setup(
    state: &AppState,
    group: &GroupRef,
) -> Result<(GroupsRow, crate::schema::NocodbConfigRow, String), Verification> {
    let group = match nocodb::group_by_text_id(&state.db, group.param.as_deref()).await {
        Ok(Some(group)) => group,
        Ok(None) => return Err(Verification::failure("Groupe non trouvé")),
        Err(message) => return Err(Verification::failure(message)),
    };
    if !has_reconciliation_config(&group) {
        return Err(Verification::failure(
            "Configuration NocoDB manquante pour ce magasin",
        ));
    }
    let Some(config) = nocodb::active_config(state).await else {
        return Err(Verification::failure("Configuration NocoDB non trouvée"));
    };
    let table_id = column_or(&group.nocodb_table_id, FALLBACK_TABLE_ID);
    Ok((group, config, table_id))
}

async fn run_verify_invoice(
    state: &AppState,
    invoice_reference: &str,
    group_ref: &GroupRef,
    force_refresh: bool,
    is_reconciled: bool,
) -> Verification {
    if js::trim(invoice_reference).is_empty() {
        return Verification::failure("Référence de facture vide");
    }
    if !force_refresh {
        if let Some(cached) = check_cache(&state.db, &cache_key(invoice_reference, &group_ref.key)).await {
            return cached;
        }
    }
    let (group, config, table_id) = match reconciliation_setup(state, group_ref).await {
        Ok(setup) => setup,
        Err(failure) => return failure,
    };

    // Par référence de facture, puis par numéro de BL si le magasin a la colonne
    let mut searches = vec![(
        column_or(&group.invoice_column_name, "RefFacture"),
        MATCH_INVOICE_REFERENCE,
    )];
    if let Some(bl_column) = group
        .nocodb_bl_column_name
        .clone()
        .filter(|name| !name.is_empty())
    {
        searches.push((bl_column, MATCH_BL_NUMBER));
    }
    for (column, match_type) in searches {
        let result = match nocodb::search(&config, &table_id, &column, invoice_reference).await {
            Search::Error(message) => Verification::failure(message),
            Search::Found(Value::Null) => Verification::failure(
                "Erreur NocoDB: Cannot read properties of null (reading 'invoice_reference')",
            ),
            Search::Found(data) => {
                let reference = data
                    .get("invoice_reference")
                    .filter(|value| truthy(value))
                    .cloned()
                    .unwrap_or_else(|| {
                        Value::String(if match_type == MATCH_BL_NUMBER {
                            format!("BL_{invoice_reference}")
                        } else {
                            invoice_reference.to_string()
                        })
                    });
                let supplier = data
                    .get(column_or(&group.nocodb_supplier_column_name, "supplier"))
                    .filter(|value| truthy(value))
                    .cloned()
                    .unwrap_or_else(|| Value::String("Inconnu".to_string()));
                found_result(&data, &group, match_type, JsField::Set(reference), supplier)
            }
            Search::NotFound => continue,
        };
        save_to_cache(&state.db, invoice_reference, group_ref, &result, is_reconciled).await;
        return result;
    }
    let result = Verification::failure("Aucune correspondance trouvée dans NocoDB");
    save_to_cache(&state.db, invoice_reference, group_ref, &result, is_reconciled).await;
    result
}

/// verifyInvoice : la référence existe-t-elle dans la table NocoDB du magasin ?
/// Cache lu d'abord, sauf `force_refresh` ; `is_reconciled` (livraison validée)
/// rend l'entrée enregistrée permanente.
pub async fn verify_invoice(
    state: &AppState,
    invoice_reference: &str,
    group_id: i32,
    force_refresh: bool,
    is_reconciled: bool,
) -> Verification {
    run_verify_invoice(
        state,
        invoice_reference,
        &GroupRef::id(group_id),
        force_refresh,
        is_reconciled,
    )
    .await
}

/// verifyInvoice appelé avec les valeurs brutes d'un corps de requête
/// (POST /api/verify-invoice) : référence qui n'est pas une chaîne (TypeError de
/// Node) et identifiant de magasin quelconque (texte de la clé de cache, erreur de
/// PostgreSQL s'il n'est pas un entier)
pub async fn verify_invoice_raw(
    state: &AppState,
    invoice_reference: &Value,
    group_id: &Value,
    force_refresh: bool,
    is_reconciled: bool,
) -> Verification {
    let Some(reference) = invoice_reference.as_str() else {
        return Verification::failure(nocodb::not_a_string_error(
            "invoiceReference",
            "trim",
            Some(invoice_reference),
        ));
    };
    run_verify_invoice(
        state,
        reference,
        &GroupRef::raw(group_id),
        force_refresh,
        is_reconciled,
    )
    .await
}

/// Règle de rapprochement du fournisseur d'un BL : l'un des noms contient l'autre,
/// sans tenir compte de la casse (un nom vide correspond donc toujours)
pub fn bl_supplier_matches(found: &str, expected: &str) -> bool {
    let (found, expected) = (found.to_lowercase(), expected.to_lowercase());
    found.contains(&expected) || expected.contains(&found)
}

/// Enregistrement du cache par BL (24 h) : montants et échéance jamais écrits
async fn save_bl_cache(
    db: &PgPool,
    key: &str,
    group: &GroupRef,
    invoice_reference: Option<&Value>,
    supplier_name: &Value,
    result: &Verification,
    is_reconciled: bool,
) {
    save_cache(
        db,
        CacheEntry {
            key: key.to_string(),
            group_param: group.param.clone(),
            invoice_reference: invoice_reference.and_then(crate::db::pg_text),
            supplier_name: crate::db::pg_text(supplier_name),
            invoice_amount: None,
            invoice_amount_ttc: None,
            due_date: None,
            exists: result.exists,
            match_type: result.match_type.clone(),
            error_message: result.error_message.get().cloned(),
            is_reconciled,
            expires_at: expires_at(Utc::now(), CacheLifetime::BlNumber),
        },
    )
    .await;
}

/// verifyInvoiceByBL : un BL de ce numéro existe-t-il pour ce fournisseur ?
pub async fn verify_invoice_by_bl(
    state: &AppState,
    bl_number: &str,
    supplier_name: &str,
    group_id: i32,
    force_refresh: bool,
    is_reconciled: bool,
) -> Verification {
    if js::trim(bl_number).is_empty() {
        return Verification::failure("Numéro BL vide");
    }
    let group_ref = GroupRef::id(group_id);
    let key = bl_cache_key(bl_number, &group_ref.key, supplier_name);
    if !force_refresh {
        match read_cache(&state.db, &key).await {
            Ok(Some(cached)) if Utc::now().naive_utc() < cached.expires_at => {
                // `valeur || undefined` : un texte vide ou null est omis
                let text = |text: Option<String>| match text.filter(|text| !text.is_empty()) {
                    Some(text) => JsField::Set(Value::String(text)),
                    None => JsField::Absent,
                };
                return Verification {
                    exists: cached.exists,
                    match_type: cached.match_type,
                    error_message: match cached.error_message.filter(|message| !message.is_empty()) {
                        Some(message) => JsField::Set(message),
                        None => JsField::Absent,
                    },
                    invoice_reference: text(Some(cached.invoice_reference)),
                    supplier_name: text(cached.supplier_name),
                    from_cache: Some(true),
                    ..Default::default()
                };
            }
            Ok(_) => {}
            Err(error) => tracing::error!(%error, "lecture du cache BL"),
        }
    }
    let (group, config, table_id) = match reconciliation_setup(state, &group_ref).await {
        Ok(setup) => setup,
        Err(failure) => return failure,
    };
    let bl_value = Value::String(bl_number.to_string());
    let supplier_value = Value::String(supplier_name.to_string());
    let supplier_column = column_or(&group.nocodb_supplier_column_name, "supplier");
    let column = column_or(&group.nocodb_bl_column_name, "Numero_BL");
    match nocodb::search(&config, &table_id, &column, bl_number).await {
        Search::Error(message) => {
            let result = Verification::failure(message);
            save_bl_cache(
                &state.db,
                &key,
                &group_ref,
                Some(&bl_value),
                &supplier_value,
                &result,
                is_reconciled,
            )
            .await;
            result
        }
        Search::Found(data) => {
            // Erreurs JavaScript de Node sur une ligne inattendue (null, fournisseur non textuel)
            let found_supplier = match &data {
                Value::Null => Err(format!(
                    "Cannot read properties of null (reading '{supplier_column}')"
                )),
                data => match data.get(&supplier_column).filter(|value| truthy(value)) {
                    None => Ok(String::new()),
                    Some(Value::String(text)) => Ok(text.clone()),
                    Some(_) => Err("foundSupplier.toLowerCase is not a function".to_string()),
                },
            };
            let found_supplier = match found_supplier {
                Ok(found) => found,
                Err(message) => {
                    let result = Verification::failure(format!("Erreur NocoDB BL: {message}"));
                    save_bl_cache(
                        &state.db,
                        &key,
                        &group_ref,
                        Some(&bl_value),
                        &supplier_value,
                        &result,
                        is_reconciled,
                    )
                    .await;
                    return result;
                }
            };
            if !bl_supplier_matches(&found_supplier, supplier_name) {
                tracing::info!(
                    expected = supplier_name,
                    found = found_supplier,
                    "fournisseur du BL différent"
                );
                return Verification::failure(format!(
                    "BL trouvé mais fournisseur différent: {found_supplier} vs {supplier_name}"
                ));
            }
            let reference = data
                .get(column_or(&group.invoice_column_name, "RefFacture"))
                .filter(|value| truthy(value))
                .cloned()
                .unwrap_or_else(|| Value::String(format!("BL_{bl_number}")));
            let supplier = Value::String(if found_supplier.is_empty() {
                supplier_name.to_string()
            } else {
                found_supplier
            });
            let result = found_result(
                &data,
                &group,
                MATCH_BL_NUMBER,
                JsField::Set(reference.clone()),
                supplier.clone(),
            );
            save_bl_cache(
                &state.db,
                &key,
                &group_ref,
                Some(&reference),
                &supplier,
                &result,
                is_reconciled,
            )
            .await;
            result
        }
        Search::NotFound => {
            let result = Verification::failure("Aucun BL correspondant trouvé dans NocoDB");
            save_bl_cache(
                &state.db,
                &key,
                &group_ref,
                Some(&bl_value),
                &supplier_value,
                &result,
                is_reconciled,
            )
            .await;
            result
        }
    }
}

// ---------- Marquage « rapproché » ----------

async fn mark_reconciled(db: &PgPool, key: &str) {
    let cached = match read_cache(db, key).await {
        Ok(Some(cached)) => cached,
        Ok(None) => {
            tracing::info!(key, "cache des factures : aucune entrée à marquer");
            return;
        }
        Err(error) => {
            tracing::error!(%error, "cache des factures : marquage");
            return;
        }
    };
    if cached.is_reconciled == Some(true) {
        return;
    }
    // L'upsert de Node réécrit l'entrée à l'identique sauf is_reconciled et
    // updated_at : expires_at n'est pas prolongé (la colonne n'est pas dans son SET)
    let result = sqlx::query(
        "UPDATE invoice_verification_cache SET is_reconciled = true, updated_at = $2::timestamp WHERE cache_key = $1",
    )
    .bind(key)
    .bind(crate::modules::now_iso())
    .execute(db)
    .await;
    if let Err(error) = result {
        tracing::error!(%error, "cache des factures : marquage");
    }
}

/// updateCacheAsReconciled : marque « rapprochée » l'entrée d'une référence (ou
/// d'un numéro de BL) de ce magasin, si elle existe
pub async fn update_cache_as_reconciled(db: &PgPool, invoice_reference: &str, group_id: i32) {
    mark_reconciled(db, &cache_key(invoice_reference, &group_id.to_string())).await;
}

/// updateCacheAsReconciled avec les valeurs brutes d'un corps de requête
/// (POST /api/cache/mark-reconciled) : rien n'est fait si la référence n'est pas une
/// chaîne (TypeError interceptée par Node)
pub async fn update_cache_as_reconciled_raw(db: &PgPool, invoice_reference: &Value, group_id: &Value) {
    match invoice_reference.as_str() {
        Some(reference) => mark_reconciled(db, &cache_key(reference, &js::to_js_string(group_id))).await,
        None => tracing::error!("cache des factures : référence qui n'est pas une chaîne"),
    }
}

/// Blancs ASCII retirés par String.prototype.trim(), pour reproduire les clés en SQL
const ASCII_WHITESPACE: &str = " \t\n\u{0B}\u{0C}\r";

/// updateExistingReconciledCaches : marque « rapprochées » les entrées non expirées
/// des références et numéros de BL de toutes les livraisons validées, en une
/// requête ; rend le nombre d'entrées modifiées (les erreurs sont journalisées)
pub async fn update_existing_reconciled_caches(db: &PgPool) -> u64 {
    let result = sqlx::query(
        "UPDATE invoice_verification_cache
            SET is_reconciled = true, updated_at = $1::timestamp
          WHERE is_reconciled IS NOT TRUE
            AND expires_at > $1::timestamp
            AND cache_key IN (
              SELECT group_id::text || '_' || lower(btrim(invoice_reference, $2))
                FROM deliveries
               WHERE reconciled = true AND btrim(invoice_reference, $2) <> ''
              UNION
              SELECT group_id::text || '_' || lower(btrim(bl_number, $2))
                FROM deliveries
               WHERE reconciled = true AND btrim(bl_number, $2) <> ''
            )",
    )
    .bind(crate::modules::now_iso())
    .bind(ASCII_WHITESPACE)
    .execute(db)
    .await;
    match result {
        Ok(done) => done.rows_affected(),
        Err(error) => {
            tracing::error!(%error, "cache des factures : mise à jour en lot");
            0
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn utc(text: &str) -> DateTime<Utc> {
        DateTime::parse_from_rfc3339(text).unwrap().with_timezone(&Utc)
    }

    fn group() -> GroupsRow {
        let mut group = empty_group();
        group.nocodb_amount_column_name = Some("MontantHT".into());
        group.nocodb_invoice_amount_ttc_column_name = Some("MontantTTC".into());
        group.nocodb_supplier_column_name = Some("Fournisseur".into());
        group.nocodb_due_date_column_name = Some("Echeance".into());
        group
    }

    fn empty_group() -> GroupsRow {
        GroupsRow {
            id: 1,
            name: "Magasin".into(),
            color: None,
            nocodb_config_id: None,
            nocodb_table_name: None,
            nocodb_table_id: None,
            invoice_column_name: None,
            nocodb_bl_column_name: None,
            nocodb_amount_column_name: None,
            nocodb_invoice_amount_ttc_column_name: None,
            nocodb_supplier_column_name: None,
            nocodb_due_date_column_name: None,
            webhook_url: None,
            address: None,
            phone: None,
            logo: None,
            smtp_enabled: None,
            smtp_host: None,
            smtp_port: None,
            smtp_secure: None,
            smtp_user: None,
            smtp_password: None,
            smtp_sender_email: None,
            smtp_sender_name: None,
            created_at: None,
            updated_at: None,
        }
    }

    #[test]
    fn cles_du_cache_comme_node() {
        // generateCacheKey et la clé BL de verifyInvoiceByBL
        assert_eq!(cache_key("  FAC-2001 ", "1"), "1_fac-2001");
        assert_eq!(cache_key("Fac\u{a0}É", "01"), "01_fac\u{a0}é");
        assert_eq!(
            bl_cache_key(" BL-1002 ", "1", "Bonduelle SA"),
            "bl_1_bl-1002_bonduelle sa"
        );
    }

    #[test]
    fn durees_du_cache_comme_node() {
        // new Date() puis setHours / setFullYear, dans Node 22 (TZ=UTC)
        let now = utc("2026-10-15T20:00:00.000Z");
        assert_eq!(
            js::iso(&expires_at(now, CacheLifetime::Found)),
            "2026-10-16T02:00:00.000Z"
        );
        assert_eq!(
            js::iso(&expires_at(now, CacheLifetime::NotFound)),
            "2026-10-16T08:00:00.000Z"
        );
        assert_eq!(
            js::iso(&expires_at(now, CacheLifetime::BlNumber)),
            "2026-10-16T20:00:00.000Z"
        );
        assert_eq!(
            js::iso(&expires_at(now, CacheLifetime::Reconciled)),
            "2076-10-15T20:00:00.000Z"
        );
        let leap = utc("2028-02-29T10:00:00.000Z");
        assert_eq!(
            js::iso(&expires_at(leap, CacheLifetime::Reconciled)),
            "2078-03-01T10:00:00.000Z"
        );
    }

    #[test]
    fn resultat_trouve_depuis_une_ligne_nocodb() {
        let row = json!({ "Id": 1, "RefFacture": "FAC-2001", "MontantHT": 1250.5, "MontantTTC": "1 500,60",
                          "Fournisseur": "Lactalis", "Echeance": "2026-10-25" });
        let result = found_result(
            &row,
            &group(),
            MATCH_INVOICE_REFERENCE,
            JsField::Set(json!("FAC-2001")),
            json!("Lactalis"),
        );
        assert_eq!(
            serde_json::to_value(&result).unwrap(),
            json!({ "exists": true, "matchType": "invoice_reference", "invoiceReference": "FAC-2001",
                    "invoiceAmount": 1250.5, "invoiceAmountTTC": 1, "supplierName": "Lactalis",
                    "dueDate": "2026-10-25" })
        );
        // Cellules absentes : montants à 0, échéance null ; colonnes par défaut de Node
        let empty = found_result(
            &json!({}),
            &empty_group(),
            MATCH_BL_NUMBER,
            JsField::Set(json!("BL_X")),
            json!("Inconnu"),
        );
        assert_eq!(empty.invoice_amount, JsField::Set(0.0));
        assert_eq!(empty.due_date, JsField::Set(Value::Null));
        let nan = found_result(
            &json!({ "amount": "abc" }),
            &empty_group(),
            MATCH_BL_NUMBER,
            JsField::Absent,
            json!("x"),
        );
        assert!(nan.invoice_amount.get().unwrap().is_nan());
        assert_eq!(serde_json::to_value(&nan).unwrap()["invoiceAmount"], Value::Null);
        assert_eq!(cached_amount(&nan.invoice_amount), None);
        assert_eq!(cached_amount(&JsField::Set(975.0)).as_deref(), Some("975"));
    }

    #[test]
    fn echec_et_resultat_du_cache() {
        assert_eq!(
            serde_json::to_string(&Verification::failure("Référence de facture vide")).unwrap(),
            r#"{"exists":false,"matchType":"none","errorMessage":"Référence de facture vide"}"#
        );
        let cached = Verification {
            exists: true,
            match_type: MATCH_INVOICE_REFERENCE.into(),
            error_message: JsField::Null,
            invoice_reference: JsField::Set(json!("FAC-2004")),
            invoice_amount: JsField::Set(975.0),
            invoice_amount_ttc: JsField::Absent,
            supplier_name: JsField::Set(json!("Brico Pro")),
            due_date: JsField::Set(json!("2026-11-09T00:00:00.000Z")),
            from_cache: Some(true),
            permanent: Some(false),
        };
        assert_eq!(
            serde_json::to_string(&cached).unwrap(),
            r#"{"exists":true,"matchType":"invoice_reference","errorMessage":null,"invoiceReference":"FAC-2004","supplierName":"Brico Pro","invoiceAmount":975,"dueDate":"2026-11-09T00:00:00.000Z","fromCache":true,"permanent":false}"#
        );
        assert_eq!(cached.normalized_due_date().as_deref(), Some("2026-11-09"));
    }

    #[test]
    fn rapprochement_du_fournisseur_d_un_bl() {
        assert!(bl_supplier_matches("LACTALIS France", "lactalis"));
        assert!(bl_supplier_matches("Lactalis", "Lactalis France"));
        assert!(bl_supplier_matches("", "Bonduelle"));
        assert!(!bl_supplier_matches("Brico Pro", "Bonduelle"));
    }

    #[test]
    fn configuration_de_rapprochement() {
        let mut group = empty_group();
        assert!(!has_reconciliation_config(&group));
        group.webhook_url = Some(String::new());
        assert!(!has_reconciliation_config(&group));
        group.nocodb_table_name = Some("factures".into());
        assert!(has_reconciliation_config(&group));
        assert_eq!(column_or(&Some(String::new()), "RefFacture"), "RefFacture");
    }
}
