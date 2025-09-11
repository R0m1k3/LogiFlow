import { ReactNode, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { LogOut, Store, Menu, AlertTriangle, Smartphone, Monitor } from "lucide-react";
import { useAuthUnified } from "@/hooks/useAuthUnified";
import { useIsMobile } from "@/hooks/use-mobile";
import { useScreenSize } from "@/hooks/use-screen-size";
import { usePhoneMode } from "@/hooks/use-phone-mode";
import { StoreProvider } from "@/contexts/StoreContext";
import Sidebar from "./Sidebar";
import PhoneBottomNav from "./PhoneBottomNav";
import WeatherWidget from "./WeatherWidget";
import DateWidget from "./DateWidget";
import type { Group } from "@shared/schema";


interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user } = useAuthUnified();
  const [location] = useLocation();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const { screenSize, isMobileOrTablet, isTablet } = useScreenSize();
  const { isPhoneMode, setPhoneMode, canUsePhoneMode } = usePhoneMode();
  
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(() => {
    // Restaurer le selectedStoreId depuis localStorage si disponible
    const saved = localStorage.getItem('selectedStoreId');
    const restoredId = saved ? parseInt(saved) : null;
    console.log('🏪 Layout - Restoring selectedStoreId from localStorage:', { saved, restoredId });
    return restoredId;
  });
  
  const [storeInitialized, setStoreInitialized] = useState(false);

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    // Restaurer l'état de la sidebar depuis localStorage, mais forcer collapsed sur mobile
    try {
      const saved = localStorage.getItem('sidebarCollapsed');
      console.log('🔧 Layout - Restoring sidebar state:', { saved, isMobile });
      return isMobile ? true : (saved ? JSON.parse(saved) : false);
    } catch (error) {
      console.error('Error reading sidebar state from localStorage:', error);
      return isMobile ? true : false;
    }
  });

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { data: stores = [] } = useQuery<Group[]>({
    queryKey: ['/api/groups'],
    enabled: !!user,
  });

  // Effet pour marquer l'initialisation comme terminée
  useEffect(() => {
    if (user && stores.length > 0) {
      let needsUpdate = false;
      
      // Pour tous les rôles, vérifier que selectedStoreId est cohérent avec les stores disponibles
      if (selectedStoreId) {
        const storeExists = stores.find(store => store.id === selectedStoreId);
        if (!storeExists) {
          console.log('🏪 Selected store not found in available stores, clearing selection:', {
            selectedStoreId,
            userRole: user.role,
            availableStores: stores.map(s => s.id)
          });
          setSelectedStoreId(null);
          localStorage.removeItem('selectedStoreId');
          needsUpdate = true;
        } else {
          console.log('🏪 Selected store validated successfully:', {
            selectedStoreId,
            userRole: user.role,
            storeName: storeExists.name
          });
        }
      }
      
      // IMPORTANT FIX: Pour les rôles directeur/manager, forcer la sélection d'un magasin spécifique
      // si aucun n'est sélectionné et qu'ils n'ont accès qu'à un seul magasin
      if ((user.role === 'directeur' || user.role === 'manager') && !selectedStoreId && stores.length === 1 && !needsUpdate) {
        console.log('🏪 Auto-selecting single available store for directeur/manager:', {
          storeId: stores[0].id,
          storeName: stores[0].name,
          userRole: user.role,
          userId: user.id,
          previousSelectedStoreId: selectedStoreId,
          timestamp: new Date().toISOString()
        });
        const singleStoreId = stores[0].id;
        setSelectedStoreId(singleStoreId);
        localStorage.setItem('selectedStoreId', singleStoreId.toString());
      }
      
      // VALIDATION CRITIQUE: Pour les directeurs/managers, s'assurer qu'un magasin est toujours sélectionné
      if ((user.role === 'directeur' || user.role === 'manager') && !selectedStoreId && !needsUpdate) {
        console.log('🚨 CRITICAL: Directeur/Manager has no store selected, this will cause empty data display:', {
          userId: user.id,
          userRole: user.role,
          availableStores: stores.map(s => ({ id: s.id, name: s.name }))
        });
      }
      
      console.log('🏪 Store initialization complete:', { 
        user: user.role, 
        selectedStoreId, 
        storesCount: stores.length,
        validatedStore: selectedStoreId ? stores.find(s => s.id === selectedStoreId)?.name : 'None',
        autoSelected: (user.role === 'directeur' || user.role === 'manager') && !selectedStoreId && stores.length === 1
      });
      setStoreInitialized(true);
    }
  }, [user, stores, selectedStoreId]);

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  return (
    <StoreProvider value={{ selectedStoreId, setSelectedStoreId, stores, sidebarCollapsed, setSidebarCollapsed, mobileMenuOpen, setMobileMenuOpen, storeInitialized }}>
      <div className={`layout-container flex bg-gray-50 ${isPhoneMode ? 'phone-mode' : ''}`}>
        {/* Mobile overlay for normal mode */}
        {!isPhoneMode && isMobile && mobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}
        
        {/* Sidebar for normal mode */}
        {!isPhoneMode && <Sidebar />}
        
        <main className={`flex-1 flex flex-col h-full ${
          // Ajustement des marges selon le mode
          isPhoneMode 
            ? 'ml-0 mb-20' // Mode téléphone : pas de marge gauche, marge bas pour bottom nav
            : isMobile 
              ? 'ml-0' 
              : (isTablet && !sidebarCollapsed) ? 'ml-48' : 'ml-0'
        }`}>
          {/* Header with mobile menu and store selector */}
          <header className={`${
            isPhoneMode ? 'h-12' : 'h-16'
          } bg-white border-b border-gray-200 flex items-center justify-between ${
            isMobileOrTablet ? 'px-3' : 'px-6'
          }`}>
            <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
              {/* Mobile menu button (only in normal mode) */}
              {!isPhoneMode && isMobile && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMobileMenuOpen(true)}
                  className="min-h-[44px] min-w-[44px] p-0 flex-shrink-0"
                  data-testid="button-mobile-menu"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              )}

              {/* Weather and Date widgets - responsive */}
              <div className={`flex items-center ${
                isMobile ? 'gap-1' : 'gap-3'
              } min-w-0`}>
                {/* En mode téléphone, affichage simplifié */}
                {isPhoneMode ? (
                  <div className="flex items-center gap-2">
                    <WeatherWidget />
                    {/* Phone mode toggle button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPhoneMode(!isPhoneMode)}
                      className="min-h-[44px] min-w-[44px] p-2 flex-shrink-0"
                      data-testid="button-phone-mode-toggle"
                      title="Basculer vers le mode normal"
                    >
                      <Monitor className="h-4 w-4 text-blue-600" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <WeatherWidget />
                    {!isMobile && <DateWidget />}
                    
                    {/* Phone mode toggle button */}
                    {canUsePhoneMode && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPhoneMode(!isPhoneMode)}
                        className="min-h-[44px] min-w-[44px] p-2 flex-shrink-0"
                        data-testid="button-phone-mode-toggle"
                        title="Basculer vers le mode téléphone"
                      >
                        <Smartphone className="h-4 w-4 text-gray-600" />
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Store selector for admin, directeur, and manager - responsive */}
            {!isPhoneMode && user && (user.role === 'admin' || user.role === 'directeur' || user.role === 'manager') && stores.length > 0 && (
              <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                <Store className="h-4 w-4 text-gray-500 hidden sm:block" />
                <Select
                  value={selectedStoreId?.toString() || (user.role === 'admin' ? "all" : "")}
                  onValueChange={(value) => {
                    console.log('🏪 Store selector changed:', { 
                      value, 
                      userRole: user.role, 
                      parsed: value === "all" ? null : parseInt(value) 
                    });
                    const newStoreId = value === "all" ? null : parseInt(value);
                    
                    // Invalider toutes les variantes de queryKey pour changement magasin
                    console.log('🧹 Invalidating data caches for store change');
                    queryClient.invalidateQueries({ predicate: (query) => {
                      const key = query.queryKey;
                      return Boolean(key[0]?.toString().includes('/api/orders') || 
                             key[0]?.toString().includes('/api/deliveries') || 
                             key[0]?.toString().includes('/api/stats/monthly') ||
                             key[0]?.toString().includes('/api/tasks'));
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
                  <SelectTrigger className={`border border-gray-300 min-h-[44px] ${
                    isMobile ? 'w-28 text-xs' : 
                    isTablet ? 'w-40 text-sm' : 
                    'w-64 text-sm'
                  }`} data-testid="select-store">
                    <SelectValue placeholder="Magasin" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Only show "Tous les magasins" option for admin */}
                    {user.role === 'admin' && (
                      <SelectItem value="all">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-gray-400"></div>
                          <span className={isMobile ? 'text-xs' : 'text-sm'}>
                            {isMobile ? 'Tous' : 'Tous les magasins'}
                          </span>
                        </div>
                      </SelectItem>
                    )}
                    {stores.map((store) => (
                      <SelectItem key={store.id} value={store.id.toString()}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3" 
                            style={{ backgroundColor: store.color || '#gray-400' }}
                          />
                          <span className={`${isMobile ? 'text-xs' : 'text-sm'} truncate max-w-[120px]`}>
                            {store.name}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </header>

          {/* Alert for directeur/manager without store selection */}
          {user && (user.role === 'directeur' || user.role === 'manager') && !selectedStoreId && storeInitialized && (
            <div className="bg-red-50 border-l-4 border-red-400 p-4 m-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <AlertTriangle className="h-5 w-5 text-red-400" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-700">
                    <strong>Action requise :</strong> Veuillez sélectionner un magasin pour afficher les données.
                    Vos permissions ne permettent pas de voir les données de tous les magasins.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className={`flex-1 bg-gray-50 h-full overflow-y-auto ${
            isPhoneMode 
              ? 'p-2' // Mode téléphone : padding réduit
              : isMobileOrTablet ? 'p-3' : 'p-6'
          }`}>
            {children}
          </div>
        </main>
        
        {/* Bottom navigation for phone mode (only when authenticated) */}
        {isPhoneMode && user && <PhoneBottomNav user={user} location={location} />}
      </div>
    </StoreProvider>
  );
}
