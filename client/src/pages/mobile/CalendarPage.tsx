/**
 * CalendarPage Mobile - Calendrier simplifié pour mobile
 * Affiche les commandes et livraisons comme événements
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthUnified } from "@/hooks/useAuthUnified";
import { useStore } from "@/contexts/StoreContext";
import MobileLayout from "./MobileLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Calendar as CalendarIcon,
    ChevronLeft,
    ChevronRight,
    Package,
    Truck
} from "lucide-react";
import {
    format,
    startOfMonth,
    endOfMonth,
    eachDayOfInterval,
    isSameMonth,
    isToday,
    addMonths,
    subMonths,
    startOfWeek,
    endOfWeek,
    isSameDay
} from "date-fns";
import { fr } from "date-fns/locale";

// Type pour les événements (combinaison de commandes et livraisons)
type CalendarEvent = {
    id: number;
    title: string;
    date: string;
    type: 'order' | 'delivery';
    status?: string;
    supplier?: { name: string };
};

export default function MobileCalendarPage() {
    const { user } = useAuthUnified();
    const { selectedStoreId } = useStore();
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());

    // Fetch orders for current month
    const { data: orders = [] } = useQuery({
        queryKey: ["/api/orders", selectedStoreId, format(currentMonth, 'yyyy-MM')],
        queryFn: async () => {
            const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
            const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

            const params = new URLSearchParams({
                startDate: start,
                endDate: end
            });
            if (selectedStoreId) params.append('storeId', selectedStoreId.toString());

            const response = await fetch(`/api/orders?${params}`, {
                credentials: 'include'
            });
            if (!response.ok) {
                return [];
            }
            const data = await response.json();
            return Array.isArray(data) ? data : [];
        },
        enabled: !!user,
    });

    // Fetch deliveries for current month
    const { data: deliveries = [] } = useQuery({
        queryKey: ["/api/deliveries", selectedStoreId, format(currentMonth, 'yyyy-MM')],
        queryFn: async () => {
            const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
            const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

            const params = new URLSearchParams({
                startDate: start,
                endDate: end
            });
            if (selectedStoreId) params.append('storeId', selectedStoreId.toString());

            const response = await fetch(`/api/deliveries?${params}`, {
                credentials: 'include'
            });
            if (!response.ok) {
                return [];
            }
            const data = await response.json();
            return Array.isArray(data) ? data : [];
        },
        enabled: !!user,
    });

    // Combine orders and deliveries into events
    const events: CalendarEvent[] = [
        ...orders.map((order: any) => ({
            id: order.id,
            title: `Cmd #${order.orderNumber || order.id}`,
            date: order.plannedDate,
            type: 'order' as const,
            status: order.status,
            supplier: order.supplier
        })),
        ...deliveries.map((delivery: any) => ({
            id: delivery.id,
            title: `Liv #${delivery.deliveryNumber || delivery.id}`,
            date: delivery.scheduledDate,
            type: 'delivery' as const,
            status: delivery.status,
            supplier: delivery.supplier
        }))
    ];

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);

    // Get days for the calendar grid
    const calendarStart = startOfWeek(monthStart, { locale: fr });
    const calendarEnd = endOfWeek(monthEnd, { locale: fr });
    const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

    // Get events for selected date
    const selectedDateEvents = selectedDate
        ? events.filter((event) => {
            if (!event.date) return false;
            const eventDate = new Date(event.date);
            return !isNaN(eventDate.getTime()) && isSameDay(eventDate, selectedDate);
        })
        : [];

    // Check if a day has events
    const getEventsForDay = (day: Date) => {
        return events.filter((event) => {
            if (!event.date) return false;
            const eventDate = new Date(event.date);
            return !isNaN(eventDate.getTime()) && isSameDay(eventDate, day);
        });
    };

    const navigateMonth = (direction: 'prev' | 'next') => {
        setCurrentMonth(direction === 'prev'
            ? subMonths(currentMonth, 1)
            : addMonths(currentMonth, 1)
        );
    };

    return (
        <MobileLayout>
            <div className="p-3 space-y-3">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <CalendarIcon className="h-5 w-5 text-purple-600" />
                        <h1 className="text-lg font-bold">Calendrier</h1>
                    </div>
                    <Badge variant="secondary">{events.length} événements</Badge>
                </div>

                {/* Month navigation */}
                <div className="flex items-center justify-between bg-white rounded-lg p-2 shadow-sm">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigateMonth('prev')}
                        className="h-10 w-10 p-0"
                    >
                        <ChevronLeft className="h-5 w-5" />
                    </Button>

                    <h2 className="font-semibold text-gray-900 capitalize">
                        {format(currentMonth, 'MMMM yyyy', { locale: fr })}
                    </h2>

                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigateMonth('next')}
                        className="h-10 w-10 p-0"
                    >
                        <ChevronRight className="h-5 w-5" />
                    </Button>
                </div>

                {/* Legend */}
                <div className="flex gap-4 text-xs">
                    <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-blue-500 rounded-full" />
                        <span>Commandes</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-green-500 rounded-full" />
                        <span>Livraisons</span>
                    </div>
                </div>

                {/* Calendar grid */}
                <Card>
                    <CardContent className="p-2">
                        {/* Weekday headers */}
                        <div className="grid grid-cols-7 gap-1 mb-1">
                            {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, i) => (
                                <div
                                    key={i}
                                    className="text-center text-xs font-medium text-gray-500 py-1"
                                >
                                    {day}
                                </div>
                            ))}
                        </div>

                        {/* Days grid */}
                        <div className="grid grid-cols-7 gap-1">
                            {calendarDays.map((day, i) => {
                                const isCurrentMonth = isSameMonth(day, currentMonth);
                                const isTodayDate = isToday(day);
                                const isSelected = selectedDate && isSameDay(day, selectedDate);
                                const dayEvents = getEventsForDay(day);
                                const hasOrders = dayEvents.some(e => e.type === 'order');
                                const hasDeliveries = dayEvents.some(e => e.type === 'delivery');

                                return (
                                    <button
                                        key={i}
                                        onClick={() => setSelectedDate(day)}
                                        className={`
                                            relative aspect-square flex flex-col items-center justify-center 
                                            text-sm rounded-lg transition-colors
                                            ${!isCurrentMonth ? 'text-gray-300' : 'text-gray-700'}
                                            ${isTodayDate ? 'font-bold' : ''}
                                            ${isSelected ? 'bg-blue-600 text-white' : 'hover:bg-gray-100'}
                                        `}
                                    >
                                        {format(day, 'd')}
                                        {(hasOrders || hasDeliveries) && !isSelected && (
                                            <div className="absolute bottom-0.5 flex gap-0.5">
                                                {hasOrders && <span className="w-1 h-1 bg-blue-500 rounded-full" />}
                                                {hasDeliveries && <span className="w-1 h-1 bg-green-500 rounded-full" />}
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>

                {/* Events for selected date */}
                {selectedDate && (
                    <div className="space-y-2">
                        <h3 className="font-semibold text-gray-900">
                            {format(selectedDate, 'EEEE d MMMM', { locale: fr })}
                        </h3>

                        {selectedDateEvents.length === 0 ? (
                            <p className="text-sm text-gray-500 py-4 text-center">
                                Aucun événement ce jour
                            </p>
                        ) : (
                            selectedDateEvents.map((event) => (
                                <Card key={`${event.type}-${event.id}`}>
                                    <CardContent className="p-3">
                                        <div className="flex items-start gap-3">
                                            <div className={`p-2 rounded-lg ${event.type === 'order'
                                                    ? 'bg-blue-100'
                                                    : 'bg-green-100'
                                                }`}>
                                                {event.type === 'order'
                                                    ? <Package className="h-4 w-4 text-blue-600" />
                                                    : <Truck className="h-4 w-4 text-green-600" />
                                                }
                                            </div>
                                            <div className="flex-1">
                                                <h4 className="font-medium text-gray-900">
                                                    {event.title}
                                                </h4>
                                                {event.supplier && (
                                                    <p className="text-sm text-gray-600">
                                                        {event.supplier.name}
                                                    </p>
                                                )}
                                                {event.status && (
                                                    <Badge
                                                        variant="secondary"
                                                        className="mt-1 text-xs"
                                                    >
                                                        {event.status}
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </div>
                )}
            </div>
        </MobileLayout>
    );
}
