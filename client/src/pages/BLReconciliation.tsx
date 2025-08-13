import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { safeFormat } from "@/lib/dateUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useStore } from "@/components/Layout";
import { useAuthUnified } from "@/hooks/useAuthUnified";
import { usePermissions } from "@shared/permissions";
import { Pagination, usePagination } from "@/components/ui/pagination";
import { Search, Edit, FileText, Settings, Eye, AlertTriangle, X, Check, Trash2, Ban, Filter } from "lucide-react";
import ReconciliationModal from "@/components/modals/ReconciliationModal";

export default function BLReconciliation() {
  const { user } = useAuthUnified();
  const { selectedStoreId } = useStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const permissions = usePermissions(user?.role);
  
  // Redirection pour les employés
  if (user?.role === 'employee') {
    return (
      <div className="p-4 sm:p-6">
        <div className="bg-orange-50 border-l-4 border-orange-400 p-4 rounded-r-lg">
          <div className="flex">
            <div className="flex-shrink-0">
              <FileText className="h-5 w-5 text-orange-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-orange-700">
                <strong>Accès restreint</strong><br />
                Seuls les managers et administrateurs peuvent accéder au module de rapprochement BL/Factures.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  const [activeTab, setActiveTab] = useState("manual");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDelivery, setSelectedDelivery] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Récupérer les fournisseurs pour la logique automatique
  const { data: suppliers = [] } = useQuery<any[]>({
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
    enabled: !!user
  });

  // Séparer les livraisons par mode de rapprochement
  const manualReconciliationDeliveries = deliveriesWithBL.filter((delivery: any) => {
    const supplier = suppliers.find(s => s.id === delivery.supplierId);
    return supplier?.automaticReconciliation !== true;
  });

  const automaticReconciliationDeliveries = deliveriesWithBL.filter((delivery: any) => {
    const supplier = suppliers.find(s => s.id === delivery.supplierId);
    return supplier?.automaticReconciliation === true;
  });

  // Fonctions de gestion
  const handleOpenModal = (delivery: any) => {
    setSelectedDelivery(delivery);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setSelectedDelivery(null);
    setIsModalOpen(false);
  };

  const handleSaveReconciliation = async (data: any) => {
    try {
      await apiRequest(`/api/deliveries/${selectedDelivery.id}`, "PUT", data);
      
      toast({
        title: "Succès",
        description: "Données de rapprochement mises à jour",
      });
      
      queryClient.invalidateQueries({ queryKey: ['/api/deliveries/bl'] });
      handleCloseModal();
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour les données",
        variant: "destructive",
      });
    }
  };

  const handleQuickValidate = async (delivery: any) => {
    try {
      await apiRequest(`/api/deliveries/${delivery.id}`, "PUT", {
        reconciled: true,
        validatedAt: new Date().toISOString()
      });
      
      toast({
        title: "Succès",
        description: "Rapprochement validé avec succès",
      });
      
      queryClient.invalidateQueries({ queryKey: ['/api/deliveries/bl'] });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de valider le rapprochement",
        variant: "destructive",
      });
    }
  };

  const handleDevalidateReconciliation = async (deliveryId: number) => {
    if (user?.role !== 'admin') {
      toast({
        title: "Accès refusé",
        description: "Seuls les administrateurs peuvent dévalider les rapprochements",
        variant: "destructive",
      });
      return;
    }

    if (!window.confirm("Êtes-vous sûr de vouloir dévalider ce rapprochement ?")) {
      return;
    }

    try {
      await apiRequest(`/api/deliveries/${deliveryId}`, "PUT", {
        reconciled: false,
        validatedAt: null
      });
      
      toast({
        title: "Succès",
        description: "Rapprochement dévalidé avec succès",
      });
      
      queryClient.invalidateQueries({ queryKey: ['/api/deliveries/bl'] });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de dévalider le rapprochement",
        variant: "destructive",
      });
    }
  };

  const handleDeleteDelivery = async (deliveryId: number) => {
    if (!permissions.canDelete('reconciliation')) {
      toast({
        title: "Accès refusé",
        description: "Seuls les administrateurs peuvent supprimer les livraisons",
        variant: "destructive",
      });
      return;
    }

    if (!window.confirm("Êtes-vous sûr de vouloir supprimer cette livraison ? Cette action est irréversible.")) {
      return;
    }

    try {
      await apiRequest(`/api/deliveries/${deliveryId}`, "DELETE");
      
      toast({
        title: "Succès",
        description: "Livraison supprimée avec succès",
      });
      
      queryClient.invalidateQueries({ queryKey: ['/api/deliveries/bl'] });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la livraison",
        variant: "destructive",
      });
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

  // Pagination pour les rapprochements manuels
  const {
    currentPage: manualCurrentPage,
    setCurrentPage: setManualCurrentPage,
    itemsPerPage: manualItemsPerPage,
    setItemsPerPage: setManualItemsPerPage,
    totalPages: manualTotalPages,
    paginatedData: paginatedManualDeliveries,
    totalItems: manualTotalItems
  } = usePagination(filteredManualDeliveries, 20);

  // Pagination pour les rapprochements automatiques
  const {
    currentPage: autoCurrentPage,
    setCurrentPage: setAutoCurrentPage,
    itemsPerPage: autoItemsPerPage,
    setItemsPerPage: setAutoItemsPerPage,
    totalPages: autoTotalPages,
    paginatedData: paginatedAutoDeliveries,
    totalItems: autoTotalItems
  } = usePagination(filteredAutomaticDeliveries, 20);

  const canModify = user?.role === 'directeur' || user?.role === 'admin';

  if (isLoading) {
    return <div className="flex justify-center items-center h-64">Chargement...</div>;
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4 sm:p-6 shadow-sm -m-4 sm:-m-6 mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 flex items-center">
              <FileText className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3 text-blue-600" />
              Rapprochement BL/Factures
            </h2>
            <p className="text-gray-600 mt-1 text-sm sm:text-base">
              Gestion des rapprochements manuels et automatiques
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            <Badge variant="outline" className="text-xs sm:text-sm border border-gray-300">
              {manualReconciliationDeliveries.length} manuels
            </Badge>
            <Badge variant="outline" className="text-xs sm:text-sm border border-gray-300 bg-blue-50">
              {automaticReconciliationDeliveries.length} automatiques
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

      {/* Filters */}
      <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Rechercher par fournisseur, BL ou facture..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 border border-gray-300 shadow-sm w-full"
              />
            </div>
          </div>
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
            <div className="flex-1 overflow-y-auto">
              <div className="bg-white border border-gray-200 shadow-lg overflow-hidden">
                {/* Pagination du haut */}
                <div className="p-4 border-b border-gray-200">
                  <Pagination
                    currentPage={manualCurrentPage}
                    totalPages={manualTotalPages}
                    totalItems={manualTotalItems}
                    itemsPerPage={manualItemsPerPage}
                    onPageChange={setManualCurrentPage}
                    onItemsPerPageChange={setManualItemsPerPage}
                  />
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px]">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Fournisseur
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          N° BL
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date Livr.
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Montant BL
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Ref. Facture
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Montant Fact.
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Écart
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Magasin
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {paginatedManualDeliveries.map((delivery: any) => (
                        <tr 
                          key={delivery.id} 
                          className={`hover:bg-gray-50 ${
                            delivery.reconciled === true 
                              ? 'bg-gray-100 opacity-60 text-gray-500' 
                              : 'bg-white'
                          }`}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                              <div className={`truncate max-w-32 ${
                                delivery.reconciled !== true 
                                  ? 'font-bold text-gray-900' 
                                  : 'font-medium text-gray-900'
                              }`}>
                                {delivery.supplier?.name}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-sm">
                              <div className={`${
                                delivery.reconciled !== true 
                                  ? 'font-bold text-gray-900' 
                                  : 'text-gray-900'
                              }`}>
                                {delivery.blNumber || (
                                  <span className="text-gray-400 italic text-xs">Non renseigné</span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                {safeFormat(delivery.scheduledDate, 'dd/MM/yy')}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className={`text-sm ${delivery.reconciled !== true ? 'font-medium text-gray-900' : 'text-gray-600'}`}>
                                {delivery.blAmount ? 
                                  `${parseFloat(delivery.blAmount).toFixed(2)}€` :
                                  <span className="text-gray-400 italic">Non renseigné</span>
                                }
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className={`text-sm ${delivery.reconciled !== true ? 'font-medium text-gray-900' : 'text-gray-600'}`}>
                                {delivery.invoiceReference || (
                                  <span className="text-gray-400 italic">Non renseigné</span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className={`text-sm ${delivery.reconciled !== true ? 'font-medium text-gray-900' : 'text-gray-600'}`}>
                                {delivery.invoiceAmount ? 
                                  `${parseFloat(delivery.invoiceAmount).toFixed(2)}€` : 
                                  <span className="text-gray-400 italic">Non renseigné</span>
                                }
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <div className="flex justify-center">
                                {(() => {
                                  const blAmount = delivery.blAmount ? parseFloat(delivery.blAmount) : 0;
                                  const invoiceAmount = delivery.invoiceAmount ? parseFloat(delivery.invoiceAmount) : 0;
                                  if (blAmount && invoiceAmount) {
                                    const diff = blAmount - invoiceAmount;
                                    const diffAbs = Math.abs(diff);
                                    return (
                                      <div className={`font-medium text-right ${
                                        diff === 0 ? 'text-green-600' : 
                                        diffAbs > 10 ? 'text-red-600' : 'text-orange-600'
                                      }`}>
                                        {diff > 0 ? '+' : ''}{diff.toFixed(2)}€
                                      </div>
                                    );
                                  }
                                  return <span className="text-gray-400 italic text-xs">-</span>;
                                })()}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                {delivery.group?.name}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right">
                              <div className="flex items-center justify-end space-x-2">
                                {!delivery.reconciled ? (
                                  <>
                                    {permissions.canValidate('reconciliation') && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleQuickValidate(delivery)}
                                        className="h-8 w-8 p-0"
                                        title="Valider le rapprochement"
                                      >
                                        <Check className="w-4 h-4" />
                                      </Button>
                                    )}
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleOpenModal(delivery)}
                                      className="h-8 w-8 p-0"
                                      title="Modifier les données"
                                    >
                                      <Edit className="w-4 h-4" />
                                    </Button>
                                    {permissions.canDelete('reconciliation') && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleDeleteDelivery(delivery.id)}
                                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                                        title="Supprimer la livraison"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    )}
                                  </>
                                ) : (
                                  <>
                                    {user?.role === 'admin' && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleDevalidateReconciliation(delivery.id)}
                                        className="h-8 w-8 p-0 text-orange-600 hover:text-orange-700"
                                        title="Dévalider le rapprochement"
                                      >
                                        <Ban className="w-4 h-4" />
                                      </Button>
                                    )}
                                    {permissions.canDelete('reconciliation') && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleDeleteDelivery(delivery.id)}
                                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                                        title="Supprimer la livraison"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    )}
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                
                {/* Pagination du bas */}
                <div className="p-4 border-t border-gray-200">
                  <Pagination
                    currentPage={manualCurrentPage}
                    totalPages={manualTotalPages}
                    totalItems={manualTotalItems}
                    itemsPerPage={manualItemsPerPage}
                    onPageChange={setManualCurrentPage}
                    onItemsPerPageChange={setManualItemsPerPage}
                  />
                </div>
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
                  {user?.role === 'admin' ? (
                    " Vous pouvez dévalider ces rapprochements si nécessaire."
                  ) : (
                    " Seuls les administrateurs peuvent dévalider ces rapprochements."
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
            <div className="flex-1 overflow-y-auto">
              <div className="bg-white border border-gray-200 shadow-lg overflow-hidden">
                {/* Pagination du haut */}
                <div className="p-4 border-b border-gray-200">
                  <Pagination
                    currentPage={autoCurrentPage}
                    totalPages={autoTotalPages}
                    totalItems={autoTotalItems}
                    itemsPerPage={autoItemsPerPage}
                    onPageChange={setAutoCurrentPage}
                    onItemsPerPageChange={setAutoItemsPerPage}
                  />
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px]">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Fournisseur
                          <Badge variant="secondary" className="ml-2 text-xs">AUTO</Badge>
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          N° BL
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date Livr.
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date Valid.
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Magasin
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {paginatedAutoDeliveries.map((delivery: any) => (
                          <tr key={delivery.id} className="hover:bg-gray-50 bg-green-50">
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
                              <div className="text-gray-900">
                                {delivery.validatedAt ? 
                                  safeFormat(delivery.validatedAt, 'dd/MM/yy HH:mm') :
                                  <span className="text-gray-400 italic text-xs">Non validé</span>
                                }
                              </div>
                            </td>
                            <td className="px-3 py-2 text-sm">
                              <div className="text-gray-900">
                                {delivery.group?.name}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-sm">
                              <div className="flex items-center space-x-2">
                                {user?.role === 'admin' && (
                                  <button
                                    onClick={() => handleDevalidateReconciliation(delivery.id)}
                                    className="text-gray-600 hover:text-orange-600 transition-colors duration-200 p-1 hover:bg-orange-50 rounded"
                                    title="Dévalider le rapprochement automatique"
                                  >
                                    <Ban className="w-4 h-4" />
                                  </button>
                                )}
                                {permissions.canDelete('reconciliation') && (
                                  <button
                                    onClick={() => handleDeleteDelivery(delivery.id)}
                                    className="text-gray-600 hover:text-red-600 transition-colors duration-200 p-1 hover:bg-red-50 rounded"
                                    title="Supprimer la livraison"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleOpenModal(delivery)}
                                  className="text-gray-600 hover:text-blue-600 transition-colors duration-200 p-1 hover:bg-blue-50 rounded"
                                  title="Voir les détails"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                
                {/* Pagination du bas */}
                <div className="p-4 border-t border-gray-200">
                  <Pagination
                    currentPage={autoCurrentPage}
                    totalPages={autoTotalPages}
                    totalItems={autoTotalItems}
                    itemsPerPage={autoItemsPerPage}
                    onPageChange={setAutoCurrentPage}
                    onItemsPerPageChange={setAutoItemsPerPage}
                  />
                </div>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Modal de rapprochement */}
      {selectedDelivery && (
        <ReconciliationModal
          isOpen={isModalOpen}
          delivery={selectedDelivery}
          onSave={handleSaveReconciliation}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}