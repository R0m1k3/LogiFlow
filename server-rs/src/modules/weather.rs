// Météo : /api/weather/* (server/routes.ts, « Weather routes » et route de
// géolocalisation ; server/weatherService.ts ; storage.getWeatherSettings,
// getWeatherData, getNearestWeatherData, createWeatherData, clearWeatherCache).
//
// Les adresses de Visual Crossing et de Nominatim sont écrites dans le code,
// comme dans Node. Écart voulu (critère du lot 2, DASH-35) : chaque appel a un
// délai maximal (connexion 10 s, comme fetch dans Node, et 30 s en tout), là où
// Node attend jusqu'à 300 s une réponse lente.
// Comme Node aujourd'hui : tout utilisateur connecté peut changer la ville par
// géolocalisation (décision R3 du plan, « Ce qu'on ne reporte pas »).

use std::sync::LazyLock;
use std::time::Duration;

use axum::extract::{Path, State};
use axum::response::IntoResponse;
use axum::{Json, Router, routing::get, routing::post, routing::put};
use chrono::{Datelike, Duration as Days, NaiveDate};
use serde_json::{Map, Value, json};
use sqlx::postgres::PgArguments;
use sqlx::{Arguments, PgPool};

use crate::AppState;
use crate::auth::CurrentUser;
use crate::db::{self, Table, node_pg_text};
use crate::error::{ApiResult, AppError, OrInternal, json_or_empty};
use crate::js::{self, string_of, truthy};
use crate::request::{JsonBody, int_id};
use crate::schema::{WeatherDataRow, WeatherSettingsRow};
use crate::zod::Object;

const VISUAL_CROSSING_URL: &str =
    "https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline";
const NOMINATIM_URL: &str = "https://nominatim.openstreetmap.org/reverse";
const NOMINATIM_USER_AGENT: &str = "LogiFlow-Weather-System/1.0 (Enterprise Weather Management Platform)";

/// Client des services météo : sans mandataire (fetch de Node n'en utilise pas),
/// avec les autorités de NODE_EXTRA_CA_CERTS que Node ajoute aux siennes
static CLIENT: LazyLock<reqwest::Client> = LazyLock::new(|| {
    let mut builder = reqwest::Client::builder()
        .no_proxy()
        .connect_timeout(Duration::from_secs(10))
        .timeout(Duration::from_secs(30))
        .user_agent("node");
    for certificate in extra_certificates() {
        builder = builder.add_root_certificate(certificate);
    }
    builder.build().expect("client HTTP de la météo")
});

/// Certificats de NODE_EXTRA_CA_CERTS ; fichier illisible : avertissement, comme Node
fn extra_certificates() -> Vec<reqwest::Certificate> {
    let Some(path) = std::env::var_os("NODE_EXTRA_CA_CERTS").filter(|path| !path.is_empty()) else {
        return Vec::new();
    };
    std::fs::read(&path)
        .map_err(|error| error.to_string())
        .and_then(|pem| reqwest::Certificate::from_pem_bundle(&pem).map_err(|error| error.to_string()))
        .unwrap_or_else(|error| {
            tracing::warn!(?path, error, "NODE_EXTRA_CA_CERTS ignoré");
            Vec::new()
        })
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/weather/settings", get(get_settings).post(create_settings))
        .route("/api/weather/settings/{id}", put(update_settings))
        .route("/api/weather/test-connection", post(test_connection))
        .route("/api/weather/current", get(current))
        .route("/api/weather/geolocation", post(geolocation))
}

/// insertWeatherSettingsSchema
fn settings_schema() -> Object {
    WeatherSettingsRow::insert_schema().omit(&["id", "createdAt", "updatedAt"])
}

fn admin_only(user: &CurrentUser) -> Result<(), AppError> {
    if user.is_admin() {
        Ok(())
    } else {
        Err(AppError::forbidden("Access denied"))
    }
}

/// storage.getWeatherSettings : première ligne, sans tri
pub(crate) async fn weather_settings(db: &PgPool) -> Result<Option<WeatherSettingsRow>, sqlx::Error> {
    sqlx::query_as(&WeatherSettingsRow::select("LIMIT 1"))
        .persistent(false)
        .fetch_optional(db)
        .await
}

