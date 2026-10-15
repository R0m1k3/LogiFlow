// Statistiques : /api/stats/by-group, /by-supplier (comptages des pages Magasins
// et Fournisseurs), /monthly, /yearly (server/routes.ts ; storage
// getOrderDeliveryStatsByGroup, getOrderDeliveryStatsBySupplier,
// getMonthlyStats, getYearlyStats).
// Comme Node aujourd'hui : pour /monthly et /yearly, un compte sans magasin
// voit les chiffres de tous les magasins (liste vide = aucun filtre), et toute
// erreur SQL (année ou mois illisibles, magasin hors limites) rend des zéros
// au lieu d'une erreur.

use axum::extract::State;
use axum::response::IntoResponse;
use axum::{Json, Router, routing::get};
use chrono::{Datelike, Utc};
use serde::Serialize;
use serde_json::json;
use sqlx::PgPool;
use sqlx::postgres::PgArguments;
use sqlx::{Arguments, Postgres};

use crate::AppState;
use crate::auth::CurrentUser;
use crate::db::js_int4;
use crate::error::{ApiResult, OrInternal};
use crate::js;
use crate::request::JsQuery;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/stats/by-group", get(by_group))
        .route("/api/stats/by-supplier", get(by_supplier))
        .route("/api/stats/monthly", get(monthly))
        .route("/api/stats/yearly", get(yearly))
}

/// Magasins retenus, nombres tels que parseInt les rend (NaN compris)
type GroupIds = Vec<f64>;

/// resolveStatsGroupIds : None = refus (liste vide), Some(None) = tous les magasins
fn resolve_stats_group_ids(user: &CurrentUser, store_id: Option<&str>) -> Option<Option<GroupIds>> {
    let user_group_ids: GroupIds = user.group_ids().into_iter().map(f64::from).collect();
    let requested = store_id.map(|raw| js::parse_int(raw).unwrap_or(f64::NAN));
    if user.is_admin() {
        return Some(requested.map(|id| vec![id]));
    }
    match requested {
        // includes : NaN n'est jamais trouvé
        Some(id) => user_group_ids.contains(&id).then(|| Some(vec![id])),
        None => (!user_group_ids.is_empty()).then_some(Some(user_group_ids)),
    }
}

/// Magasins des statistiques mensuelles et annuelles (sans refus)
fn monthly_group_ids(user: &CurrentUser, store_id: Option<&str>) -> Option<GroupIds> {
    let requested = store_id.map(|raw| js::parse_int(raw).unwrap_or(f64::NAN));
    if user.is_admin() {
        return requested.map(|id| vec![id]);
    }
    let user_group_ids: GroupIds = user.group_ids().into_iter().map(f64::from).collect();
    match requested {
        Some(id) if user_group_ids.contains(&id) => Some(vec![id]),
        _ => Some(user_group_ids),
    }
}

/// inArray(colonne, ids) : liste de paramètres, comme Drizzle ; None si
/// PostgreSQL refuserait l'un des identifiants
fn in_list(arguments: &mut PgArguments, ids: &[f64]) -> Option<String> {
    let mut placeholders = Vec::new();
    for id in ids {
        arguments.add(js_int4(*id)?).ok()?;
        placeholders.push(format!("${}", arguments.len()));
    }
    Some(format!("({})", placeholders.join(", ")))
}

/// EntityActivityStats
#[derive(Serialize)]
struct ActivityStats {
    id: i32,
    orders: i64,
    deliveries: i64,
    delivered: i64,
}

