// Statistiques détaillées : /api/analytics/summary, /timeseries, /by-supplier,
// /by-store, /export (server/routes.ts, « Analytics routes » ; storage
// getAnalyticsSummary, getAnalyticsTimeseries, getAnalyticsBySupplier,
// getAnalyticsByStore).
//
// Node assemble une partie de ces requêtes en texte (timeseries, by-store) :
// elles sont ici paramétrées, avec les mêmes résultats. Dans ces requêtes en
// texte, un identifiant décimal ou hors limites est comparé sans erreur (il ne
// correspond à rien) et seul un NaN ou un Infinity fait échouer la requête ;
// dans les requêtes de Drizzle, tout identifiant que PostgreSQL refuse comme
// integer la fait échouer.
//
// Comme Node aujourd'hui : « Montant total » additionne BL et factures (ANA-04),
// /by-store ignore les magasins de l'utilisateur (ANA-05), une liste de
// magasins vidée par le filtre des droits n'en filtre plus aucun, et un compte
// sans magasin voit tout (ANA-06) ; le directeur voit tous les magasins ; le
// taux de rapprochement vaut null (NaN) quand il n'y a aucune livraison.

use std::collections::BTreeMap;

use axum::extract::State;
use axum::http::{HeaderValue, StatusCode, header};
use axum::response::{IntoResponse, Response};
use axum::{Json, Router, routing::get};
use chrono::{DateTime, Datelike, Utc};
use serde_json::{Map, Value, json};
use sqlx::postgres::PgArguments;
use sqlx::{Arguments, PgPool, Postgres};

use crate::AppState;
use crate::auth::CurrentUser;
use crate::db::js_int4;
use crate::error::{ApiResult, AppError};
use crate::js;
use crate::request::JsQuery;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/analytics/summary", get(summary))
        .route("/api/analytics/timeseries", get(timeseries))
        .route("/api/analytics/by-supplier", get(by_supplier))
        .route("/api/analytics/by-store", get(by_store))
        .route("/api/analytics/export", get(export))
}

// ---------- Filtres ----------

/// Date du filtre : `new Date(texte)`, None si « Invalid Date »
type FilterDate = Option<DateTime<Utc>>;

/// Filtres de l'adresse, tels que Node les lit
#[derive(Default)]
struct Filters {
    start_date: Option<FilterDate>,
    end_date: Option<FilterDate>,
    /// split(',').map(Number)
    supplier_ids: Option<Vec<f64>>,
    group_ids: Option<Vec<f64>>,
    status: Option<Vec<String>>,
}

/// Échec d'une requête : Node le transforme en 500 (ou en liste vide pour by-store)
#[derive(Debug)]
struct Failure;

impl From<sqlx::Error> for Failure {
    fn from(error: sqlx::Error) -> Self {
        tracing::error!(%error, "statistiques détaillées");
        Self
    }
}

impl Filters {
    fn read(query: &JsQuery) -> Self {
        let date = |key: &str| query.truthy(key).map(|text| js::new_date(&json!(text)));
        let numbers = |key: &str| {
            query
                .truthy(key)
                .map(|text| text.split(',').map(|part| js::to_number(&json!(part))).collect())
        };
        Self {
            start_date: date("startDate"),
            end_date: date("endDate"),
            supplier_ids: numbers("supplierIds"),
            group_ids: numbers("groupIds"),
            status: query
                .truthy("status")
                .map(|text| text.split(',').map(str::to_string).collect()),
        }
    }

    /// Hors admin et directeur : seulement les magasins de l'utilisateur (la
    /// liste filtrée peut devenir vide, et alors ne filtre plus rien)
    fn restrict_to(mut self, user: &CurrentUser) -> Self {
        if user.role() != "admin" && user.role() != "directeur" {
            let own: Vec<f64> = user.group_ids().into_iter().map(f64::from).collect();
            self.group_ids = Some(match self.group_ids {
                Some(requested) => requested.into_iter().filter(|id| own.contains(id)).collect(),
                None => own,
            });
        }
        self
    }

    /// date.toISOString().split('T')[0] : Err pour « Invalid Date » (RangeError)
    fn day(date: &Option<FilterDate>) -> Result<Option<String>, Failure> {
        match date {
            None => Ok(None),
            Some(None) => Err(Failure),
            Some(Some(date)) => Ok(Some(iso_day(date))),
        }
    }

