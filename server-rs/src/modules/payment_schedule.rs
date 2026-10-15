// Échéancier des paiements fournisseurs : GET /api/payment-schedule et son export
// CSV, POST /api/payment-schedule/export (server/routes.ts), réservés à l'admin et
// au directeur (ses magasins seulement).
//
// La lecture complète les livraisons dans NocoDB (vérification des factures, avec
// son cache) : échéance absente → échéance et montant HT trouvés écrits en base ;
// montant TTC absent ou nul → montant HT (et échéance brute) réécrits.
//
// Défauts de Node reproduits :
// - une lecture (GET) écrit en base, une livraison à la fois (ECHE-01) ;
// - le repli « TTC » n'écrit jamais le TTC : il réécrit le HT et l'échéance de
//   NocoDB, et recommence à chaque lecture ; la réponse garde l'échéance d'avant ;
// - l'export n'échappe pas les champs du CSV, et une erreur de validation des
//   paramètres donne un 500 (message de ZodError).

use std::collections::HashMap;

use axum::extract::State;
use axum::http::{HeaderValue, StatusCode, header};
use axum::response::IntoResponse;
use axum::routing::{get, post};
use axum::{Json, Router};
use chrono::{DateTime, Datelike, Duration, NaiveDate, NaiveDateTime, TimeZone, Utc};
use serde_json::{Value, json};
use sqlx::PgPool;

use crate::AppState;
use crate::auth::CurrentUser;
use crate::db;
use crate::error::{ApiResult, AppError};
use crate::http::express_etag;
use crate::js;
use crate::request::{JsQuery, JsonBody};
use crate::schema::{DeliveriesRow, GroupsRow};
use crate::services::invoice_verification::{self as verification, JsField, Verification, js_number_text};
use crate::services::nocodb::{self, truthy};
use crate::zod::Parsed;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/payment-schedule", get(schedule))
        .route("/api/payment-schedule/export", post(export))
}

fn error_body(status: StatusCode, error: &str) -> AppError {
    AppError::with_body(status, json!({ "error": error }))
}

fn admin_or_directeur(user: &CurrentUser) -> Result<(), AppError> {
    if ["admin", "directeur"].contains(&user.role()) {
        Ok(())
    } else {
        Err(error_body(
            StatusCode::FORBIDDEN,
            "Accès refusé - Admin ou Directeur uniquement",
        ))
    }
}

/// Le directeur ne lit que ses magasins
fn check_directeur_store(user: &CurrentUser, group_id: f64) -> Result<(), AppError> {
    if user.role() == "directeur" && !user.group_ids().iter().any(|id| f64::from(*id) == group_id) {
        return Err(error_body(
            StatusCode::FORBIDDEN,
            "Accès refusé - Vous ne pouvez accéder qu'aux données de votre groupe",
        ));
    }
    Ok(())
}

// ---------- Validation (zod, schémas isolés : chemin vide) ----------

/// Type d'une valeur selon zod (getParsedType)
fn received(value: Option<&Value>) -> &'static str {
    match value {
        None => "undefined",
        Some(Value::Null) => "null",
        Some(Value::Bool(_)) => "boolean",
        Some(Value::Number(_)) => "number",
        Some(Value::String(_)) => "string",
        Some(Value::Array(_)) => "array",
        Some(Value::Object(_)) => "object",
    }
}

/// invalid_type de zod : « Required » pour une valeur absente
fn invalid_type(expected: &str, value: Option<&Value>, path: Value) -> Value {
    let received = received(value);
    let message = if value.is_none() {
        "Required".to_string()
    } else {
        format!("Expected {expected}, received {received}")
    };
    json!({ "code": "invalid_type", "expected": expected, "received": received, "path": path, "message": message })
}

/// z.coerce.number().int().positive() : Number(valeur), entier strictement positif
fn coerce_positive_int(value: Option<&Value>) -> Result<f64, Vec<Value>> {
    let number = value.map_or(f64::NAN, js::to_number);
    if number.is_nan() {
        return Err(vec![json!({
            "code": "invalid_type", "expected": "number", "received": "nan", "path": [],
            "message": "Expected number, received nan",
        })]);
    }
    let mut issues = Vec::new();
    if number.fract() != 0.0 || !number.is_finite() {
        issues.push(json!({
            "code": "invalid_type", "expected": "integer", "received": "float",
            "message": "Expected integer, received float", "path": [],
        }));
    }
    if number <= 0.0 {
        issues.push(json!({
            "code": "too_small", "minimum": 0, "type": "number", "inclusive": false, "exact": false,
            "message": "Number must be greater than 0", "path": [],
        }));
    }
    if issues.is_empty() {
        Ok(number)
    } else {
        Err(issues)
    }
}

