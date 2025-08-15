import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Cloud, CloudRain, Sun, CloudSnow, CloudSun, ThermometerSun, CloudDrizzle, Wind, Zap, Eye, MapPin, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

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



// Fonction de traduction française côté client comme sécurité
const translateToFrench = (condition: string): string => {
  const conditionLower = condition.toLowerCase();
  
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
  
  return condition; // Si déjà en français ou inconnu
};

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
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: weather, isLoading, error } = useQuery<WeatherResponse>({
    queryKey: ['/api/weather/current'],
    refetchInterval: 30 * 60 * 1000, // Refetch every 30 minutes
    retry: 1,
  });

  // Mutation pour la géolocalisation
  const geoLocationMutation = useMutation({
    mutationFn: async (coordinates: { latitude: number; longitude: number }) => {
      const response = await fetch('/api/weather/geolocation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(coordinates),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erreur de géolocalisation');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Localisation mise à jour",
        description: data.message,
      });
      
      // Actualiser les données météo
      queryClient.invalidateQueries({ queryKey: ['/api/weather/current'] });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur de géolocalisation",
        description: error.message || "Impossible de déterminer votre localisation",
        variant: "destructive",
      });
    },
  });

  // Fonction pour obtenir la géolocalisation
  const handleGeolocation = () => {
    if (!navigator.geolocation) {
      toast({
        title: "Géolocalisation non supportée",
        description: "Votre navigateur ne supporte pas la géolocalisation",
        variant: "destructive",
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        geoLocationMutation.mutate({ latitude, longitude });
      },
      (error) => {
        let message = "Erreur de géolocalisation";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = "Autorisation de géolocalisation refusée";
            break;
          case error.POSITION_UNAVAILABLE:
            message = "Position non disponible";
            break;
          case error.TIMEOUT:
            message = "Délai d'attente dépassé";
            break;
        }
        
        toast({
          title: "Erreur de géolocalisation",
          description: message,
          variant: "destructive",
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000, // 5 minutes
      }
    );
  };

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
      <CardContent className="p-4 min-h-[80px]">
        <div className="flex items-center gap-4">
          {/* Icône et localisation */}
          <div className="flex items-center gap-2">
            <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-full">
              <WeatherIcon condition={weather.currentYear?.condition || ''} size={24} />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-slate-700 dark:text-slate-200 font-semibold text-sm">
                  {location.split(',')[0]}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleGeolocation}
                  disabled={geoLocationMutation.isPending}
                  className="h-6 w-6 p-0 hover:bg-slate-200 dark:hover:bg-slate-600"
                  title="Détecter ma localisation"
                >
                  {geoLocationMutation.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <MapPin className="h-3 w-3" />
                  )}
                </Button>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {translateToFrench(weather.currentYear?.condition || 'Inconnu')}
              </span>
            </div>
          </div>
          
          {/* Températures avec en-têtes */}
          <div className="flex items-stretch gap-3">
            <div className="text-center">
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-1 font-medium">
                Aujourd'hui
              </div>
              <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                {currentTemp !== undefined ? `${Math.round(currentTemp)}°` : '--°'}
              </div>
            </div>
            
            {/* Comparaison avec l'an dernier */}
            {previousTemp !== undefined && (
              <>
                <div className="h-12 w-px bg-slate-300 dark:bg-slate-600 self-center"></div>
                <div className="text-center min-w-[90px]">
                  <div className="text-xs text-slate-500 dark:text-slate-400 mb-1 font-medium">
                    Année dernière
                  </div>
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <WeatherIcon condition={weather.previousYear?.condition || ''} size={16} />
                    <div className="text-lg font-semibold text-slate-600 dark:text-slate-300">
                      {Math.round(previousTemp)}°
                    </div>
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-tight">
                    {translateToFrench(weather.previousYear?.condition || '')}
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