async fn get_settings(State(state): State<AppState>, user: CurrentUser) -> ApiResult {
    admin_only(&user)?;
    let settings = weather_settings(&state.db)
        .await
        .or_500("Failed to fetch weather settings")?;
    Ok(json_or_empty(settings))
}

async fn create_settings(
    State(state): State<AppState>,
    user: CurrentUser,
    JsonBody(body): JsonBody,
) -> ApiResult {
    admin_only(&user)?;
    let data = settings_schema()
        .parse(&body)
        .map_err(|issues| AppError::validation("Validation error", issues))?;
    let settings: WeatherSettingsRow = db::insert(&state.db, &data)
        .await
        .or_500("Failed to create weather settings")?;
    Ok(Json(settings).into_response())
}

async fn update_settings(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<String>,
    JsonBody(body): JsonBody,
) -> ApiResult {
    const FAILED: &str = "Failed to update weather settings";
    admin_only(&user)?;
    // Validation avant la base : un identifiant illisible n'échoue qu'à la requête
    let data = settings_schema()
        .partial()
        .parse(&body)
        .map_err(|issues| AppError::validation("Validation error", issues))?;
    let id = int_id(&id, FAILED)?;
    let settings = db::update_by_id::<WeatherSettingsRow>(&state.db, id, &data, true)
        .await
        .or_500(FAILED)?;
    Ok(json_or_empty(settings))
}

async fn test_connection(user: CurrentUser, JsonBody(body): JsonBody) -> ApiResult {
    admin_only(&user)?;
    let given = |key: &str| body.get(key).filter(|value| truthy(value));
    let (Some(api_key), Some(location)) = (given("apiKey"), given("location")) else {
        return Err(AppError::bad_request("API key and location are required"));
    };
    let (success, message) = test_api_connection(&string_of(api_key), &string_of(location)).await;
    Ok(Json(json!({ "success": success, "message": message })).into_response())
}

// ---------- Visual Crossing et Nominatim (server/weatherService.ts) ----------

/// encodeURIComponent
fn encode_uri_component(text: &str) -> String {
    let mut encoded = String::with_capacity(text.len());
    for byte in text.bytes() {
        if byte.is_ascii_alphanumeric() || b"-_.!~*'()".contains(&byte) {
            encoded.push(byte as char);
        } else {
            encoded.push_str(&format!("%{byte:02X}"));
        }
    }
    encoded
}

/// Adresse de la chronologie Visual Crossing ; la clé est collée telle quelle, comme Node
fn timeline_url(location: &str, date: Option<&str>, api_key: &str, french: bool) -> String {
    let date = date.map(|date| format!("/{date}")).unwrap_or_default();
    let lang = if french { "&lang=fr" } else { "" };
    format!(
        "{VISUAL_CROSSING_URL}/{}{date}?unitGroup=metric&include=days&key={api_key}&contentType=json{lang}",
        encode_uri_component(location)
    )
}

/// Texte du statut (statusText de fetch)
fn status_text(response: &reqwest::Response) -> String {
    response
        .extensions()
        .get::<hyper::ext::ReasonPhrase>()
        .map(|reason| String::from_utf8_lossy(reason.as_bytes()).into_owned())
        .or_else(|| response.status().canonical_reason().map(str::to_string))
        .unwrap_or_default()
}

/// fetchCurrentWeather / fetchPreviousYearWeather : réponse JSON, None en cas d'échec
async fn fetch_timeline(url: &str) -> Option<Value> {
    let response = match CLIENT.get(url).send().await {
        Ok(response) => response,
        Err(error) => {
            tracing::error!(%error, "Erreur lors de la récupération de la météo");
            return None;
        }
    };
    if !response.status().is_success() {
        let status = response.status().as_u16();
        let status_text = status_text(&response);
        let reason: String = response
            .text()
            .await
            .unwrap_or_default()
            .chars()
            .take(300)
            .collect();
        tracing::error!(status, status_text, reason, "Weather API error");
        return None;
    }
    response
        .json::<Value>()
        .await
        .map_err(|error| tracing::error!(%error, "Réponse météo illisible"))
        .ok()
}

