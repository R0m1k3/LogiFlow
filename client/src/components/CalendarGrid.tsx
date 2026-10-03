import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday } from "date-fns";
import { safeDate } from "@/lib/dateUtils";
import { Plus, Check, MoreHorizontal, Package, Link, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { memo, useMemo, useState } from "react";

// Composant modal pour afficher les commentaires
function CommentModal({ isOpen, onClose, comment }: { isOpen: boolean, onClose: () => void, comment: string }) {
  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md w-full fixed z-[99999]" style={{zIndex: 99999}}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-blue-600" />
            Commentaire
          </DialogTitle>
        </DialogHeader>
        <div className="p-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-gray-700 whitespace-pre-wrap">{comment}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
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
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [commentClicked, setCommentClicked] = useState(false);
  
  const formatQuantity = (quantity: number, unit: string) => {
    return `${quantity}${unit === 'palettes' ? 'P' : 'C'}`;
  };

  if (type === 'order') {
    const getOrderStyle = () => {
      switch (item.status) {
        case 'delivered':
          return 'bg-gray-400 text-white shadow-md border-l-4 border-gray-500';
        case 'planned':
          return 'bg-yellow-300 text-gray-800 shadow-md border-l-4 border-yellow-500 font-medium';
        default:
          return 'bg-blue-300 text-gray-800 shadow-md border-l-4 border-blue-500';
      }
    };
    
    return (
      <div
        className={`text-xs px-2 py-2 cursor-pointer hover:opacity-90 transition-opacity ${getOrderStyle()} rounded-sm`}
        onClick={(e) => {
          e.stopPropagation();
          onItemClick(item, 'order');
        }}
        style={{marginBottom: '3px', display: 'block', width: '100%', minHeight: '24px'}}
      >
        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%'}}>
          <span className="truncate font-semibold" style={{fontSize: '11px', lineHeight: '1.2'}}>
            {item.supplier?.name || 'Commande'}
          </span>
          <div style={{display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '4px'}}>
            {/* Badge pour commande liée à des livraisons */}
            {item.deliveries && item.deliveries.length > 0 && (
              <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center" title="Liée à des livraisons">
                <Link className="w-2 h-2 text-white" />
              </div>
            )}
            {item.status === 'planned' && (
              <div className="w-2 h-2 bg-yellow-600 rounded-full" title="Planifié" />
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
        return 'bg-gray-400 text-white shadow-md border-l-4 border-gray-500';
      case 'pending':
        return 'bg-green-200 text-gray-800 shadow-md border-l-4 border-green-500';
      default:
        return 'bg-green-200 text-gray-800 shadow-md border-l-4 border-green-500';
    }
  };

  return (
    <div
      className={`text-xs px-2 py-2 cursor-pointer hover:opacity-90 transition-opacity ${getDeliveryStyle()} rounded-sm`}
      onClick={(e) => {
        if (commentClicked) {
          setCommentClicked(false);
          return;
        }
        e.stopPropagation();
        onItemClick(item, 'delivery');
      }}
      style={{marginBottom: '3px', display: 'block', width: '100%', minHeight: '24px'}}
    >
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%'}}>
        <span className="truncate font-semibold" style={{fontSize: '11px', lineHeight: '1.2'}}>
          {item.supplier?.name || 'Livraison'} - {formatQuantity(item.quantity, item.unit)}
        </span>
        <div style={{display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '4px'}}>
          {/* Icône commentaire pour les livraisons avec notes */}
          {item.notes && item.notes.trim() && (
            <div 
              className="w-4 h-4 bg-orange-500 rounded-full flex items-center justify-center cursor-pointer hover:bg-orange-600 transition-colors" 
              title="Voir le commentaire"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setCommentClicked(true);
                setShowCommentModal(true);
              }}
            >
              <MessageSquare className="w-2 h-2 text-white" />
            </div>
          )}
          {/* Badge pour livraison liée à une commande */}
          {item.orderId && (
            <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center" title="Liée à une commande">
              <Link className="w-2 h-2 text-white" />
            </div>
          )}
          {item.status === 'pending' && (
            <div className="w-2 h-2 bg-green-600 rounded-full" title="En attente" />
          )}
          {item.status === 'delivered' && (
            <Check className="w-3 h-3" />
          )}
        </div>
      </div>
      
      {/* Modal pour afficher le commentaire */}
      <CommentModal 
        isOpen={showCommentModal}
        onClose={() => {
          setShowCommentModal(false);
          // Reset après un délai pour éviter les conflits
          setTimeout(() => setCommentClicked(false), 100);
        }}
        comment={item.notes || ''}
      />
    </div>
  );
}

// Composant pour gérer l'overflow avec modal - DEV = PRODUCTION
function DayItemsContainer({ dayOrders, dayDeliveries, onItemClick }: { dayOrders: any[], dayDeliveries: any[], onItemClick: (item: any, type: 'order' | 'delivery') => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [selectedComment, setSelectedComment] = useState('');
  const [commentClickedItems, setCommentClickedItems] = useState<Set<string>>(new Set());
  const MAX_VISIBLE_ITEMS = 2; // FORCÉ : 2 éléments en dev ET production
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
    <div className="space-y-1 relative" style={{minHeight: '70px'}} data-modal-trigger="container">
      {/* Éléments visibles - IDENTIQUE DEV/PROD */}
      {visibleItems.map((item, index) => (
        <CalendarItem
          key={`${item.itemType}-${item.id}`}
          item={item}
          type={item.itemType}
          onItemClick={onItemClick}
        />
      ))}

      {/* Badge "+X autres" - BLANC/GRIS UNIFORME */}
      {hiddenCount > 0 && (
        <div data-modal-trigger="wrapper" onClick={(e) => e.stopPropagation()}>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                data-modal-trigger="button"
                className="w-full h-6 text-xs bg-white hover:bg-gray-50 border-gray-400 text-gray-700 font-semibold shadow-sm transition-all duration-150 border rounded-sm"
                style={{display: 'block !important', position: 'relative', zIndex: 50}}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsOpen(true);
                }}
              >
                <MoreHorizontal className="w-3 h-3 mr-1" />
                +{hiddenCount} autres
              </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg w-full max-h-[80vh] fixed z-[9999] p-0" style={{zIndex: 9999}}>
            <DialogHeader className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <DialogTitle className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <Package className="w-4 h-4 text-blue-600" />
                Éléments du jour - {totalItems}
              </DialogTitle>
            </DialogHeader>
            
            <div className="p-3" style={{maxHeight: '65vh', overflowY: 'auto'}}>
              <div className="space-y-2">
                {allItems.map((item, index) => {
                  const isOrder = item.itemType === 'order';
                  const itemKey = `${item.itemType}-${item.id}`;
                  const statusColor = item.status === 'delivered' 
                    ? 'bg-gray-100 border-gray-300' 
                    : item.status === 'planned'
                    ? 'bg-yellow-50 border-yellow-200'
                    : isOrder 
                    ? 'bg-blue-50 border-blue-200'
                    : 'bg-green-50 border-green-200';
                  
                  const statusText = item.status === 'delivered' ? 'Livré' : 
                                   item.status === 'planned' ? 'Planifié' : 'En attente';
                  
                  const statusIcon = item.status === 'delivered' 
                    ? <Check className="w-3 h-3 text-gray-600" />
                    : item.status === 'planned'
                    ? <div className="w-2 h-2 bg-yellow-500 rounded-full" />
                    : isOrder
                    ? <div className="w-2 h-2 bg-blue-500 rounded-full" />
                    : <div className="w-2 h-2 bg-green-600 rounded-full" />;
                  
                  return (
                    <div
                      key={`modal-${item.itemType}-${item.id}-${index}`}
                      className={`${statusColor} border rounded p-2 cursor-pointer hover:shadow-sm transition-all duration-150`}
                      onClick={(e) => {
                        if (commentClickedItems.has(itemKey)) {
                          setCommentClickedItems(prev => {
                            const newSet = new Set(prev);
                            newSet.delete(itemKey);
                            return newSet;
                          });
                          return;
                        }
                        e.preventDefault();
                        e.stopPropagation();
                        onItemClick(item, item.itemType);
                        setIsOpen(false);
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {statusIcon}
                            <span className="text-xs font-medium text-gray-600 uppercase">
                              {isOrder ? 'COMMANDE' : 'LIVRAISON'}
                            </span>
                            {/* Icône commentaire pour les livraisons avec notes */}
                            {!isOrder && item.notes && item.notes.trim() && (
                              <div 
                                className="w-4 h-4 bg-orange-500 rounded-full flex items-center justify-center cursor-pointer hover:bg-orange-600 transition-colors" 
                                title="Voir le commentaire"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setCommentClickedItems(prev => new Set(prev).add(itemKey));
                                  setSelectedComment(item.notes);
                                  setShowCommentModal(true);
                                }}
                              >
                                <MessageSquare className="w-2 h-2 text-white" />
                              </div>
                            )}
                            {/* Badge pour liaison - commandes avec livraisons ou livraisons avec commandes */}
                            {((isOrder && item.deliveries && item.deliveries.length > 0) || 
                              (!isOrder && item.orderId)) && (
                              <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center" 
                                   title={isOrder ? "Liée à des livraisons" : "Liée à une commande"}>
                                <Link className="w-2 h-2 text-white" />
                              </div>
                            )}
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                              item.status === 'delivered' ? 'bg-gray-200 text-gray-700' :
                              item.status === 'planned' ? 'bg-yellow-200 text-yellow-800' :
                              isOrder ? 'bg-blue-200 text-blue-800' : 'bg-green-200 text-green-800'
                            }`}>
                              {statusText}
                            </span>
                          </div>
                          
                          <div className="font-semibold text-sm text-gray-900 truncate">
                            {item.supplier?.name || (isOrder ? 'Commande' : 'Livraison')}
                          </div>
                          
                          <div className="flex items-center gap-3 text-xs text-gray-600 mt-1">
                            {!isOrder && (
                              <span>{item.quantity} {item.unit === 'palettes' ? 'P' : 'C'}</span>
                            )}
                            <span>
                              {item.scheduledDate ? new Date(item.scheduledDate).toLocaleDateString('fr-FR') :
                               item.deliveredDate ? new Date(item.deliveredDate).toLocaleDateString('fr-FR') :
                               new Date(item.createdAt).toLocaleDateString('fr-FR')
                              }
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </DialogContent>
          </Dialog>
          
          {/* Modal pour afficher le commentaire depuis la modal des éléments du jour */}
          <CommentModal 
            isOpen={showCommentModal}
            onClose={() => {
              setShowCommentModal(false);
              // Reset après un délai pour éviter les conflits
              setTimeout(() => setCommentClickedItems(new Set()), 100);
            }}
            comment={selectedComment}
          />
        </div>
      )}
    </div>
  );
}

// Liste vide partagée pour les jours sans élément (référence stable)
const NO_ITEMS: any[] = [];

function CalendarGrid({
  currentDate,
  orders,
  deliveries,
  publicities,
  selectedStoreId,
  userGroups,
  onDateClick,
  onItemClick,
}: CalendarGridProps) {
  // Jours affichés : 6 semaines complètes commençant un lundi
  const paddedDays = useMemo(() => {
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
    const days: Date[] = [];

    // Add padding days from previous month
    for (let i = startPadding; i > 0; i--) {
      const paddingDate = new Date(monthStart);
      paddingDate.setDate(paddingDate.getDate() - i);
      days.push(paddingDate);
    }

    // Add current month days
    days.push(...monthDays);

    // Add padding days from next month to complete the grid
    const remainingCells = 42 - days.length; // 6 weeks * 7 days
    for (let i = 1; i <= remainingCells; i++) {
      const paddingDate = new Date(monthEnd);
      paddingDate.setDate(paddingDate.getDate() + i);
      days.push(paddingDate);
    }

    return days;
  }, [currentDate]);

  // Commandes et livraisons indexées par jour ('yyyy-MM-dd', heure locale comme
  // isSameDay) en une seule passe sur chaque liste, au lieu de filtrer toutes
  // les listes pour chacune des 42 cases à chaque rendu
  const itemsByDay = useMemo(() => {
    const index = new Map<string, { orders: OrderWithRelations[]; deliveries: DeliveryWithRelations[] }>();
    const getDayEntry = (key: string) => {
      let entry = index.get(key);
      if (!entry) {
        entry = { orders: [], deliveries: [] };
        index.set(key, entry);
      }
      return entry;
    };
    let invalidCount = 0;

    for (const order of orders) {
      // Protection contre undefined/null
      if (!order || !order.supplier) {
        invalidCount++;
        continue;
      }
      // Essayer plusieurs champs de date possibles
      const orderDate = safeDate(order.plannedDate || order.createdAt);
      if (orderDate) {
        getDayEntry(format(orderDate, 'yyyy-MM-dd')).orders.push(order);
      }
    }

    for (const delivery of deliveries) {
      // Protection contre undefined/null
      if (!delivery || !delivery.supplier) {
        invalidCount++;
        continue;
      }
      // Essayer plusieurs champs de date possibles
      const deliveryDate = safeDate(delivery.scheduledDate || delivery.deliveredDate || delivery.createdAt);
      if (deliveryDate) {
        getDayEntry(format(deliveryDate, 'yyyy-MM-dd')).deliveries.push(delivery);
      }
    }

    if (invalidCount > 0) {
      console.warn(`⚠️ CalendarGrid: ${invalidCount} élément(s) sans fournisseur ignoré(s)`);
    }

    return index;
  }, [orders, deliveries]);

  // Publicités par jour affiché : filtrage par magasin fait une seule fois,
  // puis répartition sur les 42 jours selon la période de chaque publicité
  const publicitiesByDay = useMemo(() => {
    const byDay = new Map<string, any[]>();

    // Protection contre les données invalides qui causent des plantages en production
    if (!publicities || !Array.isArray(publicities)) {
      console.warn('⚠️ Invalid publicities data:', publicities);
      return byDay;
    }

    try {
      let invalidCount = 0;
      const storePublicities = publicities.filter(pub => {
        // Vérifications de sécurité pour éviter les plantages
        if (!pub || typeof pub !== 'object' || !pub.startDate || !pub.endDate) {
          invalidCount++;
          return false;
        }

        // If no store is selected and user has no assigned groups, show only publicities with participations
        if (!selectedStoreId && (!userGroups || userGroups.length === 0)) {
          return pub.participations && Array.isArray(pub.participations) && pub.participations.length > 0;
        }

        // If a specific store is selected, check if that store participates
        if (selectedStoreId) {
          return pub.participations && Array.isArray(pub.participations) &&
                 pub.participations.some((pg: any) => pg?.groupId === selectedStoreId);
        }

        // If no specific store selected but user has assigned stores,
        // show publicities where any of user's stores participate
        if (userGroups && Array.isArray(userGroups) && userGroups.length > 0) {
          const userGroupIds = userGroups.map((ug: any) => ug?.groupId).filter(id => id !== undefined);
          return pub.participations && Array.isArray(pub.participations) &&
                 pub.participations.some((pg: any) => pg?.groupId && userGroupIds.includes(pg.groupId));
        }

        // Default case: only show publicities with participations
        return pub.participations && Array.isArray(pub.participations) && pub.participations.length > 0;
      });

      if (invalidCount > 0) {
        console.warn(`⚠️ CalendarGrid: ${invalidCount} publicité(s) invalide(s) ou sans dates ignorée(s)`);
      }

      if (storePublicities.length > 0) {
        for (const date of paddedDays) {
          const dateStr = format(date, 'yyyy-MM-dd');
          // Check if the date is within the publicity period
          const dayPublicities = storePublicities.filter(pub => !(dateStr < pub.startDate || dateStr > pub.endDate));
          if (dayPublicities.length > 0) {
            byDay.set(dateStr, dayPublicities);
          }
        }
      }
    } catch (error) {
      console.error('❌ Error filtering publicities:', error);
      byDay.clear();
    }

    return byDay;
  }, [publicities, selectedStoreId, userGroups, paddedDays]);

  const weekDays = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

  return (
    <div className="bg-white shadow-xl border-2 border-gray-300 overflow-hidden">
      {/* Calendar Header - Design moderne épuré */}
      <div className="grid grid-cols-7 bg-white border-b border-gray-200">
        {weekDays.map((day, index) => (
          <div 
            key={day} 
            className={`p-4 text-center text-sm font-bold tracking-wider ${
              index >= 5 ? 'text-slate-700' : 'text-slate-800'
            } uppercase border-r border-gray-100 last:border-r-0`}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Days - Grid moderne sans arrondi */}
      <div className="grid grid-cols-7 gap-px bg-gray-100 p-px">
        {paddedDays.map((date, index) => {
          const isCurrentMonth = isSameMonth(date, currentDate);
          const isTodayDate = isToday(date);
          const isWeekend = date.getDay() === 0 || date.getDay() === 6;
          const dayKey = format(date, 'yyyy-MM-dd');
          const dayItems = itemsByDay.get(dayKey);
          const dayOrders = dayItems ? dayItems.orders : NO_ITEMS;
          const dayDeliveries = dayItems ? dayItems.deliveries : NO_ITEMS;
          const dayPublicities = publicitiesByDay.get(dayKey) || NO_ITEMS;
          
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
              onClick={(e) => {
                // Ne pas ouvrir le modal de création si on clique sur le bouton "+X autres" ou à l'intérieur
                const target = e.target as HTMLElement;
                if (target.closest('button') || target.closest('[role="dialog"]') || target.closest('[data-modal-trigger]')) {
                  e.preventDefault();
                  e.stopPropagation();
                  return;
                }
                onDateClick(date);
              }}
            >
              <div className="p-3 h-full flex flex-col relative">
                {/* Numéro du jour avec design moderne */}
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
                  
                  {/* Indicateur weekend moderne */}
                  {isWeekend && isCurrentMonth && (
                    <div className="w-2 h-2 bg-slate-400"></div>
                  )}
                </div>
                
                {/* Orders and Deliveries - DEV = PRODUCTION */}
                <div className="flex-1 relative" style={{minHeight: '90px', overflow: 'visible'}}>
                  <DayItemsContainer
                    dayOrders={dayOrders}
                    dayDeliveries={dayDeliveries}
                    onItemClick={onItemClick}
                  />
                </div>
              </div>
              
              {/* Publicities et Quick Create Button ensemble */}
              {isCurrentMonth && (
                <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
                  {/* Publicities avec Quick Create Button à gauche */}
                  {dayPublicities.length > 0 && (
                    <>
                      {dayPublicities.slice(0, 2).map((pub, idx) => (
                        <div key={`${pub.id}-${idx}`} className="flex items-center gap-1">
                          {/* Quick Create Button à gauche de la première publicité */}
                          {idx === 0 && (
                            <div className="opacity-0 group-hover:opacity-100 transition-all duration-200">
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
                          <div
                            className="bg-purple-300 text-purple-800 text-xs px-2 py-1 font-bold shadow-md cursor-help transform hover:scale-105 transition-transform duration-150 border border-purple-400"
                            title={`Pub ${pub.pubNumber}: ${pub.designation}${pub.participations ? ` - Magasins: ${pub.participations.map((pg: any) => pg.group?.name).join(', ')}` : ''}`}
                          >
                            {pub.pubNumber}
                          </div>
                        </div>
                      ))}
                      {dayPublicities.length > 2 && (
                        <div className="bg-purple-400 text-purple-900 text-xs px-2 py-1 font-bold shadow-md cursor-help transform hover:scale-105 transition-transform duration-150 border border-purple-500">
                          +{dayPublicities.length - 2}
                        </div>
                      )}
                    </>
                  )}
                  
                  {/* Quick Create Button quand pas de publicité */}
                  {dayPublicities.length === 0 && (
                    <div className="opacity-0 group-hover:opacity-100 transition-all duration-200">
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
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Mémorisé : l'ouverture d'une modale dans la page Calendrier ne recalcule pas la grille
export default memo(CalendarGrid);
