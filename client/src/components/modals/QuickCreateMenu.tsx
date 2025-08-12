import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Package, Truck } from "lucide-react";
import { useAuthUnified } from "@/hooks/useAuthUnified";
import { hasPermission } from "@/lib/permissions";

interface QuickCreateMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateOrder: () => void;
  onCreateDelivery: () => void;
}

export default function QuickCreateMenu({
  isOpen,
  onClose,
  onCreateOrder,
  onCreateDelivery,
}: QuickCreateMenuProps) {
  const { user } = useAuthUnified();
  
  const canCreateOrders = hasPermission(user?.role || '', 'orders', 'create');
  const canCreateDeliveries = hasPermission(user?.role || '', 'deliveries', 'create');
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md" aria-describedby="quick-create-modal-description">
        <DialogHeader>
          <DialogTitle>Création rapide</DialogTitle>
          <p id="quick-create-modal-description" className="text-sm text-gray-600 mt-1">
            Choisir le type d'élément à créer
          </p>
        </DialogHeader>
        <div className="space-y-3">
          {canCreateOrders && (
            <Button
              variant="outline"
              className="w-full justify-start space-x-3 p-4 h-auto hover:bg-blue-50 hover:border-blue-300"
              onClick={onCreateOrder}
            >
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <Package className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <p className="font-medium text-gray-900">Nouvelle Commande</p>
                <p className="text-sm text-gray-600">Créer une commande fournisseur</p>
              </div>
            </Button>
          )}
          
          {canCreateDeliveries && (
            <Button
              variant="outline"
              className="w-full justify-start space-x-3 p-4 h-auto hover:bg-green-50 hover:border-green-300"
              onClick={onCreateDelivery}
            >
              <div className="w-10 h-10 bg-secondary rounded-lg flex items-center justify-center">
                <Truck className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <p className="font-medium text-gray-900">Nouvelle Livraison</p>
                <p className="text-sm text-gray-600">Planifier une livraison</p>
              </div>
            </Button>
          )}
          
          {!canCreateOrders && !canCreateDeliveries && (
            <div className="text-center py-8 text-gray-500">
              <p>Vous n'avez pas les permissions nécessaires pour créer des commandes ou livraisons.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