/// testApiConnection : { success, message }
pub(crate) async fn test_api_connection(api_key: &str, location: &str) -> (bool, String) {
    const UNREACHABLE: &str = "Erreur de connexion à l'API météo";
    let url = timeline_url(location, None, api_key, false);
    let response = match CLIENT.get(url).send().await {
        Ok(response) => response,
        Err(error) => {
            tracing::error!(%error, "Erreur test API météo");
            return (false, UNREACHABLE.into());
        }
    };
    let status = response.status();
    if status.is_success() {
        return match response.json::<Value>().await {
            // data.days && data.days.length > 0 (null.days : TypeError)
            Ok(Value::Null) | Err(_) => (false, UNREACHABLE.into()),
            Ok(data) => {
                let days = data.get("days").filter(|days| truthy(days));
                if days.is_some_and(has_items) {
                    (true, "Connexion réussie à l'API météo".into())
                } else {
                    (
                        false,
                        "Aucune donnée météo trouvée pour cette localisation".into(),
                    )
                }
            }
        };
    }
    match status.as_u16() {
        401 => (false, "Clé API invalide".into()),
        404 => (false, "Localisation introuvable".into()),
        code => (false, format!("Erreur API: {code} {}", status_text(&response))),
    }
}

/// valeur.length > 0
fn has_items(value: &Value) -> bool {
    let length = match value {
        Value::Array(items) => json!(items.len()),
        Value::String(text) => json!(js::length(text)),
        Value::Object(fields) => match fields.get("length") {
            Some(length) => length.clone(),
            None => return false,
        },
        _ => return false,
    };
    js::to_number(&length) > 0.0
}

/// getCityFromCoordinates : ville, pays et « ville, pays » (Nominatim)
async fn city_from_coordinates(latitude: f64, longitude: f64) -> Option<(Value, Value, String)> {
    let url = format!(
        "{NOMINATIM_URL}?format=json&lat={}&lon={}&accept-language=fr",
        js::number_string(latitude),
        js::number_string(longitude)
    );
    let response = CLIENT
        .get(url)
        .header(reqwest::header::USER_AGENT, NOMINATIM_USER_AGENT)
        .send()
        .await
        .map_err(|error| tracing::error!(%error, "Erreur lors de la géolocalisation"))
        .ok()?;
    if !response.status().is_success() {
        tracing::error!(status = response.status().as_u16(), "Nominatim API error");
        return None;
    }
    let data = response.json::<Value>().await.ok()?;
    let address = data.get("address").filter(|address| truthy(address))?;
    let pick = |keys: &[&str], fallback: &str| {
        keys.iter()
            .filter_map(|key| address.get(*key))
            .find(|value| truthy(value))
            .cloned()
            .unwrap_or_else(|| json!(fallback))
    };
    let city = pick(
        &["city", "town", "village", "municipality", "hamlet"],
        "Ville inconnue",
    );
    let country = pick(&["country"], "Pays inconnu");
    let full_location = format!("{}, {}", string_of(&city), string_of(&country));
    Some((city, country, full_location))
}

/// translateConditionToFrench : premier mot-clé anglais reconnu, sinon tel quel
fn translate_condition(condition: &str) -> String {
    let lower = condition.to_lowercase();
    let has = |word: &str| lower.contains(word);
    let french = if has("clear") {
        "Dégagé"
    } else if has("sunny") {
        "Ensoleillé"
    } else if has("fair") {
        "Beau temps"
    } else if has("partly cloudy") {
        "Partiellement nuageux"
    } else if has("cloudy") {
        "Nuageux"
    } else if has("overcast") {
        "Couvert"
    } else if has("rain") {
        if has("heavy") {
            "Pluie forte"
        } else if has("light") {
            "Pluie légère"
        } else {
            "Pluie"
        }
    } else if has("shower") {
        "Averses"
    } else if has("drizzle") {
        "Bruine"
    } else if has("thunderstorm") || has("thunder") {
        "Orage"
    } else if has("snow") {
        if has("heavy") {
            "Neige forte"
        } else if has("light") {
            "Neige légère"
        } else {
            "Neige"
        }
    } else if has("fog") {
        "Brouillard"
    } else if has("mist") {
        "Brume"
    } else if has("wind") {
        "Venteux"
    } else {
        return condition.to_string();
    };
    french.to_string()
}

