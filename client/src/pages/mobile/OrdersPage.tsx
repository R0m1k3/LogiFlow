/**
 * OrdersPage Mobile - Liste des commandes simplifiée pour mobile
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthUnified } from "@/hooks/useAuthUnified";
import { useStore } from "@/contexts/StoreContext";
import MobileLayout from "./MobileLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Package,
    Search,
    Plus,
    Calendar,
    Building,
    ChevronRight
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

// Type pour les commandes
type Order = {
    id: number;
    orderNumber?: string;
    supplier?: { id: number; name: string; };
    orderDate: string;
    status: string;
    totalAmount?: number;
    group?: { id: number; name: string; color?: string; };
};

export default function MobileOrdersPage() {
    const { user } = useAuthUnified();
    const { selectedStoreId } = useStore();
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'delivered'>('all');

    // Fetch orders
    const { data: orders = [], isLoading } = useQuery({
        queryKey: ["/api/orders", selectedStoreId],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (selectedStoreId) params.append('storeId', selectedStoreId.toString());

            const response = await fetch(`/api/orders?${params}`, {
                credentials: 'include'
            });
            if (!response.ok) return [];
            const data = await response.json();
            return Array.isArray(data) ? data : [];
        },
        enabled: !!user,
    });

    // Filter orders
    const filteredOrders = orders.filter((order: Order) => {
        // Status filter
        if (statusFilter === 'pending' && order.status === 'delivered') return false;
        if (statusFilter === 'delivered' && order.status !== 'delivered') return false;

        // Search filter
        if (searchTerm) {
            const search = searchTerm.toLowerCase();
            const matchNumber = order.orderNumber?.toLowerCase().includes(search);
            const matchSupplier = order.supplier?.name?.toLowerCase().includes(search);
            if (!matchNumber && !matchSupplier) return false;
        }

        return true;
    });

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'delivered':
                return <Badge className="bg-green-100 text-green-700">Livrée</Badge>;
            case 'pending':
                return <Badge className="bg-yellow-100 text-yellow-700">En attente</Badge>;
            case 'cancelled':
                return <Badge className="bg-red-100 text-red-700">Annulée</Badge>;
            default:
                return <Badge className="bg-gray-100 text-gray-700">{status}</Badge>;
        }
    };

    if (isLoading) {
        return (
            <MobileLayout>
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                </div>
            </MobileLayout>
        );
    }

    return (
        <MobileLayout>
            <div className="p-3 space-y-3">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Package className="h-5 w-5 text-blue-600" />
                        <h1 className="text-lg font-bold">Commandes</h1>
                    </div>
                    <Badge variant="secondary">{filteredOrders.length}</Badge>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                        placeholder="Rechercher..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 h-10"
                    />
                </div>

                {/* Filter tabs */}
                <div className="grid grid-cols-3 gap-1 bg-gray-100 p-1 rounded-lg">
                    {(['all', 'pending', 'delivered'] as const).map((status) => (
                        <Button
                            key={status}
                            variant={statusFilter === status ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setStatusFilter(status)}
                            className="h-8 text-xs"
                        >
                            {status === 'all' && 'Toutes'}
                            {status === 'pending' && 'En attente'}
                            {status === 'delivered' && 'Livrées'}
                        </Button>
                    ))}
                </div>

                {/* Orders list */}
                <div className="space-y-2">
                    {filteredOrders.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                            <p>Aucune commande trouvée</p>
                        </div>
                    ) : (
                        filteredOrders.map((order: Order) => (
                            <Card key={order.id} className="overflow-hidden">
                                <CardContent className="p-3">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-semibold text-gray-900">
                                                    #{order.orderNumber || order.id}
                                                </span>
                                                {getStatusBadge(order.status)}
                                            </div>

                                            {order.supplier && (
                                                <p className="text-sm text-gray-600 flex items-center gap-1 truncate">
                                                    <Building className="h-3 w-3 flex-shrink-0" />
                                                    {order.supplier.name}
                                                </p>
                                            )}

                                            <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                                                <Calendar className="h-3 w-3" />
                                                {format(new Date(order.orderDate), 'dd/MM/yyyy', { locale: fr })}
                                            </p>
                                        </div>

                                        <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            </div>
        </MobileLayout>
    );
}
