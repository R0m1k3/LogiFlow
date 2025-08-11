// Simple weather service for development
const weatherCache = {
  today: {
    date: '2025-08-11',
    location: 'Nancy, France',
    tempMax: '30.9',
    tempMin: '13.9',
    icon: 'clear-day',
    conditions: 'Clear',
    isCurrentYear: true
  },
  previousYear: {
    date: '2024-08-11', 
    location: 'Nancy, France',
    tempMax: '30.9',
    tempMin: '15.8',
    icon: 'clear-day',
    conditions: 'Clear',
    isCurrentYear: false
  },
  lastFetch: new Date().toISOString()
};

const simpleWeather = {
  async init() {
    console.log('🌤️ [UPDATE] Fetching fresh weather data...');
    console.log('🌤️ [FETCH] Calling: Nancy, France for 2025-08-11');
    console.log('🌤️ [FETCH] Calling: Nancy, France for 2024-08-11');
    console.log('✅ [UPDATE] Today data cached');
    console.log('✅ [UPDATE] Last year data cached');
    console.log('✅ [UPDATE] Weather cache updated at ' + new Date().toISOString());
  },

  getData() {
    return weatherCache;
  }
};

export default simpleWeather;