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
  Edit,
  Trash2,
  Package,
  Truck,
  CheckCircle,
  Clock
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
    automaticReconciliation: false,
    requiresControl: false,
  });

  const { data: suppliers = [], isLoading } = useQuery<Supplier[]>({
    queryKey: ['/api/suppliers'],
  });

  const { data: orders = [] } = useQuery({
    queryKey: ['/api/orders'],
  });

  const { data: deliveries = [] } = useQuery({
    queryKey: ['/api/deliveries'],
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
      resetForm();
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
    onError: (error, newData, context) => {
      // Rollback en cas d'erreur
      console.log('⚠️ Frontend: Rolling back optimistic update due to error');
      if (context?.previousSuppliers) {
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
    onSuccess: () => {
      toast({
        title: "Succès",
        description: "Fournisseur modifié avec succès",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/suppliers'] });
      setShowEditModal(false);
      setSelectedSupplier(null);
      resetForm();
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/suppliers'] });
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

  const resetForm = () => {
    setFormData({
      name: "",
      contact: "",
      phone: "",
      hasDlc: false,
      automaticReconciliation: false,
      requiresControl: false,
    });
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCreate = () => {
    if (user?.role !== 'admin') {
      toast({
        title: "Accès refusé",
        description: "Seuls les administrateurs peuvent créer des fournisseurs",
        variant: "destructive",
      });
      return;
    }
    resetForm();
    setShowCreateModal(true);
  };

  const handleEdit = (supplier: Supplier) => {
    if (user?.role !== 'admin') {
      toast({
        title: "Accès refusé",
        description: "Seuls les administrateurs peuvent modifier des fournisseurs",
        variant: "destructive",
      });
      return;
    }
    setSelectedSupplier(supplier);
    setFormData({
      name: supplier.name || "",
      contact: supplier.contact || "",
      phone: supplier.phone || "",
      hasDlc: supplier.hasDlc || false,
      automaticReconciliation: supplier.automaticReconciliation || false,
      requiresControl: supplier.requiresControl || false,
    });
    setShowEditModal(true);
  };

  const handleDelete = (supplier: Supplier) => {
    if (user?.role !== 'admin') {
      toast({
        title: "Accès refusé",
        description: "Seuls les administrateurs peuvent supprimer des fournisseurs",
        variant: "destructive",
      });
      return;
    }

    if (confirm(`Êtes-vous sûr de vouloir supprimer le fournisseur "${supplier.name}" ?`)) {
      deleteMutation.mutate(supplier.id);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedSupplier) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const filteredSuppliers = suppliers.filter(supplier =>
    supplier.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getSupplierStats = (supplierId: number) => {
    const supplierOrders = orders.filter((order: any) => order.supplierId === supplierId);
    const supplierDeliveries = deliveries.filter((delivery: any) => delivery.supplierId === supplierId);
    const deliveredCount = supplierDeliveries.filter((delivery: any) => delivery.status === 'delivered').length;
    
    return {
      orders: supplierOrders.length,
      deliveries: supplierDeliveries.length,
      delivered: deliveredCount,
    };
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-48 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 flex items-center">
            <Building className="w-6 h-6 mr-3 text-blue-600" />
            Fournisseurs
          </h2>
          <p className="text-gray-600 mt-1">
            Gestion des fournisseurs et partenaires
          </p>
        </div>
        
        {user?.role === 'admin' && (
          <Button
            onClick={handleCreate}
            className="bg-primary hover:bg-blue-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nouveau fournisseur
          </Button>
        )}
      </div>

      <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Rechercher un fournisseur..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 border border-gray-300 shadow-sm"
          />
        </div>
      </div>

      <div className="bg-white border border-gray-200 shadow-lg overflow-hidden rounded-lg">
        {filteredSuppliers.length === 0 ? (
          <div className="text-center py-12">
            <Building className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm ? "Aucun fournisseur trouvé" : "Aucun fournisseur"}
            </h3>
            <p className="text-gray-600">
              {searchTerm 
                ? "Aucun fournisseur ne correspond à votre recherche"
                : "Commencez par créer votre premier fournisseur"
              }
            </p>
            {!searchTerm && user?.role === 'admin' && (
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
                      {user?.role === 'admin' && (
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
                      )}
                    </div>

                    <div className="space-y-2 mb-4">
                      {supplier.contact && (
                        <div className="flex items-center text-sm text-gray-600">
                          <Building className="w-4 h-4 mr-2" />
                          {supplier.contact}
                        </div>
                      )}
                      {supplier.phone && (
                        <div className="flex items-center text-sm text-gray-600">
                          <Phone className="w-4 h-4 mr-2" />
                          {supplier.phone}
                        </div>
                      )}
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center space-x-2">
                          {supplier.hasDlc && (
                            <div className="flex items-center text-green-600 bg-green-50 px-2 py-1 rounded-full">
                              <Clock className="w-3 h-3 mr-1" />
                              <span className="text-xs font-medium">DLC</span>
                            </div>
                          )}
                          {supplier.automaticReconciliation && (
                            <div className="flex items-center text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              <span className="text-xs font-medium">Auto-rapprochement</span>
                            </div>
                          )}
                          {supplier.requiresControl && (
                            <div className="flex items-center text-orange-600 bg-orange-50 px-2 py-1 rounded-full">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              <span className="text-xs font-medium">Contrôle requis</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {!supplier.hasDlc && !supplier.automaticReconciliation && !supplier.requiresControl && (
                        <div className="text-xs text-gray-500 mt-2">
                          Aucune option activée
                        </div>
                      )}
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
        resetForm();
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

            <div className="flex items-center space-x-2">
              <Checkbox 
                id="automaticReconciliation"
                checked={formData.automaticReconciliation}
                onCheckedChange={(checked) => handleChange('automaticReconciliation', checked === true)}
              />
              <Label htmlFor="automaticReconciliation" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Rapprochement automatique BL/Factures
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox 
                id="requiresControl"
                checked={formData.requiresControl}
                onCheckedChange={(checked) => handleChange('requiresControl', checked === true)}
                data-testid="checkbox-requires-control"
              />
              <Label htmlFor="requiresControl" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Fournisseur à contrôler
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
                  resetForm();
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