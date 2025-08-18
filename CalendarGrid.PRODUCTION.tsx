import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, isToday } from "date-fns";
import { fr } from "date-fns/locale";
import { safeDate } from "@/lib/dateUtils";
import { Plus, Check, MoreHorizontal, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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

// Composant pour afficher un élément (commande ou livraison) - VERSION PRODUCTION
function CalendarItem({ item, type, onItemClick }: { item: any, type: 'order' | 'delivery', onItemClick: (item: any, type: 'order' | 'delivery') => void }) {
  const formatQuantity = (quantity: number, unit: string) => {
    return `${quantity}${unit === 'palettes' ? 'P' : 'C'}`;
  };

  if (type === 'order') {
    const getOrderStyle = () => {
      switch (item.status) {
        case 'delivered':
          return 'bg-gray-400 text-white shadow-sm border-l-4 border-gray-500';
        case 'planned':
          return 'bg-yellow-300 text-gray-800 shadow-sm border-l-4 border-yellow-500 font-medium';
        default:
          return 'bg-blue-300 text-gray-800 shadow-sm border-l-4 border-blue-500';
      }
    };
    
    return (
      <div
        className={`text-xs px-1 py-1 cursor-pointer hover:opacity-90 transition-opacity ${getOrderStyle()}`}
        onClick={(e) => {
          e.stopPropagation();
          onItemClick(item, 'order');
        }}
        style={{marginBottom: '2px', display: 'block', width: '100%'}}
      >
        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%'}}>
          <span className="truncate font-semibold" style={{fontSize: '10px'}}>
            {item.supplier?.name || 'Commande'}
          </span>
          <div style={{display: 'flex', alignItems: 'center'}}>
            {item.status === 'planned' && (
              <div className="w-1.5 h-1.5 bg-yellow-600" title="Planifié" />
            )}
            {item.status === 'delivered' && (
              <Check className="w-3 h-3" />
            )}
          </div>
        </div>
      </div>
    );
  }

  // Livraison
  const getDeliveryStyle = () => {
    switch (item.status) {
      case 'delivered':
        return 'bg-gray-400 text-white shadow-sm border-l-4 border-gray-500';
      case 'pending':
        return 'bg-green-300 text-gray-800 shadow-sm border-l-4 border-green-500';
      default:
        return 'bg-green-300 text-gray-800 shadow-sm border-l-4 border-green-500';
    }
  };

  return (
    <div
      className={`text-xs px-1 py-1 cursor-pointer hover:opacity-90 transition-opacity ${getDeliveryStyle()}`}
      onClick={(e) => {
        e.stopPropagation();
        onItemClick(item, 'delivery');
      }}
      style={{marginBottom: '2px', display: 'block', width: '100%'}}
    >
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%'}}>
        <span className="truncate font-semibold" style={{fontSize: '10px'}}>
          {item.supplier?.name || 'Livraison'} - {formatQuantity(item.quantity, item.unit)}
        </span>
        <div style={{display: 'flex', alignItems: 'center'}}>
          {item.status === 'pending' && (
            <div className="w-1.5 h-1.5 bg-green-600" title="En attente" />
          )}
          {item.status === 'delivered' && (
            <Check className="w-3 h-3" />
          )}
        </div>
      </div>
    </div>
  );
}

// Composant pour gérer l'overflow avec modal - VERSION PRODUCTION
function DayItemsContainer({ dayOrders, dayDeliveries, onItemClick }: { dayOrders: any[], dayDeliveries: any[], onItemClick: (item: any, type: 'order' | 'delivery') => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const MAX_VISIBLE_ITEMS = 4; // PRODUCTION : TOUJOURS 4 ÉLÉMENTS
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
    <div className="space-y-1 relative" style={{minHeight: '60px'}}>
      {/* Éléments visibles */}
      {visibleItems.map((item, index) => (
        <CalendarItem
          key={`${item.itemType}-${item.id}`}
          item={item}
          type={item.itemType}
          onItemClick={onItemClick}
        />
      ))}

      {/* Badge "+X autres" avec modal - PRODUCTION */}
      {hiddenCount > 0 && (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="w-full h-5 text-xs bg-white hover:bg-gray-50 border-gray-400 text-gray-700 font-semibold shadow-sm transition-all duration-150 border"
              style={{display: 'block !important', position: 'relative', zIndex: 9999}}
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(true);
              }}
            >
              <MoreHorizontal className="w-3 h-3 mr-1" />
              +{hiddenCount} autres
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg max-h-[70vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-gray-800 flex items-center gap-2">
                <Package className="w-4 h-4" />
                Éléments du jour ({totalItems})
              </DialogTitle>
            </DialogHeader>
            <div className="mt-3">
              <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                {allItems.map((item, index) => (
                  <div
                    key={`modal-${item.itemType}-${item.id}-${index}`}
                    className="border border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    <CalendarItem
                      item={item}
                      type={item.itemType}
                      onItemClick={(clickedItem, type) => {
                        onItemClick(clickedItem, type);
                        setIsOpen(false);
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>
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
  onItemClick
}: CalendarGridProps) {
  const weekDays = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];
  
  // Generate calendar days
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  
  // Calculate the number of days to show before the month starts (to align with Monday)
  const startPadding = (monthStart.getDay() + 6) % 7; // Convert Sunday=0 to Monday=0 format
  const paddingDays = Array.from({ length: startPadding }, (_, i) => {
    const date = new Date(monthStart);
    date.setDate(date.getDate() - startPadding + i);
    return date;
  });
  
  const paddedDays = [...paddingDays, ...calendarDays];

  // Filter data based on selected store
  const filteredOrders = selectedStoreId 
    ? orders.filter(order => order.groupId === selectedStoreId)
    : orders;
    
  const filteredDeliveries = selectedStoreId 
    ? deliveries.filter(delivery => delivery.groupId === selectedStoreId)
    : deliveries;

  const getItemsForDate = (date: Date) => {
    const dayOrders = filteredOrders.filter(order => {
      const orderDate = safeDate(order.scheduledDate || order.deliveredDate || order.createdAt);
      return orderDate && isSameDay(orderDate, date);
    });
    
    const dayDeliveries = filteredDeliveries.filter(delivery => {
      const deliveryDate = safeDate(delivery.scheduledDate || delivery.deliveredDate || delivery.createdAt);
      return deliveryDate && isSameDay(deliveryDate, date);
    });
    
    return { orders: dayOrders, deliveries: dayDeliveries };
  };

  const getPublicitiesForDate = (date: Date) => {
    return publicities.filter(pub => {
      if (!pub.validFrom || !pub.validTo) return false;
      
      const pubStart = safeDate(pub.validFrom);
      const pubEnd = safeDate(pub.validTo);
      
      if (!pubStart || !pubEnd) return false;
      
      return date >= pubStart && date <= pubEnd;
    });
  };

  return (
    <div className="bg-white shadow-xl border-2 border-gray-300 overflow-hidden">
      {/* Calendar Header */}
      <div className="grid grid-cols-7 bg-gradient-to-r from-slate-100 to-gray-100 border-b-2 border-gray-400">
        {weekDays.map((day, index) => (
          <div 
            key={day} 
            className={`p-4 text-center text-sm font-bold tracking-wider ${
              index >= 5 ? 'text-slate-700' : 'text-slate-800'
            } uppercase border-r border-gray-300 last:border-r-0`}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Days */}
      <div className="grid grid-cols-7 gap-px bg-gray-300 p-px">
        {paddedDays.map((date, index) => {
          const isCurrentMonth = isSameMonth(date, currentDate);
          const isTodayDate = isToday(date);
          const isWeekend = date.getDay() === 0 || date.getDay() === 6;
          const { orders: dayOrders, deliveries: dayDeliveries } = getItemsForDate(date);
          const dayPublicities = getPublicitiesForDate(date);
          
          return (
            <div
              key={index}
              className={`h-36 relative group cursor-pointer transition-all duration-200 ${
                isTodayDate
                  ? "bg-blue-100 hover:bg-blue-200 border-2 border-blue-600"
                  : isWeekend && isCurrentMonth
                  ? "bg-gray-200 hover:bg-gray-300"
                  : isCurrentMonth
                  ? "bg-white hover:bg-gray-50"
                  : "bg-gray-150"
              } ${!isCurrentMonth ? 'opacity-50' : ''}`}
              onClick={() => onDateClick(date)}
            >
              <div className="p-3 h-full flex flex-col relative">
                {/* Numéro du jour */}
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-sm font-bold tracking-tight ${
                    isTodayDate 
                      ? "text-white bg-blue-600 px-2 py-1 text-xs shadow-md" 
                      : isCurrentMonth 
                      ? "text-slate-900" 
                      : "text-gray-500"
                  }`}>
                    {format(date, 'd')}
                  </span>
                  
                  {/* Indicateur weekend */}
                  {isWeekend && isCurrentMonth && (
                    <div className="w-2 h-2 bg-slate-400"></div>
                  )}
                </div>
                
                {/* Orders and Deliveries - PRODUCTION OPTIMISÉ */}
                <div className="flex-1 relative" style={{minHeight: '80px', overflow: 'visible'}}>
                  <DayItemsContainer
                    dayOrders={dayOrders}
                    dayDeliveries={dayDeliveries}
                    onItemClick={onItemClick}
                  />
                </div>
              </div>
              
              {/* Publicities */}
              {dayPublicities.length > 0 && (
                <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
                  {dayPublicities.slice(0, 2).map((pub, idx) => (
                    <div
                      key={`${pub.id}-${idx}`}
                      className="bg-purple-300 text-purple-800 text-xs px-2 py-1 font-bold shadow-md cursor-help transform hover:scale-105 transition-transform duration-150 border border-purple-400"
                      title={`Pub ${pub.pubNumber}: ${pub.designation}${pub.participations ? ` - Magasins: ${pub.participations.map((pg: any) => pg.group?.name).join(', ')}` : ''}`}
                    >
                      {pub.pubNumber}
                    </div>
                  ))}
                  {dayPublicities.length > 2 && (
                    <div className="bg-purple-400 text-purple-900 text-xs px-2 py-1 font-bold shadow-md cursor-help transform hover:scale-105 transition-transform duration-150 border border-purple-500">
                      +{dayPublicities.length - 2}
                    </div>
                  )}
                </div>
              )}

              {/* Quick Create Button */}
              {isCurrentMonth && (
                <div className={`absolute ${dayPublicities.length === 0 ? 'top-2 right-2' : 'bottom-2 right-2'} opacity-0 group-hover:opacity-100 transition-all duration-200`}>
                  <Button
                    size="sm"
                    className="w-6 h-6 bg-orange-300 text-orange-800 p-0 hover:bg-orange-400 shadow-md transform hover:scale-110 transition-all duration-150 border border-orange-500"
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