/// Méthodes héritées d'Object.prototype : iconMap[nom] est une fonction,
/// que JSON.stringify omet
const OBJECT_PROTOTYPE_METHODS: [&str; 11] = [
    "constructor",
    "__defineGetter__",
    "__defineSetter__",
    "hasOwnProperty",
    "__lookupGetter__",
    "__lookupSetter__",
    "isPrototypeOf",
    "propertyIsEnumerable",
    "toString",
    "valueOf",
    "toLocaleString",
];

/// getWeatherIcon : émoji de l'icône Visual Crossing (None : clé omise du JSON)
fn weather_icon(icon: Option<&Value>) -> Option<Value> {
    let key = icon.map(string_of).unwrap_or_else(|| "undefined".into());
    let emoji = match key.as_str() {
        "clear-day" => "☀️",
        "clear-night" => "🌙",
        "partly-cloudy-day" => "⛅",
        "partly-cloudy-night" | "cloudy" => "☁️",
        "rain" => "🌧️",
        "snow" => "❄️",
        "wind" => "💨",
        "fog" => "🌫️",
        "thunder" => "⛈️",
        "hail" => "🌨️",
        "__proto__" => return Some(json!({})),
        method if OBJECT_PROTOTYPE_METHODS.contains(&method) => return None,
        _ => "🌤️",
    };
    Some(json!(emoji))
}

/// getPreviousYearDate : même jour de la semaine, même semaine du mois, l'an
/// dernier (calculé sur la date du jour à Paris)
fn previous_year_date(date: NaiveDate) -> NaiveDate {
    let (year, month) = (date.year() - 1, date.month());
    let weekday = date.weekday().num_days_from_sunday() as i64;
    let first_of_month = NaiveDate::from_ymd_opt(year, month, 1).expect("premier du mois");
    let first_weekday = first_of_month.weekday().num_days_from_sunday() as i64;
    let days_to_add = (weekday - first_weekday + 7) % 7;
    let week_of_month = i64::from(date.day().div_ceil(7));
    // new Date(année, mois, jour) déborde sur le mois suivant si besoin
    let target = first_of_month + Days::days(days_to_add + (week_of_month - 1) * 7);
    if target.month() != month {
        target - Days::days(7)
    } else {
        target
    }
}

/// Météo d'un jour : ligne en cache, ou réponse de l'API (InsertWeatherData)
/// quand elle n'a pas pu être enregistrée ; None = valeur undefined (clé omise)
type WeatherRecord = Vec<(String, Option<Value>)>;

fn record_of(row: WeatherDataRow) -> WeatherRecord {
    match serde_json::to_value(row) {
        Ok(Value::Object(fields)) => fields
            .into_iter()
            .map(|(key, value)| (key, Some(value)))
            .collect(),
        _ => Vec::new(),
    }
}

/// TypeError de convertApiDataToWeatherData sur une réponse inattendue
#[derive(Debug, PartialEq)]
struct TypeError;

/// valeur[clé] en JavaScript (undefined sur une valeur qui n'est pas un objet)
fn property<'a>(value: &'a Value, key: &str) -> Option<&'a Value> {
    value.as_object().and_then(|fields| fields.get(key))
}

/// convertApiDataToWeatherData : premier jour de la réponse, conditions traduites
fn convert_api_data(
    api: &Value,
    location: &str,
    is_current_year: bool,
) -> Result<Option<WeatherRecord>, TypeError> {
    let Some(days) = property(api, "days").filter(|days| truthy(days)) else {
        return Ok(None);
    };
    // days.length === 0 ; puis days[0]
    let today = match days {
        Value::Array(items) if items.is_empty() => return Ok(None),
        Value::Array(items) => items.first(),
        Value::Object(fields) => {
            if fields.get("length").and_then(Value::as_f64) == Some(0.0) {
                return Ok(None);
            }
            fields.get("0")
        }
        // Chaîne : days[0] est un caractère, sans propriété tempmax
        _ => None,
    };
    let Some(today @ Value::Object(_)) = today else {
        return Err(TypeError);
    };
    let text = |key: &str| match property(today, key) {
        None | Some(Value::Null) => Err(TypeError),
        Some(value) => Ok(string_of(value)),
    };
    let temp_max = text("tempmax")?;
    let temp_min = text("tempmin")?;
    let Some(Value::String(conditions)) = property(today, "conditions") else {
        return Err(TypeError);
    };
    Ok(Some(vec![
        ("date".into(), property(today, "datetime").cloned()),
        ("location".into(), Some(json!(location))),
        ("tempMax".into(), Some(json!(temp_max))),
        ("tempMin".into(), Some(json!(temp_min))),
        ("icon".into(), property(today, "icon").cloned()),
        ("conditions".into(), Some(json!(translate_condition(conditions)))),
        ("isCurrentYear".into(), Some(json!(is_current_year))),
    ]))
}

