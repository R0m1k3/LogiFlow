import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Save, Loader2 } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface UtilitiesConfig {
  id?: number;
  salesAnalysisUrl?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export default function SalesAnalysisConfig() {
  const { toast } = useToast();
  const [salesAnalysisUrl, setSalesAnalysisUrl] = useState("");

  // Récupérer la configuration existante
  const { data: config, isLoading } = useQuery<UtilitiesConfig>({
    queryKey: ['/api/utilities']
  });

  // Mettre à jour l'état quand les données sont chargées
  useEffect(() => {
    if (config?.salesAnalysisUrl) {
      setSalesAnalysisUrl(config.salesAnalysisUrl);
    }
  }, [config]);

  // Mutation pour sauvegarder la configuration
  const saveMutation = useMutation({
    mutationFn: async (data: { salesAnalysisUrl: string | null }) => {
      return await apiRequest('/api/utilities', 'POST', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/utilities'] });
      toast({
        title: "Configuration sauvegardée",
        description: "L'URL d'analyse des ventes a été mise à jour avec succès.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de sauvegarder la configuration",
        variant: "destructive",
      });
    }
  });

  const handleSave = () => {
    saveMutation.mutate({
      salesAnalysisUrl: salesAnalysisUrl.trim() || null
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuration Analyse des Ventes</CardTitle>
        <CardDescription>
          Configurez l'URL ou l'adresse IP pour accéder à l'interface d'analyse des ventes.
          Cette page sera accessible via le menu "Analyse Vente".
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="salesAnalysisUrl">URL ou Adresse IP</Label>
          <Input
            id="salesAnalysisUrl"
            type="text"
            placeholder="https://exemple.com/analyse ou http://192.168.1.100:8080"
            value={salesAnalysisUrl}
            onChange={(e) => setSalesAnalysisUrl(e.target.value)}
            data-testid="input-sales-analysis-url"
          />
          <p className="text-sm text-gray-500">
            Exemple : https://votre-domaine.com/analyse ou http://192.168.1.100:8080
          </p>
        </div>

        <Button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          data-testid="button-save-sales-analysis"
        >
          {saveMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Sauvegarde...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Sauvegarder
            </>
          )}
        </Button>

        {config?.salesAnalysisUrl && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-800">
              <strong>URL configurée :</strong> {config.salesAnalysisUrl}
            </p>
            <p className="text-xs text-blue-600 mt-1">
              Cette URL sera affichée dans le menu "Analyse Vente"
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
