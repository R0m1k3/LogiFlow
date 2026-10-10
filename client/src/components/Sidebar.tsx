import { Link, useLocation } from "wouter";
import { useAuthUnified } from "@/hooks/useAuthUnified";
import { Button } from "@/components/ui/button";
import { useStore } from "@/contexts/StoreContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useScreenSize } from "@/hooks/use-screen-size";
import { getNavSections, getRoleLabel, isNavItemActive, type NavItem } from "@/lib/navigation";
import { Boxes, LogOut, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";

// En-tête du menu : logo + bouton de repli (PC/tablette) ou de fermeture (mobile)
function SidebarHeader({ collapsed, isMobile, onToggle, onClose }: {
  collapsed: boolean;
  isMobile: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const showLabel = !collapsed || isMobile;

  return (
    <div className={`h-16 flex items-center border-b border-gray-200 px-3 shrink-0 ${showLabel ? 'justify-between' : 'justify-center'}`}>
      {showLabel && (
        <Link href="/" className="flex items-center gap-2.5 rounded-md px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
            <Boxes className="h-5 w-5 text-white" aria-hidden="true" />
          </span>
          <span className="text-lg font-semibold text-gray-900">LogiFlow</span>
        </Link>
      )}
      {isMobile ? (
        <Button variant="ghost" size="sm" onClick={onClose} className="h-9 w-9 p-0" aria-label="Fermer le menu">
          <X className="h-5 w-5" />
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className="h-9 w-9 p-0 text-gray-600"
          aria-label={collapsed ? "Déplier le menu" : "Réduire le menu"}
          title={collapsed ? "Déplier le menu" : "Réduire le menu"}
        >
          {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
        </Button>
      )}
    </div>
  );
}

function SidebarLink({ item, active, compact, onNavigate }: {
  item: NavItem;
  active: boolean;
  compact: boolean;
  onNavigate: () => void;
}) {
  const Icon = item.icon;

  return (
    <Link
      href={item.path}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      title={compact ? item.label : undefined}
      className={`group relative flex items-center gap-3 rounded-md min-h-10 py-2 text-sm leading-snug font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${compact ? 'justify-center px-0' : 'px-3'
        } ${active
          ? 'bg-blue-50 text-blue-700'
          : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
        }`}
    >
      {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r bg-blue-600" aria-hidden="true" />}
      <Icon className={`h-5 w-5 shrink-0 ${active ? 'text-blue-700' : 'text-gray-500 group-hover:text-gray-700'}`} aria-hidden="true" />
      {compact ? <span className="sr-only">{item.label}</span> : <span className="min-w-0">{item.label}</span>}
    </Link>
  );
}

export default function Sidebar() {
  const { user, isLoading } = useAuthUnified();
  const [location] = useLocation();
  const { sidebarCollapsed, setSidebarCollapsed, mobileMenuOpen, setMobileMenuOpen } = useStore();
  const isMobile = useIsMobile();
  const { isTablet } = useScreenSize();

  // Sur mobile le menu s'affiche toujours déplié
  const compact = sidebarCollapsed && !isMobile;

  const handleLogout = async () => {
    try {
      // Déconnexion côté serveur pour détruire la session
      await fetch('/api/logout', {
        method: 'POST',
        credentials: 'include'
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Retour à la page de connexion quelle que soit la réponse
      window.location.href = "/auth";
    }
  };

  const toggleSidebar = () => {
    const newCollapsed = !sidebarCollapsed;
    setSidebarCollapsed(newCollapsed);
    try {
      localStorage.setItem('sidebarCollapsed', JSON.stringify(newCollapsed));
    } catch {
      // ignore
    }
  };

  const closeMobileMenu = () => setMobileMenuOpen(false);

  const handleNavigate = () => {
    if (isMobile) closeMobileMenu();
  };

  const getInitials = (firstName?: string, lastName?: string, username?: string) => {
    const initials = `${firstName?.[0] || ""}${lastName?.[0] || ""}`;
    return (initials || username?.[0] || "U").toUpperCase();
  };

  // Classes responsives : panneau glissant sur mobile, largeur fixe sur tablette et PC
  const getSidebarClasses = () => {
    if (isMobile) {
      return `fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 shadow-lg flex flex-col transform transition-transform duration-300 ease-in-out ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`;
    }

    if (isTablet) {
      return `${sidebarCollapsed ? 'sidebar-collapsed' : 'sidebar-tablet'} bg-white border-r border-gray-200 flex flex-col transition-all duration-300 ease-in-out`;
    }

    return `${sidebarCollapsed ? 'sidebar-collapsed' : 'sidebar-expanded'} bg-white border-r border-gray-200 flex flex-col transition-all duration-300 ease-in-out`;
  };

  const header = (
    <SidebarHeader
      collapsed={sidebarCollapsed}
      isMobile={isMobile}
      onToggle={toggleSidebar}
      onClose={closeMobileMenu}
    />
  );

  if (isLoading || !user) {
    return (
      <aside className={getSidebarClasses()}>
        {header}
        <div className="flex-1 flex items-center justify-center">
          {isLoading ? (
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          ) : (
            !compact && <p className="text-sm text-gray-600">Authentification requise</p>
          )}
        </div>
      </aside>
    );
  }

  const sections = getNavSections(user.role);
  const displayName = user.firstName || user.lastName
    ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
    : user.username;

  return (
    <aside className={getSidebarClasses()}>
      {header}

      <nav className="flex-1 overflow-y-auto py-3 px-2" aria-label="Menu principal">
        {sections.map((section, sectionIndex) => (
          <div key={section.title ?? 'accueil'} className={sectionIndex > 0 ? 'mt-4' : undefined}>
            {section.title && (
              compact ? (
                <div className="mx-2 mb-2 border-t border-gray-200" aria-hidden="true" />
              ) : (
                <h3 className="px-3 mb-1 text-xs font-semibold text-gray-500">
                  {section.title}
                </h3>
              )
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <SidebarLink
                  key={item.path}
                  item={item}
                  active={isNavItemActive(item.path, location)}
                  compact={compact}
                  onNavigate={handleNavigate}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Profil et déconnexion */}
      <div className={`border-t border-gray-200 shrink-0 ${compact ? 'p-2' : 'p-3'}`}>
        <div className={`flex items-center ${compact ? 'flex-col gap-2' : 'gap-3'}`}>
          <div
            className="h-9 w-9 shrink-0 rounded-full bg-gray-100 flex items-center justify-center"
            title={compact ? `${displayName} — ${getRoleLabel(user.role)}` : undefined}
          >
            <span className="text-sm font-medium text-gray-700">
              {getInitials(user.firstName, user.lastName, user.username)}
            </span>
          </div>
          {!compact && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{displayName}</p>
              <p className="text-xs text-gray-600 truncate">{getRoleLabel(user.role)}</p>
            </div>
          )}
          <Button
            onClick={handleLogout}
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0 shrink-0 text-gray-600 hover:text-gray-900"
            aria-label="Déconnexion"
            title="Déconnexion"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
