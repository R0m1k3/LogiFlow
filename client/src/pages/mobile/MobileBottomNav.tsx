/**
 * MobileBottomNav - Navigation bottom fixe pour l'application mobile
 * 5 boutons: Accueil, Commandes, Livraisons, Tâches, Plus
 */
import { Link, useLocation } from "wouter";
import { useState } from "react";
import {
    Home,
    Package,
    Truck,
    CheckSquare,
    MoreHorizontal,
    Calendar,
    Megaphone,
    ShoppingCart,
    Clock,
    Wrench,
    Receipt
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAuthUnified } from "@/hooks/useAuthUnified";

interface NavItem {
    path: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
}

const primaryItems: NavItem[] = [
    { path: "/dashboard", label: "Accueil", icon: Home },
    { path: "/orders", label: "Commandes", icon: Package },
    { path: "/deliveries", label: "Livraisons", icon: Truck },
    { path: "/tasks", label: "Tâches", icon: CheckSquare },
];

const moreItems: NavItem[] = [
    { path: "/calendar", label: "Calendrier", icon: Calendar },
    { path: "/publicities", label: "Publicités", icon: Megaphone },
    { path: "/customer-orders", label: "Cmd Client", icon: ShoppingCart },
    { path: "/dlc", label: "DLC", icon: Clock },
    { path: "/sav", label: "SAV", icon: Wrench },
    { path: "/avoirs", label: "Avoirs", icon: Receipt },
];

export default function MobileBottomNav() {
    const [location] = useLocation();
    const { user } = useAuthUnified();
    const [moreOpen, setMoreOpen] = useState(false);

    const isActive = (path: string) => {
        if (path === "/dashboard" && (location === "/" || location === "/dashboard")) return true;
        return location.startsWith(path);
    };

    // Check if any "more" item is active
    const isMoreActive = moreItems.some(item => isActive(item.path));

    return (
        <>
            {/* Navigation bottom fixe */}
            <nav
                className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50"
                style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            >
                <div className="flex items-center justify-around h-16">
                    {/* Items principaux */}
                    {primaryItems.map((item) => {
                        const Icon = item.icon;
                        const active = isActive(item.path);

                        return (
                            <Link key={item.path} href={item.path}>
                                <div className={`flex flex-col items-center justify-center min-w-[60px] py-1 ${active ? 'text-blue-600' : 'text-gray-500'
                                    }`}>
                                    <Icon className={`h-5 w-5 ${active ? 'text-blue-600' : 'text-gray-500'}`} />
                                    <span className={`text-[10px] mt-0.5 font-medium ${active ? 'text-blue-600' : 'text-gray-500'
                                        }`}>
                                        {item.label}
                                    </span>
                                </div>
                            </Link>
                        );
                    })}

                    {/* Bouton "Plus" */}
                    <div
                        className={`flex flex-col items-center justify-center min-w-[60px] py-1 cursor-pointer ${isMoreActive || moreOpen ? 'text-blue-600' : 'text-gray-500'
                            }`}
                        onClick={() => setMoreOpen(true)}
                    >
                        <MoreHorizontal className={`h-5 w-5 ${isMoreActive || moreOpen ? 'text-blue-600' : 'text-gray-500'
                            }`} />
                        <span className={`text-[10px] mt-0.5 font-medium ${isMoreActive || moreOpen ? 'text-blue-600' : 'text-gray-500'
                            }`}>
                            Plus
                        </span>
                    </div>
                </div>
            </nav>

            {/* Sheet "Plus" */}
            <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
                <SheetContent side="bottom" className="h-auto max-h-[50vh] rounded-t-xl">
                    <SheetHeader className="pb-4">
                        <SheetTitle>Autres pages</SheetTitle>
                    </SheetHeader>

                    <div className="grid grid-cols-3 gap-3 pb-6">
                        {moreItems.map((item) => {
                            const Icon = item.icon;
                            const active = isActive(item.path);

                            return (
                                <Link
                                    key={item.path}
                                    href={item.path}
                                    onClick={() => setMoreOpen(false)}
                                >
                                    <div className={`flex flex-col items-center justify-center p-4 rounded-xl min-h-[80px] ${active
                                            ? 'bg-blue-100 text-blue-700'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}>
                                        <Icon className={`h-6 w-6 ${active ? 'text-blue-600' : 'text-gray-600'}`} />
                                        <span className={`text-xs mt-2 font-medium text-center ${active ? 'text-blue-700' : 'text-gray-700'
                                            }`}>
                                            {item.label}
                                        </span>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                </SheetContent>
            </Sheet>
        </>
    );
}
