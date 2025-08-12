import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Database, Eye, Loader2 } from "lucide-react";
import { useAuthSimple } from "@/hooks/useAuthSimple";

export default function DatabaseDebug() {
  const { user } = useAuthSimple();
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleLogSchema = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/debug/log-schema', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (response.ok) {
        setResult(data);
      } else {
        setError(data.message || data.error || 'Erreur inconnue');
      }
    } catch (err) {
      setError('Erreur de connexion au serveur');
    } finally {
      setIsLoading(false);
    }
  };

  if (!user || user.role !== 'admin') {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-gray-500">
              Accès refusé. Seuls les administrateurs peuvent accéder à cette page.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center space-x-3">
        <Database className="h-8 w-8 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Debug Base de Données</h1>
          <p className="text-gray-600">Outils de diagnostic pour la base de données de production</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Eye className="h-5 w-5" />
            <span>Scanner le Schéma de la Base</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-gray-600">
            Cette action va scanner votre base de données de production et logger toutes les tables, 
            colonnes et relations dans les logs du serveur.
          </p>
          
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-800 text-sm">
              ⚠️ <strong>Note importante :</strong> Cette fonctionnalité ne marche qu'en production 
              sur votre serveur privé. Les résultats apparaîtront dans les logs de votre serveur.
            </p>
          </div>

          <Button 
            onClick={handleLogSchema}
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Scan en cours...
              </>
            ) : (
              <>
                <Database className="mr-2 h-4 w-4" />
                Démarrer le Scan du Schéma
              </>
            )}
          </Button>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800 text-sm">
                <strong>Erreur :</strong> {error}
              </p>
            </div>
          )}

          {result && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="font-semibold text-green-800 mb-2">✅ Scan terminé avec succès</h3>
              <div className="text-green-700 text-sm space-y-1">
                <p><strong>Tables trouvées :</strong> {result.totalTables}</p>
                <p><strong>Relations FK :</strong> {result.totalForeignKeys}</p>
                <p><strong>Timestamp :</strong> {new Date(result.timestamp).toLocaleString('fr-FR')}</p>
                <p className="mt-2 font-medium">
                  📋 Consultez maintenant les logs de votre serveur pour voir le détail complet du schéma.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <h4 className="font-medium">1. Cliquer sur "Démarrer le Scan du Schéma"</h4>
            <p className="text-sm text-gray-600">Cette action va déclencher le scan de votre base de données.</p>
          </div>
          
          <div className="space-y-2">
            <h4 className="font-medium">2. Consulter les logs du serveur</h4>
            <p className="text-sm text-gray-600">
              Les résultats apparaîtront dans les logs de votre application Node.js sur votre serveur privé.
              Cherchez les lignes qui commencent par "🔍 ===== DÉBUT SCAN SCHÉMA BASE DE DONNÉES =====".
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">3. Informations récupérées</h4>
            <ul className="text-sm text-gray-600 space-y-1 ml-4">
              <li>• Liste complète des tables</li>
              <li>• Colonnes avec types de données et contraintes</li>
              <li>• Nombre d'enregistrements par table</li>
              <li>• Relations de clés étrangères</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}