/// z.string().regex(/^\d{4}-\d{2}$/)
fn month_string(value: Option<&Value>) -> Result<String, Vec<Value>> {
    let Some(Value::String(text)) = value else {
        return Err(vec![invalid_type("string", value, json!([]))]);
    };
    let bytes = text.as_bytes();
    let matches = bytes.len() == 7
        && bytes[4] == b'-'
        && bytes
            .iter()
            .enumerate()
            .all(|(i, b)| i == 4 || b.is_ascii_digit());
    if matches {
        Ok(text.clone())
    } else {
        Err(vec![
            json!({ "validation": "regex", "code": "invalid_string", "message": "Invalid", "path": [] }),
        ])
    }
}

/// z.array(z.string()).min(1) : longueur contrôlée avant les éléments
fn payment_methods(value: Option<&Value>) -> Result<Vec<String>, Vec<Value>> {
    let Some(Value::Array(items)) = value else {
        return Err(vec![invalid_type("array", value, json!([]))]);
    };
    let mut issues = Vec::new();
    if items.is_empty() {
        issues.push(json!({
            "code": "too_small", "minimum": 1, "type": "array", "inclusive": true, "exact": false,
            "message": "Array must contain at least 1 element(s)", "path": [],
        }));
    }
    let mut methods = Vec::new();
    for (index, item) in items.iter().enumerate() {
        match item.as_str() {
            Some(text) => methods.push(text.to_string()),
            None => issues.push(invalid_type("string", Some(item), json!([index]))),
        }
    }
    if issues.is_empty() {
        Ok(methods)
    } else {
        Err(issues)
    }
}

// ---------- Livraisons lues (storage.getDeliveries([groupId])) ----------

/// Date JavaScript : valide (à la milliseconde) ou « Invalid Date » (vraie, écrite null)
#[derive(Debug, Clone, Copy, PartialEq)]
enum JsDate {
    Valid(DateTime<Utc>),
    Invalid,
}

impl JsDate {
    fn of(date: Option<DateTime<Utc>>) -> Self {
        date.map_or(JsDate::Invalid, JsDate::Valid)
    }

    /// Colonne timestamp lue par node-pg : Date à la milliseconde
    fn from_column(value: NaiveDateTime) -> Self {
        let millis = Utc.from_utc_datetime(&value).timestamp_millis();
        JsDate::of(Utc.timestamp_millis_opt(millis).single())
    }

    fn to_json(self) -> Value {
        match self {
            JsDate::Valid(date) => Value::String(js::iso(&date)),
            JsDate::Invalid => Value::Null,
        }
    }
}

#[derive(Debug, sqlx::FromRow)]
struct DeliveryRow {
    id: i32,
    supplier_id: i32,
    invoice_reference: Option<String>,
    /// Montants en texte, tels que node-pg les lit ("1250.50")
    invoice_amount: Option<String>,
    invoice_amount_ttc: Option<String>,
    due_date: Option<NaiveDateTime>,
    reconciled: Option<bool>,
}

/// Livraison telle que le gestionnaire Node la garde en mémoire et la complète
struct Line {
    id: i32,
    supplier_id: i32,
    invoice_reference: String,
    invoice_amount: Option<String>,
    invoice_amount_ttc: Option<String>,
    due_date: Option<JsDate>,
    reconciled: bool,
}

