// Lot 2 : Informations (annonces), Publicités, Météo, Statistiques et
// Statistiques détaillées. Paramètres repris des appels de client/src
// (AnnouncementCard, Calendar, Publicities, Dashboard, StatsPanel, Groups,
// Suppliers, Analytics, WeatherWidget, WeatherSettings).
// Les appels réels à Visual Crossing et Nominatim ne sont jamais déclenchés :
// la météo du jour vient du cache (seeds/lot2.ts), et les cas de test de
// connexion et de géolocalisation s'arrêtent avant l'appel externe.
import type { ReadCase, WriteScenario } from "../types";

const YEAR = new Date().getUTCFullYear();
const PERIOD = "startDate={{today-30}}T00:00:00.000Z&endDate={{today}}T23:59:59.999Z";
const YEAR_PERIOD = "startDate={{year}}-01-01T00:00:00.000Z&endDate={{year}}-12-31T23:59:59.999Z";

const announcementReads: ReadCase[] = [
  { module: "announcements", path: "/api/announcements" },
  { module: "announcements", path: "/api/announcements?storeId=1" },
  { module: "announcements", path: "/api/announcements?storeId=3" },
  // Magasin illisible : erreur SQL, repli de Node sur toutes les informations
  { module: "announcements", path: "/api/announcements?storeId=abc" },
];

const publicityReads: ReadCase[] = [
  { module: "publicities", path: "/api/ad-campaigns" },
  { module: "publicities", path: "/api/ad-campaigns?year={{year}}" },
  { module: "publicities", path: "/api/ad-campaigns?year={{year}}&storeId=1" },
  { module: "publicities", path: "/api/ad-campaigns?year={{year}}&storeId=2" },
  { module: "publicities", path: "/api/ad-campaigns?year={{year-1}}" },
  { module: "publicities", path: "/api/ad-campaigns?year={{year+1}}" },
  { module: "publicities", path: "/api/ad-campaigns?storeId=3" },
  { module: "publicities", path: "/api/ad-campaigns?year=abc" },
  { module: "publicities", path: "/api/ad-campaigns?year=99999999999" },
  { module: "publicities", path: "/api/ad-campaigns/1" },
  { module: "publicities", path: "/api/ad-campaigns/3" },
  { module: "publicities", path: "/api/ad-campaigns/200" },
  { module: "publicities", path: "/api/ad-campaigns/202" },
  { module: "publicities", path: "/api/ad-campaigns/999" },
  { module: "publicities", path: "/api/ad-campaigns/abc" },
  { module: "publicities", path: "/api/ad-campaigns/debug" },
  { module: "publicities", path: "/api/ad-campaigns/debug?year={{year}}&storeId=1" },
  { module: "publicities", path: "/api/ad-campaigns/debug?year=99999999999" },
];

const weatherReads: ReadCase[] = [
  { module: "weather", path: "/api/weather/settings" },
  { module: "weather", path: "/api/weather/current" },
];

const statsReads: ReadCase[] = [
  { module: "stats", path: "/api/stats/by-group" },
  { module: "stats", path: "/api/stats/by-group?storeId=1" },
  { module: "stats", path: "/api/stats/by-group?storeId=2" },
  { module: "stats", path: "/api/stats/by-group?storeId=abc" },
  { module: "stats", path: "/api/stats/by-supplier" },
  { module: "stats", path: "/api/stats/by-supplier?storeId=1" },
  { module: "stats", path: "/api/stats/by-supplier?storeId=3" },
  { module: "stats", path: "/api/stats/by-supplier?storeId=abc" },
  { module: "stats", path: "/api/stats/monthly" },
  { module: "stats", path: "/api/stats/monthly?year={{year}}&month={{month}}" },
  { module: "stats", path: "/api/stats/monthly?year={{year}}&month={{month}}&storeId=1" },
  { module: "stats", path: "/api/stats/monthly?year={{year}}&month={{month}}&storeId=2" },
  { module: "stats", path: "/api/stats/monthly?year={{year}}&month={{month}}&storeId=abc" },
  { module: "stats", path: "/api/stats/monthly?year={{year-1}}&month={{month}}" },
  { module: "stats", path: "/api/stats/monthly?year={{year}}&month=12" },
  { module: "stats", path: "/api/stats/monthly?year={{year}}&month=13" },
  { module: "stats", path: "/api/stats/monthly?year=abc&month=3" },
  { module: "stats", path: "/api/stats/yearly" },
  { module: "stats", path: "/api/stats/yearly?year={{year}}" },
  { module: "stats", path: "/api/stats/yearly?year={{year}}&storeId=1" },
  { module: "stats", path: "/api/stats/yearly?year={{year}}&storeId=3" },
  { module: "stats", path: "/api/stats/yearly?year={{year-1}}" },
  { module: "stats", path: "/api/stats/yearly?year=abc" },
];

