import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { AlertCircle, CheckCircle, Cloud, Settings } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface WeatherSettings {
  id: number;
  apiKey: string;
  location: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function WeatherSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  // Fetch weather settings
  const { data: settings, isLoading } = useQuery<WeatherSettings>({
    queryKey: ['/api/weather/settings'],
  });

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (data: Partial<WeatherSettings>) => {
      const url = settings?.id ? `/api/weather/settings/${settings.id}` : '/api/weather/settings';
      const method = settings?.id ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save settings');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/weather/settings'] });
      toast({
        title: "Configuration sauvegardée",
        description: "Les paramètres météo ont été mis à jour avec succès.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de sauvegarder les paramètres.",
        variant: "destructive",
      });
    },
  });

  // Test API connection
  const testConnection = async (apiKey: string, location: string) => {
    setIsTesting(true);
    setTestResult(null);
    
    try {
      const response = await fetch('/api/weather/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ apiKey, location }),
      });
      
      if (!response.ok) {
        throw new Error('Test connection failed');
      }
      
      const result = await response.json();
      setTestResult(result);
    } catch (error: any) {
      setTestResult({ 
        success: false, 
        message: error.message || "Erreur lors du test de connexion" 
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const data = {
      apiKey: formData.get('apiKey') as string,
      location: formData.get('location') as string,
      isActive: formData.get('isActive') === 'on',
    };

    updateSettingsMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center gap-2 mb-6">
          <Cloud className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Configuration Météo</h1>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
              <div className="h-10 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
              <div className="h-10 bg-gray-200 rounded"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <div className="flex items-center gap-2 mb-6">
        <Cloud className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Configuration Météo</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Paramètres API Visual Crossing
          </CardTitle>
          <CardDescription>
            Configurez l'API Visual Crossing pour afficher la météo du jour actuel et de l'année précédente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="apiKey">Clé API Visual Crossing</Label>
              <Input
                id="apiKey"
                name="apiKey"
                type="password"
                placeholder="Votre clé API Visual Crossing"
                defaultValue={settings?.apiKey || ""}
                required
              />
              <p className="text-sm text-muted-foreground">
                Obtenez votre clé API gratuite sur{" "}
                <a
                  href="https://www.visualcrossing.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  visualcrossing.com
                </a>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Localisation</Label>
              <Input
                id="location"
                name="location"
                placeholder="Nancy, France"
                defaultValue={settings?.location || "Nancy, France"}
                required
              />
              <p className="text-sm text-muted-foreground">
                Ville ou région pour laquelle afficher la météo
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="isActive"
                name="isActive"
                defaultChecked={settings?.isActive ?? true}
              />
              <Label htmlFor="isActive">Activer l'affichage météo</Label>
            </div>

            {testResult && (
              <Alert variant={testResult.success ? "default" : "destructive"}>
                {testResult.success ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <AlertDescription>{testResult.message}</AlertDescription>
              </Alert>
            )}

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const formData = new FormData(document.querySelector('form') as HTMLFormElement);
                  const apiKey = formData.get('apiKey') as string;
                  const location = formData.get('location') as string;
                  
                  if (apiKey && location) {
                    testConnection(apiKey, location);
                  } else {
                    toast({
                      title: "Erreur",
                      description: "Veuillez remplir la clé API et la localisation avant de tester.",
                      variant: "destructive",
                    });
                  }
                }}
                disabled={isTesting}
              >
                {isTesting ? "Test en cours..." : "Tester la connexion"}
              </Button>
              
              <Button 
                type="submit" 
                disabled={updateSettingsMutation.isPending}
              >
                {updateSettingsMutation.isPending ? "Sauvegarde..." : "Sauvegarder"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>À propos</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            Le widget météo affiche la température maximale du jour actuel ainsi que 
            celle du même jour l'année précédente, permettant une comparaison rapide.
          </p>
          <p>
            Les données sont mises en cache pour éviter les appels API répétés et 
            optimiser les performances.
          </p>
          <p>
            L'affichage météo apparaît en haut à gauche de l'interface, 
            à côté du sélecteur de magasin.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}