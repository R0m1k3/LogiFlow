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
import type { Group, Supplier, OrderWithRelations } from "@shared/schema";

interface EditOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: OrderWithRelations | null;
}

export default function EditOrderModal({
  isOpen,
  onClose,
  order,
}: EditOrderModalProps) {
  const { user } = useAuthUnified();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    supplierId: "",
    groupId: "",
    plannedDate: "",
    notes: "",
  });

  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ['/api/suppliers'],
    enabled: user?.role === 'admin' || user?.role === 'manager',
  });

  const { data: groups = [] } = useQuery<Group[]>({
    queryKey: ['/api/groups'],
  });

  // Initialiser le formulaire avec les données de la commande
  useEffect(() => {
    if (order) {
      setFormData({
        supplierId: order.supplierId.toString(),
        groupId: order.groupId.toString(),
        plannedDate: safeFormat(order.plannedDate, 'yyyy-MM-dd'),
        notes: order.notes || "",
      });
    }
  }, [order]);

  const updateOrderMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("PUT", `/api/orders/${order?.id}`, data);
    },
    onSuccess: () => {
      toast({
        title: "Succès",
        description: "Commande modifiée avec succès",
      });
      // Invalider tous les caches liés aux commandes
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
        description: "Impossible de modifier la commande",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.supplierId || !formData.groupId || !formData.plannedDate) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir tous les champs obligatoires",
        variant: "destructive",
      });
      return;
    }

    updateOrderMutation.mutate({
      supplierId: parseInt(formData.supplierId),
      groupId: parseInt(formData.groupId),
      plannedDate: formData.plannedDate,
      notes: formData.notes || undefined,
    });
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (!order) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md" aria-describedby="edit-order-modal-description">
        <DialogHeader>
          <DialogTitle>Modifier la Commande #{order.id}</DialogTitle>
          <p id="edit-order-modal-description" className="text-sm text-gray-600 mt-1">
            Modifier les détails de cette commande
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

          <div>
            <Label htmlFor="group">Magasin/Groupe *</Label>
            <Select value={formData.groupId} onValueChange={(value) => handleChange('groupId', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionnez un magasin" />
              </SelectTrigger>
              <SelectContent>
                {Array.isArray(groups) && groups.map((group) => (
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

          <div>
            <Label htmlFor="plannedDate">Date prévue *</Label>
            <Input
              id="plannedDate"
              type="date"
              value={formData.plannedDate}
              onChange={(e) => handleChange('plannedDate', e.target.value)}
            />
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
              disabled={updateOrderMutation.isPending}
              className="bg-primary hover:bg-blue-700"
            >
              {updateOrderMutation.isPending ? "Modification..." : "Modifier"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}