/// Comptages par magasin ou par fournisseur (colonne `key`), sans tri : l'ordre
/// est celui de la base, puis les lignes de livraisons sans commande à la suite
async fn activity_stats(
    db: &PgPool,
    key: &str,
    group_ids: Option<&GroupIds>,
) -> Result<Vec<ActivityStats>, sqlx::Error> {
    let scoped = group_ids.filter(|ids| !ids.is_empty());
    let query = |table: &str, extra: &str| -> Result<(String, PgArguments), sqlx::Error> {
        let mut arguments = PgArguments::default();
        let filter = match scoped {
            Some(ids) => {
                let list = in_list(&mut arguments, ids)
                    .ok_or_else(|| sqlx::Error::Protocol("invalid input syntax for type integer".into()))?;
                format!("WHERE {table}.group_id IN {list}")
            }
            None => String::new(),
        };
        Ok((
            format!("SELECT {table}.{key}, count(*){extra} FROM {table} {filter} GROUP BY {table}.{key}"),
            arguments,
        ))
    };
    let (orders_sql, orders_arguments) = query("orders", "")?;
    let (deliveries_sql, deliveries_arguments) = query(
        "deliveries",
        ", count(*) filter (where deliveries.status = 'delivered')",
    )?;
    let (order_rows, delivery_rows) = tokio::join!(
        sqlx::query_as_with::<Postgres, (Option<i32>, i64), _>(&orders_sql, orders_arguments)
            .persistent(false)
            .fetch_all(db),
        sqlx::query_as_with::<Postgres, (Option<i32>, i64, i64), _>(&deliveries_sql, deliveries_arguments)
            .persistent(false)
            .fetch_all(db),
    );
    let (order_rows, delivery_rows) = (order_rows?, delivery_rows?);

    // mergeActivityStats : Map par identifiant, dans l'ordre d'apparition
    let mut stats: Vec<ActivityStats> = Vec::new();
    fn entry(stats: &mut Vec<ActivityStats>, id: i32) -> &mut ActivityStats {
        let index = match stats.iter().position(|entry| entry.id == id) {
            Some(index) => index,
            None => {
                stats.push(ActivityStats {
                    id,
                    orders: 0,
                    deliveries: 0,
                    delivered: 0,
                });
                stats.len() - 1
            }
        };
        &mut stats[index]
    }
    for (id, count) in order_rows {
        if let Some(id) = id {
            entry(&mut stats, id).orders = count;
        }
    }
    for (id, count, delivered) in delivery_rows {
        if let Some(id) = id {
            let entry = entry(&mut stats, id);
            entry.deliveries = count;
            entry.delivered = delivered;
        }
    }
    Ok(stats)
}

async fn by_group(State(state): State<AppState>, user: CurrentUser, query: JsQuery) -> ApiResult {
    let Some(group_ids) = resolve_stats_group_ids(&user, query.truthy("storeId")) else {
        return Ok(Json(json!([])).into_response());
    };
    let stats = activity_stats(&state.db, "group_id", group_ids.as_ref())
        .await
        .or_500("Failed to fetch group stats")?;
    Ok(Json(stats).into_response())
}

async fn by_supplier(State(state): State<AppState>, user: CurrentUser, query: JsQuery) -> ApiResult {
    let Some(group_ids) = resolve_stats_group_ids(&user, query.truthy("storeId")) else {
        return Ok(Json(json!([])).into_response());
    };
    let stats = activity_stats(&state.db, "supplier_id", group_ids.as_ref())
        .await
        .or_500("Failed to fetch supplier stats")?;
    Ok(Json(stats).into_response())
}

/// Chiffres de /monthly et /yearly
#[derive(Serialize, Default)]
struct PeriodStats {
    #[serde(rename = "ordersCount")]
    orders_count: i64,
    #[serde(rename = "deliveriesCount")]
    deliveries_count: i64,
    #[serde(rename = "pendingOrdersCount")]
    pending_orders_count: i64,
    #[serde(rename = "averageDeliveryTime", serialize_with = "js_number")]
    average_delivery_time: f64,
    #[serde(rename = "totalPalettes")]
    total_palettes: i64,
    #[serde(rename = "totalPackages")]
    total_packages: i64,
}

fn js_number<S: serde::Serializer>(value: &f64, serializer: S) -> Result<S::Ok, S::Error> {
    js::number_value(*value).serialize(serializer)
}

