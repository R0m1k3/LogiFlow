import { Link, useLocation } from "wouter";
import { useAuthSimple } from "@/hooks/useAuthSimple";
import { Button } from "@/components/ui/button";
import { useStore } from "./Layout";
import { useIsMobile } from "@/hooks/use-mobile";
import { 
  Store, 
  Calendar, 
  BarChart3, 
  Package, 
  Truck, 
  Building, 
  Users, 
  UserCog, 
  LogOut,
  FileText,
  Megaphone,
  Database,
  ShoppingCart,
  Clock,
  ListTodo,
  ChevronLeft,
  ChevronRight,
  X
} from "lucide-react";

export default function Sidebar() {
  const { user, isLoading, error } = useAuthSimple();
  const [location] = useLocation();
  const { sidebarCollapsed, setSidebarCollapsed, mobileMenuOpen, setMobileMenuOpen } = useStore();
  const isMobile = useIsMobile();

  // Debug logging pour production
  console.log('Sidebar - User:', user);
  console.log('Sidebar - isLoading:', isLoading);
  console.log('Sidebar - error:', error);

  const handleLogout = async () => {
    try {
      // Force logout via fetch to ensure session is destroyed
      await fetch('/api/logout', { 
        method: 'POST',
        credentials: 'include'
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Force redirect to auth page regardless of API response
      window.location.href = "/auth";
    }
  };

  const toggleSidebar = () => {
    const newCollapsed = !sidebarCollapsed;
    setSidebarCollapsed(newCollapsed);
    localStorage.setItem('sidebarCollapsed', JSON.stringify(newCollapsed));
  };

  const getInitials = (firstName?: string, lastName?: string) => {
    if (!firstName && !lastName) return "U";
    return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();
  };

  const isActive = (path: string) => {
    if (path === "/" && location === "/") return true;
    if (path !== "/" && location.startsWith(path)) return true;
    return false;
  };

  const menuItems = [
    { 
      path: "/dashboard", 
      label: "Tableau de bord", 
      icon: BarChart3, 
      roles: ["admin", "directeur", "manager", "employee"] 
    },
    { 
      path: "/calendar", 
      label: "Calendrier", 
      icon: Calendar, 
      roles: ["admin", "directeur", "manager", "employee"] 
    },
    { 
      path: "/orders", 
      label: "Commandes", 
      icon: Package, 
      roles: ["admin", "directeur", "manager"] 
    },
    { 
      path: "/deliveries", 
      label: "Livraisons", 
      icon: Truck, 
      roles: ["admin", "directeur", "manager"] 
    },
    { 
      path: "/bl-reconciliation", 
      label: "Rapprochement", 
      icon: FileText, 
      roles: ["admin", "directeur"] 
    },
    { 
      path: "/publicities", 
      label: "Publicités", 
      icon: Megaphone, 
      roles: ["admin", "directeur", "manager", "employee"] 
    },
    { 
      path: "/customer-orders", 
      label: "Commandes Client", 
      icon: ShoppingCart, 
      roles: ["admin", "directeur", "manager", "employee"] 
    },
    { 
      path: "/dlc", 
      label: "Gestion DLC", 
      icon: Clock, 
      roles: ["admin", "directeur", "manager", "employee"] 
    },
    { 
      path: "/tasks", 
      label: "Tâches", 
      icon: ListTodo, 
      roles: ["admin", "directeur", "manager", "employee"] 
    },
  ];

  const managementItems = [
    { 
      path: "/suppliers", 
      label: "Fournisseurs", 
      icon: Building, 
      roles: ["admin"] 
    },
    { 
      path: "/groups", 
      label: "Magasins", 
      icon: Users, 
      roles: ["admin"] 
    },
  ];

  const adminItems = [
    { 
      path: "/users", 
      label: "Utilisateurs", 
      icon: UserCog, 
      roles: ["admin"] 
    },
    { 
      path: "/nocodb-config", 
      label: "Configuration NocoDB", 
      icon: Database, 
      roles: ["admin"] 
    },
    { 
      path: "/database-debug", 
      label: "Debug Base de Données", 
      icon: Database, 
      roles: ["admin"] 
    },
  ];

  const hasPermission = (roles: string[]) => {
    const hasRole = user?.role && roles.includes(user.role);
    // Debug uniquement en développement pour éviter spam console
    if (import.meta.env.MODE === 'development') {
      console.log('hasPermission check:', { userRole: user?.role, roles, hasRole });
    }
    return hasRole;
  };



  // Classes responsives pour la sidebar
  const sidebarClasses = isMobile 
    ? `fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 shadow-lg transform transition-transform duration-300 ease-in-out ${
        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      }`
    : `${sidebarCollapsed ? 'w-16' : 'w-64'} bg-white border-r border-gray-200 flex flex-col shadow-lg transition-all duration-300 ease-in-out`;

  // Si l'utilisateur n'est pas encore chargé, afficher un état de chargement
  if (isLoading) {
    return (
      <aside className={sidebarClasses}>
        <div className="h-16 flex items-center justify-between border-b border-gray-200 bg-white px-3">
          {/* Mobile close button */}
          {isMobile ? (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center space-x-3">
                <Store className="h-6 w-6 text-blue-600" />
                <span className="text-lg font-semibold text-gray-900">LogiFlow</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMobileMenuOpen(false)}
                className="h-8 w-8 p-0 hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <>
              {!sidebarCollapsed && (
                <div className="flex items-center space-x-3">
                  <Store className="h-6 w-6 text-blue-600" />
                  <span className="text-lg font-semibold text-gray-900">LogiFlow</span>
                </div>
              )}
              {sidebarCollapsed && (
                <div className="flex items-center justify-center w-full">
                  <Store className="h-6 w-6 text-blue-600" />
                </div>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleSidebar}
                className="h-8 w-8 p-0 hover:bg-gray-100"
              >
                {sidebarCollapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )}
              </Button>
            </>
          )}
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </aside>
    );
  }

  // Si l'utilisateur n'est pas authentifié, afficher seulement le logo
  if (!user) {
    return (
      <aside className={sidebarClasses}>
        <div className="h-16 flex items-center justify-between border-b border-gray-200 bg-white px-3">
          {/* Mobile close button */}
          {isMobile ? (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center space-x-3">
                <Store className="h-6 w-6 text-blue-600" />
                <span className="text-lg font-semibold text-gray-900">LogiFlow</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMobileMenuOpen(false)}
                className="h-8 w-8 p-0 hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <>
              {!sidebarCollapsed && (
                <div className="flex items-center space-x-3">
                  <Store className="h-6 w-6 text-blue-600" />
                  <span className="text-lg font-semibold text-gray-900">LogiFlow</span>
                </div>
              )}
              {sidebarCollapsed && (
                <div className="flex items-center justify-center w-full">
                  <Store className="h-6 w-6 text-blue-600" />
                </div>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleSidebar}
                className="h-8 w-8 p-0 hover:bg-gray-100"
              >
                {sidebarCollapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )}
              </Button>
            </>
          )}
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-500">
            {!sidebarCollapsed && <p>Authentification requise</p>}
          </div>
        </div>
      </aside>
    );
  }

  const handleMenuClick = () => {
    if (isMobile) {
      setMobileMenuOpen(false);
    }
  };

  return (
    <aside className={sidebarClasses}>
      {/* Logo et bouton de collapse */}
      <div className="h-16 flex items-center justify-between border-b border-gray-200 bg-white px-3">
        {/* Mobile close button */}
        {isMobile ? (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center space-x-3">
              <Store className="h-6 w-6 text-blue-600" />
              <span className="text-lg font-semibold text-gray-900">LogiFlow</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileMenuOpen(false)}
              className="h-8 w-8 p-0 hover:bg-gray-100"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <>
            {!sidebarCollapsed && (
              <div className="flex items-center space-x-3">
                <Store className="h-6 w-6 text-blue-600" />
                <span className="text-lg font-semibold text-gray-900">LogiFlow</span>
              </div>
            )}
            {sidebarCollapsed && (
              <div className="flex items-center justify-center w-full">
                <Store className="h-6 w-6 text-blue-600" />
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSidebar}
              className="h-8 w-8 p-0 hover:bg-gray-100"
            >
              {sidebarCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
          </>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3">
        <div className="space-y-1">
          {menuItems.map((item) => {
            const hasRolePermission = hasPermission(item.roles);
            // console.log(`🔍 Menu item ${item.path} (${item.label}):`, { 
            //   roles: item.roles, 
            //   hasPermission: hasRolePermission,
            //   userRole: user?.role 
            // });
            
            if (!hasRolePermission) return null;
            
            const Icon = item.icon;
            const active = isActive(item.path);
            
            return (
              <Link key={item.path} href={item.path}>
                <div
                  className={`flex items-center ${sidebarCollapsed && !isMobile ? 'px-3 py-3 justify-center' : 'px-3 py-2'} text-sm font-medium transition-colors hover:bg-gray-100 ${
                    active
                      ? 'bg-gray-100 text-gray-900 border-r-2 border-gray-700'
                      : 'text-gray-700'
                  }`}
                  title={sidebarCollapsed && !isMobile ? item.label : undefined}
                  onClick={handleMenuClick}
                >
                  <Icon className={`h-4 w-4 ${sidebarCollapsed && !isMobile ? '' : 'mr-3'}`} />
                  {(!sidebarCollapsed || isMobile) && item.label}
                </div>
              </Link>
            );
          })}
        </div>

        {/* Management Section */}
        {managementItems.some(item => hasPermission(item.roles)) && (
          <>
            {!sidebarCollapsed && (
              <div className="mt-6 mb-2">
                <h3 className="px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Gestion
                </h3>
              </div>
            )}
            {sidebarCollapsed && <div className="mt-4 mb-2 border-t border-gray-200"></div>}
            <div className="space-y-1">
              {managementItems.map((item) => {
                if (!hasPermission(item.roles)) return null;
                
                const Icon = item.icon;
                const active = isActive(item.path);
                
                return (
                  <Link key={item.path} href={item.path}>
                    <div
                      className={`flex items-center ${sidebarCollapsed ? 'px-3 py-3 justify-center' : 'px-3 py-2'} text-sm font-medium transition-colors hover:bg-gray-100 ${
                        active
                          ? 'bg-gray-100 text-gray-900 border-r-2 border-gray-700'
                          : 'text-gray-700'
                      }`}
                      title={sidebarCollapsed ? item.label : undefined}
                      onClick={() => console.log(`Navigating to management: ${item.path}`)}
                    >
                      <Icon className={`h-4 w-4 ${sidebarCollapsed ? '' : 'mr-3'}`} />
                      {!sidebarCollapsed && item.label}
                    </div>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </nav>

      {/* Administration Section */}
      {adminItems.some(item => hasPermission(item.roles)) && (
        <div className="border-t border-gray-200 py-4 px-3">
          {!sidebarCollapsed && (
            <div className="mb-2">
              <h3 className="px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                Administration
              </h3>
            </div>
          )}
          <div className="space-y-1">
            {adminItems.map((item) => {
              if (!hasPermission(item.roles)) return null;
              
              const Icon = item.icon;
              const active = isActive(item.path);
              
              return (
                <Link key={item.path} href={item.path}>
                  <div
                    className={`flex items-center ${sidebarCollapsed ? 'px-3 py-3 justify-center' : 'px-3 py-2'} text-sm font-medium transition-colors hover:bg-gray-100 ${
                      active
                        ? 'bg-gray-100 text-gray-900 border-r-2 border-gray-700'
                        : 'text-gray-700'
                    }`}
                    title={sidebarCollapsed ? item.label : undefined}
                    onClick={() => console.log(`Navigating to admin: ${item.path}`)}
                  >
                    <Icon className={`h-4 w-4 ${sidebarCollapsed ? '' : 'mr-3'}`} />
                    {!sidebarCollapsed && item.label}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* User Profile & Logout */}
      <div className="border-t border-gray-200 p-4">
        {!sidebarCollapsed ? (
          <>
            <div className="flex items-center space-x-3 mb-3">
              <div className="h-8 w-8 bg-gray-100 flex items-center justify-center">
                <span className="text-xs font-medium text-gray-700">
                  {getInitials(user?.firstName, user?.lastName)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user?.firstName || user?.lastName ? `${user?.firstName || ''} ${user?.lastName || ''}`.trim() : user?.username}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {user?.role === 'admin' ? 'Administrateur' : 
                   user?.role === 'manager' ? 'Manager' : 
                   user?.role === 'directeur' ? 'Directeur' : 'Employé'}
                </p>
              </div>
            </div>
            <Button 
              onClick={handleLogout}
              variant="ghost"
              size="sm"
              className="w-full justify-start text-gray-700 hover:text-gray-900 hover:bg-gray-100"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Déconnexion
            </Button>
          </>
        ) : (
          <div className="flex flex-col items-center space-y-3">
            <div className="h-8 w-8 bg-gray-100 flex items-center justify-center">
              <span className="text-xs font-medium text-gray-700">
                {getInitials(user?.firstName, user?.lastName)}
              </span>
            </div>
            <Button 
              onClick={handleLogout}
              variant="ghost"
              size="sm"
              className="w-8 h-8 p-0 text-gray-700 hover:text-gray-900 hover:bg-gray-100"
              title="Déconnexion"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </aside>
  );
}
