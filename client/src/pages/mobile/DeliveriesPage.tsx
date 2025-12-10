/**
 * DeliveriesPage Mobile - Liste des livraisons simplifiée pour mobile
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
    Truck,
    Search,
    Calendar,
    Building,
    ChevronRight,
    Package,
    CheckCircle,
    Clock
} from "lucide-react";
import { format, isToday, isTomorrow, isPast } from "date-fns";
import { fr } from "date-fns/locale";

// Type pour les livraisons
type Delivery = {
    id: number;
    deliveryNumber?: string;
    supplier?: { id: number; name: string; };
    expectedDate: string;
    status: string;
    order?: { id: number; orderNumber: string; };
    group?: { id: number; name: string; color?: string; };
};

export default function MobileDeliveriesPage() {
    const { user } = useAuthUnified();
    const { selectedStoreId } = useStore();
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'received'>('all');

    // Fetch deliveries
    const { data: deliveries = [], isLoading } = useQuery({
        queryKey: ["/api/deliveries", selectedStoreId],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (selectedStoreId) params.append('storeId', selectedStoreId.toString());

            const response = await fetch(`/api/deliveries?${params}`, {
                credentials: 'include'
            });
            if (!response.ok) return [];
            const data = await response.json();
            return Array.isArray(data) ? data : [];
        },
        enabled: !!user,
    });

    // Filter deliveries
    const filteredDeliveries = deliveries.filter((delivery: Delivery) => {
        // Status filter
        if (statusFilter === 'pending' && delivery.status === 'received') return false;
        if (statusFilter === 'received' && delivery.status !== 'received') return false;

        // Search filter
        if (searchTerm) {
            const search = searchTerm.toLowerCase();
            const matchNumber = delivery.deliveryNumber?.toLowerCase().includes(search);
            const matchSupplier = delivery.supplier?.name?.toLowerCase().includes(search);
            if (!matchNumber && !matchSupplier) return false;
        }

        return true;
    });

    const getDateBadge = (dateStr: string) => {
        if (!dateStr) return null;
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return null;

        if (isToday(date)) {
            return <Badge className="bg-blue-100 text-blue-700">Aujourd'hui</Badge>;
        }
        if (isTomorrow(date)) {
            return <Badge className="bg-purple-100 text-purple-700">Demain</Badge>;
        }
        if (isPast(date)) {
            return <Badge className="bg-red-100 text-red-700">En retard</Badge>;
        }
        return null;
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'received':
                return <CheckCircle className="h-4 w-4 text-green-600" />;
            case 'pending':
                return <Clock className="h-4 w-4 text-yellow-600" />;
            default:
                return <Package className="h-4 w-4 text-gray-600" />;
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
                        <Truck className="h-5 w-5 text-green-600" />
                        <h1 className="text-lg font-bold">Livraisons</h1>
                    </div>
                    <Badge variant="secondary">{filteredDeliveries.length}</Badge>
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
                    {(['all', 'pending', 'received'] as const).map((status) => (
                        <Button
                            key={status}
                            variant={statusFilter === status ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setStatusFilter(status)}
                            className="h-8 text-xs"
                        >
                            {status === 'all' && 'Toutes'}
                            {status === 'pending' && 'En attente'}
                            {status === 'received' && 'Reçues'}
                        </Button>
                    ))}
                </div>

                {/* Deliveries list */}
                <div className="space-y-2">
                    {filteredDeliveries.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <Truck className="h-12 w-12 mx-auto mb-3 opacity-50" />
                            <p>Aucune livraison trouvée</p>
                        </div>
                    ) : (
                        filteredDeliveries.map((delivery: Delivery) => (
                            <Card key={delivery.id} className="overflow-hidden">
                                <CardContent className="p-3">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                {getStatusIcon(delivery.status)}
                                                <span className="font-semibold text-gray-900">
                                                    #{delivery.deliveryNumber || delivery.id}
                                                </span>
                                                {getDateBadge(delivery.expectedDate)}
                                            </div>

                                            {delivery.supplier && (
                                                <p className="text-sm text-gray-600 flex items-center gap-1 truncate">
                                                    <Building className="h-3 w-3 flex-shrink-0" />
                                                    {delivery.supplier.name}
                                                </p>
                                            )}

                                            <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                                                <Calendar className="h-3 w-3" />
                                                {delivery.expectedDate && !isNaN(new Date(delivery.expectedDate).getTime())
                                                    ? format(new Date(delivery.expectedDate), 'dd/MM/yyyy', { locale: fr })
                                                    : 'Date inconnue'
                                                }
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
