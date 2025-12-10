/**
 * MobileApp - Wrapper pour l'application mobile avec StoreProvider
 * Fournit le contexte Store à toutes les pages mobiles
 */
import { ReactNode, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthUnified } from "@/hooks/useAuthUnified";
import { StoreProvider } from "@/contexts/StoreContext";
import type { Group } from "@shared/schema";

interface MobileAppProps {
    children: ReactNode;
}

export default function MobileApp({ children }: MobileAppProps) {
    const { user } = useAuthUnified();

    // Store state management
    const [selectedStoreId, setSelectedStoreId] = useState<number | null>(() => {
        if (typeof window === 'undefined') return null;
        const saved = localStorage.getItem('selectedStoreId');
        return saved ? parseInt(saved) : null;
    });
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [storeInitialized, setStoreInitialized] = useState(false);

    // Fetch stores
    const { data: stores = [] } = useQuery<Group[]>({
        queryKey: ['/api/groups'],
        enabled: !!user,
    });

    // Initialize store selection
    useEffect(() => {
        if (user && stores.length > 0) {
            if ((user.role === 'directeur' || user.role === 'manager') && !selectedStoreId && stores.length === 1) {
                const singleStoreId = stores[0].id;
                setSelectedStoreId(singleStoreId);
                localStorage.setItem('selectedStoreId', singleStoreId.toString());
            }
            setStoreInitialized(true);
        }
    }, [user, stores, selectedStoreId]);

    // Sync selectedStoreId to localStorage
    useEffect(() => {
        if (selectedStoreId) {
            localStorage.setItem('selectedStoreId', selectedStoreId.toString());
        } else {
            localStorage.removeItem('selectedStoreId');
        }
    }, [selectedStoreId]);

    const storeContextValue = {
        selectedStoreId,
        setSelectedStoreId,
        stores,
        sidebarCollapsed,
        setSidebarCollapsed,
        mobileMenuOpen,
        setMobileMenuOpen,
        storeInitialized
    };

    return (
        <StoreProvider value={storeContextValue}>
            {children}
        </StoreProvider>
    );
}
