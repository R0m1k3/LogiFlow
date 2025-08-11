import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, isToday } from "date-fns";
import { fr } from "date-fns/locale";
import { safeDate } from "@/lib/dateUtils";
import { Plus, Check, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import type { OrderWithRelations, DeliveryWithRelations } from "@shared/schema";

interface CalendarGridProps {
  currentDate: Date;
  orders: OrderWithRelations[];
  deliveries: DeliveryWithRelations[];
  onDateClick: (date: Date) => void;
  onItemClick: (item: any, type: 'order' | 'delivery') => void;
  user?: { role: string } | null;
  onOrderValidated?: () => void;
}

export default function CalendarGrid({
  currentDate,
  orders,
  deliveries,
  onDateClick,
  onItemClick,
  user,
  onOrderValidated,
}: CalendarGridProps) {
  const { toast } = useToast();
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);

  // Get all days in the month
  const monthDays = eachDayOfInterval({
    start: monthStart,
    end: monthEnd,
  });

  // Pad the calendar to start on Monday
  const firstDayOfWeek = monthStart.getDay();
  const startPadding = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
  const paddedDays = [];

  // Add padding days from previous month
  for (let i = startPadding; i > 0; i--) {
    const paddingDate = new Date(monthStart);
    paddingDate.setDate(paddingDate.getDate() - i);
    paddedDays.push(paddingDate);
  }

  // Add current month days
  paddedDays.push(...monthDays);

  // Add padding days from next month to complete the grid
  const remainingCells = 42 - paddedDays.length; // 6 weeks * 7 days
  for (let i = 1; i <= remainingCells; i++) {
    const paddingDate = new Date(monthEnd);
    paddingDate.setDate(paddingDate.getDate() + i);
    paddedDays.push(paddingDate);
  }

  const weekDays = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

  // Fonction pour valider une commande
  const handleValidateOrder = async (orderId: number, event: React.MouseEvent) => {
    event.stopPropagation();
    
    console.log('🔥 DEBUG: Validation clicked for order', orderId, 'User role:', user?.role);
    
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'delivered' })
      });
      
      console.log('🔥 DEBUG: Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('🔥 DEBUG: Response error:', errorText);
        throw new Error(`Erreur ${response.status}: ${errorText}`);
      }
      
      toast({
        title: "Commande validée",
        description: `La commande CMD-${orderId} a été marquée comme livrée.`,
      });
      
      // Rafraîchir les données
      if (onOrderValidated) {
        onOrderValidated();
      }
    } catch (error) {
      console.error('🔥 DEBUG: Validation error:', error);
      toast({
        title: "Erreur",
        description: "Impossible de valider la commande.",
        variant: "destructive"
      });
    }
  };

  const getItemsForDate = (date: Date) => {
    // Debug: Log des commandes reçues (seulement une fois)
    if (orders.length > 0 && date.getDate() === 1) {
      console.log('📅 CalendarGrid Debug - Orders received:', orders.length);
      console.log('📅 First order structure:', orders[0]);
      console.log('📅 All orders dates:', orders.map(o => ({ id: o.id, plannedDate: o.plannedDate, supplier: o.supplier?.name })));
    }
    
    // Debug: Log des livraisons reçues (seulement une fois)
    if (deliveries.length > 0 && date.getDate() === 1) {
      console.log('🚛 CalendarGrid Debug - Deliveries received:', deliveries.length);
      console.log('🚛 First delivery structure:', deliveries[0]);
      console.log('🚛 All deliveries dates:', deliveries.map(d => ({ id: d.id, scheduledDate: d.scheduledDate, supplier: d.supplier?.name })));
    }
    
    const dayOrders = orders.filter(order => {
      // Protection contre undefined/null
      if (!order || !order.supplier) {
        console.warn('📅 Invalid order found:', order);
        return false;
      }
      
      // Essayer plusieurs champs de date possibles
      const orderDate = safeDate(order.plannedDate || order.createdAt);
      const matches = orderDate && isSameDay(orderDate, date);
      
      if (matches) {
        console.log('📅 Order matches date:', {
          orderId: order.id,
          supplier: order.supplier?.name,
          plannedDate: order.plannedDate,
          matchingDate: format(date, 'yyyy-MM-dd')
        });
      }
      
      return matches;
    });
    
    const dayDeliveries = deliveries.filter(delivery => {
      // Protection contre undefined/null
      if (!delivery || !delivery.supplier) {
        console.warn('🚛 Invalid delivery found:', delivery);
        return false;
      }
      
      // Essayer plusieurs champs de date possibles
      const deliveryDate = safeDate(delivery.scheduledDate || delivery.deliveredDate || delivery.createdAt);
      const matches = deliveryDate && isSameDay(deliveryDate, date);
      
      if (matches) {
        console.log('🚛 Delivery matches date:', {
          deliveryId: delivery.id,
          supplier: delivery.supplier?.name,
          scheduledDate: delivery.scheduledDate,
          matchingDate: format(date, 'yyyy-MM-dd')
        });
      }
      
      return matches;
    });
    
    return { orders: dayOrders, deliveries: dayDeliveries };
  };

  const formatQuantity = (quantity: number, unit: string) => {
    return `${quantity}${unit === 'palettes' ? 'P' : 'C'}`;
  };

  return (
    <div className="bg-white shadow-sm border border-gray-200 overflow-hidden">
      {/* Calendar Header */}
      <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
        {weekDays.map(day => (
          <div key={day} className="p-4 text-center text-sm font-medium text-gray-700">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Days */}
      <div className="grid grid-cols-7">
        {paddedDays.map((date, index) => {
          const isCurrentMonth = isSameMonth(date, currentDate);
          const isTodayDate = isToday(date);
          const { orders: dayOrders, deliveries: dayDeliveries } = getItemsForDate(date);
          
          return (
            <div
              key={index}
              className={`h-32 border-r border-b border-gray-100 relative group cursor-pointer transition-colors ${
                isTodayDate
                  ? "bg-blue-50 hover:bg-blue-100 ring-1 ring-blue-200"
                  : isCurrentMonth
                  ? "bg-white hover:bg-gray-50"
                  : "bg-gray-50"
              }`}
              onClick={() => onDateClick(date)}
            >
              <div className="p-2">
                <span className={`text-sm font-medium ${
                  isTodayDate 
                    ? "text-blue-700 font-semibold" 
                    : isCurrentMonth ? "text-gray-900" : "text-gray-400"
                }`}>
                  {format(date, 'd')}
                </span>
                
                {/* Orders and Deliveries */}
                <div className="mt-1 space-y-1">
                  {dayOrders.map((order) => {
                    // Vérifier si la commande a une livraison liée (peu importe le statut)
                    const hasLinkedDelivery = order.deliveries && order.deliveries.length > 0;
                    
                    const colorClass = order.status === 'delivered' 
                      ? 'bg-delivered text-white' 
                      : order.status === 'planned'
                      ? 'bg-orange-500 text-white border-2 border-orange-300'
                      : 'bg-primary text-white';
                    
                    return (
                      <div
                        key={`order-${order.id}`}
                        className={`text-xs px-2 py-1 flex items-center justify-between cursor-pointer group/order ${colorClass}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onItemClick(order, 'order');
                        }}
                      >
                        <span className="truncate">
                          {order.supplier.name}
                        </span>
                        <div className="flex items-center ml-1 flex-shrink-0">
                          {/* DEBUG: Affichage info utilisateur sur première commande */}
                          {order.id === orders[0]?.id && (
                            <div className="text-[8px] text-red-500 absolute -top-4 -left-2 bg-white px-1 rounded z-10">
                              User: {user?.role || 'null'} | Status: {order.status}
                            </div>
                          )}
                          
                          {/* Bouton de validation pour les admins - VERSION VISIBLE POUR DEBUG */}
                          {user?.role === 'admin' && order.status !== 'delivered' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-5 w-5 p-0 bg-red-500 hover:bg-red-600 mr-1"
                              onClick={(e) => handleValidateOrder(order.id, e)}
                              title="Valider la commande"
                            >
                              <CheckCircle className="w-3 h-3 text-white" />
                            </Button>
                          )}
                          
                          {/* Bouton de test TOUJOURS VISIBLE */}
                          {order.status !== 'delivered' && (
                            <div className="text-[8px] bg-yellow-300 text-black px-1 rounded mr-1">
                              V
                            </div>
                          )}
                          
                          {order.status === 'planned' && (
                            <span className="w-2 h-2 bg-yellow-300 mr-1" title="Commande planifiée (liée à une livraison)" />
                          )}
                          {order.status === 'delivered' && (
                            <Check className="w-3 h-3" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                  
                  {dayDeliveries.map((delivery) => (
                    <div
                      key={`delivery-${delivery.id}`}
                      className={`text-xs px-2 py-1 flex items-center justify-between cursor-pointer ${
                        delivery.status === 'delivered' 
                          ? 'bg-delivered text-white' 
                          : delivery.status === 'pending'
                          ? 'bg-yellow-500 text-white border-2 border-yellow-300'
                          : 'bg-secondary text-white'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onItemClick(delivery, 'delivery');
                      }}
                    >
                      <span className="truncate">
                        {delivery.supplier.name} - {formatQuantity(delivery.quantity, delivery.unit)}
                      </span>
                      <div className="flex items-center ml-1 flex-shrink-0">
                        {delivery.status === 'pending' && (
                          <span className="w-2 h-2 bg-orange-300 mr-1" title="En attente de validation" />
                        )}
                        {delivery.status === 'delivered' && (
                          <Check className="w-3 h-3" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Quick Create Button */}
              {isCurrentMonth && (
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    size="sm"
                    className="w-6 h-6 bg-accent text-white rounded-full p-0 hover:bg-orange-600"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDateClick(date);
                    }}
                  >
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
