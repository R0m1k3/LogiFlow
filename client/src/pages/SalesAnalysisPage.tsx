import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, TrendingUp, AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

interface UtilitiesConfig {
  id?: number;
  salesAnalysisUrl?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export default function SalesAnalysisPage() {
  // Récupérer l'URL configurée
  const { data: config, isLoading } = useQuery<UtilitiesConfig>({
    queryKey: ['/api/utilities']
  });

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
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 p-6">
        <div className="flex items-center">
          <TrendingUp className="w-8 h-8 text-blue-600 mr-3" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Analyse des Ventes
            </h2>
            <p className="text-gray-600 text-sm">
              {salesAnalysisUrl}
            </p>
          </div>
        </div>
      </div>

      {/* Iframe Content */}
      <div className="flex-1 overflow-hidden">
        <iframe
          src={salesAnalysisUrl}
          className="w-full h-full border-0"
          title="Analyse des Ventes"
          data-testid="iframe-sales-analysis"
        />
      </div>
    </div>
  );
}
