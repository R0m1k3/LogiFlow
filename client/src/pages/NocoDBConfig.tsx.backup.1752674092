import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuthUnified } from "@/hooks/useAuthUnified";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Database,
  Plus,
  Edit,
  Trash2,
  Settings,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Link,
} from "lucide-react";
import type { NocodbConfig } from "@shared/schema";

// Form schemas
const nocodbConfigFormSchema = z.object({
  name: z.string().min(1, "Le nom est obligatoire"),
  baseUrl: z.string().url("L'URL doit être valide").min(1, "L'URL de base est obligatoire"),
  apiToken: z.string().min(1, "Le token API est obligatoire"),
  projectId: z.string().min(1, "L'ID du projet est obligatoire"),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
});

type NocodbConfigForm = z.infer<typeof nocodbConfigFormSchema>;

export default function NocoDBConfig() {
  const { user } = useAuthUnified();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<NocodbConfig | null>(null);
  const [showTokens, setShowTokens] = useState<{ [key: number]: boolean }>({});

  // Queries avec protection complète
  const { data: rawConfigs, isLoading, error } = useQuery({
    queryKey: ['/api/nocodb-config'],
    enabled: user?.role === 'admin',
  });

  // Protection triple couche pour éviter les erreurs TypeError
  const configs = rawConfigs || [];
  const safeConfigs = Array.isArray(configs) ? configs : [];
  
  // Log pour debug production
  console.log('🔍 NocoDBConfig Debug:', { 
    rawConfigs, 
    configs,
    isArray: Array.isArray(configs), 
    safeConfigs, 
    length: safeConfigs.length,
    error,
    userRole: user?.role
  });

  // Mutations
  const createConfigMutation = useMutation({
    mutationFn: (data: NocodbConfigForm) => 
      apiRequest('/api/nocodb-config', 'POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/nocodb-config'] });
      setShowCreateModal(false);
      toast({
        title: "Configuration créée",
        description: "La configuration NocoDB a été créée avec succès.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de la création de la configuration.",
        variant: "destructive",
      });
    },
  });

  const updateConfigMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<NocodbConfigForm> }) =>
      apiRequest(`/api/nocodb-config/${id}`, 'PUT', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/nocodb-config'] });
      setShowEditModal(false);
      setSelectedConfig(null);
      toast({
        title: "Configuration mise à jour",
        description: "La configuration NocoDB a été mise à jour avec succès.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de la mise à jour de la configuration.",
        variant: "destructive",
      });
    },
  });

  const deleteConfigMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest(`/api/nocodb-config/${id}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/nocodb-config'] });
      setShowDeleteModal(false);
      setSelectedConfig(null);
      toast({
        title: "Configuration supprimée",
        description: "La configuration NocoDB a été supprimée avec succès.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de la suppression de la configuration.",
        variant: "destructive",
      });
    },
  });

  // Forms
  const createForm = useForm<NocodbConfigForm>({
    resolver: zodResolver(nocodbConfigFormSchema),
    defaultValues: {
      name: "",
      baseUrl: "",
      apiToken: "",
      projectId: "",
      description: "",
      isActive: true,
    },
  });

  const editForm = useForm<NocodbConfigForm>({
    resolver: zodResolver(nocodbConfigFormSchema),
  });

  // Handle create config
  const handleCreateConfig = (data: NocodbConfigForm) => {
    createConfigMutation.mutate(data);
  };

  // Handle edit config
  const handleEditConfig = (data: NocodbConfigForm) => {
    if (!selectedConfig) return;
    updateConfigMutation.mutate({ id: selectedConfig.id, data });
  };

  // Handle delete config
  const handleDeleteConfig = () => {
    if (!selectedConfig) return;
    deleteConfigMutation.mutate(selectedConfig.id);
  };

  // Open edit modal
  const openEditModal = (config: NocodbConfig) => {
    setSelectedConfig(config);
    editForm.reset({
      name: config.name,
      baseUrl: config.baseUrl,
      apiToken: config.apiToken,
      projectId: config.projectId,
      description: config.description || "",
      isActive: config.isActive,
    });
    setShowEditModal(true);
  };

  // Open delete modal
  const openDeleteModal = (config: NocodbConfig) => {
    setSelectedConfig(config);
    setShowDeleteModal(true);
  };

  // Toggle token visibility
  const toggleTokenVisibility = (configId: number) => {
    setShowTokens(prev => ({
      ...prev,
      [configId]: !prev[configId]
    }));
  };

  // Format token for display
  const formatToken = (token: string, isVisible: boolean) => {
    if (isVisible) return token;
    return '•'.repeat(Math.min(token.length, 20));
  };

  if (user?.role !== 'admin') {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="p-6 text-center">
            <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Accès restreint</h3>
            <p className="text-muted-foreground">
              Seuls les administrateurs peuvent gérer les configurations NocoDB.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Database className="h-8 w-8 text-blue-600" />
            Configuration NocoDB
          </h1>
          <p className="text-muted-foreground mt-2">
            Gérez les connexions aux bases de données NocoDB externes pour récupérer des informations.
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Nouvelle Configuration
        </Button>
      </div>

      {/* Configurations List */}
      <div className="grid gap-6">
        {safeConfigs.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Database className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Aucune configuration</h3>
              <p className="text-muted-foreground mb-4">
                Commencez par créer votre première configuration NocoDB.
              </p>
              <Button onClick={() => setShowCreateModal(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Créer une configuration
              </Button>
            </CardContent>
          </Card>
        ) : (
          safeConfigs.map((config: NocodbConfig) => (
            <Card key={config.id} className="border shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex justify-between items-start">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Database className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">{config.name}</CardTitle>
                        <Badge variant={config.isActive ? "default" : "secondary"}>
                          {config.isActive ? (
                            <><CheckCircle className="h-3 w-3 mr-1" /> Actif</>
                          ) : (
                            <><XCircle className="h-3 w-3 mr-1" /> Inactif</>
                          )}
                        </Badge>
                      </div>
                      {config.description && (
                        <CardDescription className="mt-1">
                          {config.description}
                        </CardDescription>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditModal(config)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openDeleteModal(config)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-600">URL de base</label>
                    <div className="flex items-center gap-2 mt-1">
                      <Link className="h-4 w-4 text-gray-400" />
                      <span className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                        {config.baseUrl}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">ID du projet</label>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                        {config.projectId}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Token API</label>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm font-mono bg-gray-100 px-2 py-1 rounded flex-1">
                        {formatToken(config.apiToken, showTokens[config.id])}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleTokenVisibility(config.id)}
                      >
                        {showTokens[config.id] ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-md" aria-describedby="create-config-description">
          <DialogHeader>
            <DialogTitle>Nouvelle Configuration NocoDB</DialogTitle>
          </DialogHeader>
          <div id="create-config-description" className="sr-only">
            Créer une nouvelle configuration pour se connecter à une base de données NocoDB externe
          </div>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(handleCreateConfig)} className="space-y-4">
              <FormField
                control={createForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom de la configuration</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Production NocoDB" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={createForm.control}
                name="baseUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL de base</FormLabel>
                    <FormControl>
                      <Input placeholder="https://your-nocodb-instance.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={createForm.control}
                name="apiToken"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Personal API Token</FormLabel>
                    <FormControl>
                      <Input 
                        type="password" 
                        placeholder="xc-token-xxxxxxxxxxxxxx" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={createForm.control}
                name="projectId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ID du projet</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="p_xxxxxxxxxxxxxx" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={createForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (optionnel)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Description de cette configuration..."
                        rows={3}
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={createForm.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Configuration active</FormLabel>
                      <div className="text-sm text-muted-foreground">
                        Activer cette configuration pour l'utiliser
                      </div>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="flex justify-end space-x-3 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowCreateModal(false)}
                  disabled={createConfigMutation.isPending}
                >
                  Annuler
                </Button>
                <Button 
                  type="submit"
                  disabled={createConfigMutation.isPending}
                >
                  {createConfigMutation.isPending ? "Création..." : "Créer"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="sm:max-w-md" aria-describedby="edit-config-description">
          <DialogHeader>
            <DialogTitle>Modifier la Configuration</DialogTitle>
          </DialogHeader>
          <div id="edit-config-description" className="sr-only">
            Modifier les paramètres de la configuration NocoDB sélectionnée
          </div>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleEditConfig)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom de la configuration</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Production NocoDB" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="baseUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL de base</FormLabel>
                    <FormControl>
                      <Input placeholder="https://your-nocodb-instance.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="apiToken"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Personal API Token</FormLabel>
                    <FormControl>
                      <Input 
                        type="password" 
                        placeholder="xc-token-xxxxxxxxxxxxxx" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="projectId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ID du projet</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="p_xxxxxxxxxxxxxx" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (optionnel)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Description de cette configuration..."
                        rows={3}
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Configuration active</FormLabel>
                      <div className="text-sm text-muted-foreground">
                        Activer cette configuration pour l'utiliser
                      </div>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="flex justify-end space-x-3 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowEditModal(false)}
                  disabled={updateConfigMutation.isPending}
                >
                  Annuler
                </Button>
                <Button 
                  type="submit"
                  disabled={updateConfigMutation.isPending}
                >
                  {updateConfigMutation.isPending ? "Mise à jour..." : "Mettre à jour"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="sm:max-w-md" aria-describedby="delete-config-description">
          <DialogHeader>
            <DialogTitle>Confirmer la suppression</DialogTitle>
          </DialogHeader>
          <div id="delete-config-description" className="sr-only">
            Confirmer la suppression définitive de la configuration NocoDB
          </div>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Êtes-vous sûr de vouloir supprimer la configuration "{selectedConfig?.name}" ? 
              Cette action est irréversible.
            </p>
          </div>
          <div className="flex justify-end space-x-3">
            <Button 
              variant="outline" 
              onClick={() => setShowDeleteModal(false)}
              disabled={deleteConfigMutation.isPending}
            >
              Annuler
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteConfig}
              disabled={deleteConfigMutation.isPending}
            >
              {deleteConfigMutation.isPending ? "Suppression..." : "Supprimer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}