/// Forme renvoyée : la météo du jour, l'icône en émoji, les températures en nombres
fn displayed(record: &WeatherRecord) -> Value {
    let field = |key: &str| {
        record
            .iter()
            .find(|(name, _)| name == key)
            .and_then(|(_, value)| value.as_ref())
    };
    let temperature = |key: &str| {
        let text = field(key).map(string_of).unwrap_or_else(|| "undefined".into());
        js::number_value(js::parse_float(&text))
    };
    let mut out = Map::new();
    for (key, value) in record {
        let value = if key == "icon" {
            weather_icon(value.as_ref())
        } else {
            value.clone()
        };
        if let Some(value) = value {
            out.insert(key.clone(), value);
        }
    }
    out.insert("maxTemperature".into(), temperature("tempMax"));
    out.insert("minTemperature".into(), temperature("tempMin"));
    if let Some(conditions) = field("conditions") {
        out.insert("condition".into(), conditions.clone());
    }
    Value::Object(out)
}

/// storage.getWeatherData : ligne du jour en cache (sans tri, comme Node)
async fn cached(
    db: &PgPool,
    date: &str,
    is_current_year: bool,
) -> Result<Option<WeatherRecord>, sqlx::Error> {
    let row: Option<WeatherDataRow> = sqlx::query_as(&WeatherDataRow::select(
        "WHERE (date = $1::date AND is_current_year = $2) LIMIT 1",
    ))
    .bind(date)
    .bind(is_current_year)
    .persistent(false)
    .fetch_optional(db)
    .await?;
    Ok(row.map(record_of))
}

/// storage.getNearestWeatherData : ligne en cache la plus proche, à 7 jours près
async fn nearest(
    db: &PgPool,
    date: &str,
    is_current_year: bool,
) -> Result<Option<WeatherRecord>, sqlx::Error> {
    let row: Option<WeatherDataRow> = sqlx::query_as(&WeatherDataRow::select(
        "WHERE (is_current_year = $1 AND ABS(date - $2::date) <= $3)
         ORDER BY ABS(date - $4::date) LIMIT 1",
    ))
    .bind(is_current_year)
    .bind(date)
    .bind(7_i32)
    .bind(date)
    .persistent(false)
    .fetch_optional(db)
    .await?;
    Ok(row.map(record_of))
}

/// storage.createWeatherData : valeurs envoyées comme node-pg, undefined → défaut
async fn save(db: &PgPool, record: &WeatherRecord) -> Result<WeatherRecord, sqlx::Error> {
    let mut arguments = PgArguments::default();
    let mut columns = Vec::new();
    let mut placeholders = Vec::new();
    for (key, value) in record {
        let (Some(value), Some(col)) = (value, WeatherDataRow::field(key)) else {
            continue;
        };
        arguments.add(node_pg_text(value)).map_err(sqlx::Error::Encode)?;
        columns.push(format!("\"{}\"", col.column));
        placeholders.push(format!("${}::{}", columns.len(), col.sql_type));
    }
    let sql = format!(
        "INSERT INTO weather_data ({}) VALUES ({}) RETURNING {}",
        columns.join(", "),
        placeholders.join(", "),
        WeatherDataRow::COLUMNS
    );
    let row: WeatherDataRow = sqlx::query_as_with(&sql, arguments).fetch_one(db).await?;
    Ok(record_of(row))
}