/// `${nombre}`.padStart(2, '0')
fn pad2(number: f64) -> String {
    format!("{:0>2}", js::number_string(number))
}

/// Bornes [début, fin) du mois, en texte comme Node les construit
fn month_range(year: f64, month: f64) -> (String, String) {
    let start = format!("{}-{}-01", js::number_string(year), pad2(month));
    let end = if month == 12.0 {
        format!("{}-01-01", js::number_string(year + 1.0))
    } else {
        format!("{}-{}-01", js::number_string(year), pad2(month + 1.0))
    };
    (start, end)
}

/// Bornes [début, fin) de l'année
fn year_range(year: f64) -> (String, String) {
    (
        format!("{}-01-01", js::number_string(year)),
        format!("{}-01-01", js::number_string(year + 1.0)),
    )
}

/// Comptages d'une période ; `deliveries_by_delivered_date` : les livraisons
/// sont comptées à leur date de livraison (année) ou à leur date prévue (mois)
async fn period_stats(
    db: &PgPool,
    (start, end): (String, String),
    group_ids: Option<&GroupIds>,
    deliveries_by_delivered_date: bool,
) -> Result<PeriodStats, sqlx::Error> {
    let scoped = group_ids.filter(|ids| !ids.is_empty());
    // Requête avec bornes (texte converti par PostgreSQL) et filtre de magasins
    let build = |sql: &str, bounds: bool, group_column: &str| -> Result<(String, PgArguments), sqlx::Error> {
        let mut arguments = PgArguments::default();
        if bounds {
            arguments.add(start.as_str()).map_err(sqlx::Error::Encode)?;
            arguments.add(end.as_str()).map_err(sqlx::Error::Encode)?;
        }
        let filter = match scoped {
            Some(ids) => {
                let list = in_list(&mut arguments, ids)
                    .ok_or_else(|| sqlx::Error::Protocol("invalid input syntax for type integer".into()))?;
                format!(" AND {group_column} IN {list}")
            }
            None => String::new(),
        };
        Ok((sql.replace("{filter}", &filter), arguments))
    };
    let deliveries_range = if deliveries_by_delivered_date {
        "deliveries.delivered_date >= $1::timestamp AND deliveries.delivered_date < $2::timestamp"
    } else {
        "deliveries.scheduled_date >= $1::date AND deliveries.scheduled_date < $2::date"
    };
    let (orders_sql, orders_arguments) = build(
        "SELECT count(*) FROM orders WHERE (orders.planned_date >= $1::date AND orders.planned_date < $2::date{filter})",
        true,
        "orders.group_id",
    )?;
    let (deliveries_sql, deliveries_arguments) = build(
        &format!("SELECT count(*) FROM deliveries WHERE ({deliveries_range}{{filter}})"),
        true,
        "deliveries.group_id",
    )?;
    let (pending_sql, pending_arguments) = build(
        "SELECT count(*) FROM orders WHERE (orders.status = 'pending'{filter})",
        false,
        "orders.group_id",
    )?;
    let (delivered_sql, delivered_arguments) = build(
        "SELECT COALESCE(SUM(CAST(deliveries.quantity as INTEGER)), 0),
                COALESCE(COUNT(*), 0),
                COALESCE(AVG(EXTRACT(DAY FROM (deliveries.delivered_date - orders.planned_date))), 0)::text
           FROM deliveries
          INNER JOIN orders ON deliveries.order_id = orders.id
          WHERE ((deliveries.delivered_date >= $1::timestamp AND deliveries.delivered_date < $2::timestamp
                  AND deliveries.status = 'delivered' AND deliveries.delivered_date IS NOT NULL{filter})
                 AND deliveries.order_id IS NOT NULL AND orders.planned_date IS NOT NULL)",
        true,
        "deliveries.group_id",
    )?;
    // Promise.all : les quatre requêtes vont à leur terme, la première erreur l'emporte
    let (orders, deliveries, pending, delivered) = tokio::join!(
        sqlx::query_as_with::<Postgres, (i64,), _>(&orders_sql, orders_arguments).fetch_one(db),
        sqlx::query_as_with::<Postgres, (i64,), _>(&deliveries_sql, deliveries_arguments).fetch_one(db),
        sqlx::query_as_with::<Postgres, (i64,), _>(&pending_sql, pending_arguments).fetch_one(db),
        sqlx::query_as_with::<Postgres, (i64, i64, String), _>(&delivered_sql, delivered_arguments)
            .fetch_one(db),
    );
    let ((orders,), (deliveries,), (pending,), (palettes, packages, average)) =
        (orders?, deliveries?, pending?, delivered?);
    Ok(PeriodStats {
        orders_count: orders,
        deliveries_count: deliveries,
        pending_orders_count: pending,
        // Number(avgDelay) : moyenne numeric relue en texte
        average_delivery_time: js::to_number(&json!(average)),
        total_palettes: palettes,
        total_packages: packages,
    })
}

