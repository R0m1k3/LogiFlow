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
import type { Group, Supplier } from "@shared/schema";

interface CreateOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date | null;
}

export default function CreateOrderModal({
  isOpen,
  onClose,
  selectedDate,
}: CreateOrderModalProps) {
  const { user } = useAuthUnified();
  const { selectedStoreId } = useStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    supplierId: "",
    groupId: "",
    plannedDate: selectedDate ? format(selectedDate, 'yyyy-MM-dd') : "",
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

  // Auto-sélectionner le magasin selon les règles
  useEffect(() => {
    console.log('🏪 CreateOrderModal - Store selection effect:', {
      groupsLength: groups.length,
      currentFormGroupId: formData.groupId,
      selectedStoreId,
      userRole: user?.role,
      allGroups: groups.map(g => ({ id: g.id, name: g.name })),
      filteredGroups: groups.length
    });
    
    // Reset le formulaire si le magasin sélectionné change
    if (user?.role === 'admin' && selectedStoreId && formData.groupId && formData.groupId !== selectedStoreId.toString()) {
      console.log('🔄 Resetting form because store changed:', { 
        currentGroupId: formData.groupId, 
        newStoreId: selectedStoreId.toString() 
      });
      setFormData(prev => ({ ...prev, groupId: "" }));
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
        console.log('🏪 Admin store selection:', { 
          selectedStoreId, 
          defaultGroupId, 
          firstGroupId: groups[0].id,
          groupsAvailable: groups.map(g => g.name)
        });
      } else {
        // Pour les autres rôles : prendre le premier magasin attribué
        defaultGroupId = groups[0].id.toString();
        console.log('🏪 Non-admin store selection:', { defaultGroupId, firstGroupId: groups[0].id });
      }
      
      if (defaultGroupId) {
        console.log('🏪 Setting default group ID:', defaultGroupId, 'for group:', groups.find(g => g.id.toString() === defaultGroupId)?.name);
        setFormData(prev => ({ ...prev, groupId: defaultGroupId }));
      }
    }
  }, [groups, selectedStoreId, user?.role, formData.groupId]);

  const createOrderMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log('🚀 Creating order with data:', data);
      const response = await apiRequest("/api/orders", "POST", data);
      console.log('✅ Order created successfully:', response);
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Succès",
        description: "Commande créée avec succès",
      });
      // Force un nettoyage complet du cache pour éviter incohérences
      console.log('🆕 Order created, clearing cache for consistency');
      
      // Invalider toutes les variantes de queryKey pour assurer cohérence
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
        description: "Impossible de créer la commande",
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

    createOrderMutation.mutate({
      supplierId: parseInt(formData.supplierId),
      groupId: parseInt(formData.groupId),
      plannedDate: formData.plannedDate,
      notes: formData.notes || undefined,
    });
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md" aria-describedby="order-modal-description">
        <DialogHeader>
          <DialogTitle>Nouvelle Commande</DialogTitle>
          <p id="order-modal-description" className="text-sm text-gray-600 mt-1">
            Créer une nouvelle commande pour un fournisseur
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
            <Label htmlFor="plannedDate">Date prévue *</Label>
            <Input
              id="plannedDate"
              type="date"
              value={formData.plannedDate}
              onChange={(e) => handleChange('plannedDate', e.target.value)}
              required
            />
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
              disabled={createOrderMutation.isPending}
              className="bg-primary hover:bg-blue-700"
            >
              {createOrderMutation.isPending ? "Création..." : "Créer la commande"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
