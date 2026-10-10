/**
 * MobileBottomNav - Barre de navigation fixe en bas de l'écran (téléphone)
 * 4 raccourcis tirés de la configuration du menu (selon le rôle) + « Menu »
 */
import { Link, useLocation } from "wouter";
import { Menu } from "lucide-react";
import { useAuthUnified } from "@/hooks/useAuthUnified";
import { getMobileShortcuts, isNavItemActive } from "@/lib/navigation";

interface MobileBottomNavProps {
    menuOpen: boolean;
    onOpenMenu: () => void;
}

export default function MobileBottomNav({ menuOpen, onOpenMenu }: MobileBottomNavProps) {
    const [location] = useLocation();
    const { user } = useAuthUnified();
    const shortcuts = getMobileShortcuts(user?.role);

    // « Menu » est mis en avant quand la page affichée n'est pas un raccourci
    const menuActive = menuOpen || !shortcuts.some((item) => isNavItemActive(item.path, location));

    const itemClasses = (active: boolean) =>
        `flex flex-1 flex-col items-center justify-center gap-0.5 min-w-0 h-full px-1 text-xs font-medium leading-tight text-center ${active ? 'text-blue-700' : 'text-gray-600'}`;

    return (
        <nav
            className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            aria-label="Navigation principale"
        >
            <div className="flex items-stretch h-16">
                {shortcuts.map((item) => {
                    const Icon = item.icon;
                    const active = isNavItemActive(item.path, location);

                    return (
                        <Link
                            key={item.path}
                            href={item.path}
                            aria-current={active ? "page" : undefined}
                            className={itemClasses(active)}
                        >
                            <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                            <span className="line-clamp-2">{item.label}</span>
                        </Link>
                    );
                })}

                <button
                    type="button"
                    onClick={onOpenMenu}
                    aria-haspopup="dialog"
                    aria-expanded={menuOpen}
                    className={itemClasses(menuActive)}
                >
                    <Menu className="h-5 w-5 shrink-0" aria-hidden="true" />
                    <span>Menu</span>
                </button>
            </div>
        </nav>
    );
}
