/**
 * ResponsiveCalendar - Wrapper for automatic mobile/desktop detection
 */
import { useScreenSize } from "@/hooks/use-screen-size";
import Calendar from "@/pages/Calendar";
import MobileCalendarPage from "@/pages/mobile/CalendarPage";

export default function ResponsiveCalendar() {
    const { isMobile } = useScreenSize();

    if (isMobile) {
        return <MobileCalendarPage />;
    }

    return <Calendar />;
}