    fn days(&self) -> Result<(Option<String>, Option<String>), Failure> {
        Ok((Self::day(&self.start_date)?, Self::day(&self.end_date)?))
    }
}

/// Partie date de toISOString (années hors 0..9999 sur 6 chiffres signés)
fn iso_day(date: &DateTime<Utc>) -> String {
    let year = date.year();
    let year = if (0..=9999).contains(&year) {
        format!("{year:04}")
    } else {
        format!("{}{:06}", if year < 0 { '-' } else { '+' }, year.abs())
    };
    format!("{year}-{}", date.format("%m-%d"))
}

/// Liste non vide (filters.x?.length)
fn non_empty<T>(list: &Option<Vec<T>>) -> Option<&[T]> {
    list.as_deref().filter(|list| !list.is_empty())
}

/// Conditions WHERE paramétrées
#[derive(Default)]
struct Conditions {
    clauses: Vec<String>,
    arguments: PgArguments,
}

impl Conditions {
    fn placeholder(&self) -> String {
        format!("${}", self.arguments.len())
    }

    /// colonne op $n::type (date en texte, convertie par PostgreSQL)
    fn compare(&mut self, column: &str, operator: &str, value: &str, sql_type: &str) -> Result<(), Failure> {
        self.arguments.add(value).map_err(sqlx::Error::Encode)?;
        self.clauses
            .push(format!("{column} {operator} {}::{sql_type}", self.placeholder()));
        Ok(())
    }

    /// inArray de Drizzle sur une colonne integer : chaque nombre doit être un entier
    fn integers(&mut self, column: &str, ids: &[f64]) -> Result<(), Failure> {
        let mut placeholders = Vec::new();
        for id in ids {
            let id = js_int4(*id).ok_or(Failure)?;
            self.arguments.add(id).map_err(sqlx::Error::Encode)?;
            placeholders.push(self.placeholder());
        }
        self.clauses
            .push(format!("{column} IN ({})", placeholders.join(", ")));
        Ok(())
    }

    /// `colonne IN (${ids.join(',')})` écrit dans le texte SQL par Node : un NaN ou
    /// un Infinity est une erreur SQL, les autres nombres sont comparés sans erreur
    fn literal_integers(&mut self, column: &str, ids: &[f64]) -> Result<(), Failure> {
        if ids.iter().any(|id| !id.is_finite()) {
            return Err(Failure);
        }
        let matching: Vec<i32> = ids.iter().filter_map(|id| js_int4(*id)).collect();
        if matching.is_empty() {
            self.clauses.push("FALSE".into());
            return Ok(());
        }
        let mut placeholders = Vec::new();
        for id in matching {
            self.arguments.add(id).map_err(sqlx::Error::Encode)?;
            placeholders.push(self.placeholder());
        }
        self.clauses
            .push(format!("{column} IN ({})", placeholders.join(", ")));
        Ok(())
    }

    fn texts(&mut self, column: &str, values: &[String]) -> Result<(), Failure> {
        let mut placeholders = Vec::new();
        for value in values {
            self.arguments.add(value.as_str()).map_err(sqlx::Error::Encode)?;
            placeholders.push(self.placeholder());
        }
        self.clauses
            .push(format!("{column} IN ({})", placeholders.join(", ")));
        Ok(())
    }

    fn where_clause(&self) -> String {
        if self.clauses.is_empty() {
            String::new()
        } else {
            format!("WHERE ({})", self.clauses.join(" AND "))
        }
    }
}

/// Number(texte numeric) ; NaN → 0 (Number(x) || 0)
fn number_or_zero(text: Option<&str>) -> f64 {
    let number = text.map_or(0.0, |text| js::to_number(&json!(text)));
    if number.is_nan() { 0.0 } else { number }
}

// ---------- Lignes rendues (JSON ou CSV) ----------

/// Valeur d'une ligne : nombre JavaScript, texte, ou objet sérialisé tel quel
enum Cell {
    Number(f64),
    Text(String),
    Json(Value),
}