/// Météo absente du cache : appel à l'API, puis enregistrement ; si
/// l'enregistrement échoue, la ligne en cache, à défaut la réponse de l'API
async fn fetch_and_save(
    db: &PgPool,
    url: &str,
    location: &str,
    date: &str,
    is_current_year: bool,
) -> Result<Option<WeatherRecord>, AppError> {
    const FAILED: &str = "Failed to fetch weather data";
    let Some(api) = fetch_timeline(url).await.filter(truthy) else {
        return Ok(None);
    };
    let Some(record) =
        convert_api_data(&api, location, is_current_year).map_err(|_| AppError::internal(FAILED))?
    else {
        return Ok(None);
    };
    match save(db, &record).await {
        Ok(saved) => Ok(Some(saved)),
        Err(error) => {
            tracing::warn!(%error, "météo : enregistrement impossible");
            let existing = cached(db, date, is_current_year).await.or_500(FAILED)?;
            Ok(Some(existing.unwrap_or(record)))
        }
    }
}

async fn current(State(state): State<AppState>, _user: CurrentUser) -> ApiResult {
    const FAILED: &str = "Failed to fetch weather data";
    let db = &state.db;
    let settings = weather_settings(db)
        .await
        .or_500(FAILED)?
        .filter(|settings| settings.is_active)
        .ok_or_else(|| AppError::not_found("Weather service not configured or disabled"))?;

    let today = crate::clock::today();
    let today_text = today.format("%Y-%m-%d").to_string();
    let previous_text = previous_year_date(today).format("%Y-%m-%d").to_string();
    // Lectures du cache en parallèle (Promise.all)
    let (current_year, previous_year) =
        tokio::join!(cached(db, &today_text, true), cached(db, &previous_text, false));
    let (mut current_year, mut previous_year) = (current_year.or_500(FAILED)?, previous_year.or_500(FAILED)?);

    // Appels à l'API l'un après l'autre (limite de requêtes simultanées de Visual Crossing)
    if current_year.is_none() {
        let url = timeline_url(&settings.location, None, &settings.api_key, true);
        current_year = fetch_and_save(db, &url, &settings.location, &today_text, true).await?;
    }
    if previous_year.is_none() {
        let url = timeline_url(&settings.location, Some(&previous_text), &settings.api_key, true);
        previous_year = fetch_and_save(db, &url, &settings.location, &previous_text, false).await?;
    }
    // Replis : ligne de l'an dernier la plus proche, puis météo relevée l'an dernier
    if previous_year.is_none() {
        previous_year = nearest(db, &previous_text, false).await.or_500(FAILED)?;
    }
    if previous_year.is_none() {
        previous_year = nearest(db, &previous_text, true).await.or_500(FAILED)?;
    }

    Ok(Json(json!({
        "currentYear": current_year.as_ref().map(displayed),
        "previousYear": previous_year.as_ref().map(displayed),
        "location": settings.location,
    }))
    .into_response())
}