const analyticsReads: ReadCase[] = [
  { module: "analytics", path: "/api/analytics/summary" },
  { module: "analytics", path: `/api/analytics/summary?${PERIOD}` },
  { module: "analytics", path: `/api/analytics/summary?${YEAR_PERIOD}&supplierIds=1,2&groupIds=1` },
  { module: "analytics", path: `/api/analytics/summary?${PERIOD}&groupIds=2` },
  { module: "analytics", path: `/api/analytics/summary?${PERIOD}&status=delivered` },
  { module: "analytics", path: "/api/analytics/summary?startDate={{today+500}}T00:00:00.000Z" },
  { module: "analytics", path: "/api/analytics/summary?supplierIds=abc" },
  { module: "analytics", path: "/api/analytics/summary?groupIds=1.5" },
  { module: "analytics", path: "/api/analytics/summary?startDate=pas-une-date" },
  { module: "analytics", path: `/api/analytics/timeseries?${PERIOD}&granularity=day` },
  { module: "analytics", path: `/api/analytics/timeseries?${YEAR_PERIOD}&granularity=week` },
  { module: "analytics", path: `/api/analytics/timeseries?${YEAR_PERIOD}&granularity=month&groupIds=1,2` },
  { module: "analytics", path: "/api/analytics/timeseries" },
  { module: "analytics", path: "/api/analytics/timeseries?granularity=autre&supplierIds=1,4" },
  { module: "analytics", path: "/api/analytics/timeseries?supplierIds=1.5,2" },
  { module: "analytics", path: "/api/analytics/timeseries?supplierIds=abc" },
  { module: "analytics", path: "/api/analytics/timeseries?endDate=pas-une-date" },
  { module: "analytics", path: "/api/analytics/by-supplier" },
  { module: "analytics", path: `/api/analytics/by-supplier?${PERIOD}` },
  { module: "analytics", path: `/api/analytics/by-supplier?${YEAR_PERIOD}&groupIds=1,3` },
  { module: "analytics", path: "/api/analytics/by-supplier?groupIds=abc" },
  { module: "analytics", path: "/api/analytics/by-store" },
  { module: "analytics", path: `/api/analytics/by-store?${PERIOD}&supplierIds=1,2` },
  { module: "analytics", path: "/api/analytics/by-store?supplierIds=abc" },
  { module: "analytics", path: "/api/analytics/by-store?startDate=pas-une-date" },
  { module: "analytics", path: `/api/analytics/export?${PERIOD}&type=summary` },
  { module: "analytics", path: "/api/analytics/export" },
  { module: "analytics", path: `/api/analytics/export?${YEAR_PERIOD}&type=timeseries` },
  { module: "analytics", path: `/api/analytics/export?${PERIOD}&groupIds=1&type=suppliers` },
  { module: "analytics", path: "/api/analytics/export?type=stores&supplierIds=2" },
  { module: "analytics", path: "/api/analytics/export?type=inconnu" },
  { module: "analytics", path: "/api/analytics/export?type=timeseries&startDate={{today+500}}T00:00:00.000Z" },
  { module: "analytics", path: "/api/analytics/export?type=stores&supplierIds=abc" },
  { module: "analytics", path: "/api/analytics/export?type=suppliers&groupIds=abc" },
  { module: "analytics", path: "/api/analytics/export?type=r%C3%A9sum%C3%A9" },
  { module: "analytics", path: "/api/analytics/export?type=%E2%82%AC" },
];

export const reads: ReadCase[] = [
  ...announcementReads,
  ...publicityReads,
  ...weatherReads,
  ...statsReads,
  ...analyticsReads,
];

