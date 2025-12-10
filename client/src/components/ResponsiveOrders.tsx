/**
 * ResponsiveOrders - Wrapper for automatic mobile/desktop detection
 */
import { useScreenSize } from "@/hooks/use-screen-size";
import Orders from "@/pages/Orders";
import MobileOrdersPage from "@/pages/mobile/OrdersPage";

export default function ResponsiveOrders() {
    const { isMobile } = useScreenSize();

    if (isMobile) {
        return <MobileOrdersPage />;
    }

    return <Orders />;
}
