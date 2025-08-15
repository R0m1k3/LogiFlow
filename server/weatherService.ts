import { WeatherData, WeatherSettings, InsertWeatherData } from "../shared/schema.js";

export interface WeatherApiResponse {
  days: Array<{
    datetime: string;
    tempmax: number;
    tempmin: number;
    icon: string;
    conditions: string;
  }>;
}

export interface WeatherDisplayData {
  currentYear: WeatherData | null;
  previousYear: WeatherData | null;
}

export class WeatherService {
  private baseUrl = "https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline";

  /**
   * Récupère les données météo actuelles depuis l'API Visual Crossing
   */
  async fetchCurrentWeather(settings: WeatherSettings): Promise<WeatherApiResponse | null> {
    try {
      const url = `${this.baseUrl}/${encodeURIComponent(settings.location)}?unitGroup=metric&include=days&key=${settings.apiKey}&contentType=json&lang=fr`;
      
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`Weather API error: ${response.status} ${response.statusText}`);
        return null;
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Erreur lors de la récupération de la météo actuelle:", error);
      return null;
    }
  }

  /**
   * Récupère les données météo de l'année précédente pour la même date
   */
  async fetchPreviousYearWeather(settings: WeatherSettings, targetDate: string): Promise<WeatherApiResponse | null> {
    try {
      // Pour les données historiques, Visual Crossing utilise la syntaxe: /timeline/location/date
      const url = `${this.baseUrl}/${encodeURIComponent(settings.location)}/${targetDate}?unitGroup=metric&include=days&key=${settings.apiKey}&contentType=json&lang=fr`;
      
      console.log(`🌤️ [FETCH-HISTORY] Requesting: ${settings.location} for ${targetDate}`);
      
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`🌤️ [ERROR] Weather API error for previous year: ${response.status} ${response.statusText}`);
        
        // Pour les données historiques, certains comptes peuvent ne pas avoir accès
        if (response.status === 401) {
          console.warn(`⚠️ [WARNING] Historical data access may not be available with current API key`);
        }
        return null;
      }

      const data = await response.json();
      console.log(`✅ [FETCH-HISTORY] Successfully retrieved data for ${targetDate}`);
      return data;
    } catch (error) {
      console.error("🌤️ [ERROR] Erreur lors de la récupération de la météo de l'année précédente:", error);
      return null;
    }
  }

  /**
   * Convertit les données de l'API en format WeatherData
   */
  convertApiDataToWeatherData(apiData: WeatherApiResponse, location: string, isCurrentYear: boolean): InsertWeatherData | null {
    if (!apiData.days || apiData.days.length === 0) {
      return null;
    }

    const todayData = apiData.days[0];
    
    return {
      // Pas d'ID - sera auto-généré par PostgreSQL serial
      date: todayData.datetime,
      location,
      tempMax: todayData.tempmax.toString(),
      tempMin: todayData.tempmin.toString(),
      icon: todayData.icon,
      conditions: todayData.conditions,
      isCurrentYear
      // Pas de createdAt/updatedAt - gérés par la base de données
    };
  }

  /**
   * Calcule la date de l'année précédente pour la même date
   */
  getPreviousYearDate(date: Date = new Date()): string {
    const previousYear = new Date(date);
    previousYear.setFullYear(date.getFullYear() - 1);
    return previousYear.toISOString().split('T')[0]; // Format YYYY-MM-DD
  }

  /**
   * Convertit l'icône météo en format d'affichage
   */
  getWeatherIcon(iconCode: string): string {
    const iconMap: { [key: string]: string } = {
      'clear-day': '☀️',
      'clear-night': '🌙',
      'partly-cloudy-day': '⛅',
      'partly-cloudy-night': '☁️',
      'cloudy': '☁️',
      'rain': '🌧️',
      'snow': '❄️',
      'wind': '💨',
      'fog': '🌫️',
      'thunder': '⛈️',
      'hail': '🌨️'
    };

    return iconMap[iconCode] || '🌤️';
  }

  /**
   * Valide les paramètres de configuration météo
   */
  validateWeatherSettings(settings: Partial<WeatherSettings>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!settings.apiKey || settings.apiKey.trim().length === 0) {
      errors.push("La clé API Visual Crossing est requise");
    }

    if (!settings.location || settings.location.trim().length === 0) {
      errors.push("La localisation est requise");
    }

    // Vérification basique du format de la clé API Visual Crossing
    if (settings.apiKey && settings.apiKey.length < 10) {
      errors.push("La clé API semble invalide (trop courte)");
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Test de connexion à l'API météo
   */
  async testApiConnection(apiKey: string, location: string): Promise<{ success: boolean; message: string }> {
    try {
      const testUrl = `${this.baseUrl}/${encodeURIComponent(location)}?unitGroup=metric&include=days&key=${apiKey}&contentType=json`;
      
      const response = await fetch(testUrl);
      
      if (response.ok) {
        const data = await response.json();
        if (data.days && data.days.length > 0) {
          return { success: true, message: "Connexion réussie à l'API météo" };
        } else {
          return { success: false, message: "Aucune donnée météo trouvée pour cette localisation" };
        }
      } else if (response.status === 401) {
        return { success: false, message: "Clé API invalide" };
      } else if (response.status === 404) {
        return { success: false, message: "Localisation introuvable" };
      } else {
        return { success: false, message: `Erreur API: ${response.status} ${response.statusText}` };
      }
    } catch (error) {
      console.error("Erreur test API météo:", error);
      return { success: false, message: "Erreur de connexion à l'API météo" };
    }
  }
}

export const weatherService = new WeatherService();