const announcementWrites: WriteScenario[] = [
  {
    module: "announcements",
    name: "créer, modifier, supprimer une information",
    steps: [
      { method: "POST", path: "/api/announcements", body: { title: "Inventaire tournant", content: "Rayon frais lundi", type: "warning" } },
      { method: "POST", path: "/api/announcements", body: { title: "Livraison décalée", content: "Camion attendu à 14 h", storeId: 1 } },
      { method: "POST", path: "/api/announcements", body: { title: "Autre magasin", content: "Pour Metz", type: "", storeId: 2, createdBy: "pirate" } },
      { method: "PUT", path: "/api/announcements/{{0.id}}", body: { title: "Inventaire reporté", type: "error", storeId: null } },
      { method: "PUT", path: "/api/announcements/202", body: { content: "Réunion déplacée", storeId: 3 } },
      { method: "DELETE", path: "/api/announcements/{{1.id}}" },
      { method: "DELETE", path: "/api/announcements/3" },
      { method: "GET", path: "/api/announcements" },
    ],
    tables: ["dashboard_messages"],
  },
  {
    module: "announcements",
    name: "information invalide ou introuvable",
    steps: [
      { method: "POST", path: "/api/announcements", body: {} },
      { method: "POST", path: "/api/announcements", body: { title: "x".repeat(300), content: 5 } },
      { method: "POST", path: "/api/announcements", body: { title: "Type inconnu", content: "Refusé par la base", type: "urgent" } },
      { method: "POST", path: "/api/announcements", body: { title: "Magasin inconnu", content: "Clé étrangère", storeId: 999 } },
      { method: "POST", path: "/api/announcements", body: { title: "Magasin en texte", content: "Refusé", storeId: "1" } },
      { method: "PUT", path: "/api/announcements/999", body: { title: "Introuvable" } },
      { method: "PUT", path: "/api/announcements/abc", body: { title: "Illisible" } },
      { method: "PUT", path: "/api/announcements/1", body: {} },
      { method: "PUT", path: "/api/announcements/1", body: { type: 5, storeId: "2" } },
      { method: "PUT", path: "/api/announcements/1", body: { type: "urgent" } },
      { method: "DELETE", path: "/api/announcements/999" },
      { method: "DELETE", path: "/api/announcements/abc" },
    ],
    tables: ["dashboard_messages"],
  },
];

const publicityWrites: WriteScenario[] = [
  {
    module: "publicities",
    name: "créer, modifier, supprimer une publicité",
    steps: [
      {
        method: "POST", path: "/api/ad-campaigns",
        body: { pubNumber: "PUB-50", designation: "Fête des jardins", startDate: "{{today+40}}", endDate: "{{today+50}}", year: YEAR, participatingGroups: [1, 2] },
      },
      { method: "PUT", path: "/api/ad-campaigns/{{0.id}}", body: { designation: "Fête des jardins (prolongée)", endDate: "{{today+55}}", participatingGroups: [3] } },
      { method: "PUT", path: "/api/ad-campaigns/1", body: { pubNumber: "PUB-01", year: String(YEAR), participatingGroups: [] } },
      { method: "PUT", path: "/api/ad-campaigns/2", body: { designation: ["Spécial", "jardin"], createdBy: "bench_manager", inconnu: 1 } },
      { method: "PUT", path: "/api/ad-campaigns/202", body: { participatingGroups: 5 } },
      { method: "GET", path: "/api/ad-campaigns/{{0.id}}" },
      { method: "POST", path: "/api/ad-campaigns/{{0.id}}/delete", body: {} },
      { method: "DELETE", path: "/api/ad-campaigns/3" },
      { method: "GET", path: "/api/ad-campaigns?year={{year}}" },
    ],
    tables: ["publicities", "publicity_participations"],
  },
  {
    module: "publicities",
    name: "publicité invalide, en double ou introuvable",
    steps: [
      { method: "POST", path: "/api/ad-campaigns", body: {} },
      { method: "POST", path: "/api/ad-campaigns", body: { pubNumber: "PUB-01", designation: "Doublon", startDate: "{{today}}", endDate: "{{today+7}}", year: YEAR } },
      { method: "POST", path: "/api/ad-campaigns", body: { pubNumber: "PUB-60", designation: "Magasin inconnu", startDate: "{{today}}", endDate: "{{today+7}}", year: YEAR, participatingGroups: [1, 999] } },
      { method: "POST", path: "/api/ad-campaigns", body: { pubNumber: "PUB-61", designation: "Groupes en texte", startDate: "{{today}}", endDate: "{{today+7}}", year: YEAR, participatingGroups: "12" } },
      { method: "POST", path: "/api/ad-campaigns", body: { pubNumber: "PUB-62", designation: "Date illisible", startDate: "bientôt", endDate: "{{today+7}}", year: YEAR } },
      { method: "PUT", path: "/api/ad-campaigns/1", body: { startDate: "pas une date" } },
      { method: "PUT", path: "/api/ad-campaigns/1", body: { createdAt: "2020-01-01" } },
      { method: "PUT", path: "/api/ad-campaigns/1", body: { pubNumber: "PUB-02" } },
      { method: "PUT", path: "/api/ad-campaigns/1", body: { year: 2030.5 } },
      { method: "PUT", path: "/api/ad-campaigns/1", body: { designation: null } },
      { method: "PUT", path: "/api/ad-campaigns/2", body: { participatingGroups: null } },
      { method: "PUT", path: "/api/ad-campaigns/200", body: { participatingGroups: [2, 2] } },
      { method: "PUT", path: "/api/ad-campaigns/999", body: { designation: "Introuvable" } },
      { method: "PUT", path: "/api/ad-campaigns/998", body: { participatingGroups: [1] } },
      { method: "PUT", path: "/api/ad-campaigns/abc", body: { designation: "Illisible" } },
      { method: "PUT", path: "/api/ad-campaigns/201", body: {} },
      { method: "DELETE", path: "/api/ad-campaigns/999" },
      { method: "DELETE", path: "/api/ad-campaigns/abc" },
      { method: "POST", path: "/api/ad-campaigns/99999999999/delete", body: {} },
    ],
    tables: ["publicities", "publicity_participations"],
  },
];

