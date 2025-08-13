import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuthUnified } from "@/hooks/useAuthUnified";
import { apiRequest } from "@/lib/queryClient";
import { hasPermission } from "@/lib/permissions";
import { 
  Download, 
  Trash2, 
  Database, 
  Clock, 
  User, 
  FileText,
  AlertTriangle,
  CheckCircle,
  Loader2
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface BackupFile {
  id: string;
  filename: string;
  description: string | null;
  size: number;
  createdAt: string;
  createdBy: string;
  tablesCount: number;
  status: string;
  backupType: string;
}

export default function BackupManager() {
  const { user } = useAuthUnified();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deletingBackup, setDeletingBackup] = useState<string | null>(null);

  // Check permissions
  const canManageBackups = hasPermission(user?.role || '', 'admin', 'manage');

  // Fetch backup list
  const { data: backups = [], isLoading, error } = useQuery({
    queryKey: ['/api/backups'],
    queryFn: () => apiRequest('/api/backups'),
    enabled: canManageBackups,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Create manual backup
  const createBackupMutation = useMutation({
    mutationFn: () => apiRequest('/api/backups', 'POST'),
    onSuccess: () => {
      toast({
        title: "Succès",
        description: "Sauvegarde manuelle créée avec succès",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/backups'] });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de créer la sauvegarde",
        variant: "destructive",
      });
    },
  });

  // Delete backup
  const deleteBackupMutation = useMutation({
    mutationFn: (filename: string) => apiRequest(`/api/backups/${filename}`, 'DELETE'),
    onSuccess: () => {
      toast({
        title: "Succès",
        description: "Sauvegarde supprimée avec succès",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/backups'] });
      setDeletingBackup(null);
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de supprimer la sauvegarde",
        variant: "destructive",
      });
      setDeletingBackup(null);
    },
  });

  const handleDownload = (filename: string) => {
    // Create download link
    const link = document.createElement('a');
    link.href = `/api/backups/${filename}/download`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDelete = (filename: string) => {
    setDeletingBackup(filename);
    deleteBackupMutation.mutate(filename);
  };

  const formatFileSize = (bytes: number): string => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getTypeIcon = (type: string) => {
    return type === 'automatic' ? <Clock className="w-4 h-4" /> : <User className="w-4 h-4" />;
  };

  const getTypeBadge = (type: string) => {
    return type === 'automatic' 
      ? <Badge variant="secondary">Automatique</Badge>
      : <Badge variant="outline">Manuelle</Badge>;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800">Terminé</Badge>;
      case 'creating':
        return <Badge className="bg-blue-100 text-blue-800">En cours</Badge>;
      case 'failed':
        return <Badge variant="destructive">Échec</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (!canManageBackups) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Card className="w-96">
          <CardHeader className="text-center">
            <AlertTriangle className="w-12 h-12 text-orange-500 mx-auto mb-4" />
            <CardTitle>Accès refusé</CardTitle>
            <CardDescription>
              Vous n'avez pas les permissions nécessaires pour accéder à la gestion des sauvegardes.
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
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Database className="w-8 h-8 text-blue-600 mr-3" />
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Gestion des Sauvegardes
              </h2>
              <p className="text-gray-600">
                Sauvegarde automatique quotidienne à 2h00 - Maximum 10 fichiers conservés
              </p>
            </div>
          </div>
          
          <Button
            onClick={() => createBackupMutation.mutate()}
            disabled={createBackupMutation.isPending}
            className="bg-accent hover:bg-orange-600 text-white"
          >
            {createBackupMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Database className="w-4 h-4 mr-2" />
            )}
            Sauvegarde Manuelle
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 overflow-auto">
        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Sauvegardes
              </CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{backups.length}</div>
              <p className="text-xs text-muted-foreground">
                Maximum 10 fichiers
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Dernière Sauvegarde
              </CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {backups.length > 0 ? (
                  format(new Date(backups[0].createdAt), 'dd/MM', { locale: fr })
                ) : '-'}
              </div>
              <p className="text-xs text-muted-foreground">
                {backups.length > 0 ? (
                  format(new Date(backups[0].createdAt), 'HH:mm', { locale: fr })
                ) : 'Aucune sauvegarde'}
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Statut Système
              </CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">Actif</div>
              <p className="text-xs text-muted-foreground">
                Sauvegarde automatique 2h00
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Backup List */}
        <Card>
          <CardHeader>
            <CardTitle>Liste des Sauvegardes</CardTitle>
            <CardDescription>
              Gestion des fichiers de sauvegarde de la base de données PostgreSQL
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : error ? (
              <div className="text-center text-red-600 h-32 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 mr-2" />
                Erreur lors du chargement des sauvegardes
              </div>
            ) : backups.length === 0 ? (
              <div className="text-center text-gray-500 h-32 flex items-center justify-center">
                <FileText className="w-6 h-6 mr-2" />
                Aucune sauvegarde disponible
              </div>
            ) : (
              <div className="space-y-2">
                {backups.map((backup) => (
                  <div 
                    key={backup.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        {getTypeIcon(backup.backupType)}
                        <FileText className="w-5 h-5 text-gray-400" />
                      </div>
                      
                      <div>
                        <div className="font-medium text-gray-900">
                          {backup.filename}
                        </div>
                        <div className="text-sm text-gray-500">
                          {backup.description || 'Sauvegarde de base de données'}
                        </div>
                        <div className="text-sm text-gray-500 flex items-center space-x-4 mt-1">
                          <span>
                            {format(new Date(backup.createdAt), 'dd/MM/yyyy à HH:mm', { locale: fr })}
                          </span>
                          <span>{formatFileSize(backup.size)}</span>
                          <span>{backup.tablesCount} tables</span>
                          {getTypeBadge(backup.backupType)}
                          {getStatusBadge(backup.status)}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(backup.filename)}
                      >
                        <Download className="w-4 h-4 mr-1" />
                        Télécharger
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(backup.filename)}
                        disabled={deletingBackup === backup.filename}
                        className="text-red-600 hover:text-red-700"
                      >
                        {deletingBackup === backup.filename ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}