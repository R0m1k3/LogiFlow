/**
 * CalendarPage Mobile - Calendrier simplifié pour mobile
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
    Clock,
    MapPin
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

// Type pour les événements
type CalendarEvent = {
    id: number;
    title: string;
    startDate: string;
    endDate?: string;
    description?: string;
    location?: string;
    type?: string;
};

export default function MobileCalendarPage() {
    const { user } = useAuthUnified();
    const { selectedStoreId } = useStore();
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());

    // Fetch calendar events
    const { data: events = [], isLoading } = useQuery({
        queryKey: ["/api/calendar/events", selectedStoreId, format(currentMonth, 'yyyy-MM')],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (selectedStoreId) params.append('storeId', selectedStoreId.toString());
            params.append('month', format(currentMonth, 'yyyy-MM'));

            const response = await fetch(`/api/calendar/events?${params}`, {
                credentials: 'include'
            });
            if (!response.ok) return [];
            const data = await response.json();
            return Array.isArray(data) ? data : [];
        },
        enabled: !!user,
    });

    // Get days for the calendar grid
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { locale: fr });
    const calendarEnd = endOfWeek(monthEnd, { locale: fr });
    const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

    // Get events for selected date
    const selectedDateEvents = selectedDate
        ? events.filter((event: CalendarEvent) =>
            isSameDay(new Date(event.startDate), selectedDate)
        )
        : [];

    // Check if a day has events
    const hasEvents = (day: Date) => {
        return events.some((event: CalendarEvent) =>
            isSameDay(new Date(event.startDate), day)
        );
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
                                const dayHasEvents = hasEvents(day);

                                return (
                                    <button
                                        key={i}
                                        onClick={() => setSelectedDate(day)}
                                        className={`
                                            relative aspect-square flex items-center justify-center 
                                            text-sm rounded-lg transition-colors
                                            ${!isCurrentMonth ? 'text-gray-300' : 'text-gray-700'}
                                            ${isTodayDate ? 'font-bold' : ''}
                                            ${isSelected ? 'bg-blue-600 text-white' : 'hover:bg-gray-100'}
                                        `}
                                    >
                                        {format(day, 'd')}
                                        {dayHasEvents && !isSelected && (
                                            <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-blue-600 rounded-full" />
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
                            {format(selectedDate, 'd MMMM', { locale: fr })}
                        </h3>

                        {selectedDateEvents.length === 0 ? (
                            <p className="text-sm text-gray-500 py-4 text-center">
                                Aucun événement
                            </p>
                        ) : (
                            selectedDateEvents.map((event: CalendarEvent) => (
                                <Card key={event.id}>
                                    <CardContent className="p-3">
                                        <h4 className="font-medium text-gray-900 mb-1">
                                            {event.title}
                                        </h4>
                                        {event.startDate && (
                                            <p className="text-sm text-gray-600 flex items-center gap-1">
                                                <Clock className="h-3 w-3" />
                                                {format(new Date(event.startDate), 'HH:mm')}
                                            </p>
                                        )}
                                        {event.location && (
                                            <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                                                <MapPin className="h-3 w-3" />
                                                {event.location}
                                            </p>
                                        )}
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
