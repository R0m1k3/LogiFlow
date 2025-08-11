import { Link, useLocation } from "wouter";
import { useAuthSimple } from "@/hooks/useAuthSimple";
import { Button } from "@/components/ui/button";
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
  Shield,
  Database,
  ShoppingCart,
  Clock,
  ListTodo
} from "lucide-react";

export default function Sidebar() {
  const { user, isLoading, error } = useAuthSimple();
  const [location] = useLocation();

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
      roles: ["admin", "manager", "employee"] 
    },
    { 
      path: "/calendar", 
      label: "Calendrier", 
      icon: Calendar, 
      roles: ["admin", "manager", "employee"] 
    },
    { 
      path: "/orders", 
      label: "Commandes", 
      icon: Package, 
      roles: ["admin", "manager"] 
    },
    { 
      path: "/deliveries", 
      label: "Livraisons", 
      icon: Truck, 
      roles: ["admin", "manager"] 
    },
    { 
      path: "/bl-reconciliation", 
      label: "Rapprochement", 
      icon: FileText, 
      roles: ["admin", "manager"] 
    },
    { 
      path: "/publicities", 
      label: "Publicités", 
      icon: Megaphone, 
      roles: ["admin", "manager"] 
    },
    { 
      path: "/customer-orders", 
      label: "Commandes Client", 
      icon: ShoppingCart, 
      roles: ["admin", "manager", "employee"] 
    },
    { 
      path: "/dlc", 
      label: "Gestion DLC", 
      icon: Clock, 
      roles: ["admin", "manager", "employee"] 
    },
    { 
      path: "/tasks", 
      label: "Tâches", 
      icon: ListTodo, 
      roles: ["admin", "manager", "employee"] 
    },
  ];

  const managementItems = [
    { 
      path: "/suppliers", 
      label: "Fournisseurs", 
      icon: Building, 
      roles: ["admin", "manager"] 
    },
    { 
      path: "/groups", 
      label: "Magasins", 
      icon: Users, 
      roles: ["admin", "manager"] 
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
      path: "/roles", 
      label: "Gestion des Rôles", 
      icon: Shield, 
      roles: ["admin"] 
    },
    { 
      path: "/nocodb-config", 
      label: "Configuration NocoDB", 
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



  // Si l'utilisateur n'est pas encore chargé, afficher un état de chargement
  if (isLoading) {
    return (
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col shadow-lg">
        <div className="h-16 flex items-center justify-center border-b border-gray-200 bg-white">
          <div className="flex items-center space-x-3">
            <Store className="h-6 w-6 text-blue-600" />
            <span className="text-lg font-semibold text-gray-900">LogiFlow</span>
          </div>
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
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col shadow-lg">
        <div className="h-16 flex items-center justify-center border-b border-gray-200 bg-white">
          <div className="flex items-center space-x-3">
            <Store className="h-6 w-6 text-blue-600" />
            <span className="text-lg font-semibold text-gray-900">LogiFlow</span>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-500">
            <p>Authentification requise</p>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col shadow-lg">
      {/* Logo */}
      <div className="h-16 flex items-center justify-center border-b border-gray-200 bg-white">
        <div className="flex items-center space-x-3">
          <Store className="h-6 w-6 text-blue-600" />
          <span className="text-lg font-semibold text-gray-900">LogiFlow</span>
        </div>
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
                  className={`flex items-center px-3 py-2 text-sm font-medium transition-colors hover:bg-gray-100 ${
                    active
                      ? 'bg-gray-100 text-gray-900 border-r-2 border-gray-700'
                      : 'text-gray-700'
                  }`}
                  onClick={() => console.log(`Navigating to: ${item.path}`)}
                >
                  <Icon className="mr-3 h-4 w-4" />
                  {item.label}
                </div>
              </Link>
            );
          })}
        </div>

        {/* Management Section */}
        {managementItems.some(item => hasPermission(item.roles)) && (
          <>
            <div className="mt-6 mb-2">
              <h3 className="px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                Gestion
              </h3>
            </div>
            <div className="space-y-1">
              {managementItems.map((item) => {
                if (!hasPermission(item.roles)) return null;
                
                const Icon = item.icon;
                const active = isActive(item.path);
                
                return (
                  <Link key={item.path} href={item.path}>
                    <div
                      className={`flex items-center px-3 py-2 text-sm font-medium transition-colors hover:bg-gray-100 ${
                        active
                          ? 'bg-gray-100 text-gray-900 border-r-2 border-gray-700'
                          : 'text-gray-700'
                      }`}
                      onClick={() => console.log(`Navigating to management: ${item.path}`)}
                    >
                      <Icon className="mr-3 h-4 w-4" />
                      {item.label}
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
          <div className="mb-2">
            <h3 className="px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
              Administration
            </h3>
          </div>
          <div className="space-y-1">
            {adminItems.map((item) => {
              if (!hasPermission(item.roles)) return null;
              
              const Icon = item.icon;
              const active = isActive(item.path);
              
              return (
                <Link key={item.path} href={item.path}>
                  <div
                    className={`flex items-center px-3 py-2 text-sm font-medium transition-colors hover:bg-gray-100 ${
                      active
                        ? 'bg-gray-100 text-gray-900 border-r-2 border-gray-700'
                        : 'text-gray-700'
                    }`}
                    onClick={() => console.log(`Navigating to admin: ${item.path}`)}
                  >
                    <Icon className="mr-3 h-4 w-4" />
                    {item.label}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* User Profile & Logout */}
      <div className="border-t border-gray-200 p-4">
        <div className="flex items-center space-x-3 mb-3">
          <div className="h-8 w-8 bg-gray-100 flex items-center justify-center">
            <span className="text-xs font-medium text-gray-700">
              {getInitials(user?.firstName, user?.lastName)}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {user?.email}
            </p>
          </div>
        </div>
        
        <Button
          onClick={handleLogout}
          variant="outline"
          size="sm"
          className="w-full justify-start text-gray-600 hover:text-red-600 hover:border-red-300"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Déconnexion
        </Button>
      </div>
    </aside>
  );
}
