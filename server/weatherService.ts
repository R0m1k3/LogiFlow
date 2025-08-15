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
   * Traduit les conditions météo en français
   */
  private translateConditionToFrench(condition: string): string {
    const conditionLower = condition.toLowerCase();
    
    // Traductions anglais -> français
    if (conditionLower.includes('clear')) return 'Dégagé';
    if (conditionLower.includes('sunny')) return 'Ensoleillé';
    if (conditionLower.includes('fair')) return 'Beau temps';
    if (conditionLower.includes('partly cloudy')) return 'Partiellement nuageux';
    if (conditionLower.includes('cloudy')) return 'Nuageux';
    if (conditionLower.includes('overcast')) return 'Couvert';
    if (conditionLower.includes('rain')) {
      if (conditionLower.includes('heavy')) return 'Pluie forte';
      if (conditionLower.includes('light')) return 'Pluie légère';
      return 'Pluie';
    }
    if (conditionLower.includes('shower')) return 'Averses';
    if (conditionLower.includes('drizzle')) return 'Bruine';
    if (conditionLower.includes('thunderstorm') || conditionLower.includes('thunder')) return 'Orage';
    if (conditionLower.includes('snow')) {
      if (conditionLower.includes('heavy')) return 'Neige forte';
      if (conditionLower.includes('light')) return 'Neige légère';
      return 'Neige';
    }
    if (conditionLower.includes('fog')) return 'Brouillard';
    if (conditionLower.includes('mist')) return 'Brume';
    if (conditionLower.includes('wind')) return 'Venteux';
    
    // Si déjà en français, retourner tel quel
    return condition;
  }

  /**
   * Convertit les données de l'API en format WeatherData avec traduction française forcée
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
      conditions: this.translateConditionToFrench(todayData.conditions), // Traduction forcée
      isCurrentYear
      // Pas de createdAt/updatedAt - gérés par la base de données
    };
  }

  /**
   * Calcule la date de l'année précédente pour le même jour de la semaine
   */
  getPreviousYearDate(date: Date = new Date()): string {
    const currentYear = date.getFullYear();
    const currentMonth = date.getMonth();
    const currentDayOfWeek = date.getDay(); // 0 = dimanche, 1 = lundi, etc.
    
    // Créer une date pour l'année précédente, même mois
    const previousYear = new Date(currentYear - 1, currentMonth, 1);
    
    // Trouver le premier jour de la semaine correspondant dans ce mois
    const firstDayOfMonth = previousYear.getDay();
    const daysToAdd = (currentDayOfWeek - firstDayOfMonth + 7) % 7;
    
    // Calculer quelle semaine nous sommes dans le mois actuel
    const currentDate = date.getDate();
    const currentWeekOfMonth = Math.ceil(currentDate / 7);
    
    // Aller à la même semaine du mois l'année précédente
    const targetDate = new Date(currentYear - 1, currentMonth, 1 + daysToAdd + (currentWeekOfMonth - 1) * 7);
    
    // Si la date calculée dépasse le mois, prendre la dernière occurrence de ce jour dans le mois
    if (targetDate.getMonth() !== currentMonth) {
      // Revenir en arrière d'une semaine
      targetDate.setDate(targetDate.getDate() - 7);
    }
    
    console.log(`🗓️ [DATE-CALC] Aujourd'hui: ${date.toISOString().split('T')[0]} (${this.getDayName(currentDayOfWeek)})`);
    console.log(`🗓️ [DATE-CALC] Année précédente: ${targetDate.toISOString().split('T')[0]} (${this.getDayName(targetDate.getDay())})`);
    
    return targetDate.toISOString().split('T')[0]; // Format YYYY-MM-DD
  }

  /**
   * Retourne le nom du jour de la semaine
   */
  private getDayName(dayOfWeek: number): string {
    const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    return days[dayOfWeek];
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