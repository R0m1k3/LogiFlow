import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Check, X } from "lucide-react";

const validateDeliverySchema = z.object({
  blNumber: z.string().min(1, "Le numéro de BL est obligatoire"),
  blAmount: z.string().optional(),
});

type ValidateDeliveryForm = z.infer<typeof validateDeliverySchema>;

interface ValidateDeliveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  delivery: any;
  onValidated?: () => void; // Callback pour fermer le modal parent
}

export default function ValidateDeliveryModal({
  isOpen,
  onClose,
  delivery,
  onValidated,
}: ValidateDeliveryModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<ValidateDeliveryForm>({
    resolver: zodResolver(validateDeliverySchema),
    defaultValues: {
      blNumber: "",
      blAmount: "",
    },
  });

  const validateDeliveryMutation = useMutation({
    mutationFn: async (data: ValidateDeliveryForm) => {
      const payload: any = {
        blNumber: data.blNumber,
      };
      
      if (data.blAmount && data.blAmount.trim() !== '') {
        payload.blAmount = parseFloat(data.blAmount);
      }
      
      await apiRequest(`/api/deliveries/${delivery.id}/validate`, "POST", payload);
    },
    onSuccess: () => {
      toast({
        title: "Succès",
        description: "Livraison validée avec succès",
      });
      // Invalider tous les caches liés aux livraisons
      queryClient.invalidateQueries({ queryKey: ['/api/deliveries'] });
      // Invalider tous les caches BL/Rapprochement avec toutes les variations de clés
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          query.queryKey[0] === '/api/deliveries/bl' || 
          query.queryKey[0] === '/api/deliveries'
      });
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats/monthly'] });
      form.reset();
      onClose();
      // Fermer aussi le modal parent si fourni
      if (onValidated) {
        onValidated();
      }
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
        description: "Impossible de valider la livraison",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ValidateDeliveryForm) => {
    validateDeliveryMutation.mutate(data);
  };

  if (!delivery) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md" aria-describedby="validate-delivery-modal-description">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Check className="w-5 h-5 text-green-600" />
            <span>Valider la livraison</span>
          </DialogTitle>
          <p id="validate-delivery-modal-description" className="text-sm text-gray-600 mt-1">
            Saisir les informations du bon de livraison
          </p>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Informations de la livraison */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <h4 className="font-medium text-gray-900">Détails de la livraison</h4>
              <div className="text-sm text-gray-600">
                <p><strong>Fournisseur:</strong> {delivery.supplier?.name}</p>
                <p><strong>Magasin:</strong> {delivery.group?.name}</p>
                <p><strong>Quantité:</strong> {delivery.quantity} {delivery.unit === 'palettes' ? 'Palettes' : 'Colis'}</p>
              </div>
            </div>

            {/* Numéro de BL */}
            <FormField
              control={form.control}
              name="blNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>N° Bon de Livraison *</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Ex: BL-2024-001"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Montant BL */}
            <FormField
              control={form.control}
              name="blAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Montant BL (€) - Optionnel</FormLabel>
                  <FormControl>
                    <Input 
                      type="number"
                      step="0.01"
                      placeholder="Ex: 1200.00 (à remplir plus tard si nécessaire)"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Actions */}
            <div className="flex justify-end space-x-3 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose}
                disabled={validateDeliveryMutation.isPending}
              >
                <X className="w-4 h-4 mr-2" />
                Annuler
              </Button>
              <Button 
                type="submit"
                disabled={validateDeliveryMutation.isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                <Check className="w-4 h-4 mr-2" />
                {validateDeliveryMutation.isPending ? "Validation..." : "Valider livraison"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}