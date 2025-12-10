/**
 * ResponsiveTasks - Wrapper component that automatically detects screen size
 * and renders either the mobile or desktop version of the Tasks page.
 */
import { useScreenSize } from "@/hooks/use-screen-size";
import Tasks from "@/pages/Tasks";
import MobileTasksPage from "@/pages/mobile/TasksPage";

export default function ResponsiveTasks() {
    const { isMobile } = useScreenSize();

    // Render mobile version for screens < 768px
    if (isMobile) {
        return <MobileTasksPage />;
    }

    // Render desktop version for larger screens
    return <Tasks />;
}
