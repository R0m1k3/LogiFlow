import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import CalendarGrid from "@/components/CalendarGrid";
import QuickCreateMenu from "@/components/modals/QuickCreateMenu";
import OrderDetailModal from "@/components/modals/OrderDetailModal";
import CreateOrderModal from "@/components/modals/CreateOrderModal";
import CreateDeliveryModal from "@/components/modals/CreateDeliveryModal";
import StatsPanel from "@/components/StatsPanel";
import { useAuthUnified } from "@/hooks/useAuthUnified";
import { useStore } from "@/components/Layout";
import { apiRequest } from "@/lib/queryClient";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { fr } from "date-fns/locale";

export default function Calendar() {
  const { user } = useAuthUnified();
  const { selectedStoreId } = useStore();
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date(2025, 6, 1)); // July 2025
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [showOrderDetail, setShowOrderDetail] = useState(false);
  const [showCreateOrder, setShowCreateOrder] = useState(false);
  const [showCreateDelivery, setShowCreateDelivery] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);

  // Fetch orders and deliveries for the current month with store filtering
  const { data: orders = [], isLoading: loadingOrders } = useQuery({
    queryKey: ['/api/orders', selectedStoreId, { 
      startDate: format(monthStart, 'yyyy-MM-dd'), 
      endDate: format(monthEnd, 'yyyy-MM-dd') 
    }],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: format(monthStart, 'yyyy-MM-dd'),
        endDate: format(monthEnd, 'yyyy-MM-dd')
      });
      if (selectedStoreId && user?.role === 'admin') {
        params.append('storeId', selectedStoreId.toString());
      }
      
      const url = `/api/orders?${params.toString()}`;
      console.log('📅 Calendar fetching orders:', {
        url,
        selectedStoreId,
        userRole: user?.role,
        params: params.toString()
      });
      
      const response = await fetch(url, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch orders');
      }
      
      const data = await response.json();
      console.log('📅 Calendar orders received:', Array.isArray(data) ? data.length : 'NOT_ARRAY', 'items');
      return data;
    },
  });

  const { data: deliveries = [], isLoading: loadingDeliveries } = useQuery({
    queryKey: ['/api/deliveries', selectedStoreId, { 
      startDate: format(monthStart, 'yyyy-MM-dd'), 
      endDate: format(monthEnd, 'yyyy-MM-dd') 
    }],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: format(monthStart, 'yyyy-MM-dd'),
        endDate: format(monthEnd, 'yyyy-MM-dd')
      });
      if (selectedStoreId && user?.role === 'admin') {
        params.append('storeId', selectedStoreId.toString());
      }
      
      const url = `/api/deliveries?${params.toString()}`;
      console.log('📅 Calendar fetching deliveries:', {
        url,
        selectedStoreId,
        userRole: user?.role,
        params: params.toString()
      });
      
      const response = await fetch(url, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch deliveries');
      }
      
      const data = await response.json();
      console.log('📅 Calendar deliveries received:', Array.isArray(data) ? data.length : 'NOT_ARRAY', 'items');
      return data;
    },
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

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setShowQuickCreate(true);
  };

  const handleItemClick = (item: any, type: 'order' | 'delivery') => {
    // Rafraîchir les données avant d'ouvrir le modal pour s'assurer d'avoir les liaisons à jour
    queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
    queryClient.invalidateQueries({ queryKey: ['/api/orders', selectedStoreId] });
    queryClient.invalidateQueries({ queryKey: ['/api/deliveries'] });
    queryClient.invalidateQueries({ queryKey: ['/api/deliveries', selectedStoreId] });
    
    setSelectedItem({ ...item, type });
    setShowOrderDetail(true);
  };

  const handleCreateOrder = () => {
    setShowQuickCreate(false);
    setShowCreateOrder(true);
  };

  const handleCreateDelivery = () => {
    setShowQuickCreate(false);
    setShowCreateDelivery(true);
  };

  const isLoading = loadingOrders || loadingDeliveries;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Calendrier des Commandes & Livraisons
            </h2>
            <p className="text-gray-600">
              {format(currentDate, 'MMMM yyyy', { locale: fr })}
            </p>
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
          <Button
            onClick={() => setShowQuickCreate(true)}
            className="bg-accent hover:bg-orange-600 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nouveau
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 p-6 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : (
          <CalendarGrid
            currentDate={currentDate}
            orders={orders}
            deliveries={deliveries}
            onDateClick={handleDateClick}
            onItemClick={handleItemClick}
          />
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
      <StatsPanel />
    </div>
  );
}
