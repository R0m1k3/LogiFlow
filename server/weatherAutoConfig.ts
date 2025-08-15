/**
 * Auto-configuration du système météo pour la production
 * Configure automatiquement les paramètres météo avec la clé API des variables d'environnement
 */

import { storage } from "./storage.js";
import { weatherService } from "./weatherService.js";

export async function initializeWeatherConfig() {
  try {
    console.log('🌤️ [AUTO-CONFIG] Initializing weather configuration...');
    
    // Vérifier si la configuration météo existe déjà
    const existingSettings = await storage.getWeatherSettings();
    
    if (existingSettings && existingSettings.isActive) {
      console.log('✅ [AUTO-CONFIG] Weather settings already configured and active');
      return;
    }
    
    // Récupérer la clé API depuis les variables d'environnement
    const apiKey = process.env.VISUAL_CROSSING_API_KEY;
    
    if (!apiKey) {
      console.log('⚠️ [AUTO-CONFIG] VISUAL_CROSSING_API_KEY not found in environment variables');
      return;
    }
    
    // Configuration par défaut
    const defaultConfig = {
      apiKey: apiKey,
      location: "Nancy, France",
      isActive: true
    };
    
    console.log('🌤️ [AUTO-CONFIG] Testing API connection...');
    
    // Tester la connexion API avant de sauvegarder
    const testResult = await weatherService.testApiConnection(defaultConfig.apiKey, defaultConfig.location);
    
    if (!testResult.success) {
      console.error('❌ [AUTO-CONFIG] API test failed:', testResult.message);
      return;
    }
    
    console.log('✅ [AUTO-CONFIG] API test successful');
    
    // Créer ou mettre à jour la configuration
    if (existingSettings) {
      // Mettre à jour la configuration existante
      await storage.updateWeatherSettings(existingSettings.id, defaultConfig);
      console.log('🔄 [AUTO-CONFIG] Weather settings updated');
    } else {
      // Créer une nouvelle configuration
      await storage.createWeatherSettings(defaultConfig);
      console.log('🆕 [AUTO-CONFIG] Weather settings created');
    }
    
    console.log('✅ [AUTO-CONFIG] Weather system successfully configured');
    
  } catch (error) {
    console.error('❌ [AUTO-CONFIG] Failed to initialize weather config:', error);
  }
}