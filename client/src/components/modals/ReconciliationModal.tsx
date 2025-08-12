import React, { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { safeFormat } from "@/lib/dateUtils";
import { FileText, Settings, Check, X } from "lucide-react";

interface ReconciliationModalProps {
  isOpen: boolean;
  onClose: () => void;
  delivery: any;
  onSave?: () => void;
}

export default function ReconciliationModal({
  isOpen,
  onClose,
  delivery,
  onSave
}: ReconciliationModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    blNumber: "",
    blAmount: "",
    invoiceReference: "",
    invoiceAmount: "",
    reconciled: false,
  });

  // Initialiser le formulaire avec les données de la livraison
  useEffect(() => {
    if (delivery) {
      setFormData({
        blNumber: delivery.blNumber || "",
        blAmount: delivery.blAmount || "",
        invoiceReference: delivery.invoiceReference || "",
        invoiceAmount: delivery.invoiceAmount || "",
        reconciled: delivery.reconciled || false,
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
        description: "Données de rapprochement mises à jour avec succès",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/deliveries/bl'] });
      if (onSave) onSave();
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour les données",
        variant: "destructive",
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation basique
    if (!formData.blNumber.trim()) {
      toast({
        title: "Erreur",
        description: "Le numéro de BL est requis",
        variant: "destructive",
      });
      return;
    }

    updateDeliveryMutation.mutate({
      blNumber: formData.blNumber.trim(),
      blAmount: formData.blAmount ? parseFloat(formData.blAmount) : null,
      invoiceReference: formData.invoiceReference.trim() || null,
      invoiceAmount: formData.invoiceAmount ? parseFloat(formData.invoiceAmount) : null,
    });
  };

  const handleValidateReconciliation = () => {
    if (!formData.blNumber.trim()) {
      toast({
        title: "Erreur",
        description: "Veuillez d'abord renseigner le numéro de BL",
        variant: "destructive",
      });
      return;
    }

    updateDeliveryMutation.mutate({
      blNumber: formData.blNumber.trim(),
      blAmount: formData.blAmount ? parseFloat(formData.blAmount) : null,
      invoiceReference: formData.invoiceReference.trim() || null,
      invoiceAmount: formData.invoiceAmount ? parseFloat(formData.invoiceAmount) : null,
      reconciled: true,
      validatedAt: new Date().toISOString()
    });
  };

  const isAutomaticMode = delivery?.supplier?.automaticReconciliation;
  const canValidate = formData.blNumber.trim().length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            {isAutomaticMode ? (
              <Settings className="w-5 h-5 text-blue-600" />
            ) : (
              <FileText className="w-5 h-5 text-gray-600" />
            )}
            <span>
              Rapprochement {isAutomaticMode ? 'Automatique' : 'Manuel'}
            </span>
            <Badge variant={isAutomaticMode ? "default" : "secondary"}>
              {isAutomaticMode ? "AUTO" : "MANUEL"}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Informations de la livraison */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-medium text-gray-900 mb-3">Informations de la livraison</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Fournisseur :</span>
                <div className="font-medium">{delivery?.supplier?.name}</div>
              </div>
              <div>
                <span className="text-gray-600">Date prévue :</span>
                <div className="font-medium">
                  {safeFormat(delivery?.scheduledDate, 'dd/MM/yyyy')}
                </div>
              </div>
              <div>
                <span className="text-gray-600">Magasin :</span>
                <div className="font-medium">{delivery?.group?.name}</div>
              </div>
              <div>
                <span className="text-gray-600">Statut :</span>
                <Badge variant={delivery?.reconciled ? "default" : "secondary"}>
                  {delivery?.reconciled ? "Rapproché" : "En attente"}
                </Badge>
              </div>
            </div>
          </div>

          <Separator />

          {/* Formulaire de rapprochement */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Données BL */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Bon de Livraison (BL)</h4>
                
                <div>
                  <Label htmlFor="blNumber">N° BL *</Label>
                  <Input
                    id="blNumber"
                    value={formData.blNumber}
                    onChange={(e) => setFormData(prev => ({ ...prev, blNumber: e.target.value }))}
                    placeholder="Ex: BL-2025-001"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="blAmount">Montant BL (€)</Label>
                  <Input
                    id="blAmount"
                    type="number"
                    step="0.01"
                    value={formData.blAmount}
                    onChange={(e) => setFormData(prev => ({ ...prev, blAmount: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Données Facture */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Facture</h4>
                
                <div>
                  <Label htmlFor="invoiceReference">Référence Facture</Label>
                  <Input
                    id="invoiceReference"
                    value={formData.invoiceReference}
                    onChange={(e) => setFormData(prev => ({ ...prev, invoiceReference: e.target.value }))}
                    placeholder="Ex: FAC-2025-001"
                  />
                </div>

                <div>
                  <Label htmlFor="invoiceAmount">Montant Facture (€)</Label>
                  <Input
                    id="invoiceAmount"
                    type="number"
                    step="0.01"
                    value={formData.invoiceAmount}
                    onChange={(e) => setFormData(prev => ({ ...prev, invoiceAmount: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-between pt-4">
              <div className="flex space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={updateDeliveryMutation.isPending}
                >
                  <X className="w-4 h-4 mr-2" />
                  Annuler
                </Button>
                
                <Button
                  type="submit"
                  variant="outline"
                  disabled={updateDeliveryMutation.isPending}
                >
                  {updateDeliveryMutation.isPending ? "Enregistrement..." : "Enregistrer"}
                </Button>
              </div>

              <Button
                type="button"
                onClick={handleValidateReconciliation}
                disabled={!canValidate || updateDeliveryMutation.isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                <Check className="w-4 h-4 mr-2" />
                {updateDeliveryMutation.isPending ? "Validation..." : "Valider le rapprochement"}
              </Button>
            </div>
          </form>

          {/* Note d'aide */}
          <div className="text-xs text-gray-500 bg-blue-50 p-3 rounded">
            <strong>Note :</strong> Le numéro de BL est obligatoire pour valider un rapprochement. 
            Les montants sont optionnels mais recommandés pour un suivi précis.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}