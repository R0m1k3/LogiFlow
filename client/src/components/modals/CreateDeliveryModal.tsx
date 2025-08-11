import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuthUnified } from "@/hooks/useAuthUnified";
import { useStore } from "@/components/Layout";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { format } from "date-fns";
import { safeFormat } from "@/lib/dateUtils";
import type { Group, Supplier, OrderWithRelations } from "@shared/schema";

interface CreateDeliveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date | null;
}

export default function CreateDeliveryModal({
  isOpen,
  onClose,
  selectedDate,
}: CreateDeliveryModalProps) {
  const { user } = useAuthUnified();
  const { selectedStoreId } = useStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    orderId: "",
    supplierId: "",
    groupId: "",
    scheduledDate: selectedDate ? format(selectedDate, 'yyyy-MM-dd') : "",
    quantity: "",
    unit: "palettes",
    notes: "",
  });

  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ['/api/suppliers'],
    enabled: user?.role === 'admin' || user?.role === 'manager',
  });

  const { data: groupsData = [] } = useQuery<Group[]>({
    queryKey: ['/api/groups'],
  });
  
  // Filtrer les groupes selon le magasin sélectionné pour les admins
  const groups = Array.isArray(groupsData) ? (
    user?.role === 'admin' && selectedStoreId 
      ? groupsData.filter(g => g.id === selectedStoreId)
      : groupsData
  ) : [];

  // Filtrer les commandes par fournisseur sélectionné
  const { data: allOrders = [] } = useQuery<OrderWithRelations[]>({
    queryKey: ['/api/orders'],
  });

  // Filtrer les commandes par fournisseur sélectionné - montrer toutes les commandes non livrées
  const availableOrders = allOrders.filter(order => 
    formData.supplierId ? (order.supplierId === parseInt(formData.supplierId) && order.status !== 'delivered') : false
  );

  // Auto-sélectionner le magasin selon les règles
  useEffect(() => {
    console.log('🏪 CreateDeliveryModal - Store selection effect:', {
      groupsLength: groups.length,
      currentFormGroupId: formData.groupId,
      selectedStoreId,
      userRole: user?.role,
      allGroups: groups.map(g => ({ id: g.id, name: g.name })),
      filteredGroups: groups.length
    });
    
    // Reset le formulaire si le magasin sélectionné change
    if (user?.role === 'admin' && selectedStoreId && formData.groupId && formData.groupId !== selectedStoreId.toString()) {
      console.log('🔄 Resetting delivery form because store changed:', { 
        currentGroupId: formData.groupId, 
        newStoreId: selectedStoreId.toString() 
      });
      setFormData(prev => ({ ...prev, groupId: "", orderId: "" }));
      return;
    }
    
    if (groups.length > 0 && !formData.groupId) {
      let defaultGroupId = "";
      
      if (user?.role === 'admin') {
        // Pour l'admin : utiliser le magasin sélectionné dans le header (filtré), sinon le premier de la liste
        if (selectedStoreId && groups.find(g => g.id === selectedStoreId)) {
          defaultGroupId = selectedStoreId.toString();
        } else {
          defaultGroupId = groups[0].id.toString();
        }
        console.log('🏪 Admin delivery store selection:', { 
          selectedStoreId, 
          defaultGroupId, 
          firstGroupId: groups[0].id,
          groupsAvailable: groups.map(g => g.name)
        });
      } else {
        // Pour les autres rôles : prendre le premier magasin attribué
        // (La logique existante filtre déjà les groupes selon les permissions)
        defaultGroupId = groups[0].id.toString();
        console.log('🏪 Non-admin delivery store selection:', { defaultGroupId, firstGroupId: groups[0].id });
      }
      
      if (defaultGroupId) {
        console.log('🏪 Setting default group ID for delivery:', defaultGroupId, 'for group:', groups.find(g => g.id.toString() === defaultGroupId)?.name);
        setFormData(prev => ({ ...prev, groupId: defaultGroupId }));
      }
    }
  }, [groups, selectedStoreId, user?.role, formData.groupId]);

  // Réinitialiser la commande sélectionnée quand on change de fournisseur
  useEffect(() => {
    if (formData.supplierId) {
      setFormData(prev => ({ ...prev, orderId: "" }));
    }
  }, [formData.supplierId]);

  const createDeliveryMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("/api/deliveries", "POST", data);
    },
    onSuccess: () => {
      toast({
        title: "Succès",
        description: "Livraison créée avec succès",
      });
      
      // Invalider toutes les variantes de queryKey pour assurer cohérence
      console.log('🚚 Delivery created, clearing cache for consistency');
      queryClient.invalidateQueries({ predicate: (query) => {
        const key = query.queryKey;
        return key[0]?.toString().includes('/api/orders') || 
               key[0]?.toString().includes('/api/deliveries') || 
               key[0]?.toString().includes('/api/stats/monthly');
      }});
      
      onClose();
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
        description: "Impossible de créer la livraison",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.supplierId || !formData.groupId || !formData.scheduledDate || !formData.quantity) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir tous les champs obligatoires",
        variant: "destructive",
      });
      return;
    }

    createDeliveryMutation.mutate({
      orderId: formData.orderId && formData.orderId !== "none" ? parseInt(formData.orderId) : undefined,
      supplierId: parseInt(formData.supplierId),
      groupId: parseInt(formData.groupId),
      scheduledDate: formData.scheduledDate,
      quantity: parseInt(formData.quantity),
      unit: formData.unit,
      status: "planned",
      notes: formData.notes || undefined,
      createdBy: user?.id,
    });
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Afficher toutes les commandes du fournisseur sélectionné (pas de filtrage supplémentaire)
  const finalFilteredOrders = availableOrders;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md" aria-describedby="delivery-modal-description">
        <DialogHeader>
          <DialogTitle>Nouvelle Livraison</DialogTitle>
          <p id="delivery-modal-description" className="text-sm text-gray-600 mt-1">
            Créer une nouvelle livraison pour un fournisseur
          </p>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="supplier">Fournisseur *</Label>
            <Select value={formData.supplierId} onValueChange={(value) => handleChange('supplierId', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionnez un fournisseur" />
              </SelectTrigger>
              <SelectContent>
                {Array.isArray(suppliers) && suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id.toString()}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {formData.supplierId && (
            <div>
              <Label htmlFor="order">Commande liée (optionnel)</Label>
              <Select value={formData.orderId} onValueChange={(value) => handleChange('orderId', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionnez une commande de ce fournisseur" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucune commande liée</SelectItem>
                  {Array.isArray(finalFilteredOrders) && finalFilteredOrders.map((order) => (
                    <SelectItem key={order.id} value={order.id.toString()}>
                      #{order.id} - {order.supplier.name} - {safeFormat(order.plannedDate, 'dd/MM/yyyy')}
                    </SelectItem>
                  ))}
                  {(!Array.isArray(finalFilteredOrders) || finalFilteredOrders.length === 0) && (
                    <SelectItem value="disabled" disabled>
                      Aucune commande disponible pour ce fournisseur
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Affichage du magasin sélectionné */}
          {formData.groupId && (
            <div>
              <Label>Magasin/Groupe</Label>
              <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-md border">
                {(() => {
                  const selectedGroup = groups.find(g => g.id.toString() === formData.groupId);
                  return selectedGroup ? (
                    <>
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: selectedGroup.color }}
                      />
                      <span className="font-medium">{selectedGroup.name}</span>
                    </>
                  ) : null;
                })()}
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="scheduledDate">Date prévue *</Label>
            <Input
              id="scheduledDate"
              type="date"
              value={formData.scheduledDate}
              onChange={(e) => handleChange('scheduledDate', e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="quantity">Quantité *</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                value={formData.quantity}
                onChange={(e) => handleChange('quantity', e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="unit">Unité</Label>
              <Select value={formData.unit} onValueChange={(value) => handleChange('unit', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="palettes">Palettes</SelectItem>
                  <SelectItem value="colis">Colis</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Commentaires</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Commentaires additionnels..."
              rows={3}
            />
          </div>

          <div className="flex items-center space-x-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button 
              type="submit" 
              disabled={createDeliveryMutation.isPending}
              className="bg-secondary hover:bg-green-700"
            >
              {createDeliveryMutation.isPending ? "Création..." : "Créer la livraison"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
