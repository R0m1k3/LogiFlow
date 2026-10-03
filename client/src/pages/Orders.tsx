import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pagination, usePagination } from "@/components/ui/pagination";
import { useAuthUnified } from "@/hooks/useAuthUnified";
import { useStore } from "@/contexts/StoreContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { usePermissions } from "@shared/permissions";
import { 
  Plus, 
  Search, 
  Filter, 
  Package, 
  Calendar,
  Eye,
  Edit,
  Trash2,
  Building,
  User,
} from "lucide-react";
import { safeFormat } from "@/lib/dateUtils";
import CreateOrderModal from "@/components/modals/CreateOrderModal";
import EditOrderModal from "@/components/modals/EditOrderModal";
import OrderDetailModal from "@/components/modals/OrderDetailModal";
import ConfirmDeleteModal from "@/components/modals/ConfirmDeleteModal";
import type { OrderWithRelations } from "@shared/schema";

// Référence stable pendant le chargement (pour la mémoïsation du filtrage)
const NO_ORDERS: OrderWithRelations[] = [];

export default function Orders() {
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
              <Package className="h-5 w-5 text-orange-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-orange-700">
                <strong>Accès restreint</strong><br />
                Seuls les managers et administrateurs peuvent accéder à la page des commandes.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderWithRelations | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<OrderWithRelations | null>(null);

  // Construire l'URL pour l'historique complet sans filtrage par date
  // CRITICAL FIX: Appliquer le filtrage par storeId pour TOUS les rôles, pas seulement admin
  const ordersUrl = `/api/orders${selectedStoreId ? `?storeId=${selectedStoreId}` : ''}`;
  
  
  const { data: ordersData = NO_ORDERS, isLoading } = useQuery<OrderWithRelations[]>({
    queryKey: [ordersUrl, selectedStoreId],
    queryFn: async () => {
      const response = await fetch(ordersUrl, { credentials: 'include' });
      if (!response.ok) {
        throw new Error('Failed to fetch orders');
      }
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
  });

  // Production Bug Fix: Ensure array safety for all data operations
  const orders = Array.isArray(ordersData) ? ordersData : NO_ORDERS;

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest(`/api/orders/${id}`, "DELETE");
    },
    onSuccess: () => {
      toast({
        title: "Succès",
        description: "Commande supprimée avec succès",
      });
      
      // Invalidation ciblée sans clear() pour préserver le contexte : les requêtes
      // affichées sont rechargées tout de suite, les autres (mois du calendrier
      // déjà visités, autres pages) seulement quand elles seront réaffichées
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0]?.toString() || '';
          return key.includes('/api/orders') || key.includes('/api/deliveries');
        }
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Non autorisé",
          description: "Vous êtes déconnecté. Reconnexion...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la commande",
        variant: "destructive",
      });
    },
  });

  // Filtrage recalculé seulement quand la liste, la recherche ou le statut changent
  const filteredOrders = useMemo(() => {
    const search = searchTerm.toLowerCase();
    return orders.filter(order => {
      const matchesSearch = order.supplier?.name.toLowerCase().includes(search) ||
                           order.group?.name.toLowerCase().includes(search) ||
                           order.notes?.toLowerCase().includes(search);
      
      const matchesStatus = statusFilter === "all" || order.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [orders, searchTerm, statusFilter]);

  // Pagination
  const {
    currentPage,
    setCurrentPage,
    itemsPerPage,
    setItemsPerPage,
    totalPages,
    paginatedData: paginatedOrders,
    totalItems
  } = usePagination(filteredOrders, 20);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">En attente</Badge>;
      case 'planned':
        return <Badge className="bg-blue-100 text-blue-800">Planifié</Badge>;
      case 'delivered':
        return <Badge className="bg-green-100 text-green-800">Livré</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleViewOrder = (order: OrderWithRelations) => {
    setSelectedOrder({ ...order, type: 'order' } as any);
    setShowDetailModal(true);
  };

  const handleEditOrder = (order: OrderWithRelations) => {
    setSelectedOrder(order);
    setShowEditModal(true);
  };

  const handleDeleteOrder = (order: OrderWithRelations) => {
    setOrderToDelete(order);
    setShowDeleteModal(true);
  };

  const confirmDeleteOrder = () => {
    if (orderToDelete) {
      deleteMutation.mutate(orderToDelete.id);
      setShowDeleteModal(false);
      setOrderToDelete(null);
    }
  };

  const canCreate = permissions.canCreate('orders');
  const canEdit = permissions.canEdit('orders');
  const canDelete = permissions.canDelete('orders');

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4 sm:p-6 shadow-sm -m-4 sm:-m-6 mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 flex items-center">
              <Package className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3 text-blue-600" />
              Gestion des Commandes
            </h2>
            <p className="text-gray-600 mt-1 text-sm sm:text-base">
              {filteredOrders.length} commande{filteredOrders.length !== 1 ? 's' : ''}
            </p>
          </div>
          {canCreate && (
            <Button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white shadow-md w-full sm:w-auto"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nouvelle Commande
            </Button>
          )}
        </div>
      </div>


      {/* Filters */}
      <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Rechercher par fournisseur, groupe..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 border border-gray-300 shadow-sm w-full"
              />
            </div>
          </div>
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-48 border border-gray-300 shadow-sm">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Filtrer par statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="pending">En attente</SelectItem>
              <SelectItem value="planned">Planifié</SelectItem>
              <SelectItem value="delivered">Livré</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Orders List */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <Package className="w-16 h-16 mb-4 text-gray-300" />
            <h3 className="text-lg font-medium mb-2">Aucune commande trouvée</h3>
            <p className="text-center max-w-md">
              {searchTerm || statusFilter !== "all"
                ? "Aucune commande ne correspond à vos critères de recherche."
                : "Vous n'avez pas encore de commandes. Créez votre première commande pour commencer."}
            </p>
            {canCreate && !searchTerm && statusFilter === "all" && (
              <Button
                onClick={() => setShowCreateModal(true)}
                className="mt-4 bg-primary hover:bg-blue-700 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Créer une commande
              </Button>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className="bg-white border border-gray-200 shadow-lg overflow-hidden">
              <div>
                <table className="w-full min-w-[700px]">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Fournisseur
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Groupe
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date prévue
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Statut
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Créé par
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginatedOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <Building className="w-5 h-5 text-gray-400 mr-2" />
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {order.supplier?.name}
                              </div>
                              <div className="text-sm text-gray-500">
                                #{order.id}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div 
                              className="w-3 h-3 rounded-full mr-2" 
                              style={{ backgroundColor: order.group?.color }}
                            />
                            <span className="text-sm text-gray-900">{order.group?.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div className="flex items-center">
                            <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                            {safeFormat(order.plannedDate, 'dd MMM yyyy')}
                          </div>
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(order.status)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div className="flex items-center">
                            <User className="w-4 h-4 text-gray-400 mr-2" />
                            {order.creator?.firstName} {order.creator?.lastName}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewOrder(order)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {canEdit && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditOrder(order)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                            )}
                            {canDelete && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteOrder(order)}
                                className="text-red-600 hover:text-red-700"
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
              
              {/* Pagination */}
              <div className="p-4 border-t border-gray-200">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={totalItems}
                  itemsPerPage={itemsPerPage}
                  onPageChange={setCurrentPage}
                  onItemsPerPageChange={setItemsPerPage}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreateModal && (
        <CreateOrderModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          selectedDate={null}
        />
      )}

      {showEditModal && selectedOrder && (
        <EditOrderModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          order={selectedOrder}
        />
      )}

      {showDetailModal && selectedOrder && (
        <OrderDetailModal
          isOpen={showDetailModal}
          onClose={() => setShowDetailModal(false)}
          item={selectedOrder}
        />
      )}

      {/* Modal de confirmation de suppression */}
      <ConfirmDeleteModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setOrderToDelete(null);
        }}
        onConfirm={confirmDeleteOrder}
        title="Supprimer la commande"
        description="Êtes-vous sûr de vouloir supprimer cette commande ?"
        itemName={orderToDelete ? `${orderToDelete.supplier?.name} - ${safeFormat(orderToDelete.plannedDate, 'dd/MM/yyyy')}` : undefined}
        isLoading={deleteMutation.isPending}
      />

    </div>
  );
}
