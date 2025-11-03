import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, TrendingUp, AlertCircle, RefreshCw } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

interface UtilitiesConfig {
  id?: number;
  salesAnalysisUrl?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export default function SalesAnalysisPage() {
  // State pour forcer le rechargement de l'iframe
  const [iframeKey, setIframeKey] = useState(0);
  
  // Récupérer l'URL configurée
  const { data: config, isLoading } = useQuery<UtilitiesConfig>({
    queryKey: ['/api/utilities']
  });
  
  // Fonction pour recharger l'iframe
  const handleRefresh = () => {
    setIframeKey(prev => prev + 1);
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const salesAnalysisUrl = config?.salesAnalysisUrl;

  if (!salesAnalysisUrl) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Card className="w-96">
          <CardHeader className="text-center">
            <AlertCircle className="w-12 h-12 text-orange-500 mx-auto mb-4" />
            <CardTitle>URL non configurée</CardTitle>
            <CardDescription>
              L'URL d'analyse des ventes n'a pas encore été configurée.
              Veuillez la définir dans les utilitaires.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Link href="/utilities">
              <Button variant="default" data-testid="button-configure-url">
                Configurer l'URL
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full h-screen relative">
      {/* Bouton de rechargement flottant */}
      <div className="absolute top-4 right-4 z-10">
        <Button
          onClick={handleRefresh}
          variant="default"
          size="sm"
          className="shadow-lg"
          data-testid="button-refresh-iframe"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Recharger
        </Button>
      </div>
      
      {/* iframe avec clé pour forcer le rechargement */}
      <iframe
        key={iframeKey}
        src={salesAnalysisUrl}
        className="w-full h-full border-0"
        title="Analyse des Ventes"
        data-testid="iframe-sales-analysis"
        allow="fullscreen"
      />
    </div>
  );
}