const weatherWrites: WriteScenario[] = [
  {
    module: "weather",
    name: "configurer la météo",
    steps: [
      { method: "PUT", path: "/api/weather/settings/1", body: { location: "Metz, France", isActive: true, apiKey: "cle-meteo-modifiee" } },
      { method: "GET", path: "/api/weather/current" },
      { method: "POST", path: "/api/weather/settings", body: { apiKey: "seconde-cle-meteo", location: "Épinal, France" } },
      { method: "GET", path: "/api/weather/settings" },
      { method: "PUT", path: "/api/weather/settings/999", body: { location: "Introuvable" } },
      { method: "PUT", path: "/api/weather/settings/1", body: {} },
      { method: "PUT", path: "/api/weather/settings/1", body: { isActive: false } },
      { method: "GET", path: "/api/weather/current" },
    ],
    tables: ["weather_settings", "weather_data"],
  },
  {
    module: "weather",
    name: "configuration météo invalide",
    steps: [
      { method: "POST", path: "/api/weather/settings", body: {} },
      { method: "POST", path: "/api/weather/settings", body: { apiKey: 5, isActive: "oui" } },
      { method: "PUT", path: "/api/weather/settings/1", body: { isActive: "oui" } },
      { method: "PUT", path: "/api/weather/settings/abc", body: { location: "Illisible" } },
      { method: "PUT", path: "/api/weather/settings/abc", body: { location: 12 } },
    ],
    tables: ["weather_settings"],
  },
  {
    // Corps incomplets : refusés avant tout appel à Visual Crossing ou Nominatim
    module: "weather",
    name: "test de connexion et géolocalisation incomplets",
    steps: [
      { method: "POST", path: "/api/weather/test-connection", body: {} },
      { method: "POST", path: "/api/weather/test-connection", body: { apiKey: "cle-de-test-meteo" } },
      { method: "POST", path: "/api/weather/test-connection", body: { apiKey: "", location: "Nancy, France" } },
      { method: "POST", path: "/api/weather/geolocation", body: {} },
      { method: "POST", path: "/api/weather/geolocation", body: { latitude: 0, longitude: 6.18 } },
      { method: "POST", path: "/api/weather/geolocation", body: { latitude: 48.69 } },
      { method: "POST", path: "/api/weather/geolocation", body: { latitude: "", longitude: "6.18" } },
    ],
    tables: ["weather_settings", "weather_data"],
  },
];

export const writes: WriteScenario[] = [...announcementWrites, ...publicityWrites, ...weatherWrites];
