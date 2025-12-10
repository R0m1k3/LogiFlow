/**
 * ResponsiveDeliveries - Wrapper for automatic mobile/desktop detection
 */
import { useScreenSize } from "@/hooks/use-screen-size";
import Deliveries from "@/pages/Deliveries";
import MobileDeliveriesPage from "@/pages/mobile/DeliveriesPage";

export default function ResponsiveDeliveries() {
    const { isMobile } = useScreenSize();

    if (isMobile) {
        return <MobileDeliveriesPage />;
    }

    return <Deliveries />;
}