/// year ? parseInt(year) : année en cours (heure du serveur, UTC)
fn year_param(query: &JsQuery) -> f64 {
    match query.truthy("year") {
        Some(year) => js::parse_int(year).unwrap_or(f64::NAN),
        None => f64::from(Utc::now().year()),
    }
}

async fn monthly(State(state): State<AppState>, user: CurrentUser, query: JsQuery) -> ApiResult {
    let year = year_param(&query);
    let month = match query.truthy("month") {
        Some(month) => js::parse_int(month).unwrap_or(f64::NAN),
        None => f64::from(Utc::now().month()),
    };
    let group_ids = monthly_group_ids(&user, query.truthy("storeId"));
    let stats = period_stats(&state.db, month_range(year, month), group_ids.as_ref(), false)
        .await
        .unwrap_or_else(|error| {
            tracing::error!(%error, "Erreur calcul statistiques");
            PeriodStats::default()
        });
    Ok(Json(stats).into_response())
}

async fn yearly(State(state): State<AppState>, user: CurrentUser, query: JsQuery) -> ApiResult {
    let year = year_param(&query);
    let group_ids = monthly_group_ids(&user, query.truthy("storeId"));
    let stats = period_stats(&state.db, year_range(year), group_ids.as_ref(), true)
        .await
        .unwrap_or_else(|error| {
            tracing::error!(%error, "Erreur calcul statistiques annuelles");
            PeriodStats::default()
        });
    Ok(Json(stats).into_response())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bornes_des_periodes_comme_node() {
        assert_eq!(
            month_range(2026.0, 3.0),
            ("2026-03-01".into(), "2026-04-01".into())
        );
        assert_eq!(
            month_range(2026.0, 9.0),
            ("2026-09-01".into(), "2026-10-01".into())
        );
        assert_eq!(
            month_range(2026.0, 12.0),
            ("2026-12-01".into(), "2027-01-01".into())
        );
        assert_eq!(
            month_range(2026.0, 13.0),
            ("2026-13-01".into(), "2026-14-01".into())
        );
        assert_eq!(
            month_range(f64::NAN, 3.0),
            ("NaN-03-01".into(), "NaN-04-01".into())
        );
        assert_eq!(
            month_range(2026.0, -1.0),
            ("2026--1-01".into(), "2026-00-01".into())
        );
        assert_eq!(year_range(2025.0), ("2025-01-01".into(), "2026-01-01".into()));
    }

    #[test]
    fn statistiques_au_format_javascript() {
        let stats = PeriodStats {
            orders_count: 3,
            average_delivery_time: 1.5,
            ..PeriodStats::default()
        };
        assert_eq!(
            serde_json::to_string(&stats).unwrap(),
            r#"{"ordersCount":3,"deliveriesCount":0,"pendingOrdersCount":0,"averageDeliveryTime":1.5,"totalPalettes":0,"totalPackages":0}"#
        );
    }
}
