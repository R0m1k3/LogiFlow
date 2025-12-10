/**
 * MobileLayout - Layout dédié pour l'application mobile
 * Affiche le magasin sélectionné de manière visible et une navigation bottom
 * Inclut son propre StoreProvider
 */
import { ReactNode, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Menu, Store, ChevronDown, LogOut } from "lucide-react";
import { useAuthUnified } from "@/hooks/useAuthUnified";
import { StoreProvider } from "@/contexts/StoreContext";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import MobileBottomNav from "./MobileBottomNav";
import type { Group } from "@shared/schema";

interface MobileLayoutProps {
    children: ReactNode;
    title?: string;
}

// Inner component that uses the store context
function MobileLayoutInner({ children, title, selectedStoreId, setSelectedStoreId, stores, user }: {
    children: ReactNode;
    title?: string;
    selectedStoreId: number | null;
    setSelectedStoreId: (id: number | null) => void;
    stores: Group[];
    user: any;
}) {
    const [menuOpen, setMenuOpen] = useState(false);

    // Get selected store name
    const selectedStore = stores?.find((s: Group) => s.id === selectedStoreId);
    const storeName = selectedStore?.name || "Tous les magasins";

    const handleLogout = async () => {
        try {
            await fetch('/api/logout', { method: 'POST', credentials: 'include' });
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            window.location.href = "/auth";
        }
    };

    const handleStoreChange = (value: string) => {
        const newStoreId = value === "all" ? null : parseInt(value);
        if (newStoreId) {
            localStorage.setItem('selectedStoreId', newStoreId.toString());
        } else {
            localStorage.removeItem('selectedStoreId');
        }
        setSelectedStoreId(newStoreId);
    };

    return (
        <div
            className="min-h-screen bg-gray-50 flex flex-col"
            style={{
                width: '100%',
                maxWidth: '100vw',
                overflowX: 'hidden',
                paddingBottom: '80px'
            }}
        >
            {/* Header fixe */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
                <div className="flex items-center justify-between h-14 px-3">
                    {/* Menu hamburger */}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setMenuOpen(true)}
                        className="h-10 w-10 p-0"
                    >
                        <Menu className="h-5 w-5" />
                    </Button>

                    {/* Logo */}
                    <div className="flex items-center gap-1">
                        <Store className="h-5 w-5 text-blue-600" />
                        <span className="font-semibold text-gray-900">LogiFlow</span>
                    </div>

                    {/* Magasin sélectionné - bien visible */}
                    <div
                        className="flex items-center gap-1 bg-blue-50 px-2 py-1 rounded-lg cursor-pointer"
                        onClick={() => setMenuOpen(true)}
                    >
                        <span className="text-xs font-medium text-blue-700 truncate max-w-[80px]">
                            {storeName}
                        </span>
                        <ChevronDown className="h-3 w-3 text-blue-600" />
                    </div>
                </div>

                {/* Titre de page optionnel */}
                {title && (
                    <div className="px-3 pb-2">
                        <h1 className="text-lg font-bold text-gray-900">{title}</h1>
                    </div>
                )}
            </header>

            {/* Contenu principal */}
            <main className="flex-1 overflow-y-auto overflow-x-hidden">
                {children}
            </main>

            {/* Navigation bottom */}
            <MobileBottomNav />

            {/* Menu latéral (Sheet) */}
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
                <SheetContent side="left" className="w-[280px] p-0">
                    <SheetHeader className="p-4 border-b">
                        <SheetTitle className="flex items-center gap-2">
                            <Store className="h-5 w-5 text-blue-600" />
                            LogiFlow
                        </SheetTitle>
                    </SheetHeader>

                    <div className="p-4 space-y-6">
                        {/* Utilisateur */}
                        {user && (
                            <div className="bg-gray-50 rounded-lg p-3">
                                <p className="font-medium text-gray-900">
                                    {user.firstName} {user.lastName}
                                </p>
                                <p className="text-sm text-gray-500 capitalize">{user.role}</p>
                            </div>
                        )}

                        {/* Sélecteur de magasin */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">
                                Magasin
                            </label>
                            <Select
                                value={selectedStoreId?.toString() || (user?.role === 'admin' ? "all" : "")}
                                onValueChange={handleStoreChange}
                            >
                                <SelectTrigger className="w-full h-12">
                                    <SelectValue placeholder="Sélectionner un magasin" />
                                </SelectTrigger>
                                <SelectContent>
                                    {user?.role === 'admin' && (
                                        <SelectItem value="all">
                                            <div className="flex items-center gap-2">
                                                <div className="w-3 h-3 bg-gray-400 rounded-full" />
                                                Tous les magasins
                                            </div>
                                        </SelectItem>
                                    )}
                                    {stores?.map((store: Group) => (
                                        <SelectItem key={store.id} value={store.id.toString()}>
                                            <div className="flex items-center gap-2">
                                                <div
                                                    className="w-3 h-3 rounded-full"
                                                    style={{ backgroundColor: store.color || '#gray' }}
                                                />
                                                {store.name}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Déconnexion */}
                        <Button
                            variant="outline"
                            className="w-full h-12 text-red-600 border-red-200 hover:bg-red-50"
                            onClick={handleLogout}
                        >
                            <LogOut className="h-4 w-4 mr-2" />
                            Déconnexion
                        </Button>
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    );
}

// Main MobileLayout component with StoreProvider
export default function MobileLayout({ children, title }: MobileLayoutProps) {
    const { user } = useAuthUnified();

    // Store state management
    const [selectedStoreId, setSelectedStoreId] = useState<number | null>(() => {
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
            <MobileLayoutInner
                title={title}
                selectedStoreId={selectedStoreId}
                setSelectedStoreId={setSelectedStoreId}
                stores={stores}
                user={user}
            >
                {children}
            </MobileLayoutInner>
        </StoreProvider>
    );
}

