import { ReactNode, useState, createContext, useContext } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { LogOut, Store, Menu } from "lucide-react";
import { useAuthUnified } from "@/hooks/useAuthUnified";
import { useIsMobile } from "@/hooks/use-mobile";
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
  const isMobile = useIsMobile();
  
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(() => {
    // Restaurer le selectedStoreId depuis localStorage si disponible
    const saved = localStorage.getItem('selectedStoreId');
    const restoredId = saved ? parseInt(saved) : null;
    console.log('🏪 Layout - Restoring selectedStoreId from localStorage:', { saved, restoredId });
    return restoredId;
  });

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    // Restaurer l'état de la sidebar depuis localStorage, mais forcer collapsed sur mobile
    const saved = localStorage.getItem('sidebarCollapsed');
    return isMobile ? true : (saved ? JSON.parse(saved) : false);
  });

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { data: stores = [] } = useQuery<Group[]>({
    queryKey: ['/api/groups'],
    enabled: !!user,
  });

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  return (
    <StoreContext.Provider value={{ selectedStoreId, setSelectedStoreId, stores, sidebarCollapsed, setSidebarCollapsed, mobileMenuOpen, setMobileMenuOpen }}>
      <div className="flex h-screen overflow-hidden bg-gray-50">
        {/* Mobile overlay */}
        {isMobile && mobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}
        
        <Sidebar />
        
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Header with mobile menu and store selector */}
          <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:px-6">
            <div className="flex items-center gap-4">
              {/* Mobile menu button */}
              {isMobile && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMobileMenuOpen(true)}
                  className="h-8 w-8 p-0"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              )}

            </div>

            {/* Store selector for admin - responsive */}
            {user?.role === 'admin' && stores.length > 0 && (
              <div className="flex items-center gap-2">
                <Store className="h-4 w-4 text-gray-500 hidden sm:block" />
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
                  <SelectTrigger className="w-32 sm:w-64 border border-gray-300">
                    <SelectValue placeholder="Magasin" />
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
                            style={{ backgroundColor: store.color || '#gray-400' }}
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

          <div className="flex-1 overflow-auto bg-gray-50 p-6">
            {children}
          </div>
        </main>
      </div>
    </StoreContext.Provider>
  );
}
