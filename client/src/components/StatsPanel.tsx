import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Package, Truck, Clock } from "lucide-react";
import { useStore } from "./Layout";
import { useAuthUnified } from "@/hooks/useAuthUnified";

export default function StatsPanel() {
  const { selectedStoreId } = useStore();
  const { user } = useAuthUnified();
  const currentDate = new Date();
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  // Construire l'URL avec les paramètres
  const statsUrl = `/api/stats/monthly?year=${year}&month=${month}${selectedStoreId ? `&storeId=${selectedStoreId}` : ''}`;

  const { data: stats, isLoading } = useQuery({
    queryKey: [statsUrl, selectedStoreId], // Include selectedStoreId in key to force refetch
  });

  if (isLoading) {
    return (
      <div className="fixed bottom-6 right-6 bg-white rounded-xl shadow-lg border border-gray-200 p-4 min-w-80">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
          <div className="grid grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="text-center">
                <div className="h-8 bg-gray-200 rounded w-16 mx-auto mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-12 mx-auto"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <Card className="fixed bottom-6 right-6 min-w-80 shadow-lg border-gray-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center">
          <TrendingUp className="w-5 h-5 text-accent mr-2" />
          Statistiques du mois
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary flex items-center justify-center">
              <Package className="w-5 h-5 mr-1" />
              {stats?.ordersCount || 0}
            </div>
            <div className="text-xs text-gray-600">Commandes</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-secondary flex items-center justify-center">
              <Truck className="w-5 h-5 mr-1" />
              {stats?.deliveriesCount || 0}
            </div>
            <div className="text-xs text-gray-600">Livraisons</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-accent">
              {stats?.totalPalettes || 0}
            </div>
            <div className="text-xs text-gray-600">Palettes</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-delivered">
              {stats?.totalPackages || 0}
            </div>
            <div className="text-xs text-gray-600">Colis</div>
          </div>
        </div>
        
        <div className="mt-3 pt-3 border-t border-gray-200 text-center">
          <div className="text-sm text-gray-600 flex items-center justify-center">
            <Clock className="w-4 h-4 mr-1" />
            Délai moyen: 
            <span className="font-medium text-gray-900 ml-1">
              {stats?.averageDeliveryTime?.toFixed(1) || '0'} jours
            </span>
          </div>
        </div>
        
        {stats?.pendingOrdersCount > 0 && (
          <div className="mt-2 text-center">
            <div className="text-sm text-orange-600">
              {stats.pendingOrdersCount} commandes en attente
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
