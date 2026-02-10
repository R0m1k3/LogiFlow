import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  XCircle,
  Clock,
  PackageX,
  Eye,
  ArrowRight
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface DlcProduct {
  id: number;
  productName: string;
  expiryDate: string;
  supplier: { name: string };
  status: string;
  stockEpuise: boolean;
}

interface DlcAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  dlcStats: { expired: number; expiringSoon: number; active: number };
  selectedStoreId?: number;
}

export function DlcAlertModal({ isOpen, onClose, dlcStats, selectedStoreId }: DlcAlertModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [snoozeUntil, setSnoozeUntil] = useState<Date | null>(null);

  // Invalider les queries DLC quand le magasin change
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/dlc-products"] });
  }, [selectedStoreId, queryClient]);

  // Fetch detailed DLC products for the modal
  const { data: expiredProducts = [] } = useQuery<DlcProduct[]>({
    queryKey: ["/api/dlc-products", "expires", selectedStoreId],
    queryFn: () => {
      const params = new URLSearchParams();
      params.append("status", "expires");
      if (selectedStoreId) params.append("storeId", selectedStoreId.toString());
      return fetch(`/api/dlc-products?${params}`, { credentials: 'include' })
        .then(res => res.json());
    },
    enabled: isOpen && dlcStats.expired > 0,
  });

  const { data: expiringSoonProducts = [] } = useQuery<DlcProduct[]>({
    queryKey: ["/api/dlc-products", "expires_soon", selectedStoreId],
    queryFn: () => {
      const params = new URLSearchParams();
      params.append("status", "expires_soon");
      if (selectedStoreId) params.append("storeId", selectedStoreId.toString());
      return fetch(`/api/dlc-products?${params}`, { credentials: 'include' })
        .then(res => res.json());
    },
    enabled: isOpen && dlcStats.expiringSoon > 0,
  });

  // Mutation to mark product as stock depleted
  const markStockEpuiseMutation = useMutation({
    mutationFn: (productId: number) =>
      apiRequest(`/api/dlc-products/${productId}/stock-epuise`, "PUT"),
    onSuccess: () => {
      toast({
        title: "✅ Produit marqué",
        description: "Le produit a été marqué comme stock épuisé",
      });
      // Refresh DLC stats and products
      queryClient.invalidateQueries({ queryKey: ["/api/dlc-products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dlc-products/stats"] });
    },
    onError: () => {
      toast({
        title: "❌ Erreur",
        description: "Impossible de marquer le produit comme épuisé",
        variant: "destructive",
      });
    },
  });

  // Calculate days until expiry
  const getDaysUntilExpiry = (expiryDate: string) => {
    const today = new Date();
    const expiry = new Date(expiryDate);
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Handle temporary snooze (2 hours)
  const handleSnooze = () => {
    const snoozeTime = new Date();
    snoozeTime.setHours(snoozeTime.getHours() + 2);
    setSnoozeUntil(snoozeTime);
    localStorage.setItem('dlcAlertSnooze', snoozeTime.toISOString());
    onClose();
  };

  // Check if modal should be snoozed
  useEffect(() => {
    const snoozedUntil = localStorage.getItem('dlcAlertSnooze');
    if (snoozedUntil) {
      const snoozeDate = new Date(snoozedUntil);
      if (new Date() < snoozeDate) {
        setSnoozeUntil(snoozeDate);
      } else {
        localStorage.removeItem('dlcAlertSnooze');
      }
    }
  }, []);

  // Don't show if snoozed
  if (snoozeUntil && new Date() < snoozeUntil) {
    return null;
  }

  // Don't show if no issues
  if (dlcStats.expired === 0 && dlcStats.expiringSoon === 0) {
    return null;
  }

  const handleMarkStockEpuise = (productId: number) => {
    markStockEpuiseMutation.mutate(productId);
  };

  const handleViewDlcModule = () => {
    window.location.href = '/dlc';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-6 w-6" />
            Alerte Produits DLC - Action Requise
          </DialogTitle>
          <DialogDescription>
            Des produits nécessitent votre attention immédiate pour éviter le gaspillage et respecter la sécurité alimentaire.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6" data-testid="dlc-alert-modal-content">
          {/* Expired Products */}
          {dlcStats.expired > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-600" />
                <h3 className="font-semibold text-red-800">
                  Produits Expirés ({dlcStats.expired})
                </h3>
              </div>

              <div className="space-y-2 max-h-40 overflow-y-auto">
                {expiredProducts.slice(0, 8).map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-red-900">{product.productName}</div>
                      <div className="text-sm text-red-700">
                        {product.supplier.name} • Expiré depuis {Math.abs(getDaysUntilExpiry(product.expiryDate))} jour(s)
                      </div>
                    </div>

                    {!product.stockEpuise && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleMarkStockEpuise(product.id)}
                        disabled={markStockEpuiseMutation.isPending}
                        className="text-red-700 border-red-300 hover:bg-red-100"
                        data-testid={`button-stock-epuise-${product.id}`}
                      >
                        <PackageX className="h-4 w-4 mr-1" />
                        Stock épuisé
                      </Button>
                    )}

                    {product.stockEpuise && (
                      <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                        Stock épuisé
                      </Badge>
                    )}
                  </div>
                ))}

                {expiredProducts.length > 8 && (
                  <div className="text-sm text-gray-600 text-center py-2">
                    et {expiredProducts.length - 8} autre(s) produit(s) expiré(s)...
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Expiring Soon Products */}
          {dlcStats.expiringSoon > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-orange-600" />
                <h3 className="font-semibold text-orange-800">
                  Expirent Bientôt ({dlcStats.expiringSoon})
                </h3>
              </div>

              <div className="space-y-2 max-h-40 overflow-y-auto">
                {expiringSoonProducts.slice(0, 8).map((product) => {
                  const daysLeft = getDaysUntilExpiry(product.expiryDate);
                  return (
                    <div
                      key={product.id}
                      className="flex items-center justify-between p-3 bg-orange-50 border border-orange-200 rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="font-medium text-orange-900">{product.productName}</div>
                        <div className="text-sm text-orange-700">
                          {product.supplier.name} • Expire dans {daysLeft} jour(s)
                        </div>
                      </div>

                      <Badge
                        variant="outline"
                        className={`
                          ${daysLeft <= 3 ? 'border-red-300 text-red-700 bg-red-50' : 'border-orange-300 text-orange-700 bg-orange-50'}
                        `}
                      >
                        {daysLeft <= 3 ? 'URGENT' : `${daysLeft}j`}
                      </Badge>
                    </div>
                  );
                })}

                {expiringSoonProducts.length > 8 && (
                  <div className="text-sm text-gray-600 text-center py-2">
                    et {expiringSoonProducts.length - 8} autre(s) produit(s) expirant bientôt...
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
          <Button
            onClick={handleViewDlcModule}
            className="flex-1 bg-blue-600 hover:bg-blue-700"
            data-testid="button-view-dlc-module"
          >
            <Eye className="h-4 w-4 mr-2" />
            Voir tous les produits DLC
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>

          <Button
            variant="outline"
            onClick={handleSnooze}
            className="flex-1"
            data-testid="button-snooze-alert"
          >
            <Clock className="h-4 w-4 mr-2" />
            Traiter plus tard (2h)
          </Button>
        </div>

        {/* Help Text */}
        <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded">
          💡 <strong>Conseil :</strong> Ce modal réapparaîtra tant que les produits ne sont pas traités.
          Marquez les produits comme "stock épuisé" ou traitez-les dans le module DLC pour faire disparaître l'alerte.
        </div>
      </DialogContent>
    </Dialog>
  );
}