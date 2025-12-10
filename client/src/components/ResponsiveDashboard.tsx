/**
 * ResponsiveDashboard - Wrapper for automatic mobile/desktop detection
 */
import { useScreenSize } from "@/hooks/use-screen-size";
import Dashboard from "@/pages/Dashboard";
import MobileDashboardPage from "@/pages/mobile/DashboardPage";

export default function ResponsiveDashboard() {
    const { isMobile } = useScreenSize();

    if (isMobile) {
        return <MobileDashboardPage />;
    }

    return <Dashboard />;
}
