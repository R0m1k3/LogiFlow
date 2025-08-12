import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { safeFormat } from "@/lib/dateUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useStore } from "@/components/Layout";
import { useAuthUnified } from "@/hooks/useAuthUnified";
import { usePermissions } from "@shared/permissions";
import { Search, Edit, FileText, Settings, Eye, AlertTriangle, X, Check, Trash2, Ban } from "lucide-react";
import type { Supplier } from "@shared/schema";

export default function BLReconciliation() {
  const { user } = useAuthUnified();
  const { selectedStoreId } = useStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const permissions = usePermissions(user?.role);
  
  // Vérification des permissions d'accès au module
  if (!permissions.canView('reconciliation')) {
    return (
      <div className="p-6">
        <div className="bg-orange-50 border-l-4 border-orange-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <FileText className="h-5 w-5 text-orange-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-orange-700">
                <strong>Accès restreint</strong><br />
                Seuls les directeurs et administrateurs peuvent accéder au module de rapprochement BL/Factures.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  const [activeTab, setActiveTab] = useState("manual");
  const [searchTerm, setSearchTerm] = useState("");

  // Récupérer les fournisseurs pour la logique automatique
  const { data: suppliers = [], isLoading: suppliersLoading } = useQuery<Supplier[]>({
    queryKey: ['/api/suppliers'],
  });

  // Récupérer les livraisons validées avec BL
  const { data: deliveriesWithBL = [], isLoading } = useQuery({
    queryKey: ['/api/deliveries/bl', selectedStoreId],
    queryFn: async () => {
      const params = new URLSearchParams({});
      if (selectedStoreId && user?.role === 'admin') {
        params.append('storeId', selectedStoreId.toString());
      }
      
      const response = await fetch(`/api/deliveries?${params.toString()}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch deliveries');
      }
      
      const deliveries = await response.json();
      const filtered = Array.isArray(deliveries) ? deliveries.filter((d: any) => d.status === 'delivered') : [];
      
      return filtered.sort((a: any, b: any) => new Date(b.deliveredDate || b.updatedAt).getTime() - new Date(a.deliveredDate || a.updatedAt).getTime());
    },
  });

  // Séparer les livraisons selon le mode de rapprochement du fournisseur
  const manualReconciliationDeliveries = deliveriesWithBL.filter((delivery: any) => {
    const supplier = suppliers.find((s: any) => s.id === delivery.supplierId);
    return !supplier?.automaticReconciliation;
  });

  const automaticReconciliationDeliveries = deliveriesWithBL.filter((delivery: any) => {
    const supplier = suppliers.find((s: any) => s.id === delivery.supplierId);
    return supplier?.automaticReconciliation;
  });

  // Mutation pour valider un rapprochement manuel
  const validateManualMutation = useMutation({
    mutationFn: async (deliveryId: number) => {
      return await apiRequest(`/api/deliveries/${deliveryId}`, "PUT", {
        reconciled: true,
        validatedAt: new Date().toISOString()
      });
    },
    onSuccess: () => {
      toast({
        title: "Succès",
        description: "Rapprochement validé avec succès",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/deliveries/bl'] });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de valider le rapprochement",
        variant: "destructive",
      });
    }
  });

  // Mutation pour dévalider un rapprochement (admins uniquement)
  const devalidateMutation = useMutation({
    mutationFn: async (deliveryId: number) => {
      return await apiRequest(`/api/deliveries/${deliveryId}`, "PUT", {
        reconciled: false,
        validatedAt: null
      });
    },
    onSuccess: () => {
      toast({
        title: "Succès",
        description: "Rapprochement dévalidé avec succès",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/deliveries/bl'] });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de dévalider le rapprochement",
        variant: "destructive",
      });
    }
  });

  // Mutation pour supprimer une ligne (admins uniquement)
  const deleteMutation = useMutation({
    mutationFn: async (deliveryId: number) => {
      return await apiRequest(`/api/deliveries/${deliveryId}`, "DELETE");
    },
    onSuccess: () => {
      toast({
        title: "Succès",
        description: "Ligne supprimée avec succès",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/deliveries/bl'] });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la ligne",
        variant: "destructive",
      });
    }
  });

  // Fonctions de gestion des actions
  const handleValidateManual = (deliveryId: number) => {
    if (!permissions.canValidate('reconciliation')) {
      toast({
        title: "Accès refusé",
        description: "Vous n'avez pas les permissions pour valider les rapprochements",
        variant: "destructive",
      });
      return;
    }
    validateManualMutation.mutate(deliveryId);
  };

  const handleDevalidate = (deliveryId: number) => {
    if (!permissions.canEdit('reconciliation')) {
      toast({
        title: "Accès refusé",
        description: "Seuls les administrateurs peuvent dévalider les rapprochements",
        variant: "destructive",
      });
      return;
    }
    if (confirm("Êtes-vous sûr de vouloir dévalider ce rapprochement ?")) {
      devalidateMutation.mutate(deliveryId);
    }
  };

  const handleDelete = (deliveryId: number) => {
    if (!permissions.canDelete('reconciliation')) {
      toast({
        title: "Accès refusé",
        description: "Seuls les administrateurs peuvent supprimer les lignes",
        variant: "destructive",
      });
      return;
    }
    if (confirm("Êtes-vous sûr de vouloir supprimer cette ligne ? Cette action est irréversible.")) {
      deleteMutation.mutate(deliveryId);
    }
  };

  // Filtrage des livraisons par recherche
  const filterDeliveries = (deliveries: any[]) => {
    return deliveries.filter((delivery: any) => {
      const searchLower = searchTerm.toLowerCase();
      return (
        delivery.supplier?.name?.toLowerCase().includes(searchLower) ||
        delivery.blNumber?.toLowerCase().includes(searchLower) ||
        delivery.invoiceReference?.toLowerCase().includes(searchLower)
      );
    });
  };

  const filteredManualDeliveries = filterDeliveries(manualReconciliationDeliveries);
  const filteredAutomaticDeliveries = filterDeliveries(automaticReconciliationDeliveries);

  // Vérifier si une ligne est dévalidée (pour la coloration)
  const isDevalidated = (delivery: any) => {
    return delivery.reconciled === false && delivery.validatedAt === null;
  };

  if (isLoading || suppliersLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header avec onglets */}
      <div className="bg-white border-b border-gray-200 p-6 shadow-sm -m-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 flex items-center">
              <FileText className="w-6 h-6 mr-3 text-blue-600" />
              Rapprochement BL/Factures
            </h2>
            <p className="text-gray-600 mt-1">
              Gestion des rapprochements manuels et automatiques
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <Badge variant="outline" className="text-sm border border-gray-300">
              {manualReconciliationDeliveries.length} rapprochements manuels
            </Badge>
            <Badge variant="outline" className="text-sm border border-gray-300 bg-blue-50">
              {automaticReconciliationDeliveries.length} rapprochements automatiques
            </Badge>
          </div>
        </div>

        {/* Onglets */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="manual" className="flex items-center space-x-2">
              <Edit className="w-4 h-4" />
              <span>Rapprochement Manuel</span>
              <Badge variant="secondary" className="ml-2">
                {manualReconciliationDeliveries.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="automatic" className="flex items-center space-x-2">
              <Settings className="w-4 h-4" />
              <span>Rapprochement Automatique</span>
              <Badge variant="secondary" className="ml-2">
                {automaticReconciliationDeliveries.length}
              </Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Filtre de recherche */}
      <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Rechercher par fournisseur, BL ou facture..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 border border-gray-300 shadow-sm"
          />
        </div>
      </div>

      {/* Contenu des onglets */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsContent value="manual" className="space-y-6">
          {filteredManualDeliveries.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Aucun rapprochement manuel trouvé
              </h3>
              <p className="text-gray-600">
                Les livraisons de fournisseurs en mode manuel apparaîtront ici.
              </p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 shadow-lg overflow-hidden rounded-lg">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Fournisseur
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        N° BL
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date Livr.
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Montant BL
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ref. Facture
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Montant Fact.
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Statut
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredManualDeliveries.map((delivery: any) => (
                      <tr 
                        key={delivery.id} 
                        className={`hover:bg-gray-50 ${
                          delivery.reconciled ? 'bg-green-50' : 
                          isDevalidated(delivery) ? 'bg-red-50' : ''
                        }`}
                      >
                        <td className="px-3 py-2 text-sm">
                          <div className="font-medium text-gray-900 truncate max-w-32">
                            {delivery.supplier?.name}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-sm">
                          <div className="text-gray-900">
                            {delivery.blNumber || (
                              <span className="text-gray-400 italic text-xs">Non renseigné</span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-sm">
                          <div className="text-gray-900">
                            {safeFormat(delivery.scheduledDate, 'dd/MM/yy')}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-sm">
                          <div className="font-medium text-gray-900">
                            {delivery.blAmount ? 
                              `${parseFloat(delivery.blAmount).toFixed(2)}€` :
                              <span className="text-gray-400 italic text-xs">Non renseigné</span>
                            }
                          </div>
                        </td>
                        <td className="px-3 py-2 text-sm">
                          <div className="text-gray-900">
                            {delivery.invoiceReference || (
                              <span className="text-gray-400 italic text-xs">Non renseigné</span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-sm">
                          <div className="text-gray-900">
                            {delivery.invoiceAmount ? 
                              `${parseFloat(delivery.invoiceAmount).toFixed(2)}€` : 
                              <span className="text-gray-400 italic text-xs">Non renseigné</span>
                            }
                          </div>
                        </td>
                        <td className="px-3 py-2 text-sm">
                          {delivery.reconciled ? (
                            <Badge variant="default" className="bg-green-600 text-white">
                              Validé
                            </Badge>
                          ) : isDevalidated(delivery) ? (
                            <Badge variant="destructive">
                              Dévalidé
                            </Badge>
                          ) : (
                            <Badge variant="outline">
                              En attente
                            </Badge>
                          )}
                        </td>
                        <td className="px-3 py-2 text-sm">
                          <div className="flex items-center space-x-2">
                            {permissions.canEdit('reconciliation') && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-gray-600 hover:text-blue-600 p-1"
                                title="Modifier"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                            )}
                            
                            {!delivery.reconciled && permissions.canValidate('reconciliation') && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleValidateManual(delivery.id)}
                                disabled={validateManualMutation.isPending}
                                className="text-green-600 hover:text-green-700 p-1"
                                title="Valider"
                              >
                                <Check className="w-4 h-4" />
                              </Button>
                            )}
                            
                            {delivery.reconciled && permissions.canEdit('reconciliation') && user?.role === 'admin' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDevalidate(delivery.id)}
                                disabled={devalidateMutation.isPending}
                                className="text-orange-600 hover:text-orange-700 p-1"
                                title="Dévalider"
                              >
                                <Ban className="w-4 h-4" />
                              </Button>
                            )}
                            
                            {permissions.canDelete('reconciliation') && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(delivery.id)}
                                disabled={deleteMutation.isPending}
                                className="text-red-600 hover:text-red-700 p-1"
                                title="Supprimer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="automatic" className="space-y-6">
          {/* Message d'information */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-blue-900">Mode rapprochement automatique</h4>
                <p className="text-sm text-blue-700 mt-1">
                  Les livraisons de fournisseurs en mode automatique sont validées automatiquement lorsqu'elles ont le statut "delivered" et un numéro de BL.
                  {permissions.canEdit('reconciliation') ? (
                    " Vous pouvez dévalider ces rapprochements si nécessaire."
                  ) : (
                    " Seuls les directeurs et administrateurs peuvent modifier ces rapprochements."
                  )}
                </p>
              </div>
            </div>
          </div>

          {filteredAutomaticDeliveries.length === 0 ? (
            <div className="text-center py-12">
              <Settings className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Aucun rapprochement automatique trouvé
              </h3>
              <p className="text-gray-600">
                Les livraisons de fournisseurs en mode automatique apparaîtront ici.
              </p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 shadow-lg overflow-hidden rounded-lg">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Fournisseur
                        <Badge variant="secondary" className="ml-2 text-xs">AUTO</Badge>
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        N° BL
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date Livr.
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date Valid.
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Montant BL
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ref. Facture
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Statut
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredAutomaticDeliveries.map((delivery: any) => (
                      <tr 
                        key={delivery.id} 
                        className={`hover:bg-gray-50 ${
                          isDevalidated(delivery) ? 'bg-red-50' : 'bg-green-50'
                        }`}
                      >
                        <td className="px-3 py-2 text-sm">
                          <div className="flex items-center space-x-2">
                            <div className="font-medium text-gray-900 truncate max-w-32">
                              {delivery.supplier?.name}
                            </div>
                            <div className="w-3 h-3 bg-blue-500 rounded-full" title="Mode automatique" />
                          </div>
                        </td>
                        <td className="px-3 py-2 text-sm">
                          <div className="text-gray-900 font-medium">
                            {delivery.blNumber || '-'}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-sm">
                          <div className="text-gray-900">
                            {safeFormat(delivery.scheduledDate, 'dd/MM/yy')}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-sm">
                          <div className="text-gray-900">
                            {delivery.reconciled && delivery.validatedAt ? 
                              safeFormat(delivery.validatedAt, 'dd/MM/yy') : 
                              '-'
                            }
                          </div>
                        </td>
                        <td className="px-3 py-2 text-sm">
                          <div className="font-medium text-gray-900">
                            {delivery.blAmount ? 
                              `${parseFloat(delivery.blAmount).toFixed(2)}€` :
                              '-'
                            }
                          </div>
                        </td>
                        <td className="px-3 py-2 text-sm">
                          <div className="text-gray-900">
                            {delivery.invoiceReference || '-'}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-sm">
                          {isDevalidated(delivery) ? (
                            <Badge variant="destructive">
                              Dévalidé
                            </Badge>
                          ) : (
                            <Badge variant="default" className="bg-green-600 text-white">
                              Auto-validé
                            </Badge>
                          )}
                        </td>
                        <td className="px-3 py-2 text-sm">
                          <div className="flex items-center space-x-2">
                            {isDevalidated(delivery) && permissions.canEdit('reconciliation') && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-gray-600 hover:text-blue-600 p-1"
                                  title="Modifier"
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleValidateManual(delivery.id)}
                                  disabled={validateManualMutation.isPending}
                                  className="text-green-600 hover:text-green-700 p-1"
                                  title="Valider"
                                >
                                  <Check className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                            
                            {!isDevalidated(delivery) && permissions.canEdit('reconciliation') && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDevalidate(delivery.id)}
                                disabled={devalidateMutation.isPending}
                                className="text-orange-600 hover:text-orange-700 p-1"
                                title="Dévalider"
                              >
                                <Ban className="w-4 h-4" />
                              </Button>
                            )}
                            
                            {permissions.canDelete('reconciliation') && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(delivery.id)}
                                disabled={deleteMutation.isPending}
                                className="text-red-600 hover:text-red-700 p-1"
                                title="Supprimer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}