async fn geolocation(
    State(state): State<AppState>,
    _user: CurrentUser,
    JsonBody(body): JsonBody,
) -> ApiResult {
    const FAILED: &str = "Erreur lors de la géolocalisation";
    let given = |key: &str| body.get(key).filter(|value| truthy(value));
    let (Some(latitude), Some(longitude)) = (given("latitude"), given("longitude")) else {
        return Err(AppError::bad_request("Latitude et longitude requises"));
    };
    let settings = weather_settings(&state.db)
        .await
        .or_500(FAILED)?
        .filter(|settings| !settings.api_key.is_empty())
        .ok_or_else(|| AppError::internal("Configuration météo manquante"))?;
    let latitude = js::parse_float(&string_of(latitude));
    let longitude = js::parse_float(&string_of(longitude));
    let (city, country, full_location) = city_from_coordinates(latitude, longitude)
        .await
        .ok_or_else(|| AppError::internal("Impossible de déterminer la ville à partir des coordonnées"))?;

    let mut data = Map::new();
    data.insert("location".into(), json!(full_location));
    db::update_by_id::<WeatherSettingsRow>(&state.db, settings.id, &data, true)
        .await
        .or_500(FAILED)?;
    // La ville a changé : le cache météo est vidé
    sqlx::query("DELETE FROM weather_data")
        .execute(&state.db)
        .await
        .or_500(FAILED)?;
    tracing::info!(from = %settings.location, to = %full_location, "localisation météo mise à jour");
    Ok(Json(json!({
        "success": true,
        "location": { "city": city, "country": country, "fullLocation": full_location },
        "message": format!("Localisation mise à jour vers {full_location}"),
    }))
    .into_response())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn day(text: &str) -> NaiveDate {
        NaiveDate::parse_from_str(text, "%Y-%m-%d").unwrap()
    }

    #[test]
    fn date_de_l_an_dernier_comme_node() {
        // weatherService.getPreviousYearDate(new Date(`${date}T12:00:00Z`)), TZ=UTC
        for (date, expected) in [
            ("2026-10-15", "2025-10-16"),
            ("2026-10-01", "2025-10-02"),
            ("2026-10-31", "2025-10-25"),
            ("2026-03-29", "2025-03-30"),
            ("2026-03-31", "2025-03-25"),
            ("2026-02-28", "2025-02-22"),
            ("2026-01-01", "2025-01-02"),
            ("2026-12-31", "2025-12-25"),
            ("2025-03-30", "2024-03-31"),
            ("2024-02-29", "2023-02-23"),
            ("2028-02-29", "2027-02-23"),
            ("2026-07-07", "2025-07-01"),
            ("2026-05-31", "2025-05-25"),
            ("2026-08-29", "2025-08-30"),
            ("2026-11-30", "2025-11-24"),
        ] {
            assert_eq!(previous_year_date(day(date)), day(expected), "{date}");
        }
    }

    fn as_json(record: Option<WeatherRecord>) -> Value {
        match record {
            None => Value::Null,
            Some(record) => Value::Object(
                record
                    .into_iter()
                    .filter_map(|(key, value)| value.map(|value| (key, value)))
                    .collect(),
            ),
        }
    }

    #[test]
    fn conversion_de_la_reponse_comme_node() {
        // JSON.stringify(weatherService.convertApiDataToWeatherData(…, "Nancy, France", true))
        let convert = |api: Value| as_json(convert_api_data(&api, "Nancy, France", true).unwrap());
        assert_eq!(
            convert(
                json!({ "days": [{ "datetime": "2026-10-15", "tempmax": 18.3, "tempmin": 7, "icon": "partly-cloudy-day", "conditions": "Partially cloudy" }] })
            ),
            json!({ "date": "2026-10-15", "location": "Nancy, France", "tempMax": "18.3", "tempMin": "7", "icon": "partly-cloudy-day", "conditions": "Nuageux", "isCurrentYear": true })
        );
        assert_eq!(
            convert(
                json!({ "days": [{ "datetime": "2025-10-16", "tempmax": -2.5, "tempmin": -10.25, "icon": "snow", "conditions": "Snow, Heavy" }] })
            ),
            json!({ "date": "2025-10-16", "location": "Nancy, France", "tempMax": "-2.5", "tempMin": "-10.25", "icon": "snow", "conditions": "Neige forte", "isCurrentYear": true })
        );
        assert_eq!(
            convert(
                json!({ "days": [{ "datetime": "2026-01-02", "tempmax": "12", "tempmin": true, "icon": "rain", "conditions": "Rain, Overcast" }] })
            ),
            json!({ "date": "2026-01-02", "location": "Nancy, France", "tempMax": "12", "tempMin": "true", "icon": "rain", "conditions": "Couvert", "isCurrentYear": true })
        );
        assert_eq!(
            convert(
                json!({ "days": [{ "datetime": "2026-01-03", "tempmax": [1, 2], "tempmin": { "a": 1 }, "conditions": "Pluie modérée" }] })
            ),
            json!({ "date": "2026-01-03", "location": "Nancy, France", "tempMax": "1,2", "tempMin": "[object Object]", "conditions": "Pluie modérée", "isCurrentYear": true })
        );
        assert_eq!(
            convert(
                json!({ "days": [{ "tempmax": 0.1, "tempmin": 1e-7, "icon": 5, "conditions": "Light Drizzle" }] })
            ),
            json!({ "location": "Nancy, France", "tempMax": "0.1", "tempMin": "1e-7", "icon": 5, "conditions": "Bruine", "isCurrentYear": true })
        );
        for empty in [
            json!({ "days": [] }),
            json!({ "days": { "length": 0 } }),
            json!({ "nodays": 1 }),
            json!("texte"),
        ] {
            assert_eq!(convert(empty), Value::Null);
        }
        for invalid in [
            json!({ "days": [{ "tempmax": null, "tempmin": 1, "conditions": "x" }] }),
            json!({ "days": [{ "tempmax": 1, "tempmin": 1, "conditions": 3 }] }),
            json!({ "days": [5] }),
            json!({ "days": 5 }),
            json!({ "days": "abc" }),
        ] {
            assert_eq!(convert_api_data(&invalid, "L", false), Err(TypeError));
        }
    }

    #[test]
    fn conditions_traduites_comme_node() {
        let conditions = [
            "Clear",
            "Sunny",
            "Fair",
            "Partially cloudy",
            "Cloudy",
            "Overcast",
            "Rain, Heavy",
            "Light Rain",
            "Rain",
            "Showers",
            "Drizzle",
            "Thunderstorm",
            "Snow, Light",
            "Snow",
            "Fog",
            "Mist",
            "Windy",
            "Pluie modérée",
            "Rain, Partially cloudy",
            "Clear, Snow",
        ];
        let expected = [
            "Dégagé",
            "Ensoleillé",
            "Beau temps",
            "Nuageux",
            "Nuageux",
            "Couvert",
            "Pluie forte",
            "Pluie légère",
            "Pluie",
            "Averses",
            "Bruine",
            "Orage",
            "Neige légère",
            "Neige",
            "Brouillard",
            "Brume",
            "Venteux",
            "Pluie modérée",
            "Nuageux",
            "Dégagé",
        ];
        for (condition, french) in conditions.iter().zip(expected) {
            assert_eq!(translate_condition(condition), french, "{condition}");
        }
    }

    #[test]
    fn icones_comme_node() {
        for (icon, expected) in [
            ("clear-day", json!("☀️")),
            ("clear-night", json!("🌙")),
            ("partly-cloudy-day", json!("⛅")),
            ("partly-cloudy-night", json!("☁️")),
            ("cloudy", json!("☁️")),
            ("rain", json!("🌧️")),
            ("snow", json!("❄️")),
            ("wind", json!("💨")),
            ("fog", json!("🌫️")),
            ("thunder", json!("⛈️")),
            ("hail", json!("🌨️")),
            ("showers-day", json!("🌤️")),
            ("", json!("🌤️")),
            ("__proto__", json!({})),
        ] {
            assert_eq!(weather_icon(Some(&json!(icon))), Some(expected), "{icon}");
        }
        assert_eq!(weather_icon(Some(&json!("constructor"))), None);
        assert_eq!(weather_icon(Some(&json!("toString"))), None);
        assert_eq!(weather_icon(None), Some(json!("🌤️")));
        assert_eq!(weather_icon(Some(&Value::Null)), Some(json!("🌤️")));
    }

    #[test]
    fn affichage_d_une_reponse_non_enregistree() {
        // Réponse de l'API sans date ni icône : clés omises, icône par défaut à sa place
        let record = convert_api_data(
            &json!({ "days": [{ "tempmax": "21.5°", "tempmin": "n/a", "conditions": "Clear" }] }),
            "Metz",
            false,
        )
        .unwrap()
        .unwrap();
        let shown = displayed(&record);
        assert_eq!(
            serde_json::to_string(&shown).unwrap(),
            r#"{"location":"Metz","tempMax":"21.5°","tempMin":"n/a","icon":"🌤️","conditions":"Dégagé","isCurrentYear":false,"maxTemperature":21.5,"minTemperature":null,"condition":"Dégagé"}"#
        );
    }

    #[test]
    fn adresses_des_services() {
        assert_eq!(encode_uri_component("Nancy, France"), "Nancy%2C%20France");
        assert_eq!(encode_uri_component("Épinal (88)!*'~"), "%C3%89pinal%20(88)!*'~");
        assert_eq!(
            timeline_url("Nancy, France", Some("2025-10-16"), "CLE", true),
            "https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/Nancy%2C%20France/2025-10-16?unitGroup=metric&include=days&key=CLE&contentType=json&lang=fr"
        );
        assert!(has_items(&json!([1])) && !has_items(&json!([])) && !has_items(&json!(3)));
    }
}
