import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, isToday } from "date-fns";
import { fr } from "date-fns/locale";
import { safeDate } from "@/lib/dateUtils";
import { Plus, Check, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useState } from "react";
import type { OrderWithRelations, DeliveryWithRelations } from "@shared/schema";

interface CalendarGridProps {
  currentDate: Date;
  orders: OrderWithRelations[];
  deliveries: DeliveryWithRelations[];
  publicities: any[];
  selectedStoreId: number | null;
  userGroups: any[];
  onDateClick: (date: Date) => void;
  onItemClick: (item: any, type: 'order' | 'delivery') => void;
}

// Composant pour afficher un élément (commande ou livraison)
function CalendarItem({ item, type, onItemClick }: { item: any, type: 'order' | 'delivery', onItemClick: (item: any, type: 'order' | 'delivery') => void }) {
  const formatQuantity = (quantity: number, unit: string) => {
    return `${quantity}${unit === 'palettes' ? 'P' : 'C'}`;
  };

  if (type === 'order') {
    const colorClass = item.status === 'delivered' 
      ? 'bg-delivered text-white' 
      : item.status === 'planned'
      ? 'bg-yellow-200 text-gray-800 border-2 border-yellow-300'
      : 'bg-primary text-white';
    
    return (
      <div
        className={`text-xs px-2 py-1 flex items-center justify-between cursor-pointer group/order ${colorClass}`}
        onClick={(e) => {
          e.stopPropagation();
          onItemClick(item, 'order');
        }}
      >
        <span className="truncate">
          {item.supplier.name}
        </span>
        <div className="flex items-center ml-1 flex-shrink-0">
          {item.status === 'planned' && (
            <span className="w-2 h-2 bg-yellow-600 mr-1" title="Commande planifiée (liée à une livraison)" />
          )}
          {item.status === 'delivered' && (
            <Check className="w-3 h-3" />
          )}
        </div>
      </div>
    );
  }

  // Livraison
  return (
    <div
      className={`text-xs px-2 py-1 flex items-center justify-between cursor-pointer ${
        item.status === 'delivered' 
          ? 'bg-delivered text-white' 
          : item.status === 'pending'
          ? 'bg-yellow-500 text-white border-2 border-yellow-300'
          : 'bg-secondary text-white'
      }`}
      onClick={(e) => {
        e.stopPropagation();
        onItemClick(item, 'delivery');
      }}
    >
      <span className="truncate">
        {item.supplier.name} - {formatQuantity(item.quantity, item.unit)}
      </span>
      <div className="flex items-center ml-1 flex-shrink-0">
        {item.status === 'pending' && (
          <span className="w-2 h-2 bg-orange-300 mr-1" title="En attente de validation" />
        )}
        {item.status === 'delivered' && (
          <Check className="w-3 h-3" />
        )}
      </div>
    </div>
  );
}

// Composant pour gérer l'overflow avec popover
function DayItemsContainer({ dayOrders, dayDeliveries, onItemClick }: { dayOrders: any[], dayDeliveries: any[], onItemClick: (item: any, type: 'order' | 'delivery') => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const MAX_VISIBLE_ITEMS = 2;
  const totalItems = dayOrders.length + dayDeliveries.length;
  
  if (totalItems === 0) return null;

  // Combiner tous les éléments avec leur type
  const allItems = [
    ...dayOrders.map(order => ({ ...order, itemType: 'order' as const })),
    ...dayDeliveries.map(delivery => ({ ...delivery, itemType: 'delivery' as const }))
  ];

  const visibleItems = allItems.slice(0, MAX_VISIBLE_ITEMS);
  const hiddenCount = Math.max(0, totalItems - MAX_VISIBLE_ITEMS);

  return (
    <div className="mt-1 space-y-1">
      {/* Éléments visibles */}
      {visibleItems.map((item, index) => (
        <CalendarItem
          key={`${item.itemType}-${item.id}`}
          item={item}
          type={item.itemType}
          onItemClick={onItemClick}
        />
      ))}

      {/* Badge "+X autres" avec popover */}
      {hiddenCount > 0 && (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="w-full h-6 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 border-gray-300"
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(!isOpen);
              }}
            >
              <MoreHorizontal className="w-3 h-3 mr-1" />
              +{hiddenCount} autres
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-80 p-3"
            align="start"
            side="right"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-2">
              <h4 className="font-medium text-sm text-gray-900">
                Tous les éléments ({totalItems})
              </h4>
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {allItems.map((item) => (
                  <CalendarItem
                    key={`popup-${item.itemType}-${item.id}`}
                    item={item}
                    type={item.itemType}
                    onItemClick={(clickedItem, type) => {
                      onItemClick(clickedItem, type);
                      setIsOpen(false);
                    }}
                  />
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

export default function CalendarGrid({
  currentDate,
  orders,
  deliveries,
  publicities,
  selectedStoreId,
  userGroups,
  onDateClick,
  onItemClick,
}: CalendarGridProps) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);

  // Helper function to filter publicities based on user's assigned stores
  const getPublicitiesForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    
    return publicities.filter(pub => {
      // Check if the date is within the publicity period
      const pubStart = pub.startDate;
      const pubEnd = pub.endDate;
      
      if (dateStr < pubStart || dateStr > pubEnd) {
        return false;
      }

      // If no store is selected and user has no assigned groups, show all publicities
      if (!selectedStoreId && (!userGroups || userGroups.length === 0)) {
        return true;
      }

      // If a specific store is selected, check if that store participates
      if (selectedStoreId) {
        return pub.participatingGroups?.some((pg: any) => pg.groupId === selectedStoreId);
      }

      // If no specific store selected but user has assigned stores, 
      // show publicities where any of user's stores participate
      if (userGroups && userGroups.length > 0) {
        const userGroupIds = userGroups.map((ug: any) => ug.groupId);
        return pub.participatingGroups?.some((pg: any) => userGroupIds.includes(pg.groupId));
      }

      return true;
    });
  };

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
          const dayPublicities = getPublicitiesForDate(date);
          
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
                
                {/* Orders and Deliveries avec système d'overflow */}
                <DayItemsContainer
                  dayOrders={dayOrders}
                  dayDeliveries={dayDeliveries}
                  onItemClick={onItemClick}
                />
              </div>
              
              {/* Publicities in top-right corner */}
              {dayPublicities.length > 0 && (
                <div className="absolute top-1 right-1 flex flex-col items-end gap-1">
                  {dayPublicities.slice(0, 3).map((pub, idx) => (
                    <div
                      key={`${pub.id}-${idx}`}
                      className="bg-purple-100 text-purple-800 text-xs px-1.5 py-0.5 rounded-sm border border-purple-200 font-medium shadow-sm cursor-help"
                      title={`Pub ${pub.pubNumber}: ${pub.designation}${pub.participatingGroups ? ` - Magasins: ${pub.participatingGroups.map((pg: any) => pg.group?.name).join(', ')}` : ''}`}
                    >
                      {pub.pubNumber}
                    </div>
                  ))}
                  {dayPublicities.length > 3 && (
                    <div className="bg-purple-200 text-purple-700 text-xs px-1.5 py-0.5 rounded-sm border border-purple-300 font-medium">
                      +{dayPublicities.length - 3}
                    </div>
                  )}
                </div>
              )}

              {/* Quick Create Button */}
              {isCurrentMonth && dayPublicities.length === 0 && (
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
              
              {/* Quick Create Button when publicities are present */}
              {isCurrentMonth && dayPublicities.length > 0 && (
                <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
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