type Row = Vec<(&'static str, Cell)>;

impl Cell {
    fn json(&self) -> Value {
        match self {
            Self::Number(number) => js::number_value(*number),
            Self::Text(text) => json!(text),
            Self::Json(value) => value.clone(),
        }
    }

    /// Valeur dans le CSV : typeof val === 'object' ? JSON.stringify(val) : val
    fn csv(&self) -> String {
        match self {
            Self::Number(number) => js::number_string(*number),
            Self::Text(text) => text.clone(),
            Self::Json(value) => value.to_string(),
        }
    }
}

fn row_json(row: &Row) -> Value {
    Value::Object(
        row.iter()
            .map(|(key, cell)| ((*key).to_string(), cell.json()))
            .collect::<Map<_, _>>(),
    )
}

fn rows_json(rows: &[Row]) -> Value {
    Value::Array(rows.iter().map(row_json).collect())
}

/// En-têtes puis une ligne par élément, valeurs séparées par des virgules sans guillemets
fn to_csv(rows: &[Row]) -> String {
    let headers: Vec<&str> = rows[0].iter().map(|(key, _)| *key).collect();
    let lines: Vec<String> = rows
        .iter()
        .map(|row| {
            row.iter()
                .map(|(_, cell)| cell.csv())
                .collect::<Vec<_>>()
                .join(",")
        })
        .collect();
    format!("{}\n{}", headers.join(","), lines.join("\n"))
}

// ---------- Requêtes ----------

/// getAnalyticsSummary
async fn summary_row(db: &PgPool, filters: &Filters) -> Result<Row, Failure> {
    let (start, end) = filters.days()?;
    let conditions = |date_column: &str, prefix: &str| -> Result<Conditions, Failure> {
        let mut conditions = Conditions::default();
        if let Some(start) = &start {
            conditions.compare(&format!("{prefix}.{date_column}"), ">=", start, "date")?;
        }
        if let Some(end) = &end {
            conditions.compare(&format!("{prefix}.{date_column}"), "<=", end, "date")?;
        }
        if let Some(ids) = non_empty(&filters.supplier_ids) {
            conditions.integers(&format!("{prefix}.supplier_id"), ids)?;
        }
        if let Some(ids) = non_empty(&filters.group_ids) {
            conditions.integers(&format!("{prefix}.group_id"), ids)?;
        }
        if let Some(status) = non_empty(&filters.status) {
            conditions.texts(&format!("{prefix}.status"), status)?;
        }
        Ok(conditions)
    };
    let orders = conditions("planned_date", "orders")?;
    let deliveries = conditions("scheduled_date", "deliveries")?;
    let suppliers = conditions("scheduled_date", "deliveries")?;

    // Magasins les plus actifs : seul le filtre des magasins s'applique
    let mut stores = PgArguments::default();
    let store_ids = non_empty(&filters.group_ids);
    let mut store_list = || -> Result<String, Failure> {
        let mut placeholders = Vec::new();
        for id in store_ids.unwrap_or_default() {
            stores
                .add(js_int4(*id).ok_or(Failure)?)
                .map_err(sqlx::Error::Encode)?;
            placeholders.push(format!("${}", stores.len()));
        }
        Ok(format!("({})", placeholders.join(", ")))
    };
    let (orders_filter, deliveries_filter, stores_filter) = if store_ids.is_some() {
        (
            format!("WHERE group_id IN {}", store_list()?),
            format!("WHERE group_id IN {}", store_list()?),
            format!("WHERE g.id IN {}", store_list()?),
        )
    } else {
        Default::default()
    };
    let stores_sql = format!(
        "SELECT g.id AS id, g.name AS name, COALESCE(o.count, 0) AS orders, COALESCE(d.count, 0) AS deliveries
           FROM groups g
           LEFT JOIN (SELECT group_id, COUNT(*) AS count FROM orders {orders_filter} GROUP BY group_id) o ON o.group_id = g.id
           LEFT JOIN (SELECT group_id, COUNT(*) AS count FROM deliveries {deliveries_filter} GROUP BY group_id) d ON d.group_id = g.id
           {stores_filter}
          ORDER BY COALESCE(o.count, 0) + COALESCE(d.count, 0) DESC
          LIMIT 5"
    );
    let orders_sql = format!("SELECT COUNT(*) FROM orders {}", orders.where_clause());
    let deliveries_sql = format!(
        "SELECT COUNT(*),
                (COALESCE(SUM(CAST(bl_amount AS NUMERIC)), 0) + COALESCE(SUM(CAST(invoice_amount AS NUMERIC)), 0))::text,
                COUNT(CASE WHEN reconciled = true THEN 1 END),
                (AVG(EXTRACT(EPOCH FROM (delivered_date - scheduled_date)) / 86400))::text
           FROM deliveries {}",
        deliveries.where_clause()
    );
    let suppliers_sql = format!(
        "SELECT suppliers.id, suppliers.name, COUNT(deliveries.id),
                COALESCE(SUM(CAST(deliveries.bl_amount AS NUMERIC)), 0)::text
           FROM deliveries
          INNER JOIN suppliers ON deliveries.supplier_id = suppliers.id
          {}
          GROUP BY suppliers.id, suppliers.name
          ORDER BY COUNT(deliveries.id) DESC
          LIMIT 5",
        suppliers.where_clause()
    );
    // Promise.all : les quatre requêtes vont à leur terme, la première erreur l'emporte
    let (orders, deliveries, top_suppliers, top_stores) = tokio::join!(
        sqlx::query_as_with::<Postgres, (i64,), _>(&orders_sql, orders.arguments).fetch_one(db),
        sqlx::query_as_with::<Postgres, (i64, String, i64, Option<String>), _>(
            &deliveries_sql,
            deliveries.arguments
        )
        .fetch_one(db),
        sqlx::query_as_with::<Postgres, (i32, String, i64, String), _>(&suppliers_sql, suppliers.arguments)
            .persistent(false)
            .fetch_all(db),
        sqlx::query_as_with::<Postgres, (i32, String, i64, i64), _>(&stores_sql, stores)
            .persistent(false)
            .fetch_all(db),
    );
    let ((total_orders,), (count, amount, reconciled, average), top_suppliers, top_stores) =
        (orders?, deliveries?, top_suppliers?, top_stores?);

    let top_suppliers: Vec<Value> = top_suppliers
        .into_iter()
        .map(|(id, name, count, amount)| {
            json!({ "id": id, "name": name, "count": count, "amount": js::number_value(js::to_number(&json!(amount))) })
        })
        .collect();
    let top_stores: Vec<Value> = top_stores
        .into_iter()
        .map(|(id, name, orders, deliveries)| json!({ "id": id, "name": name, "orders": orders, "deliveries": deliveries }))
        .collect();
    // deliveryStats.count est un texte (bigint), toujours « vrai » : 0 livraison → NaN
    let reconciliation_rate = reconciled as f64 / count as f64 * 100.0;
    Ok(vec![
        ("totalOrders", Cell::Number(total_orders as f64)),
        ("totalDeliveries", Cell::Number(count as f64)),
        ("reconciliationRate", Cell::Number(reconciliation_rate)),
        ("totalAmount", Cell::Number(number_or_zero(Some(&amount)))),
        (
            "avgDeliveryDelay",
            Cell::Number(number_or_zero(average.as_deref())),
        ),
        ("topSuppliers", Cell::Json(Value::Array(top_suppliers))),
        ("topStores", Cell::Json(Value::Array(top_stores))),
    ])
}

/// getAnalyticsTimeseries : commandes et livraisons par jour, semaine ou mois
async fn timeseries_rows(db: &PgPool, filters: &Filters, granularity: &str) -> Result<Vec<Row>, Failure> {
    let format = match granularity {
        "day" => "YYYY-MM-DD",
        "week" => "YYYY-IW",
        _ => "YYYY-MM",
    };
    let (start, end) = filters.days()?;
    let series = |table: &str, date_column: &str| -> Result<(String, Conditions), Failure> {
        let mut conditions = Conditions::default();
        conditions.arguments.add(format).map_err(sqlx::Error::Encode)?;
        if let Some(start) = &start {
            conditions.compare(date_column, ">=", start, "date")?;
        }
        if let Some(end) = &end {
            conditions.compare(date_column, "<=", end, "date")?;
        }
        if let Some(ids) = non_empty(&filters.supplier_ids) {
            conditions.literal_integers("supplier_id", ids)?;
        }
        if let Some(ids) = non_empty(&filters.group_ids) {
            conditions.literal_integers("group_id", ids)?;
        }
        let sql = format!(
            "SELECT TO_CHAR({date_column}, $1) AS date, COUNT(*) AS count FROM {table} {} GROUP BY 1 ORDER BY 1",
            conditions.where_clause()
        );
        Ok((sql, conditions))
    };
    let (orders_sql, orders) = series("orders", "planned_date")?;
    let (deliveries_sql, deliveries) = series("deliveries", "scheduled_date")?;
    let (order_rows, delivery_rows) = tokio::join!(
        sqlx::query_as_with::<Postgres, (String, i64), _>(&orders_sql, orders.arguments).fetch_all(db),
        sqlx::query_as_with::<Postgres, (String, i64), _>(&deliveries_sql, deliveries.arguments)
            .fetch_all(db),
    );
    let (order_rows, delivery_rows) = (order_rows?, delivery_rows?);

    // Map date → { orders, deliveries } triée par date (localeCompare sur des
    // chiffres et des tirets : ordre des octets, celui de BTreeMap)
    let mut series: BTreeMap<String, (i64, i64)> = BTreeMap::new();
    for (date, count) in order_rows {
        series.insert(date, (count, 0));
    }
    for (date, count) in delivery_rows {
        series.entry(date).or_default().1 = count;
    }
    Ok(series
        .into_iter()
        .map(|(date, (orders, deliveries))| {
            vec![
                ("date", Cell::Text(date)),
                ("orders", Cell::Number(orders as f64)),
                ("deliveries", Cell::Number(deliveries as f64)),
            ]
        })
        .collect())
}

/// getAnalyticsBySupplier : livraisons et montant des BL par fournisseur
async fn supplier_rows(db: &PgPool, filters: &Filters) -> Result<Vec<Row>, Failure> {
    let (start, end) = filters.days()?;
    let mut conditions = Conditions::default();
    if let Some(start) = &start {
        conditions.compare("deliveries.scheduled_date", ">=", start, "date")?;
    }
    if let Some(end) = &end {
        conditions.compare("deliveries.scheduled_date", "<=", end, "date")?;
    }
    if let Some(ids) = non_empty(&filters.group_ids) {
        conditions.integers("deliveries.group_id", ids)?;
    }
    let sql = format!(
        "SELECT suppliers.id, suppliers.name, COUNT(deliveries.id),
                COALESCE(SUM(CAST(deliveries.bl_amount AS NUMERIC)), 0)::text
           FROM deliveries
          INNER JOIN suppliers ON deliveries.supplier_id = suppliers.id
          {}
          GROUP BY suppliers.id, suppliers.name
          ORDER BY COUNT(deliveries.id) DESC",
        conditions.where_clause()
    );
    let rows: Vec<(i32, String, i64, String)> = sqlx::query_as_with(&sql, conditions.arguments)
        .persistent(false)
        .fetch_all(db)
        .await?;
    Ok(rows
        .into_iter()
        .map(|(id, name, deliveries, amount)| {
            vec![
                ("supplierId", Cell::Number(f64::from(id))),
                ("supplierName", Cell::Text(name)),
                ("deliveries", Cell::Number(deliveries as f64)),
                ("amount", Cell::Number(js::to_number(&json!(amount)))),
            ]
        })
        .collect())
}

/// getAnalyticsByStore : commandes et livraisons par magasin ; toute erreur
/// rend une liste vide
async fn store_rows(db: &PgPool, filters: &Filters) -> Vec<Row> {
    store_rows_or_fail(db, filters).await.unwrap_or_default()
}

async fn store_rows_or_fail(db: &PgPool, filters: &Filters) -> Result<Vec<Row>, Failure> {
    let (start, end) = filters.days()?;
    let mut conditions = Conditions::default();
    let mut orders = Vec::new();
    let mut deliveries = Vec::new();
    if let Some(start) = &start {
        conditions.compare("planned_date", ">=", start, "date")?;
        orders.push(conditions.clauses.pop().unwrap_or_default());
        conditions.compare("scheduled_date", ">=", start, "date")?;
        deliveries.push(conditions.clauses.pop().unwrap_or_default());
    }
    if let Some(end) = &end {
        conditions.compare("planned_date", "<=", end, "date")?;
        orders.push(conditions.clauses.pop().unwrap_or_default());
        conditions.compare("scheduled_date", "<=", end, "date")?;
        deliveries.push(conditions.clauses.pop().unwrap_or_default());
    }
    if let Some(ids) = non_empty(&filters.supplier_ids) {
        conditions.literal_integers("supplier_id", ids)?;
        let clause = conditions.clauses.pop().unwrap_or_default();
        // Même liste pour les deux sous-requêtes (paramètres réutilisés)
        orders.push(clause.clone());
        deliveries.push(clause);
    }
    let and =
        |clauses: &[String]| -> String { clauses.iter().map(|clause| format!(" AND {clause}")).collect() };
    let sql = format!(
        "SELECT g.id AS \"groupId\", g.name AS \"storeName\", COALESCE(o.count, 0) AS orders, COALESCE(d.count, 0) AS deliveries
           FROM groups g
           LEFT JOIN (SELECT group_id, COUNT(*) AS count FROM orders WHERE 1=1{} GROUP BY group_id) o ON g.id = o.group_id
           LEFT JOIN (SELECT group_id, COUNT(*) AS count FROM deliveries WHERE 1=1{} GROUP BY group_id) d ON g.id = d.group_id
          ORDER BY (COALESCE(o.count, 0) + COALESCE(d.count, 0)) DESC",
        and(&orders),
        and(&deliveries)
    );
    let rows: Vec<(i32, String, i64, i64)> = sqlx::query_as_with(&sql, conditions.arguments)
        .persistent(false)
        .fetch_all(db)
        .await?;
    Ok(rows
        .into_iter()
        .map(|(id, name, orders, deliveries)| {
            vec![
                ("groupId", Cell::Number(f64::from(id))),
                ("storeName", Cell::Text(name)),
                ("orders", Cell::Number(orders as f64)),
                ("deliveries", Cell::Number(deliveries as f64)),
            ]
        })
        .collect())
}

// ---------- Adresses ----------

fn failed(message: &str) -> AppError {
    AppError::internal(message)
}

async fn summary(State(state): State<AppState>, user: CurrentUser, query: JsQuery) -> ApiResult {
    let filters = Filters::read(&query).restrict_to(&user);
    let row = summary_row(&state.db, &filters)
        .await
        .map_err(|_| failed("Failed to fetch analytics summary"))?;
    Ok(Json(row_json(&row)).into_response())
}

async fn timeseries(State(state): State<AppState>, user: CurrentUser, query: JsQuery) -> ApiResult {
    let filters = Filters {
        status: None,
        ..Filters::read(&query)
    }
    .restrict_to(&user);
    let granularity = query.truthy("granularity").unwrap_or("day");
    let rows = timeseries_rows(&state.db, &filters, granularity)
        .await
        .map_err(|_| failed("Failed to fetch analytics timeseries"))?;
    Ok(Json(rows_json(&rows)).into_response())
}

async fn by_supplier(State(state): State<AppState>, user: CurrentUser, query: JsQuery) -> ApiResult {
    let filters = Filters {
        supplier_ids: None,
        status: None,
        ..Filters::read(&query)
    }
    .restrict_to(&user);
    let rows = supplier_rows(&state.db, &filters)
        .await
        .map_err(|_| failed("Failed to fetch analytics by supplier"))?;
    Ok(Json(rows_json(&rows)).into_response())
}

async fn by_store(State(state): State<AppState>, _user: CurrentUser, query: JsQuery) -> ApiResult {
    // Ni les magasins de l'utilisateur ni ?groupIds (ANA-05)
    let filters = Filters::read(&query);
    Ok(Json(rows_json(&store_rows(&state.db, &filters).await)).into_response())
}

/// Caractères refusés par Node dans un en-tête (checkInvalidHeaderChar)
fn header_bytes(value: &str) -> Option<Vec<u8>> {
    value
        .chars()
        .map(|c| match c as u32 {
            0x09 | 0x20..=0x7e | 0x80..=0xff => Some(c as u32 as u8),
            _ => None,
        })
        .collect()
}

async fn export(State(state): State<AppState>, user: CurrentUser, query: JsQuery) -> ApiResult {
    const FAILED: &str = "Failed to export analytics";
    let kind = query.truthy("type").unwrap_or("summary");
    let filters = Filters::read(&query).restrict_to(&user);
    let filename = format!(
        "analytics_{kind}_{}.csv",
        crate::clock::today().format("%Y-%m-%d")
    );
    let rows = match kind {
        "timeseries" => timeseries_rows(&state.db, &filters, "day").await,
        "suppliers" => supplier_rows(&state.db, &filters).await,
        "stores" => Ok(store_rows(&state.db, &filters).await),
        _ => summary_row(&state.db, &filters).await.map(|row| vec![row]),
    }
    .map_err(|_| failed(FAILED))?;
    if rows.is_empty() {
        return Err(AppError::not_found("No data to export"));
    }
    let csv = to_csv(&rows);
    let csv_type = HeaderValue::from_static("text/csv; charset=utf-8");
    // Nom de fichier invalide pour un en-tête : Node échoue après avoir posé le
    // type CSV, et l'erreur JSON part avec ce type
    let disposition = header_bytes(&format!("attachment; filename=\"{filename}\""))
        .and_then(|bytes| HeaderValue::from_bytes(&bytes).ok());
    let Some(disposition) = disposition else {
        let body = json!({ "message": FAILED }).to_string();
        return Ok((
            StatusCode::INTERNAL_SERVER_ERROR,
            [(header::CONTENT_TYPE, csv_type)],
            body,
        )
            .into_response());
    };
    let etag = HeaderValue::from_str(&crate::http::express_etag(csv.as_bytes())).ok();
    let mut response: Response = (
        [
            (header::CONTENT_TYPE, csv_type),
            (header::CONTENT_DISPOSITION, disposition),
        ],
        csv,
    )
        .into_response();
    if let Some(etag) = etag {
        response.headers_mut().insert(header::ETAG, etag);
    }
    Ok(response)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn csv_comme_node() {
        // Valeurs produites par la conversion CSV de /api/analytics/export dans Node
        let summary = vec![vec![
            ("totalOrders", Cell::Number(9.0)),
            ("reconciliationRate", Cell::Number(f64::NAN)),
            ("avgDeliveryDelay", Cell::Number(1.2291666666666667)),
            (
                "topSuppliers",
                Cell::Json(json!([{ "id": 4, "name": "Jardin & Co", "count": 2, "amount": 450.25 }])),
            ),
        ]];
        assert_eq!(
            to_csv(&summary),
            "totalOrders,reconciliationRate,avgDeliveryDelay,topSuppliers\n9,NaN,1.2291666666666667,[{\"id\":4,\"name\":\"Jardin & Co\",\"count\":2,\"amount\":450.25}]"
        );
        // NaN en JSON : null
        assert_eq!(row_json(&summary[0])["reconciliationRate"], Value::Null);
        let rows = vec![
            vec![
                ("date", Cell::Text("2026-10-01".into())),
                ("orders", Cell::Number(2.0)),
            ],
            vec![
                ("date", Cell::Text("2026-10-02".into())),
                ("orders", Cell::Number(0.0)),
            ],
        ];
        assert_eq!(to_csv(&rows), "date,orders\n2026-10-01,2\n2026-10-02,0");
    }

    #[test]
    fn listes_d_identifiants_comme_le_texte_sql_de_node() {
        let mut conditions = Conditions::default();
        conditions
            .literal_integers("supplier_id", &[1.5, 2.0, 99999999999.0])
            .unwrap();
        assert_eq!(conditions.clauses, vec!["supplier_id IN ($1)"]);
        conditions.literal_integers("group_id", &[1.5]).unwrap();
        assert_eq!(conditions.clauses[1], "FALSE");
        assert!(conditions.literal_integers("group_id", &[1.0, f64::NAN]).is_err());
        assert!(Conditions::default().integers("group_id", &[1.5]).is_err());
    }

    #[test]
    fn dates_des_filtres() {
        let date = |text: &str| js::new_date(&json!(text)).unwrap();
        assert_eq!(iso_day(&date("2026-09-15T23:30:00.000+02:00")), "2026-09-15");
        assert_eq!(iso_day(&date("2026-09-15T22:30:00.000-02:00")), "2026-09-16");
        assert_eq!(header_bytes("é€"), None);
        assert_eq!(header_bytes("résumé").unwrap().len(), 6);
    }
}