/// Livraisons du magasin avec une référence de facture, par date de création
/// décroissante (mêmes jointures que Node)
async fn invoiced_deliveries(db: &PgPool, group_id: i32) -> Result<Vec<Line>, sqlx::Error> {
    let rows: Vec<DeliveryRow> = sqlx::query_as(
        "SELECT d.id, d.supplier_id, d.invoice_reference, d.invoice_amount::text AS invoice_amount,
                d.invoice_amount_ttc::text AS invoice_amount_ttc, d.due_date, d.reconciled
           FROM deliveries d
           LEFT JOIN suppliers s ON d.supplier_id = s.id
           LEFT JOIN groups g ON d.group_id = g.id
           LEFT JOIN users u ON d.created_by = u.id
          WHERE d.group_id = $1
          ORDER BY d.created_at DESC",
    )
    .bind(group_id)
    .fetch_all(db)
    .await?;
    Ok(rows
        .into_iter()
        .filter_map(|row| {
            let reference = row.invoice_reference.filter(|reference| !reference.is_empty())?;
            Some(Line {
                id: row.id,
                supplier_id: row.supplier_id,
                invoice_reference: reference,
                invoice_amount: row.invoice_amount,
                invoice_amount_ttc: row.invoice_amount_ttc,
                due_date: row.due_date.map(JsDate::from_column),
                reconciled: row.reconciled == Some(true),
            })
        })
        .collect())
}

/// Nom et mode de paiement des fournisseurs (storage.getSuppliers)
async fn suppliers(db: &PgPool) -> Result<HashMap<i32, (String, Option<String>)>, sqlx::Error> {
    let rows: Vec<(i32, String, Option<String>)> =
        sqlx::query_as("SELECT id, name, payment_method FROM suppliers ORDER BY name")
            .fetch_all(db)
            .await?;
    Ok(rows
        .into_iter()
        .map(|(id, name, method)| (id, (name, method)))
        .collect())
}

/// Texte d'une valeur vraie (`valeur || repli`)
fn or_default(value: &Option<String>) -> Option<&str> {
    value.as_deref().filter(|text| !text.is_empty())
}

/// `montant ? parseFloat(montant) : 0`
fn amount(value: &Option<String>) -> f64 {
    or_default(value).map_or(0.0, js::parse_float)
}

/// Montant trouvé « vrai » (ni absent, ni 0, ni NaN)
fn found_amount(result: &Verification) -> Option<f64> {
    result
        .invoice_amount
        .get()
        .copied()
        .filter(|amount| *amount != 0.0 && !amount.is_nan())
}

/// storage.updateDelivery : erreur journalisée, comme le catch de Node
async fn update_delivery(db: &PgPool, id: i32, data: &Parsed) -> bool {
    match db::update_by_id::<DeliveriesRow>(db, id, data, true).await {
        Ok(_) => true,
        Err(error) => {
            tracing::error!(%error, id, "échéancier : mise à jour de la livraison");
            false
        }
    }
}

/// Échéance absente : échéance (normalisée) et montant HT manquant pris dans NocoDB
async fn complete_due_date(state: &AppState, group_id: i32, line: &mut Line) {
    let result =
        verification::verify_invoice(state, &line.invoice_reference, group_id, false, line.reconciled).await;
    let mut data = Parsed::new();
    // new Date(échéance invalide) : la mise à jour échoue (toISOString), la
    // livraison garde en mémoire sa date invalide et son montant
    let mut writable = true;
    if result.exists {
        if let Some(normalized) = result.normalized_due_date() {
            let date = JsDate::of(crate::services::dates::parse_js_date(&normalized));
            match date {
                JsDate::Valid(date) => {
                    data.insert("dueDate".into(), json!(js::iso(&date)));
                }
                JsDate::Invalid => writable = false,
            }
            line.due_date = Some(date);
        }
    }
    if let Some(found) = found_amount(&result).filter(|_| result.exists) {
        if or_default(&line.invoice_amount).is_none() {
            let text = js_number_text(found);
            data.insert("invoiceAmount".into(), json!(text));
            line.invoice_amount = Some(text);
        }
    }
    if !data.is_empty() && writable {
        update_delivery(&state.db, line.id, &data).await;
    }
}

/// Montant TTC absent ou nul : réécrit le HT (et l'échéance brute) de NocoDB, sans
/// jamais écrire le TTC
async fn complete_amount(state: &AppState, group_id: i32, line: &mut Line) {
    let result =
        verification::verify_invoice(state, &line.invoice_reference, group_id, false, line.reconciled).await;
    let Some(found) = found_amount(&result).filter(|_| result.exists) else {
        return;
    };
    let text = js_number_text(found);
    let mut data = Parsed::new();
    data.insert("invoiceAmount".into(), json!(text));
    if let JsField::Set(due) = &result.due_date {
        if truthy(due) {
            match crate::services::dates::js_date(due) {
                Some(date) => {
                    data.insert("dueDate".into(), json!(js::iso(&date)));
                }
                // new Date(échéance) invalide : toISOString lève avant la requête
                None => return,
            }
        }
    }
    if update_delivery(&state.db, line.id, &data).await {
        line.invoice_amount = Some(text);
    }
}

