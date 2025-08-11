import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuthUnified } from "@/hooks/useAuthUnified";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { 
  Plus, 
  Search, 
  Building, 
  Phone, 
  Mail,
  Edit,
  Trash2,
  Package,
  Truck,
  CheckCircle,
  XCircle
} from "lucide-react";
import type { Supplier } from "@shared/schema";

export default function Suppliers() {
  const { user } = useAuthUnified();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    contact: "",
    phone: "",
    hasDlc: false,
  });

  const { data: suppliers = [], isLoading } = useQuery<Supplier[]>({
    queryKey: ['/api/suppliers'],
    enabled: user?.role === 'admin' || user?.role === 'manager',
  });

  const { data: orders = [] } = useQuery({
    queryKey: ['/api/orders'],
    enabled: user?.role === 'admin' || user?.role === 'manager',
  });

  const { data: deliveries = [] } = useQuery({
    queryKey: ['/api/deliveries'],
    enabled: user?.role === 'admin' || user?.role === 'manager',
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log('🚚 Frontend: Creating supplier with data:', data);
      const result = await apiRequest("/api/suppliers", "POST", data);
      console.log('🚚 Frontend: Supplier creation result:', result);
      return result;
    },
    onSuccess: () => {
      toast({
        title: "Succès",
        description: "Fournisseur créé avec succès",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/suppliers'] });
      setShowCreateModal(false);
      setFormData({ name: "", contact: "", phone: "", hasDlc: false });
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
        description: "Impossible de créer le fournisseur",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log('🔧 Frontend: Updating supplier with data:', data);
      const result = await apiRequest(`/api/suppliers/${selectedSupplier?.id}`, "PUT", data);
      console.log('🔧 Frontend: Supplier update result:', result);
      return result;
    },
    onMutate: async (newData) => {
      // Mise à jour optimiste - mettre à jour l'interface immédiatement
      console.log('🚀 Frontend: Optimistic update starting...');
      await queryClient.cancelQueries({ queryKey: ['/api/suppliers'] });
      
      const previousSuppliers = queryClient.getQueryData(['/api/suppliers']);
      
      if (previousSuppliers && selectedSupplier) {
        const updatedSuppliers = (previousSuppliers as any[]).map(supplier => 
          supplier.id === selectedSupplier.id 
            ? { ...supplier, ...newData, updatedAt: new Date().toISOString() }
            : supplier
        );
        queryClient.setQueryData(['/api/suppliers'], updatedSuppliers);
        console.log('✅ Frontend: Optimistic update applied');
      }
      
      return { previousSuppliers };
    },
    onSuccess: async (result) => {
      console.log('✅ Frontend: Update mutation successful, result:', result);
      console.log('🔄 Frontend: Starting cache invalidation...');
      
      // Forcer une actualisation complète du cache
      await queryClient.invalidateQueries({ queryKey: ['/api/suppliers'] });
      await queryClient.refetchQueries({ 
        queryKey: ['/api/suppliers'],
        type: 'active'
      });
      
      // Attendre un petit délai pour s'assurer que les données sont fraîches
      await new Promise(resolve => setTimeout(resolve, 100));
      
      console.log('✅ Frontend: Cache invalidation complete');
      
      toast({
        title: "Succès",
        description: "Fournisseur modifié avec succès",
      });
      
      setShowEditModal(false);
      setSelectedSupplier(null);
      setFormData({ name: "", contact: "", phone: "", hasDlc: false });
    },
    onError: (error, variables, context) => {
      // Rollback optimiste en cas d'erreur
      if (context?.previousSuppliers) {
        console.log('❌ Frontend: Error occurred, rolling back optimistic update');
        queryClient.setQueryData(['/api/suppliers'], context.previousSuppliers);
      }
      
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
        description: "Impossible de modifier le fournisseur",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest(`/api/suppliers/${id}`, "DELETE");
    },
    onSuccess: () => {
      toast({
        title: "Succès",
        description: "Fournisseur supprimé avec succès",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/suppliers'] });
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
        description: "Impossible de supprimer le fournisseur",
        variant: "destructive",
      });
    },
  });

  const filteredSuppliers = Array.isArray(suppliers) ? suppliers.filter(supplier =>
    supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    supplier.contact?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    supplier.phone?.toLowerCase().includes(searchTerm.toLowerCase())
  ) : [];

  const getSupplierStats = (supplierId: number) => {
    const supplierOrders = Array.isArray(orders) ? orders.filter(order => order.supplierId === supplierId) : [];
    const supplierDeliveries = Array.isArray(deliveries) ? deliveries.filter(delivery => delivery.supplierId === supplierId) : [];
    
    return {
      orders: supplierOrders.length,
      deliveries: supplierDeliveries.length,
      delivered: supplierDeliveries.filter(d => d.status === 'delivered').length,
    };
  };

  const handleCreate = () => {
    setFormData({ name: "", contact: "", phone: "", hasDlc: false });
    setShowCreateModal(true);
  };

  const handleEdit = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setFormData({
      name: supplier.name,
      contact: supplier.contact || "",
      phone: supplier.phone || "",
      hasDlc: supplier.hasDlc || false,
    });
    setShowEditModal(true);
  };

  const handleDelete = (supplier: Supplier) => {
    const stats = getSupplierStats(supplier.id);
    
    if (stats.orders > 0 || stats.deliveries > 0) {
      toast({
        title: "Suppression impossible",
        description: "Ce fournisseur a des commandes ou livraisons associées",
        variant: "destructive",
      });
      return;
    }

    if (window.confirm(`Êtes-vous sûr de vouloir supprimer le fournisseur "${supplier.name}" ?`)) {
      deleteMutation.mutate(supplier.id);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast({
        title: "Erreur",
        description: "Le nom du fournisseur est requis",
        variant: "destructive",
      });
      return;
    }

    if (selectedSupplier) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const canManage = user?.role === 'admin' || user?.role === 'manager';

  if (!canManage) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="text-center">
          <Building className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Accès restreint
          </h2>
          <p className="text-gray-600">
            Vous n'avez pas les permissions nécessaires pour accéder à cette page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 flex items-center">
              <Building className="w-6 h-6 mr-3 text-blue-600" />
              Gestion des Fournisseurs
            </h2>
            <p className="text-gray-600 mt-1">
              {filteredSuppliers.length} fournisseur{filteredSuppliers.length !== 1 ? 's' : ''}
            </p>
          </div>
          <Button
            onClick={handleCreate}
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-md"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nouveau Fournisseur
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="bg-gray-50 border-b border-gray-200 p-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Rechercher un fournisseur..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 border border-gray-300 shadow-sm"
          />
        </div>
      </div>

      {/* Suppliers List */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <Building className="w-16 h-16 mb-4 text-gray-300" />
            <h3 className="text-lg font-medium mb-2">
              {searchTerm ? "Aucun fournisseur trouvé" : "Aucun fournisseur"}
            </h3>
            <p className="text-center max-w-md">
              {searchTerm 
                ? "Aucun fournisseur ne correspond à votre recherche."
                : "Vous n'avez pas encore de fournisseurs. Créez votre premier fournisseur pour commencer."}
            </p>
            {!searchTerm && (
              <Button
                onClick={handleCreate}
                className="mt-4 bg-primary hover:bg-blue-700 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Créer un fournisseur
              </Button>
            )}
          </div>
        ) : (
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredSuppliers.map((supplier) => {
                const stats = getSupplierStats(supplier.id);
                return (
                  <div key={supplier.id} className="bg-white border border-gray-200 shadow-lg hover:shadow-xl transition-shadow p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-blue-600 flex items-center justify-center mr-3">
                          <Building className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900">{supplier.name}</h3>
                          <p className="text-sm text-gray-500">#{supplier.id}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(supplier)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(supplier)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2 mb-4">
                      {supplier.contact && (
                        <div className="flex items-center text-sm text-gray-600">
                          <Mail className="w-4 h-4 mr-2" />
                          {supplier.contact}
                        </div>
                      )}
                      {supplier.phone && (
                        <div className="flex items-center text-sm text-gray-600">
                          <Phone className="w-4 h-4 mr-2" />
                          {supplier.phone}
                        </div>
                      )}
                      <div className="flex items-center text-sm">
                        {supplier.hasDlc ? (
                          <div className="flex items-center text-green-600">
                            <CheckCircle className="w-4 h-4 mr-2" />
                            DLC activé
                          </div>
                        ) : (
                          <div className="flex items-center text-gray-400">
                            <XCircle className="w-4 h-4 mr-2" />
                            DLC désactivé
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="border-t pt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center">
                          <div className="flex items-center justify-center text-primary mb-1">
                            <Package className="w-4 h-4 mr-1" />
                            <span className="font-semibold">{stats.orders}</span>
                          </div>
                          <p className="text-xs text-gray-500">Commandes</p>
                        </div>
                        <div className="text-center">
                          <div className="flex items-center justify-center text-secondary mb-1">
                            <Truck className="w-4 h-4 mr-1" />
                            <span className="font-semibold">{stats.deliveries}</span>
                          </div>
                          <p className="text-xs text-gray-500">Livraisons</p>
                        </div>
                      </div>
                      {stats.deliveries > 0 && (
                        <div className="mt-2 text-center">
                          <p className="text-xs text-gray-500">
                            {stats.delivered} livrées ({Math.round((stats.delivered / stats.deliveries) * 100)}%)
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Dialog open={showCreateModal || showEditModal} onOpenChange={() => {
        setShowCreateModal(false);
        setShowEditModal(false);
        setSelectedSupplier(null);
        setFormData({ name: "", contact: "", phone: "", hasDlc: false });
      }}>
        <DialogContent className="sm:max-w-md" aria-describedby="supplier-modal-description">
          <DialogHeader>
            <DialogTitle>
              {selectedSupplier ? 'Modifier' : 'Nouveau'} Fournisseur
            </DialogTitle>
            <p id="supplier-modal-description" className="text-sm text-gray-600 mt-1">
              {selectedSupplier ? 'Modifier les informations du fournisseur' : 'Créer un nouveau fournisseur'}
            </p>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Nom du fournisseur *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="Nom du fournisseur"
                required
              />
            </div>

            <div>
              <Label htmlFor="contact">Contact</Label>
              <Input
                id="contact"
                value={formData.contact}
                onChange={(e) => handleChange('contact', e.target.value)}
                placeholder="Nom du contact"
              />
            </div>

            <div>
              <Label htmlFor="phone">Téléphone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                placeholder="Numéro de téléphone"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox 
                id="hasDlc"
                checked={formData.hasDlc}
                onCheckedChange={(checked) => handleChange('hasDlc', checked === true)}
              />
              <Label htmlFor="hasDlc" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Gestion DLC
              </Label>
            </div>

            <div className="flex items-center space-x-3 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setShowCreateModal(false);
                  setShowEditModal(false);
                  setSelectedSupplier(null);
                  setFormData({ name: "", contact: "", phone: "", hasDlc: false });
                }}
              >
                Annuler
              </Button>
              <Button 
                type="submit" 
                disabled={createMutation.isPending || updateMutation.isPending}
                className="bg-primary hover:bg-blue-700"
              >
                {createMutation.isPending || updateMutation.isPending
                  ? "Enregistrement..." 
                  : (selectedSupplier ? "Modifier" : "Créer")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
