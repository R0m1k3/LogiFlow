/**
 * DashboardPage Mobile - Tableau de bord simplifié pour mobile
 */
import { useQuery } from "@tanstack/react-query";
import { useAuthUnified } from "@/hooks/useAuthUnified";
import { useStore } from "@/contexts/StoreContext";
import MobileLayout from "./MobileLayout";
import { Card, CardContent } from "@/components/ui/card";
import {
    Package,
    Truck,
    CheckSquare,
    AlertTriangle,
    TrendingUp,
    Clock,
    Calendar
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

// Stats card component
function StatCard({
    icon: Icon,
    label,
    value,
    trend,
    color
}: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: string | number;
    trend?: string;
    color: string;
}) {
    return (
        <Card className="overflow-hidden">
            <CardContent className="p-4">
                <div className="flex items-start justify-between">
                    <div className={`p-2 rounded-lg ${color}`}>
                        <Icon className="h-5 w-5 text-white" />
                    </div>
                    {trend && (
                        <span className="text-xs text-green-600 font-medium flex items-center">
                            <TrendingUp className="h-3 w-3 mr-1" />
                            {trend}
                        </span>
                    )}
                </div>
                <div className="mt-3">
                    <p className="text-2xl font-bold text-gray-900">{value}</p>
                    <p className="text-sm text-gray-500">{label}</p>
                </div>
            </CardContent>
        </Card>
    );
}

export default function MobileDashboardPage() {
    const { user } = useAuthUnified();
    const { selectedStoreId } = useStore();

    // Fetch stats
    const { data: stats, isLoading } = useQuery({
        queryKey: ["/api/stats/dashboard", selectedStoreId],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (selectedStoreId) params.append('storeId', selectedStoreId.toString());

            const response = await fetch(`/api/stats/dashboard?${params}`, {
                credentials: 'include'
            });
            if (!response.ok) return null;
            return response.json();
        },
        enabled: !!user,
    });

    // Fetch pending tasks count
    const { data: tasks = [] } = useQuery({
        queryKey: ["/api/tasks", selectedStoreId],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (selectedStoreId) params.append('storeId', selectedStoreId.toString());

            const response = await fetch(`/api/tasks?${params}`, {
                credentials: 'include'
            });
            if (!response.ok) return [];
            const data = await response.json();
            return Array.isArray(data) ? data : [];
        },
        enabled: !!user,
    });

    // Fetch today's orders
    const { data: orders = [] } = useQuery({
        queryKey: ["/api/orders/today", selectedStoreId],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (selectedStoreId) params.append('storeId', selectedStoreId.toString());
            params.append('date', format(new Date(), 'yyyy-MM-dd'));

            const response = await fetch(`/api/orders?${params}`, {
                credentials: 'include'
            });
            if (!response.ok) return [];
            const data = await response.json();
            return Array.isArray(data) ? data : [];
        },
        enabled: !!user,
    });

    // Fetch today's deliveries
    const { data: deliveries = [] } = useQuery({
        queryKey: ["/api/deliveries/today", selectedStoreId],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (selectedStoreId) params.append('storeId', selectedStoreId.toString());
            params.append('date', format(new Date(), 'yyyy-MM-dd'));

            const response = await fetch(`/api/deliveries?${params}`, {
                credentials: 'include'
            });
            if (!response.ok) return [];
            const data = await response.json();
            return Array.isArray(data) ? data : [];
        },
        enabled: !!user,
    });

    const pendingTasks = tasks.filter((t: any) => t.status !== 'completed').length;
    const urgentTasks = tasks.filter((t: any) => t.priority === 'high' && t.status !== 'completed').length;
    const todayDate = format(new Date(), "EEEE d MMMM", { locale: fr });

    return (
        <MobileLayout>
            <div className="p-4 space-y-4">
                {/* Welcome */}
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-4 text-white">
                    <p className="text-blue-100 text-sm">Bonjour,</p>
                    <h2 className="text-xl font-bold">
                        {user?.firstName || user?.username || 'Utilisateur'}
                    </h2>
                    <p className="text-blue-100 text-sm mt-1 capitalize">{todayDate}</p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3">
                    <StatCard
                        icon={Package}
                        label="Commandes"
                        value={orders.length}
                        color="bg-blue-500"
                    />
                    <StatCard
                        icon={Truck}
                        label="Livraisons"
                        value={deliveries.length}
                        color="bg-green-500"
                    />
                    <StatCard
                        icon={CheckSquare}
                        label="Tâches en cours"
                        value={pendingTasks}
                        color="bg-purple-500"
                    />
                    <StatCard
                        icon={AlertTriangle}
                        label="Urgentes"
                        value={urgentTasks}
                        color="bg-red-500"
                    />
                </div>

                {/* Quick Actions */}
                <div className="bg-white rounded-xl p-4 shadow-sm">
                    <h3 className="font-semibold text-gray-900 mb-3">Accès rapide</h3>
                    <div className="grid grid-cols-4 gap-2">
                        {[
                            { icon: Package, label: "Commande", path: "/orders" },
                            { icon: Truck, label: "Livraison", path: "/deliveries" },
                            { icon: CheckSquare, label: "Tâche", path: "/tasks" },
                            { icon: Calendar, label: "Agenda", path: "/calendar" },
                        ].map((item) => {
                            const Icon = item.icon;
                            return (
                                <a
                                    key={item.path}
                                    href={item.path}
                                    className="flex flex-col items-center p-3 rounded-lg bg-gray-50 hover:bg-gray-100"
                                >
                                    <Icon className="h-6 w-6 text-gray-600 mb-1" />
                                    <span className="text-xs text-gray-600">{item.label}</span>
                                </a>
                            );
                        })}
                    </div>
                </div>

                {/* Recent Tasks */}
                {pendingTasks > 0 && (
                    <div className="bg-white rounded-xl p-4 shadow-sm">
                        <h3 className="font-semibold text-gray-900 mb-3">Tâches à faire</h3>
                        <div className="space-y-2">
                            {tasks
                                .filter((t: any) => t.status !== 'completed')
                                .slice(0, 3)
                                .map((task: any) => (
                                    <div
                                        key={task.id}
                                        className={`p-3 rounded-lg border-l-4 ${task.priority === 'high'
                                                ? 'border-red-500 bg-red-50'
                                                : 'border-gray-300 bg-gray-50'
                                            }`}
                                    >
                                        <p className="font-medium text-gray-900 text-sm truncate">
                                            {task.title}
                                        </p>
                                        {task.dueDate && (
                                            <p className="text-xs text-gray-500 flex items-center mt-1">
                                                <Clock className="h-3 w-3 mr-1" />
                                                {format(new Date(task.dueDate), 'dd/MM')}
                                            </p>
                                        )}
                                    </div>
                                ))
                            }
                        </div>
                    </div>
                )}
            </div>
        </MobileLayout>
    );
}
