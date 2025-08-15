import { useQuery } from "@tanstack/react-query";
import { Cloud, CloudRain, Sun, CloudSnow, CloudSun, ThermometerSun, CloudDrizzle, Wind, Zap, Eye } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface WeatherData {
  id: number;
  date: string;
  location: string;
  maxTemperature: number;
  minTemperature: number;
  condition: string;
  icon: string;
  isCurrentYear: boolean;
  createdAt: string;
  updatedAt: string;
}

interface WeatherResponse {
  currentYear: WeatherData | null;
  previousYear: WeatherData | null;
  location: string;
}



const WeatherIcon = ({ condition, size = 20 }: { condition: string; size?: number }) => {
  // Utiliser des tailles fixes plutôt que dynamiques pour éviter les problèmes de Tailwind
  const getIconClass = (size: number) => {
    if (size <= 16) return "h-4 w-4";
    if (size <= 20) return "h-5 w-5";
    if (size <= 24) return "h-6 w-6";
    return "h-8 w-8";
  };
  
  const iconClass = getIconClass(size);
  const conditionLower = condition.toLowerCase();
  
  // Ensoleillé/Dégagé
  if (conditionLower.includes('clear') || conditionLower.includes('dégagé') || 
      conditionLower.includes('sunny') || conditionLower.includes('ensoleillé') ||
      conditionLower.includes('fair') || conditionLower.includes('beau')) {
    return <Sun className={`${iconClass} text-yellow-500`} />;
  }
  
  // Conditions pluvieuses
  if (conditionLower.includes('rain') || conditionLower.includes('pluie') || conditionLower.includes('shower') || conditionLower.includes('averses')) {
    if (conditionLower.includes('heavy') || conditionLower.includes('forte')) {
      return <CloudRain className={`${iconClass} text-blue-600`} />;
    }
    return <CloudDrizzle className={`${iconClass} text-blue-500`} />;
  }
  
  // Bruine  
  if (conditionLower.includes('drizzle') || conditionLower.includes('bruine')) {
    return <CloudDrizzle className={`${iconClass} text-blue-400`} />;
  }
  
  // Conditions neigeuses
  if (conditionLower.includes('snow') || conditionLower.includes('neige') || conditionLower.includes('blizzard')) {
    return <CloudSnow className={`${iconClass} text-blue-300`} />;
  }
  
  // Orages
  if (conditionLower.includes('thunder') || conditionLower.includes('storm') || conditionLower.includes('orage')) {
    return <Zap className={`${iconClass} text-purple-600`} />;
  }
  
  // Brouillard
  if (conditionLower.includes('fog') || conditionLower.includes('mist') || conditionLower.includes('brouillard') || conditionLower.includes('brume')) {
    return <Cloud className={`${iconClass} text-gray-400`} />;
  }
  
  // Vent
  if (conditionLower.includes('wind') || conditionLower.includes('vent') || conditionLower.includes('venteux')) {
    return <Wind className={`${iconClass} text-gray-600`} />;
  }
  
  // Nuageux
  if (conditionLower.includes('cloud') || conditionLower.includes('nuage') || conditionLower.includes('overcast') || conditionLower.includes('couvert')) {
    if (conditionLower.includes('partly') || conditionLower.includes('partial') || conditionLower.includes('partiellement')) {
      return <CloudSun className={`${iconClass} text-yellow-400`} />;
    }
    return <Cloud className={`${iconClass} text-gray-600`} />;
  }
  
  // Par défaut pour températures
  return <Sun className={`${iconClass} text-yellow-500`} />;
};

export default function WeatherWidget() {
  const { data: weather, isLoading, error } = useQuery<WeatherResponse>({
    queryKey: ['/api/weather/current'],
    refetchInterval: 30 * 60 * 1000, // Refetch every 30 minutes
    retry: 1,
  });

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 border-slate-200 dark:border-slate-700 shadow-sm">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 text-sm">
            <div className="animate-pulse">
              <Cloud className="h-5 w-5 text-slate-400" />
            </div>
            <span className="text-slate-600 dark:text-slate-300 font-medium">Chargement météo...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !weather) {
    return null; // Don't show widget if weather service is not configured
  }

  const currentTemp = weather.currentYear?.maxTemperature;
  const previousTemp = weather.previousYear?.maxTemperature;
  const location = weather.location || "Nancy";

  const tempDifference = currentTemp !== undefined && previousTemp !== undefined 
    ? currentTemp - previousTemp : 0;

  return (
    <Card className="bg-gradient-to-r from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 border-slate-200 dark:border-slate-700 shadow-lg hover:shadow-xl transition-all duration-300">
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          {/* Icône et localisation */}
          <div className="flex items-center gap-2">
            <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-full">
              <WeatherIcon condition={weather.currentYear?.condition || ''} size={24} />
            </div>
            <div className="flex flex-col">
              <span className="text-slate-700 dark:text-slate-200 font-semibold text-sm">
                {location.split(',')[0]}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {weather.currentYear?.condition || 'Inconnu'}
              </span>
            </div>
          </div>
          
          {/* Températures actuelles */}
          <div className="flex items-center gap-3">
            <div className="text-center">
              <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                {currentTemp !== undefined ? `${Math.round(currentTemp)}°` : '--°'}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Aujourd'hui
              </div>
            </div>
            
            {/* Comparaison avec l'an dernier */}
            {previousTemp !== undefined && (
              <>
                <div className="h-8 w-px bg-slate-300 dark:bg-slate-600"></div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <WeatherIcon condition={weather.previousYear?.condition || ''} size={16} />
                    <div className="text-lg font-semibold text-slate-600 dark:text-slate-300">
                      {Math.round(previousTemp)}°
                    </div>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Année dernière
                  </div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                    {weather.previousYear?.condition || ''}
                  </div>
                </div>
              </>
            )}
            
            {/* Différence */}
            {currentTemp !== undefined && previousTemp !== undefined && (
              <>
                <div className="h-8 w-px bg-slate-300 dark:bg-slate-600"></div>
                <div className="flex items-center gap-1">
                  {tempDifference > 0 ? (
                    <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
                      <span className="text-lg">↗</span>
                      <span className="text-sm font-semibold">+{Math.round(tempDifference)}°</span>
                    </div>
                  ) : tempDifference < 0 ? (
                    <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                      <span className="text-lg">↘</span>
                      <span className="text-sm font-semibold">{Math.round(tempDifference)}°</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                      <span className="text-lg">=</span>
                      <span className="text-sm font-semibold">0°</span>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}