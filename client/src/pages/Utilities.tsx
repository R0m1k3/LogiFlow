import { useState } from "react";
import { useAuthUnified } from "@/hooks/useAuthUnified";
import { hasPermission } from "@/lib/permissions";
import { 
  Settings,
  Database,
  Server,
  Bug,
  Cloud
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle } from "lucide-react";

// Import des composants existants
import BackupManager from "./BackupManager";
import NocoDBConfig from "./NocoDBConfig";
import DatabaseDebug from "./DatabaseDebug";
import WeatherSettings from "./WeatherSettings";

export default function Utilities() {
  const { user } = useAuthUnified();
  // Détecter l'onglet actif basé sur l'URL pour la compatibilité
  const [activeTab, setActiveTab] = useState(() => {
    const path = window.location.pathname;
    if (path === '/backup') return 'backups';
    if (path === '/nocodb-config') return 'nocodb';
    if (path === '/database-debug') return 'debug';
    if (path === '/weather-settings') return 'weather';
    return 'backups';
  });

  // Vérification des permissions pour chaque onglet
  const canManageBackups = hasPermission(user?.role || '', 'backups', 'manage');
  const canManageNocoDB = user?.role === 'admin';
  const canDebugDatabase = user?.role === 'admin';
  const canManageWeather = user?.role === 'admin';

  // Si l'utilisateur n'a aucune permission, afficher le message d'accès refusé
  if (!canManageBackups && !canManageNocoDB && !canDebugDatabase && !canManageWeather) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Card className="w-96">
          <CardHeader className="text-center">
            <AlertTriangle className="w-12 h-12 text-orange-500 mx-auto mb-4" />
            <CardTitle>Accès refusé</CardTitle>
            <CardDescription>
              Vous n'avez pas les permissions nécessaires pour accéder aux utilitaires d'administration.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 p-6">
        <div className="flex items-center">
          <Settings className="w-8 h-8 text-blue-600 mr-3" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Utilitaires d'Administration
            </h2>
            <p className="text-gray-600">
              Outils de gestion et de maintenance du système
            </p>
          </div>
        </div>
      </div>

      {/* Content avec onglets */}
      <div className="flex-1 p-6 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            {canManageBackups && (
              <TabsTrigger value="backups" className="flex items-center gap-2">
                <Database className="w-4 h-4" />
                Sauvegardes
              </TabsTrigger>
            )}
            {canManageNocoDB && (
              <TabsTrigger value="nocodb" className="flex items-center gap-2">
                <Server className="w-4 h-4" />
                Configuration NocoDB
              </TabsTrigger>
            )}
            {canDebugDatabase && (
              <TabsTrigger value="debug" className="flex items-center gap-2">
                <Bug className="w-4 h-4" />
                Debug Base de Données
              </TabsTrigger>
            )}
            {canManageWeather && (
              <TabsTrigger value="weather" className="flex items-center gap-2">
                <Cloud className="w-4 h-4" />
                Météo
              </TabsTrigger>
            )}
          </TabsList>

          {/* Contenu des onglets */}
          {canManageBackups && (
            <TabsContent value="backups" className="flex-1 overflow-hidden">
              <div className="h-full bg-gray-50 -m-6 p-6">
                <BackupManager />
              </div>
            </TabsContent>
          )}

          {canManageNocoDB && (
            <TabsContent value="nocodb" className="flex-1 overflow-hidden">
              <div className="h-full bg-gray-50 -m-6 p-6">
                <NocoDBConfig />
              </div>
            </TabsContent>
          )}

          {canDebugDatabase && (
            <TabsContent value="debug" className="flex-1 overflow-hidden">
              <div className="h-full bg-gray-50 -m-6 p-6">
                <DatabaseDebug />
              </div>
            </TabsContent>
          )}

          {canManageWeather && (
            <TabsContent value="weather" className="flex-1 overflow-hidden">
              <div className="h-full bg-gray-50 -m-6 p-6">
                <WeatherSettings />
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}