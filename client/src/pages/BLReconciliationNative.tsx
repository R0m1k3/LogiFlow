import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { safeFormat } from "@/lib/dateUtils";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useStore } from "@/contexts/StoreContext";
import { useAuthUnified } from "@/hooks/useAuthUnified";
import { usePermissions } from "@shared/permissions";
import { Search, Edit, FileText, Settings, Eye, AlertTriangle, X, Check, Trash2, Ban, ChevronLeft, ChevronRight } from "lucide-react";
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
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

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

  // Mutations pour les actions
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

  // Pagination
  const getCurrentPageData = (data: any[]) => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return data.slice(startIndex, endIndex);
  };

  const getTotalPages = (data: any[]) => {
    return Math.ceil(data.length / itemsPerPage);
  };

  const currentManualData = getCurrentPageData(filteredManualDeliveries);
  const currentAutomaticData = getCurrentPageData(filteredAutomaticDeliveries);

  const totalManualPages = getTotalPages(filteredManualDeliveries);
  const totalAutomaticPages = getTotalPages(filteredAutomaticDeliveries);

  // Reset page when changing tabs or searching
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchTerm]);

  // Vérifier si une ligne est dévalidée (pour la coloration)
  const isDevalidated = (delivery: any) => {
    return delivery.reconciled === false && delivery.validatedAt === null;
  };

  // Composant de pagination simplifiée
  const NativePagination = ({ currentPage, totalPages, onPageChange, totalItems, itemsPerPage }: {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    totalItems: number;
    itemsPerPage: number;
  }) => {
    if (totalPages <= 1) return null;

    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);

    return (
      <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200">
        <div className="flex items-center text-sm text-gray-700">
          <span>
            Affichage de {startItem} à {endItem} sur {totalItems} éléments
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-3 py-1 text-sm border border-gray-300 rounded bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Précédent</span>
          </button>
          
          <span className="px-3 py-1 text-sm bg-gray-100 rounded">
            Page {currentPage} sur {totalPages}
          </span>
          
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-3 py-1 text-sm border border-gray-300 rounded bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
          >
            <span>Suivant</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  // Badge native
  const NativeBadge = ({ children, variant = "default", className = "" }: { children: React.ReactNode, variant?: string, className?: string }) => {
    const baseClasses = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium";
    const variantClasses = {
      default: "bg-blue-100 text-blue-800",
      secondary: "bg-gray-100 text-gray-800",
      destructive: "bg-red-100 text-red-800",
      outline: "border border-gray-300 text-gray-700 bg-white"
    };
    
    return (
      <span className={`${baseClasses} ${variantClasses[variant as keyof typeof variantClasses] || variantClasses.default} ${className}`}>
        {children}
      </span>
    );
  };

  // Button native
  const NativeButton = ({ children, onClick, disabled = false, variant = "default", size = "default", className = "", title = "" }: {
    children: React.ReactNode,
    onClick?: () => void,
    disabled?: boolean,
    variant?: string,
    size?: string,
    className?: string,
    title?: string
  }) => {
    const baseClasses = "inline-flex items-center justify-center font-medium rounded transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2";
    const variantClasses = {
      default: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500",
      ghost: "text-gray-600 hover:text-gray-900 hover:bg-gray-100",
      outline: "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
    };
    const sizeClasses = {
      default: "px-4 py-2 text-sm",
      sm: "px-2 py-1 text-xs"
    };
    
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        title={title}
        className={`${baseClasses} ${variantClasses[variant as keyof typeof variantClasses] || variantClasses.default} ${sizeClasses[size as keyof typeof sizeClasses] || sizeClasses.default} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
      >
        {children}
      </button>
    );
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
            <NativeBadge variant="outline" className="text-sm border border-gray-300">
              {manualReconciliationDeliveries.length} rapprochements manuels
            </NativeBadge>
            <NativeBadge variant="outline" className="text-sm border border-gray-300 bg-blue-50">
              {automaticReconciliationDeliveries.length} rapprochements automatiques
            </NativeBadge>
          </div>
        </div>

        {/* Onglets natifs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab("manual")}
              className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                activeTab === "manual"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              <Edit className="w-4 h-4" />
              <span>Rapprochement Manuel</span>
              <NativeBadge variant="secondary" className="ml-2">
                {manualReconciliationDeliveries.length}
              </NativeBadge>
            </button>
            <button
              onClick={() => setActiveTab("automatic")}
              className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                activeTab === "automatic"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Rapprochement Automatique</span>
              <NativeBadge variant="secondary" className="ml-2">
                {automaticReconciliationDeliveries.length}
              </NativeBadge>
            </button>
          </nav>
        </div>
      </div>

      {/* Filtre de recherche */}
      <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher par fournisseur, BL ou facture..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Contenu des onglets */}
      {activeTab === "manual" && (
        <div className="space-y-6">
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
              {/* Pagination du haut */}
              <NativePagination
                currentPage={currentPage}
                totalPages={totalManualPages}
                onPageChange={setCurrentPage}
                totalItems={filteredManualDeliveries.length}
                itemsPerPage={itemsPerPage}
              />
              
              <div className="table-container">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fournisseur</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">N° BL</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date Livr.</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Montant BL</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ref. Facture</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Montant Fact.</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {currentManualData.map((delivery: any) => (
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
                            <NativeBadge variant="default" className="bg-green-600 text-white">
                              Validé
                            </NativeBadge>
                          ) : isDevalidated(delivery) ? (
                            <NativeBadge variant="destructive">
                              Dévalidé
                            </NativeBadge>
                          ) : (
                            <NativeBadge variant="outline">
                              En attente
                            </NativeBadge>
                          )}
                        </td>
                        <td className="px-3 py-2 text-sm">
                          <div className="flex items-center space-x-2">
                            {permissions.canEdit('reconciliation') && (
                              <NativeButton
                                variant="ghost"
                                size="sm"
                                className="text-gray-600 hover:text-blue-600 p-1"
                                title="Modifier"
                              >
                                <Edit className="w-4 h-4" />
                              </NativeButton>
                            )}
                            
                            {!delivery.reconciled && permissions.canValidate('reconciliation') && (
                              <NativeButton
                                variant="ghost"
                                size="sm"
                                onClick={() => handleValidateManual(delivery.id)}
                                disabled={validateManualMutation.isPending}
                                className="text-green-600 hover:text-green-700 p-1"
                                title="Valider"
                              >
                                <Check className="w-4 h-4" />
                              </NativeButton>
                            )}
                            
                            {delivery.reconciled && permissions.canEdit('reconciliation') && user?.role === 'admin' && (
                              <NativeButton
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDevalidate(delivery.id)}
                                disabled={devalidateMutation.isPending}
                                className="text-orange-600 hover:text-orange-700 p-1"
                                title="Dévalider"
                              >
                                <Ban className="w-4 h-4" />
                              </NativeButton>
                            )}
                            
                            {permissions.canDelete('reconciliation') && (
                              <NativeButton
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(delivery.id)}
                                disabled={deleteMutation.isPending}
                                className="text-red-600 hover:text-red-700 p-1"
                                title="Supprimer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </NativeButton>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination du bas */}
              <NativePagination
                currentPage={currentPage}
                totalPages={totalManualPages}
                onPageChange={setCurrentPage}
                totalItems={filteredManualDeliveries.length}
                itemsPerPage={itemsPerPage}
              />
            </div>
          )}
        </div>
      )}
      
      {activeTab === "automatic" && (
        <div className="space-y-6">
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
              {/* Pagination du haut */}
              <NativePagination
                currentPage={currentPage}
                totalPages={totalAutomaticPages}
                onPageChange={setCurrentPage}
                totalItems={filteredAutomaticDeliveries.length}
                itemsPerPage={itemsPerPage}
              />
              
              <div className="table-container">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Fournisseur
                        <NativeBadge variant="secondary" className="ml-2 text-xs">AUTO</NativeBadge>
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">N° BL</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date Livr.</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date Valid.</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Montant BL</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ref. Facture</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {currentAutomaticData.map((delivery: any) => (
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
                            <NativeBadge variant="destructive">
                              Dévalidé
                            </NativeBadge>
                          ) : (
                            <NativeBadge variant="default" className="bg-green-600 text-white">
                              Auto-validé
                            </NativeBadge>
                          )}
                        </td>
                        <td className="px-3 py-2 text-sm">
                          <div className="flex items-center space-x-2">
                            {isDevalidated(delivery) && permissions.canEdit('reconciliation') && (
                              <>
                                <NativeButton
                                  variant="ghost"
                                  size="sm"
                                  className="text-gray-600 hover:text-blue-600 p-1"
                                  title="Modifier"
                                >
                                  <Edit className="w-4 h-4" />
                                </NativeButton>
                                <NativeButton
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleValidateManual(delivery.id)}
                                  disabled={validateManualMutation.isPending}
                                  className="text-green-600 hover:text-green-700 p-1"
                                  title="Valider"
                                >
                                  <Check className="w-4 h-4" />
                                </NativeButton>
                              </>
                            )}
                            
                            {!isDevalidated(delivery) && permissions.canEdit('reconciliation') && (
                              <NativeButton
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDevalidate(delivery.id)}
                                disabled={devalidateMutation.isPending}
                                className="text-orange-600 hover:text-orange-700 p-1"
                                title="Dévalider"
                              >
                                <Ban className="w-4 h-4" />
                              </NativeButton>
                            )}
                            
                            {permissions.canDelete('reconciliation') && (
                              <NativeButton
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(delivery.id)}
                                disabled={deleteMutation.isPending}
                                className="text-red-600 hover:text-red-700 p-1"
                                title="Supprimer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </NativeButton>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination du bas */}
              <NativePagination
                currentPage={currentPage}
                totalPages={totalAutomaticPages}
                onPageChange={setCurrentPage}
                totalItems={filteredAutomaticDeliveries.length}
                itemsPerPage={itemsPerPage}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}