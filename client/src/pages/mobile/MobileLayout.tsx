/**
 * MobileLayout - Cadre de l'application sur téléphone
 * En-tête (titre de la page + magasin), contenu défilant, barre du bas et
 * menu complet, tous tirés de la même configuration que le menu PC
 * Note: Le StoreProvider est fourni par MobileApp au niveau supérieur
 */
import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Boxes, ChevronDown, LogOut } from "lucide-react";
import { useAuthUnified } from "@/hooks/useAuthUnified";
import { useStore } from "@/contexts/StoreContext";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getNavItemForPath, getNavSections, getRoleLabel, isNavItemActive } from "@/lib/navigation";
import MobileBottomNav from "./MobileBottomNav";
import type { Group } from "@shared/schema";

interface MobileLayoutProps {
    children: ReactNode;
    title?: string;
}

export default function MobileLayout({ children, title }: MobileLayoutProps) {
    const { user } = useAuthUnified();
    const [location] = useLocation();
    const { selectedStoreId, setSelectedStoreId, stores } = useStore();
    const [menuOpen, setMenuOpen] = useState(false);

    // Titre de l'onglet du navigateur tiré du menu, comme sur PC
    useEffect(() => {
        const navItem = getNavItemForPath(location);
        document.title = navItem ? `${navItem.label} — LogiFlow` : "LogiFlow";
    }, [location]);

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

    const sections = getNavSections(user?.role);
    const displayName = user && (user.firstName || user.lastName
        ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
        : user.username);

    return (
        <div
            className="bg-gray-50 flex flex-col"
            style={{
                width: '100%',
                maxWidth: '100vw',
                height: '100vh',
                overflow: 'hidden',
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0
            }}
        >
            {/* En-tête : logo + magasin actif (le titre est porté par chaque page) */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
                <div className="flex items-center justify-between gap-3 h-14 px-4">
                    <Link href="/" className="flex items-center gap-2 shrink-0">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600">
                            <Boxes className="h-4 w-4 text-white" aria-hidden="true" />
                        </span>
                        <span className="font-semibold text-gray-900">LogiFlow</span>
                    </Link>

                    <button
                        type="button"
                        className="flex items-center gap-1 bg-blue-50 px-2.5 py-1.5 rounded-lg min-w-0 shrink"
                        onClick={() => setMenuOpen(true)}
                        aria-label={`Magasin : ${storeName}. Ouvrir le menu`}
                    >
                        <span className="text-sm font-medium text-blue-700 truncate max-w-[140px]">
                            {storeName}
                        </span>
                        <ChevronDown className="h-4 w-4 text-blue-600 shrink-0" aria-hidden="true" />
                    </button>
                </div>

                {/* Titre de page optionnel */}
                {title && (
                    <div className="px-4 pb-2">
                        <h1 className="text-lg font-bold text-gray-900">{title}</h1>
                    </div>
                )}
            </header>

            {/* Contenu principal - défilant, avec la place de la barre du bas */}
            <main
                className="flex-1 overflow-x-hidden"
                style={{
                    overflowY: 'auto',
                    paddingBottom: '80px',
                    WebkitOverflowScrolling: 'touch'
                }}
            >
                {children}
            </main>

            <MobileBottomNav menuOpen={menuOpen} onOpenMenu={() => setMenuOpen(true)} />

            {/* Menu complet : tous les modules autorisés, magasin, profil */}
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
                <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-xl p-0">
                    <SheetHeader className="px-4 pt-4 pb-2 text-left">
                        <SheetTitle>Menu</SheetTitle>
                    </SheetHeader>

                    <nav className="px-4 space-y-4" aria-label="Menu principal">
                        {sections.map((section) => (
                            <div key={section.title ?? 'accueil'}>
                                {section.title && (
                                    <h2 className="mb-2 text-xs font-semibold text-gray-500">{section.title}</h2>
                                )}
                                <div className="grid grid-cols-3 gap-2">
                                    {section.items.map((item) => {
                                        const Icon = item.icon;
                                        const active = isNavItemActive(item.path, location);

                                        return (
                                            <Link
                                                key={item.path}
                                                href={item.path}
                                                onClick={() => setMenuOpen(false)}
                                                aria-current={active ? "page" : undefined}
                                                className={`flex flex-col items-center justify-center gap-1.5 rounded-xl p-2 min-h-[76px] text-center text-xs font-medium leading-tight ${active
                                                    ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200'
                                                    : 'bg-gray-100 text-gray-800 active:bg-gray-200'
                                                    }`}
                                            >
                                                <Icon className={`h-6 w-6 ${active ? 'text-blue-700' : 'text-gray-600'}`} aria-hidden="true" />
                                                <span>{item.label}</span>
                                            </Link>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </nav>

                    <div className="mt-4 border-t border-gray-200 p-4 space-y-4" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Magasin</label>
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
                                                    style={{ backgroundColor: store.color || '#9ca3af' }}
                                                />
                                                {store.name}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {user && (
                            <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="font-medium text-gray-900 truncate">{displayName}</p>
                                    <p className="text-sm text-gray-600">{getRoleLabel(user.role)}</p>
                                </div>
                                <Button
                                    variant="outline"
                                    className="h-11 shrink-0 text-red-600 border-red-200 hover:bg-red-50"
                                    onClick={handleLogout}
                                >
                                    <LogOut className="h-4 w-4 mr-2" />
                                    Déconnexion
                                </Button>
                            </div>
                        )}
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    );
}
