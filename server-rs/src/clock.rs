// Date et heure du jour à Paris (décision R5) : les magasins sont en France, et
// l'ancien serveur Node, qui comptait en UTC, rendait la date de la veille entre
// minuit et 1 h (2 h l'été). Les instants enregistrés en base restent en UTC ;
// seul « aujourd'hui » (et ce qui s'en déduit : année, mois, heure de la
// sauvegarde automatique) se calcule ici.

use chrono::{DateTime, NaiveDate, NaiveDateTime, TimeZone, Utc};
use chrono_tz::{Europe::Paris, Tz};

/// Instant présent, à l'heure de Paris
pub fn now() -> DateTime<Tz> {
    Utc::now().with_timezone(&Paris)
}

/// Date du jour à Paris
pub fn today() -> NaiveDate {
    now().date_naive()
}

/// Date à Paris d'un instant enregistré en UTC (colonne timestamp sans fuseau)
pub fn paris_date(utc: NaiveDateTime) -> NaiveDate {
    Utc.from_utc_datetime(&utc).with_timezone(&Paris).date_naive()
}

/// Instant UTC (sans fuseau, comme les colonnes) du début d'un jour de Paris
pub fn start_of_day_utc(day: NaiveDate) -> NaiveDateTime {
    let midnight = day.and_hms_opt(0, 0, 0).expect("minuit existe");
    // Minuit existe toujours à Paris (les changements d'heure ont lieu à 2 h et 3 h)
    Paris
        .from_local_datetime(&midnight)
        .earliest()
        .map(|local| local.naive_utc())
        .unwrap_or(midnight)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn utc(text: &str) -> NaiveDateTime {
        NaiveDateTime::parse_from_str(text, "%Y-%m-%d %H:%M:%S").unwrap()
    }

    #[test]
    fn date_de_paris() {
        // Été (UTC+2) : 23 h 30 UTC, c'est déjà le lendemain à Paris
        assert_eq!(
            paris_date(utc("2026-07-14 23:30:00")),
            NaiveDate::from_ymd_opt(2026, 7, 15).unwrap()
        );
        // Hiver (UTC+1)
        assert_eq!(
            paris_date(utc("2026-12-31 22:59:59")),
            NaiveDate::from_ymd_opt(2026, 12, 31).unwrap()
        );
        assert_eq!(
            paris_date(utc("2026-12-31 23:00:00")),
            NaiveDate::from_ymd_opt(2027, 1, 1).unwrap()
        );
    }

    #[test]
    fn debut_du_jour_en_utc() {
        let day = NaiveDate::from_ymd_opt(2027, 1, 1).unwrap();
        assert_eq!(start_of_day_utc(day), utc("2026-12-31 23:00:00"));
        let day = NaiveDate::from_ymd_opt(2026, 7, 15).unwrap();
        assert_eq!(start_of_day_utc(day), utc("2026-07-14 22:00:00"));
    }
}
