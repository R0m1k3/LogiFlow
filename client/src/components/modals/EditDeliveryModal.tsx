import { useState, useEffect } from "react";
import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuthUnified } from "@/hooks/useAuthUnified";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { format } from "date-fns";
import { safeFormat } from "@/lib/dateUtils";
import type { Group, Supplier, DeliveryWithRelations, OrderWithRelations } from "@shared/schema";

interface EditDeliveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  delivery: DeliveryWithRelations | null;
}

export default function EditDeliveryModal({
  isOpen,
  onClose,
  delivery,
}: EditDeliveryModalProps) {
  const { user } = useAuthUnified();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    supplierId: "",
    groupId: "",
    orderId: "",
    scheduledDate: "",
    quantity: "",
    unit: "palettes",
    notes: "",
  });

  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ['/api/suppliers'],
    enabled: user?.role === 'admin' || user?.role === 'manager',
  });

  const { data: groups = [] } = useQuery<Group[]>({
    queryKey: ['/api/groups'],
  });

  const { data: allOrders = [] } = useQuery<OrderWithRelations[]>({
    queryKey: ['/api/orders'],
  });

  // Filtrer les commandes par fournisseur sélectionné - montrer toutes les commandes non livrées
  const availableOrders = allOrders.filter(order => 
    formData.supplierId ? (order.supplierId === parseInt(formData.supplierId) && order.status !== 'delivered') : false
  );

  // Initialiser le formulaire avec les données de la livraison
  useEffect(() => {
    if (delivery) {
      setFormData({
        supplierId: delivery.supplierId.toString(),
        groupId: delivery.groupId.toString(),
        orderId: delivery.orderId ? delivery.orderId.toString() : "none",
        scheduledDate: safeFormat(delivery.scheduledDate, 'yyyy-MM-dd'),
        quantity: delivery.quantity.toString(),
        unit: delivery.unit,
        notes: delivery.notes || "",
      });
    }
  }, [delivery]);

  const updateDeliveryMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest(`/api/deliveries/${delivery?.id}`, "PUT", data);
    },
    onSuccess: () => {
      toast({
        title: "Succès",
        description: "Livraison modifiée avec succès",
      });
      // Invalider tous les caches liés aux livraisons
      queryClient.invalidateQueries({ queryKey: ['/api/deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats/monthly'] });
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
        description: "Impossible de modifier la livraison",
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

    updateDeliveryMutation.mutate({
      supplierId: parseInt(formData.supplierId),
      groupId: parseInt(formData.groupId),
      orderId: formData.orderId && formData.orderId !== "none" ? parseInt(formData.orderId) : null,
      scheduledDate: formData.scheduledDate,
      quantity: parseInt(formData.quantity),
      unit: formData.unit,
      notes: formData.notes || undefined,
    });
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (!delivery) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md" aria-describedby="edit-delivery-modal-description">
        <DialogHeader>
          <DialogTitle>Modifier la Livraison #{delivery.id}</DialogTitle>
          <p id="edit-delivery-modal-description" className="text-sm text-gray-600 mt-1">
            Modifier les détails de cette livraison
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
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id.toString()}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="group">Magasin/Groupe *</Label>
            <Select value={formData.groupId} onValueChange={(value) => handleChange('groupId', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionnez un magasin" />
              </SelectTrigger>
              <SelectContent>
                {groups.map((group) => (
                  <SelectItem key={group.id} value={group.id.toString()}>
                    <div className="flex items-center space-x-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: group.color }}
                      />
                      <span>{group.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {availableOrders.length > 0 && (
            <div>
              <Label htmlFor="order">Commande liée (optionnel)</Label>
              <Select value={formData.orderId} onValueChange={(value) => handleChange('orderId', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionnez une commande" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucune commande liée</SelectItem>
                  {availableOrders.map((order) => (
                    <SelectItem key={order.id} value={order.id.toString()}>
                      Commande #{order.id} - {order.supplier.name} - {safeFormat(order.plannedDate, 'dd/MM/yyyy')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label htmlFor="scheduledDate">Date prévue *</Label>
            <Input
              id="scheduledDate"
              type="date"
              value={formData.scheduledDate}
              onChange={(e) => handleChange('scheduledDate', e.target.value)}
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
                placeholder="Ex: 10"
              />
            </div>
            <div>
              <Label htmlFor="unit">Unité *</Label>
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
              placeholder="Commentaires optionnels..."
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button 
              type="submit" 
              disabled={updateDeliveryMutation.isPending}
              className="bg-primary hover:bg-blue-700"
            >
              {updateDeliveryMutation.isPending ? "Modification..." : "Modifier"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}