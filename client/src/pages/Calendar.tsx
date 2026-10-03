import { useCallback, useState } from "react";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Plus, RefreshCw, Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import CalendarGrid from "@/components/CalendarGrid";
import QuickCreateMenu from "@/components/modals/QuickCreateMenu";
import OrderDetailModal from "@/components/modals/OrderDetailModal";
import CreateOrderModal from "@/components/modals/CreateOrderModal";
import CreateDeliveryModal from "@/components/modals/CreateDeliveryModal";
import StatsPanel from "@/components/StatsPanel";
import { useAuthUnified } from "@/hooks/useAuthUnified";
import { useStore } from "@/contexts/StoreContext";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { fr } from "date-fns/locale";
import { hasPermission } from "@/lib/permissions";

// Référence stable tant que les données ne sont pas chargées (CalendarGrid est mémorisé)
const NO_ITEMS: any[] = [];

export default function Calendar() {
  const { user } = useAuthUnified();
  const { selectedStoreId } = useStore();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date()); // Current date
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [showOrderDetail, setShowOrderDetail] = useState(false);
  const [showCreateOrder, setShowCreateOrder] = useState(false);
  const [showCreateDelivery, setShowCreateDelivery] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);


  const startDate = format(startOfMonth(currentDate), 'yyyy-MM-dd');
  const endDate = format(endOfMonth(currentDate), 'yyyy-MM-dd');

  // Fetch orders and deliveries for the current month with store filtering
  const { data: orders = NO_ITEMS, isLoading: loadingOrders, isPlaceholderData: ordersPlaceholder } = useQuery({
    queryKey: ['/api/orders', selectedStoreId, { startDate, endDate }],
    queryFn: async () => {
      const params = new URLSearchParams({ startDate, endDate });
      // CRITICAL FIX: Appliquer le filtrage par storeId pour TOUS les rôles, pas seulement admin
      if (selectedStoreId) {
        params.append('storeId', selectedStoreId.toString());
      }

      const response = await fetch(`/api/orders?${params.toString()}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch orders');
      }

      const data = await response.json();

      // Protection contre les données invalides en production
      if (!Array.isArray(data)) {
        console.warn('⚠️ Orders data is not an array, returning empty array');
        return [];
      }
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes de cache pour éviter la disparition des données
    gcTime: 10 * 60 * 1000, // 10 minutes en cache
    // Changement de mois : garder la grille affichée pendant le chargement au lieu
    // du spinner. Jamais au changement de magasin (données d'un autre magasin).
    placeholderData: (previousData, previousQuery) =>
      previousQuery?.queryKey[1] === selectedStoreId ? keepPreviousData(previousData) : undefined,
  });

  const { data: deliveries = NO_ITEMS, isLoading: loadingDeliveries, isPlaceholderData: deliveriesPlaceholder } = useQuery({
    queryKey: ['/api/deliveries', selectedStoreId, { startDate, endDate }],
    queryFn: async () => {
      const params = new URLSearchParams({ startDate, endDate });
      // CRITICAL FIX: Appliquer le filtrage par storeId pour TOUS les rôles, pas seulement admin
      if (selectedStoreId) {
        params.append('storeId', selectedStoreId.toString());
      }

      const response = await fetch(`/api/deliveries?${params.toString()}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch deliveries');
      }

      const data = await response.json();

      // Protection contre les données invalides en production
      if (!Array.isArray(data)) {
        console.warn('⚠️ Deliveries data is not an array, returning empty array');
        return [];
      }
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes de cache pour éviter la disparition des données
    gcTime: 10 * 60 * 1000, // 10 minutes en cache
    // Même règle que pour les commandes : jamais au changement de magasin
    placeholderData: (previousData, previousQuery) =>
      previousQuery?.queryKey[1] === selectedStoreId ? keepPreviousData(previousData) : undefined,
  });

  // Fetch publicities for the current year
  const { data: publicities = NO_ITEMS } = useQuery({
    queryKey: ['/api/ad-campaigns', currentDate.getFullYear(), selectedStoreId],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('year', currentDate.getFullYear().toString());
      if (selectedStoreId && user?.role === 'admin') {
        params.append('storeId', selectedStoreId.toString());
      }

      const response = await fetch(`/api/ad-campaigns?${params.toString()}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch publicities');
      }

      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    // Changement d'année : garder les publicités affichées pendant le chargement,
    // sauf au changement de magasin
    placeholderData: (previousData, previousQuery) =>
      previousQuery?.queryKey[2] === selectedStoreId ? keepPreviousData(previousData) : undefined,
  });

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  // Gestionnaires stables : CalendarGrid (mémorisé) n'est pas re-rendu à
  // l'ouverture ou à la fermeture des modales
  const handleDateClick = useCallback((date: Date) => {
    setSelectedDate(date);
    setShowQuickCreate(true);
  }, []);

  const handleItemClick = useCallback((item: any, type: 'order' | 'delivery') => {
    // Ne pas invalider le cache à l'ouverture pour éviter la disparition des données
    setSelectedItem({ ...item, type });
    setShowOrderDetail(true);
  }, []);

  const handleCreateOrder = () => {
    setShowQuickCreate(false);
    setShowCreateOrder(true);
  };

  const handleCreateDelivery = () => {
    setShowQuickCreate(false);
    setShowCreateDelivery(true);
  };



  // La grille n'attend pas les publicités : elles s'affichent dès leur arrivée
  const isLoading = loadingOrders || loadingDeliveries;
  // Mois précédent encore affiché pendant le chargement du nouveau mois
  const isMonthLoading = ordersPlaceholder || deliveriesPlaceholder;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <CalendarIcon className="w-8 h-8 text-blue-600 mr-3" />
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Calendrier des Commandes & Livraisons
              </h2>
              <p className="text-gray-600">
                {format(currentDate, 'MMMM yyyy', { locale: fr })}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {/* Legend */}
            <div className="flex items-center space-x-6 text-sm">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-primary rounded"></div>
                <span className="text-gray-600">Commandes</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-secondary rounded"></div>
                <span className="text-gray-600">Livraisons</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-delivered rounded"></div>
                <span className="text-gray-600">Livré</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Calendar Navigation */}
      <div className="p-6 pb-0">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateMonth('prev')}
              className="p-2"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <h3 className="text-xl font-semibold text-gray-900">
              {format(currentDate, 'MMMM yyyy', { locale: fr })}
            </h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateMonth('next')}
              className="p-2"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex items-center space-x-2">
            {(hasPermission(user?.role || '', 'orders', 'create') || hasPermission(user?.role || '', 'deliveries', 'create')) && (
              <Button
                onClick={() => setShowQuickCreate(true)}
                className="bg-accent hover:bg-orange-600 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Nouveau
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 p-6 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div
            className={`transition-opacity ${isMonthLoading ? 'opacity-60' : ''}`}
            aria-busy={isMonthLoading}
          >
            <CalendarGrid
              currentDate={currentDate}
              orders={orders}
              deliveries={deliveries}
              publicities={publicities}
              selectedStoreId={selectedStoreId}
              userGroups={user?.userGroups || NO_ITEMS}
              onDateClick={handleDateClick}
              onItemClick={handleItemClick}
            />
          </div>
        )}
      </div>

      {/* Modals */}
      {showQuickCreate && (
        <QuickCreateMenu
          isOpen={showQuickCreate}
          onClose={() => setShowQuickCreate(false)}
          onCreateOrder={handleCreateOrder}
          onCreateDelivery={handleCreateDelivery}
        />
      )}

      {showOrderDetail && selectedItem && (
        <OrderDetailModal
          isOpen={showOrderDetail}
          onClose={() => setShowOrderDetail(false)}
          item={selectedItem}
        />
      )}

      {showCreateOrder && (
        <CreateOrderModal
          isOpen={showCreateOrder}
          onClose={() => setShowCreateOrder(false)}
          selectedDate={selectedDate}
        />
      )}

      {showCreateDelivery && (
        <CreateDeliveryModal
          isOpen={showCreateDelivery}
          onClose={() => setShowCreateDelivery(false)}
          selectedDate={selectedDate}
        />
      )}

      {/* Stats Panel */}
      <StatsPanel currentDate={currentDate} />
    </div>
  );
}