async fn schedule(State(state): State<AppState>, user: CurrentUser, query: JsQuery) -> ApiResult {
    let server_error = |details: String| {
        AppError::with_body(
            StatusCode::INTERNAL_SERVER_ERROR,
            json!({ "error": "Erreur serveur", "details": details }),
        )
    };
    admin_or_directeur(&user)?;
    let raw = query.get("groupId").map(|text| Value::String(text.to_string()));
    let Ok(group_id) = coerce_positive_int(raw.as_ref()) else {
        return Err(error_body(
            StatusCode::BAD_REQUEST,
            "groupId invalide - doit être un entier positif",
        ));
    };
    check_directeur_store(&user, group_id)?;
    let Some(group) = load_group(&state.db, group_id).await.map_err(server_error)? else {
        return Ok(Json(json!({ "schedules": [], "message": "Groupe non trouvé" })).into_response());
    };

    let lines = invoiced_deliveries(&state.db, group.id)
        .await
        .map_err(|error| server_error(nocodb::database_message(&error)))?;
    let (mut dated, mut undated): (Vec<Line>, Vec<Line>) =
        lines.into_iter().partition(|line| line.due_date.is_some());
    for line in &mut undated {
        complete_due_date(&state, group.id, line).await;
    }
    dated.extend(undated.into_iter().filter(|line| line.due_date.is_some()));
    for line in dated
        .iter_mut()
        .filter(|line| or_default(&line.invoice_amount_ttc).is_none_or(|ttc| js::parse_float(ttc) == 0.0))
    {
        complete_amount(&state, group.id, line).await;
    }

    let suppliers = suppliers(&state.db)
        .await
        .map_err(|error| server_error(nocodb::database_message(&error)))?;
    let schedules: Vec<Value> = dated
        .iter()
        .map(|line| {
            let supplier = suppliers.get(&line.supplier_id);
            json!({
                "id": line.id,
                "invoiceReference": line.invoice_reference,
                "dueDate": line.due_date.map_or(Value::Null, JsDate::to_json),
                "amount": js::number_value(amount(&line.invoice_amount)),
                "amountTTC": js::number_value(amount(&line.invoice_amount_ttc)),
                "supplierName": supplier
                    .map(|(name, _)| name.as_str())
                    .filter(|name| !name.is_empty())
                    .unwrap_or("Fournisseur inconnu"),
                "paymentMethod": supplier.and_then(|(_, method)| or_default(method)),
                "groupId": group.id,
                "groupName": group.name,
            })
        })
        .collect();
    Ok(Json(json!({ "schedules": schedules })).into_response())
}

/// storage.getGroup avec l'identifiant validé, envoyé en texte comme node-pg (un
/// entier hors limites fait échouer la requête)
async fn load_group(db: &PgPool, group_id: f64) -> Result<Option<GroupsRow>, String> {
    nocodb::group_by_text_id(db, Some(&js::number_to_string(group_id))).await
}

// ---------- Export CSV ----------

/// Number.prototype.toFixed(2) : arrondi de la valeur binaire exacte, les égalités
/// parfaites (x,xx5 exactement représentable) vers le haut
fn to_fixed_2(number: f64) -> String {
    if number.is_nan() {
        return "NaN".into();
    }
    if number.abs() >= 1e21 {
        return js::number_string(number);
    }
    if number < 0.0 {
        return format!("-{}", to_fixed_2(-number));
    }
    // -0 n'est pas négatif pour toFixed
    let number = number.abs();
    let eighths = number * 8.0;
    if eighths.fract() == 0.0 && eighths % 2.0 == 1.0 {
        // x = k/8 (k impair) : x × 100 se termine exactement par ,5
        let cents = (number * 100.0 + 0.5).floor() as u128;
        return format!("{}.{:02}", cents / 100, cents % 100);
    }
    format!("{number:.2}")
}

