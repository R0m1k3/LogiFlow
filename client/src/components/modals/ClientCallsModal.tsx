import { useState } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Phone, User, Package, Building } from "lucide-react";
import type { CustomerOrderWithRelations } from "@shared/schema";

interface ClientCallsModalProps {
  isOpen: boolean;
  onClose: () => void;
  pendingCalls: CustomerOrderWithRelations[];
}

export default function ClientCallsModal({ isOpen, onClose, pendingCalls }: ClientCallsModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [callingIds, setCallingIds] = useState<Set<number>>(new Set());

  const markCalledMutation = useMutation({
    mutationFn: async (customerOrderId: number) => {
      return apiRequest(`/api/customer-orders/${customerOrderId}/mark-called`, 'PATCH');
    },
    onMutate: (customerOrderId) => {
      setCallingIds(prev => new Set([...prev, customerOrderId]));
    },
    onSuccess: (_, customerOrderId) => {
      toast({
        title: "Client marqué comme appelé",
        description: "L'appel a été enregistré avec succès",
      });
      
      // Invalider les caches
      queryClient.invalidateQueries({ queryKey: ['/api/customer-orders/pending-calls'] });
      queryClient.invalidateQueries({ queryKey: ['/api/customer-orders'] });
    },
    onError: (error, customerOrderId) => {
      console.error("Error marking client as called:", error);
      toast({
        title: "Erreur",
        description: "Impossible de marquer l'appel client",
        variant: "destructive",
      });
    },
    onSettled: (_, __, customerOrderId) => {
      setCallingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(customerOrderId);
        return newSet;
      });
    }
  });

  const handleMarkCalled = (customerOrderId: number) => {
    markCalledMutation.mutate(customerOrderId);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-orange-600" />
            Clients à Appeler
            <Badge variant="secondary">{pendingCalls.length}</Badge>
          </DialogTitle>
        </DialogHeader>
        
        <div className="text-sm text-gray-600 mb-4">
          Produits disponibles - Les clients suivants n'ont pas encore été contactés :
        </div>

        {pendingCalls.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Phone className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>Aucun client à appeler actuellement</p>
            <p className="text-xs">Tous les clients ont été contactés ou aucun produit n'est disponible</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[50vh]">
            <div className="space-y-3">
              {pendingCalls.map((order) => (
                <div
                  key={order.id}
                  className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  data-testid={`client-call-item-${order.id}`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Client Info */}
                      <div className="flex items-center gap-2 mb-2">
                        <User className="h-4 w-4 text-blue-600 flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900 truncate">
                            {order.customerName}
                          </div>
                          <div className="text-sm text-gray-600 flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {order.customerPhone}
                          </div>
                        </div>
                      </div>

                      {/* Product Info */}
                      <div className="flex items-center gap-2 mb-2">
                        <Package className="h-4 w-4 text-green-600 flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="text-sm text-gray-900 truncate">
                            {order.productDesignation}
                          </div>
                          <div className="text-xs text-gray-500">
                            Quantité: {order.quantity} • {order.supplier?.name}
                          </div>
                        </div>
                      </div>

                      {/* Store Info */}
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4 text-purple-600 flex-shrink-0" />
                        <div className="text-sm text-gray-600">
                          {order.group?.name}
                        </div>
                      </div>
                    </div>

                    {/* Call Button */}
                    <div className="flex-shrink-0">
                      <Button
                        onClick={() => handleMarkCalled(order.id)}
                        disabled={callingIds.has(order.id)}
                        className="bg-green-600 hover:bg-green-700 text-white w-full sm:w-auto"
                        data-testid={`button-mark-called-${order.id}`}
                      >
                        <Phone className="h-4 w-4 mr-2" />
                        {callingIds.has(order.id) ? "Marquage..." : "Marquer Appelé"}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}