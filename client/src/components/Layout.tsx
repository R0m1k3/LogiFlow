import { ReactNode, useState, createContext, useContext } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { LogOut, Store, Menu, X } from "lucide-react";
import { useAuthUnified } from "@/hooks/useAuthUnified";
import { useResponsive } from "@/hooks/useResponsive";
import Sidebar from "./Sidebar";
import type { Group } from "@shared/schema";

interface StoreContextType {
  selectedStoreId: number | null;
  setSelectedStoreId: (storeId: number | null) => void;
  stores: Group[];
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error("useStore must be used within a StoreProvider");
  }
  return context;
};

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user } = useAuthUnified();
  const queryClient = useQueryClient();
  const { isMobile, isTablet, isDesktop } = useResponsive();
  
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(() => {
    // Restaurer le selectedStoreId depuis localStorage si disponible
    const saved = localStorage.getItem('selectedStoreId');
    const restoredId = saved ? parseInt(saved) : null;
    console.log('🏪 Layout - Restoring selectedStoreId from localStorage:', { saved, restoredId });
    return restoredId;
  });

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    // Restaurer l'état de la sidebar depuis localStorage
    const saved = localStorage.getItem('sidebarCollapsed');
    // Sur mobile, toujours collapsé par défaut
    return saved ? JSON.parse(saved) : isMobile;
  });

  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  const { data: stores = [] } = useQuery<Group[]>({
    queryKey: ['/api/groups'],
    enabled: !!user,
  });

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  return (
    <StoreContext.Provider value={{ 
      selectedStoreId, 
      setSelectedStoreId, 
      stores, 
      sidebarCollapsed, 
      setSidebarCollapsed, 
      mobileMenuOpen, 
      setMobileMenuOpen 
    }}>
      <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-900">
        {/* Mobile Sidebar Overlay */}
        {isMobile && mobileMenuOpen && (
          <>
            <div 
              className="fixed inset-0 bg-black/50 z-40" 
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-800">
              <Sidebar />
            </div>
          </>
        )}
        
        {/* Desktop Sidebar */}
        {!isMobile && <Sidebar />}
        
        <main className={`flex-1 flex flex-col overflow-hidden ${
          isMobile ? 'ml-0' : sidebarCollapsed ? 'ml-16' : 'ml-72 xl:ml-80'
        }`}>
          {/* Header with store selector for admin */}
          <header className="h-20 xl:h-24 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-6 sm:px-8 xl:px-12">
            <div className="flex items-center gap-4">
              {/* Mobile menu button */}
              {isMobile && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="h-8 w-8 p-0"
                >
                  {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </Button>
              )}
              <h1 className="text-xl xl:text-2xl font-semibold text-gray-800 dark:text-gray-200">LogiFlow</h1>
            </div>

            {/* Store selector for admin - moved to top right */}
            {user?.role === 'admin' && stores.length > 0 && (
              <div className="flex items-center gap-2">
                <Store className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                <Select
                  value={selectedStoreId?.toString() || "all"}
                  onValueChange={(value) => {
                    console.log('🏪 Store selector changed:', { value, parsed: value === "all" ? null : parseInt(value) });
                    const newStoreId = value === "all" ? null : parseInt(value);
                    
                    // Invalider toutes les variantes de queryKey pour changement magasin
                    console.log('🧹 Invalidating data caches for store change');
                    queryClient.invalidateQueries({ predicate: (query) => {
                      const key = query.queryKey;
                      return Boolean(key[0]?.toString().includes('/api/orders') || 
                             key[0]?.toString().includes('/api/deliveries') || 
                             key[0]?.toString().includes('/api/stats/monthly'));
                    }});
                    
                    // Sauvegarder dans localStorage et mettre à jour l'état
                    if (newStoreId) {
                      localStorage.setItem('selectedStoreId', newStoreId.toString());
                      console.log('💾 Store saved to localStorage:', newStoreId);
                    } else {
                      localStorage.removeItem('selectedStoreId');
                      console.log('🗑️ Store removed from localStorage');
                    }
                    setSelectedStoreId(newStoreId);
                  }}
                >
                  <SelectTrigger className="w-64 border border-gray-300">
                    <SelectValue placeholder="Sélectionner un magasin" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-gray-400"></div>
                        <span>Tous les magasins</span>
                      </div>
                    </SelectItem>
                    {stores.map((store) => (
                      <SelectItem key={store.id} value={store.id.toString()}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3" 
                            style={{ backgroundColor: store.color || '#6B7280' }}
                          />
                          <span>{store.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </header>

          {/* Main content area */}
          <div className="flex-1 bg-gray-50 dark:bg-gray-900 p-6 sm:p-8 xl:p-12 overflow-y-auto">
            <div className="container-responsive">
              <div className="desktop-spacing">
                {children}
              </div>
            </div>
          </div>
        </main>
        
        {/* Mobile menu close overlay */}
        {isMobile && mobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-black/20 z-30" 
            onClick={() => setMobileMenuOpen(false)}
          />
        )}
      </div>
    </StoreContext.Provider>
  );
}
