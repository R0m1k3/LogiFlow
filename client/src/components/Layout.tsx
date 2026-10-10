import { ReactNode, Suspense, useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { LogOut, Store, Menu, AlertTriangle } from "lucide-react";
import { useAuthUnified } from "@/hooks/useAuthUnified";
import { useIsMobile } from "@/hooks/use-mobile";
import { useScreenSize } from "@/hooks/use-screen-size";
import { StoreProvider } from "@/contexts/StoreContext";
import Sidebar from "./Sidebar";
import ErrorBoundary from "./ErrorBoundary";
import WeatherWidget from "./WeatherWidget";
import DateWidget from "./DateWidget";
import { getNavItemForPath } from "@/lib/navigation";
import type { Group } from "@shared/schema";


interface LayoutProps {
  children: ReactNode;
}

// Tableau vide stable : évite de recréer la valeur du contexte magasin à chaque
// rendu tant que /api/groups n'a pas répondu
const EMPTY_STORES: Group[] = [];

// Affiché dans la zone de contenu pendant le chargement du code d'une page
// (le menu et l'en-tête restent visibles)
function PageFallback() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Chargement...</p>
      </div>
    </div>
  );
}

export default function Layout({ children }: LayoutProps) {
  const { user } = useAuthUnified();
  const [location] = useLocation();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const { screenSize, isMobileOrTablet, isTablet } = useScreenSize();

  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(() => {
    // Restaurer le selectedStoreId depuis localStorage si disponible
    const saved = localStorage.getItem('selectedStoreId');
    return saved ? parseInt(saved) : null;
  });

  const [storeInitialized, setStoreInitialized] = useState(false);

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    // Restaurer l'état de la sidebar depuis localStorage, mais forcer collapsed sur mobile
    try {
      const saved = localStorage.getItem('sidebarCollapsed');
      return isMobile ? true : (saved ? JSON.parse(saved) : false);
    } catch {
      return isMobile ? true : false;
    }
  });

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Titre de l'onglet du navigateur tiré du menu : « Livraisons — LogiFlow »
  useEffect(() => {
    const navItem = getNavItemForPath(location);
    document.title = navItem ? `${navItem.label} — LogiFlow` : "LogiFlow";
  }, [location]);

  const { data: stores = EMPTY_STORES } = useQuery<Group[]>({
    queryKey: ['/api/groups'],
    enabled: !!user,
  });

  // Changement de magasin demandé dans le sélecteur : les données dépendantes du
  // magasin sont invalidées après le rendu (effet ci-dessous) et non dans le
  // gestionnaire. À ce moment les pages ont déjà basculé sur les clés du nouveau
  // magasin : les requêtes de l'ancien magasin ne sont plus actives et ne sont
  // donc plus rechargées pour rien, et cancelRefetch: false réutilise les
  // requêtes du nouveau magasin déjà en cours. L'invalidation est conservée pour
  // les requêtes dont la clé ne contient pas le magasin (ex. ['/api/orders'] des
  // modales de livraison).
  const storeChangePendingRef = useRef(false);

  useEffect(() => {
    if (!storeChangePendingRef.current) return;
    storeChangePendingRef.current = false;
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey;
        return Boolean(key[0]?.toString().includes('/api/orders') ||
          key[0]?.toString().includes('/api/deliveries') ||
          key[0]?.toString().includes('/api/stats/monthly') ||
          key[0]?.toString().includes('/api/tasks'));
      }
    }, { cancelRefetch: false });
  }, [selectedStoreId, queryClient]);

  // Effet pour marquer l'initialisation comme terminée
  useEffect(() => {
    if (user && stores.length > 0) {
      let needsUpdate = false;

      // Pour tous les rôles, vérifier que selectedStoreId est cohérent avec les stores disponibles
      if (selectedStoreId) {
        const storeExists = stores.find(store => store.id === selectedStoreId);
        if (!storeExists) {
          setSelectedStoreId(null);
          localStorage.removeItem('selectedStoreId');
          needsUpdate = true;
        }
      }

      // IMPORTANT FIX: Pour les rôles directeur/manager, forcer la sélection d'un magasin spécifique
      // si aucun n'est sélectionné et qu'ils n'ont accès qu'à un seul magasin
      if ((user.role === 'directeur' || user.role === 'manager') && !selectedStoreId && stores.length === 1 && !needsUpdate) {
        const singleStoreId = stores[0].id;
        setSelectedStoreId(singleStoreId);
        localStorage.setItem('selectedStoreId', singleStoreId.toString());
      }

      // VALIDATION CRITIQUE: Pour les directeurs/managers, s'assurer qu'un magasin est toujours sélectionné
      setStoreInitialized(true);
    }
  }, [user, stores, selectedStoreId]);

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

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
      <div className="layout-container flex bg-gray-50">
        {/* Mobile overlay for normal mode */}
        {isMobile && mobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar for normal mode */}
        <Sidebar />

        <main className={`flex-1 flex flex-col h-full ${
          // Ajustement des marges selon le mode
          isMobile
            ? 'ml-0'
            : (isTablet && !sidebarCollapsed) ? 'ml-48' : 'ml-0'
          }`}>
          {/* Header with mobile menu and store selector */}
          <header className={`h-16 bg-white border-b border-gray-200 flex items-center justify-between ${isMobileOrTablet ? 'px-3' : 'px-6'
            }`}>
            <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
              {/* Mobile menu button (only in normal mode) */}
              {isMobile && (
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
              <div className={`flex items-center ${isMobile ? 'gap-1' : 'gap-3'
                } min-w-0`}>
                <WeatherWidget />
                {!isMobile && <DateWidget />}
              </div>
            </div>

            {/* Store selector for admin, directeur, and manager - responsive */}
            {user && (user.role === 'admin' || user.role === 'directeur' || user.role === 'manager') && stores.length > 0 && (
              <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                <Store className="h-4 w-4 text-gray-500 hidden sm:block" />
                <Select
                  value={selectedStoreId?.toString() || (user.role === 'admin' ? "all" : "")}
                  onValueChange={(value) => {
                    const newStoreId = value === "all" ? null : parseInt(value);
                    // Invalidation des données du magasin après le rendu (voir plus haut)
                    if (newStoreId !== selectedStoreId) {
                      storeChangePendingRef.current = true;
                    }

                    // Sauvegarder dans localStorage et mettre à jour l'état
                    if (newStoreId) {
                      localStorage.setItem('selectedStoreId', newStoreId.toString());
                    } else {
                      localStorage.removeItem('selectedStoreId');
                    }
                    setSelectedStoreId(newStoreId);
                  }}
                >
                  <SelectTrigger className={`border border-gray-300 min-h-[44px] ${isMobile ? 'w-28 text-xs' :
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

          <div className={`flex-1 bg-gray-50 h-full overflow-y-auto overflow-x-hidden ${isMobileOrTablet ? 'p-3' : 'p-6'
            }`} style={{ maxWidth: '100%' }}>
            {/* Une erreur dans une page (ou l'échec du chargement de son fichier JS)
                n'efface plus le menu ; réinitialisée à chaque changement d'URL */}
            <ErrorBoundary key={location}>
              <Suspense fallback={<PageFallback />}>
                {children}
              </Suspense>
            </ErrorBoundary>
          </div>
        </main>

      </div>
    </StoreProvider>
  );
}