/// Premier et dernier instant du mois (parseISO puis endOfMonth de date-fns, en
/// heure locale : UTC), None pour un mois invalide (Invalid Date : aucune ligne)
fn month_bounds(month: &str) -> Option<(DateTime<Utc>, DateTime<Utc>)> {
    let year: i32 = month[..4].parse().ok()?;
    let number: u32 = month[5..].parse().ok()?;
    let first = NaiveDate::from_ymd_opt(year, number, 1)?;
    let next = if number == 12 {
        NaiveDate::from_ymd_opt(year + 1, 1, 1)?
    } else {
        NaiveDate::from_ymd_opt(year, number + 1, 1)?
    };
    let start = Utc.from_utc_datetime(&first.and_hms_opt(0, 0, 0)?);
    let end = Utc.from_utc_datetime(&next.and_hms_opt(0, 0, 0)?) - Duration::milliseconds(1);
    Some((start, end))
}

struct ExportLine {
    due_date: DateTime<Utc>,
    supplier_name: String,
    invoice_reference: String,
    payment_method: String,
    amount_ht: f64,
    amount_ttc: f64,
}

async fn export(State(state): State<AppState>, user: CurrentUser, JsonBody(body): JsonBody) -> ApiResult {
    let failed = |details: String| {
        AppError::with_body(
            StatusCode::INTERNAL_SERVER_ERROR,
            json!({ "error": "Erreur lors de l'export", "details": details }),
        )
    };
    let zod_failed = |issues: Vec<Value>| failed(serde_json::to_string_pretty(&issues).unwrap_or_default());
    admin_or_directeur(&user)?;
    let group_id = coerce_positive_int(body.get("groupId")).map_err(zod_failed)?;
    let month = month_string(body.get("month")).map_err(zod_failed)?;
    let methods = payment_methods(body.get("paymentMethods")).map_err(zod_failed)?;
    let include_ht = body.get("includeHT").is_some_and(truthy);
    let include_ttc = body.get("includeTTC").is_some_and(truthy);
    check_directeur_store(&user, group_id)?;
    let Some(group) = load_group(&state.db, group_id).await.map_err(failed)? else {
        return Err(error_body(StatusCode::NOT_FOUND, "Groupe non trouvé"));
    };

    let lines = invoiced_deliveries(&state.db, group.id)
        .await
        .map_err(|error| failed(nocodb::database_message(&error)))?;
    let bounds = month_bounds(&month);
    let suppliers = suppliers(&state.db)
        .await
        .map_err(|error| failed(nocodb::database_message(&error)))?;
    let mut schedules: Vec<ExportLine> = lines
        .iter()
        .filter_map(|line| match (line.due_date, bounds) {
            (Some(JsDate::Valid(due)), Some((start, end))) if start <= due && due <= end => Some((line, due)),
            _ => None,
        })
        .map(|(line, due_date)| {
            let supplier = suppliers.get(&line.supplier_id);
            ExportLine {
                due_date,
                supplier_name: supplier
                    .map(|(name, _)| name.clone())
                    .filter(|name| !name.is_empty())
                    .unwrap_or_else(|| "Fournisseur inconnu".into()),
                invoice_reference: line.invoice_reference.clone(),
                payment_method: supplier
                    .and_then(|(_, method)| or_default(method))
                    .unwrap_or("Non défini")
                    .to_string(),
                amount_ht: amount(&line.invoice_amount),
                amount_ttc: amount(&line.invoice_amount_ttc),
            }
        })
        .filter(|line| methods.contains(&line.payment_method))
        .collect();
    // Tri stable par échéance
    schedules.sort_by_key(|line| line.due_date);

    // CSV au point-virgule (Excel en français), champs non échappés
    let mut headers = vec!["Date d'échéance", "Fournisseur", "Facture", "Mode de paiement"];
    if include_ht {
        headers.push("Montant HT");
    }
    if include_ttc {
        headers.push("Montant TTC");
    }
    let mut csv_lines = vec![headers.join(";")];
    for line in &schedules {
        let mut row = vec![
            format!(
                "{:02}/{:02}/{:04}",
                line.due_date.day(),
                line.due_date.month(),
                line.due_date.year()
            ),
            line.supplier_name.clone(),
            line.invoice_reference.clone(),
            line.payment_method.clone(),
        ];
        if include_ht {
            row.push(to_fixed_2(line.amount_ht));
        }
        if include_ttc {
            row.push(to_fixed_2(line.amount_ttc));
        }
        csv_lines.push(row.join(";"));
    }
    let mut total = vec![String::new(), String::new(), String::new(), "TOTAL".to_string()];
    if include_ht {
        total.push(to_fixed_2(
            schedules.iter().fold(0.0, |sum, line| sum + line.amount_ht),
        ));
    }
    if include_ttc {
        total.push(to_fixed_2(
            schedules.iter().fold(0.0, |sum, line| sum + line.amount_ttc),
        ));
    }
    csv_lines.push(total.join(";"));
    // BOM UTF-8 pour Excel
    let content = format!("\u{FEFF}{}", csv_lines.join("\n"));
    tracing::info!(
        count = schedules.len(),
        group = group.name,
        "export CSV de l'échéancier"
    );

    // res.send : ETag calculé sur le corps
    let etag = express_etag(content.as_bytes());
    let mut response = content.into_response();
    let response_headers = response.headers_mut();
    response_headers.insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static("text/csv; charset=utf-8"),
    );
    if let Ok(value) = HeaderValue::from_str(&format!("attachment; filename=\"echeancier_{month}.csv\"")) {
        response_headers.insert(header::CONTENT_DISPOSITION, value);
    }
    if let Ok(value) = HeaderValue::from_str(&etag) {
        response_headers.insert(header::ETAG, value);
    }
    Ok(response)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn to_fixed_comme_javascript() {
        // Valeurs de Number.prototype.toFixed(2) dans Node
        assert_eq!(to_fixed_2(0.125), "0.13");
        assert_eq!(to_fixed_2(0.375), "0.38");
        assert_eq!(to_fixed_2(2.5), "2.50");
        assert_eq!(to_fixed_2(1.005), "1.00");
        assert_eq!(to_fixed_2(0.1 + 0.2), "0.30");
        assert_eq!(to_fixed_2(1250.5), "1250.50");
        assert_eq!(to_fixed_2(-45.9), "-45.90");
        assert_eq!(to_fixed_2(-0.001), "-0.00");
        assert_eq!(to_fixed_2(-0.0), "0.00");
        assert_eq!(to_fixed_2(10.125), "10.13");
    }

    #[test]
    fn identifiant_de_magasin_comme_zod() {
        assert_eq!(coerce_positive_int(Some(&json!(" 2 "))), Ok(2.0));
        assert_eq!(coerce_positive_int(Some(&json!(true))), Ok(1.0));
        let issues = coerce_positive_int(Some(&json!("-1.5"))).unwrap_err();
        assert_eq!(issues.len(), 2);
        assert_eq!(
            serde_json::to_string(&coerce_positive_int(None).unwrap_err()).unwrap(),
            r#"[{"code":"invalid_type","expected":"number","received":"nan","path":[],"message":"Expected number, received nan"}]"#
        );
    }

    #[test]
    fn parametres_d_export_comme_zod() {
        assert_eq!(month_string(Some(&json!("2026-10"))), Ok("2026-10".to_string()));
        assert_eq!(month_string(None).unwrap_err()[0]["message"], json!("Required"));
        assert_eq!(
            month_string(Some(&json!("2026-1"))).unwrap_err()[0]["validation"],
            json!("regex")
        );
        let issues = payment_methods(Some(&json!(["a", 5, null]))).unwrap_err();
        assert_eq!(issues[0]["path"], json!([1]));
        assert_eq!(issues[1]["message"], json!("Expected string, received null"));
        assert_eq!(
            payment_methods(Some(&json!([]))).unwrap_err()[0]["code"],
            json!("too_small")
        );
    }

    #[test]
    fn bornes_du_mois() {
        let (start, end) = month_bounds("2026-02").unwrap();
        assert_eq!(js::iso(&start), "2026-02-01T00:00:00.000Z");
        assert_eq!(js::iso(&end), "2026-02-28T23:59:59.999Z");
        assert_eq!(
            js::iso(&month_bounds("2026-12").unwrap().1),
            "2026-12-31T23:59:59.999Z"
        );
        assert!(month_bounds("2026-13").is_none());
        assert!(month_bounds("2026-00").is_none());
    }
}
