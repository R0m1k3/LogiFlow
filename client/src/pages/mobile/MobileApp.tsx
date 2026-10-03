/**
 * MobileApp - Wrapper pour l'application mobile avec StoreProvider
 * Fournit le contexte Store à toutes les pages mobiles
 */
import { ReactNode, Suspense, useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthUnified } from "@/hooks/useAuthUnified";
import { StoreProvider } from "@/contexts/StoreContext";
import MobileLayout from "./MobileLayout";
import type { Group } from "@shared/schema";

interface MobileAppProps {
    children: ReactNode;
}

// Tableau vide stable : évite de recréer la valeur du contexte magasin à chaque
// rendu tant que /api/groups n'a pas répondu
const EMPTY_STORES: Group[] = [];

// Affiché pendant le chargement du code d'une page : en-tête et barre de
// navigation restent visibles
function MobilePageFallback() {
    return (
        <MobileLayout>
            <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        </MobileLayout>
    );
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
    const { data: stores = EMPTY_STORES } = useQuery<Group[]>({
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

    // Valeur du contexte mémorisée : les consommateurs de useStore() ne sont
    // re-rendus que lorsqu'une de ces valeurs change réellement
    const storeContextValue = useMemo(() => ({
        selectedStoreId,
        setSelectedStoreId,
        stores,
        sidebarCollapsed,
        setSidebarCollapsed,
        mobileMenuOpen,
        setMobileMenuOpen,
        storeInitialized
    }), [selectedStoreId, stores, sidebarCollapsed, mobileMenuOpen, storeInitialized]);

    return (
        <StoreProvider value={storeContextValue}>
            <Suspense fallback={<MobilePageFallback />}>
                {children}
            </Suspense>
        </StoreProvider>
    );
}
