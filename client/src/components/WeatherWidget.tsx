import { useQuery } from "@tanstack/react-query";
import { Cloud, CloudRain, Sun, CloudSnow, ThermometerSun } from "lucide-react";
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

const WeatherIcon = ({ condition, size = 16 }: { condition: string; size?: number }) => {
  const iconClass = `h-${Math.floor(size/4)} w-${Math.floor(size/4)}`;
  
  if (condition.includes('rain') || condition.includes('pluie')) {
    return <CloudRain className={iconClass} />;
  }
  if (condition.includes('snow') || condition.includes('neige')) {
    return <CloudSnow className={iconClass} />;
  }
  if (condition.includes('cloud') || condition.includes('nuage')) {
    return <Cloud className={iconClass} />;
  }
  if (condition.includes('sun') || condition.includes('soleil') || condition.includes('clear')) {
    return <Sun className={iconClass} />;
  }
  return <ThermometerSun className={iconClass} />;
};

export default function WeatherWidget() {
  const { data: weather, isLoading, error } = useQuery<WeatherResponse>({
    queryKey: ['/api/weather/current'],
    refetchInterval: 30 * 60 * 1000, // Refetch every 30 minutes
    retry: 1,
  });

  if (isLoading) {
    return (
      <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 text-sm">
            <div className="animate-pulse">
              <Cloud className="h-4 w-4" />
            </div>
            <span className="text-blue-700 dark:text-blue-300">Chargement météo...</span>
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

  return (
    <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
      <CardContent className="p-3">
        <div className="flex items-center gap-3 text-sm">
          <div className="flex items-center gap-1">
            <WeatherIcon condition={weather.currentYear?.condition || ''} />
            <span className="text-blue-700 dark:text-blue-300 font-medium">
              {location.split(',')[0]}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="text-blue-800 dark:text-blue-200 font-semibold">
              {currentTemp !== undefined ? `${Math.round(currentTemp)}°` : '--°'}
            </div>
            
            {previousTemp !== undefined && (
              <div className="text-blue-600 dark:text-blue-400 text-xs">
                (l'an dernier: {Math.round(previousTemp)}°)
              </div>
            )}
          </div>
          
          {currentTemp !== undefined && previousTemp !== undefined && (
            <div className="text-xs">
              {currentTemp > previousTemp ? (
                <span className="text-red-600 dark:text-red-400">↑{Math.round(currentTemp - previousTemp)}°</span>
              ) : currentTemp < previousTemp ? (
                <span className="text-blue-600 dark:text-blue-400">↓{Math.round(previousTemp - currentTemp)}°</span>
              ) : (
                <span className="text-gray-600 dark:text-gray-400">=</span>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}