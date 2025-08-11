import { useQuery } from "@tanstack/react-query";
import { useAuthUnified } from "@/hooks/useAuthUnified";
import { useStore } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Package, ShoppingCart, TrendingUp, Clock, MapPin, User, AlertTriangle, CheckCircle, Truck, FileText, BarChart3, Megaphone, Shield, XCircle, CheckSquare } from "lucide-react";
import { safeFormat, safeDate } from "@/lib/dateUtils";
import type { PublicityWithRelations } from "@shared/schema";

export default function Dashboard() {
  const { user } = useAuthUnified();
  const { selectedStoreId } = useStore();

  const { data: stats } = useQuery({
    queryKey: ['/api/stats/monthly', selectedStoreId],
    queryFn: async () => {
      const currentDate = new Date();
      const params = new URLSearchParams({
        year: currentDate.getFullYear().toString(),
        month: (currentDate.getMonth() + 1).toString(),
      });
      
      if (selectedStoreId && user?.role === 'admin') {
        params.append('storeId', selectedStoreId.toString());
      }
      
      const response = await fetch(`/api/stats/monthly?${params.toString()}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch stats');
      }
      
      return response.json();
    },
  });

  // Construire les URLs pour récupérer toutes les données (pas de filtrage par date)
  const ordersUrl = `/api/orders${selectedStoreId && user?.role === 'admin' ? `?storeId=${selectedStoreId}` : ''}`;
  const deliveriesUrl = `/api/deliveries${selectedStoreId && user?.role === 'admin' ? `?storeId=${selectedStoreId}` : ''}`;
  const customerOrdersUrl = `/api/customer-orders${selectedStoreId && user?.role === 'admin' ? `?storeId=${selectedStoreId}` : ''}`;

  // Utiliser les mêmes clés de cache que les autres pages pour assurer la cohérence
  const { data: allOrders = [] } = useQuery({
    queryKey: [ordersUrl, selectedStoreId],
  });

  const { data: allDeliveries = [] } = useQuery({
    queryKey: [deliveriesUrl, selectedStoreId],
  });

  const { data: customerOrders = [] } = useQuery({
    queryKey: [customerOrdersUrl, selectedStoreId],
  });

  // Récupérer les publicités à venir (chercher dans 2024 ET 2025) - TOUTES les publicités
  const { data: upcomingPublicities = [] } = useQuery<PublicityWithRelations[]>({
    queryKey: ['/api/publicities', 'upcoming'],
    queryFn: async () => {
      // Essayer d'abord 2024, puis 2025 pour avoir toutes les publicités
      const years = [2024, 2025];
      let allPublicities: PublicityWithRelations[] = [];
      
      for (const year of years) {
        const params = new URLSearchParams();
        params.append('year', year.toString());
        // NE PAS filtrer par magasin - on veut toutes les publicités
        
        try {
          const response = await fetch(`/api/publicities?${params}`, { credentials: 'include' });
          if (response.ok) {
            const yearPublicities = await response.json();
            allPublicities = [...allPublicities, ...yearPublicities];
          }
        } catch (error) {
          console.log(`Erreur lors de la récupération des publicités ${year}:`, error);
        }
      }
      
      // Filtrer les publicités à venir et les trier par date
      const futurePublicities = allPublicities
        .filter((publicity: any) => new Date(publicity.startDate) > new Date())
        .sort((a: any, b: any) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
      
      return futurePublicities;
    },
  });

  // Fetch DLC stats
  const { data: dlcStats = { active: 0, expiringSoon: 0, expired: 0 } } = useQuery({
    queryKey: ["/api/dlc-products/stats", selectedStoreId],
    queryFn: () => {
      const params = new URLSearchParams();
      if (selectedStoreId && user?.role === 'admin') params.append("storeId", selectedStoreId.toString());
      return fetch(`/api/dlc-products/stats?${params.toString()}`, {
        credentials: 'include'
      }).then(res => res.json());
    },
  });

  // Fetch tasks
  const { data: tasks = [] } = useQuery({
    queryKey: ["/api/tasks", selectedStoreId],
    queryFn: () => {
      const params = new URLSearchParams();
      if (selectedStoreId && user?.role === 'admin') params.append("storeId", selectedStoreId.toString());
      return fetch(`/api/tasks?${params.toString()}`, {
        credentials: 'include'
      }).then(res => res.json());
    },
  });

  // Données dérivées pour les sections
  const recentOrders = Array.isArray(allOrders) ? allOrders
    .sort((a: any, b: any) => {
      const dateA = safeDate(a.createdAt);
      const dateB = safeDate(b.createdAt);
      return (dateB ? dateB.getTime() : 0) - (dateA ? dateA.getTime() : 0);
    })
    .slice(0, 3) : [];
  
  const upcomingDeliveries = Array.isArray(allDeliveries) ? allDeliveries
    .filter((d: any) => {
      const isPlanned = d.status === 'planned';
      console.log('🚚 Dashboard - Delivery filter:', { id: d.id, status: d.status, isPlanned, scheduledDate: d.scheduledDate });
      return isPlanned;
    })
    .sort((a: any, b: any) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime())
    .slice(0, 2) : [];
    
  console.log('🚚 Dashboard - Upcoming deliveries result:', upcomingDeliveries.length, upcomingDeliveries);

  // Calculs pour les statistiques
  const pendingOrdersCount = Array.isArray(allOrders) ? allOrders.filter((order: any) => order.status === 'pending').length : 0;
  const averageDeliveryTime = Math.round(stats?.averageDeliveryTime || 0);
  const deliveredThisMonth = Array.isArray(allDeliveries) ? allDeliveries.filter((delivery: any) => {
    const deliveryDate = safeDate(delivery.deliveredDate || delivery.createdAt);
    const now = new Date();
    return deliveryDate.getMonth() === now.getMonth() && 
           deliveryDate.getFullYear() === now.getFullYear() && 
           delivery.status === 'delivered';
  }).length : 0;

  // Calculer le total réel des palettes
  const totalPalettes = Array.isArray(allDeliveries) ? allDeliveries.reduce((total: number, delivery: any) => {
    if (delivery.unit === 'palettes') {
      return total + (delivery.quantity || 0);
    }
    return total;
  }, 0) : 0;

  console.log('📊 Dashboard Debug - Raw Data:', {
    allOrders: Array.isArray(allOrders) ? allOrders.length : 'NOT_ARRAY',
    allDeliveries: Array.isArray(allDeliveries) ? allDeliveries.length : 'NOT_ARRAY', 
    customerOrders: Array.isArray(customerOrders) ? customerOrders.length : 'NOT_ARRAY',
    upcomingPublicities: Array.isArray(upcomingPublicities) ? upcomingPublicities.length : 'NOT_ARRAY',
    stats: stats,
    samples: {
      order: allOrders[0],
      delivery: allDeliveries[0],
      customerOrder: customerOrders[0],
      publicity: upcomingPublicities[0]
    }
  });

  // Statistiques pour les commandes clients
  const ordersByStatus = {
    pending: Array.isArray(allOrders) ? allOrders.filter((o: any) => o.status === 'pending').length : 0,
    planned: Array.isArray(allOrders) ? allOrders.filter((o: any) => o.status === 'planned').length : 0,
    delivered: Array.isArray(allOrders) ? allOrders.filter((o: any) => o.status === 'delivered').length : 0,
    total: Array.isArray(allOrders) ? allOrders.length : 0
  };

  // Statistiques pour les commandes clients (nouveau module)
  const customerOrderStats = {
    waiting: Array.isArray(customerOrders) ? customerOrders.filter((o: any) => o.status === 'En attente de Commande').length : 0,
    inProgress: Array.isArray(customerOrders) ? customerOrders.filter((o: any) => o.status === 'Commande en Cours').length : 0,
    available: Array.isArray(customerOrders) ? customerOrders.filter((o: any) => o.status === 'Disponible').length : 0,
    withdrawn: Array.isArray(customerOrders) ? customerOrders.filter((o: any) => o.status === 'Retiré').length : 0,
    canceled: Array.isArray(customerOrders) ? customerOrders.filter((o: any) => o.status === 'Annulé').length : 0,
    total: Array.isArray(customerOrders) ? customerOrders.length : 0
  };

  return (
    <div className="flex-1 space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Tableau de Bord</h2>
          <p className="text-gray-600 mt-1">Vue d'ensemble des performances et statistiques</p>
        </div>
      </div>

      {/* Alerts */}
      <div className="space-y-3">
        {pendingOrdersCount > 0 && (
          <div className="bg-orange-50 border-l-4 border-orange-400 p-4 flex items-center space-x-3 shadow-sm">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            <span className="text-sm font-medium text-orange-800">
              <strong>{pendingOrdersCount} commande(s) en attente</strong> nécessitent une planification
            </span>
          </div>
        )}
        
        {dlcStats.expiringSoon > 0 && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 flex items-center space-x-3 shadow-sm">
            <Clock className="h-5 w-5 text-yellow-600" />
            <span className="text-sm font-medium text-yellow-800">
              <strong>{dlcStats.expiringSoon} produit(s) DLC</strong> expirent dans les 15 prochains jours
            </span>
          </div>
        )}
        
        {dlcStats.expired > 0 && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 flex items-center space-x-3 shadow-sm">
            <XCircle className="h-5 w-5 text-red-600" />
            <span className="text-sm font-medium text-red-800">
              <strong>{dlcStats.expired} produit(s) DLC</strong> sont expirés et nécessitent une action immédiate
            </span>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-white border border-gray-200 shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Livraisons ce mois</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{deliveredThisMonth}</p>
              </div>
              <div className="h-12 w-12 bg-green-100 flex items-center justify-center">
                <Truck className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border border-gray-200 shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Commandes en attente</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{pendingOrdersCount}</p>
              </div>
              <div className="h-12 w-12 bg-orange-100 flex items-center justify-center">
                <Clock className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border border-gray-200 shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Délai moyen (jours)</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{averageDeliveryTime}</p>
              </div>
              <div className="h-12 w-12 bg-blue-100 flex items-center justify-center">
                <BarChart3 className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border border-gray-200 shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total palettes</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{totalPalettes}</p>
              </div>
              <div className="h-12 w-12 bg-purple-100 flex items-center justify-center">
                <Package className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Dernières Commandes */}
        <Card className="bg-white border border-gray-200 shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="pb-4 border-b border-gray-100">
            <CardTitle className="text-lg font-semibold text-gray-800 flex items-center">
              <FileText className="h-5 w-5 mr-3 text-blue-600" />
              Dernières Commandes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-6">
            {recentOrders.length > 0 ? recentOrders.map((order: any) => (
              <div key={order.id} className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors border-l-3 border-blue-500">
                <div className="flex items-center space-x-3">
                  <div className="h-2 w-2 bg-blue-500"></div>
                  <div>
                    <p className="font-medium text-gray-900">{order.supplier?.name}</p>
                    <p className="text-sm text-gray-600">{order.group?.name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge 
                    variant={order.status === 'delivered' ? 'default' : order.status === 'planned' ? 'secondary' : 'destructive'}
                    className="text-xs"
                  >
                    {order.status === 'delivered' ? 'Livrée' : order.status === 'planned' ? 'Planifiée' : 'En attente'}
                  </Badge>
                  <p className="text-xs text-gray-500 mt-1">
                    {safeFormat(order.plannedDate, "d MMM")}
                  </p>
                </div>
              </div>
            )) : (
              <p className="text-gray-600 text-center py-8">Aucune commande récente</p>
            )}
          </CardContent>
        </Card>

        {/* Livraisons à Venir */}
        <Card className="bg-white border border-gray-200 shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="pb-4 border-b border-gray-100">
            <CardTitle className="text-lg font-semibold text-gray-800 flex items-center">
              <Calendar className="h-5 w-5 mr-3 text-green-600" />
              Livraisons à Venir
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-6">
            {Array.isArray(upcomingDeliveries) && upcomingDeliveries.length > 0 ? upcomingDeliveries.map((delivery: any) => (
              <div key={delivery.id} className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors border-l-3 border-green-500">
                <div className="flex items-center space-x-3">
                  <div className="h-2 w-2 bg-green-500"></div>
                  <div>
                    <p className="font-medium text-gray-900">{delivery.supplier?.name}</p>
                    <p className="text-sm text-gray-600">{delivery.group?.name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-900 text-sm">
                    {delivery.quantity} {delivery.unit}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {safeFormat(delivery.scheduledDate, "d MMM")}
                  </p>
                </div>
              </div>
            )) : (
              <div className="text-center py-8">
                <p className="text-gray-600">Aucune livraison programmée</p>
                <p className="text-xs text-gray-400 mt-1">({Array.isArray(allDeliveries) ? allDeliveries.length : 0} livraisons totales)</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Publicités à Venir */}
        <Card className="bg-white border border-gray-200 shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="pb-4 border-b border-gray-100">
            <CardTitle className="text-lg font-semibold text-gray-800 flex items-center">
              <Megaphone className="h-5 w-5 mr-3 text-purple-600" />
              Publicités à Venir
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-6">
            {upcomingPublicities
              .slice(0, 3)
              .map((publicity: any) => {
                const participatingStores = publicity.participations || [];
                const isCurrentStoreParticipating = selectedStoreId && participatingStores.some((p: any) => p.groupId === parseInt(selectedStoreId));
                
                return (
                  <div key={publicity.id} className="p-4 bg-gray-50 hover:bg-gray-100 transition-colors border-l-3 border-purple-500 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="h-2 w-2 bg-purple-500"></div>
                        <div>
                          <p className="font-medium text-gray-900">{publicity.pubNumber}</p>
                          <p className="text-sm text-gray-600 truncate max-w-40">{publicity.designation}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge className="bg-blue-100 text-blue-800 text-xs">
                          À venir
                        </Badge>
                        <p className="text-xs text-gray-500 mt-1">
                          {safeFormat(publicity.startDate, "d MMM")}
                        </p>
                      </div>
                    </div>
                    
                    {/* Magasins participants */}
                    <div className="flex items-center space-x-2 text-xs">
                      <span className="text-gray-500">Magasins:</span>
                      {participatingStores.length === 0 ? (
                        <span className="text-red-400">Aucun magasin</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {participatingStores.map((participation: any) => (
                            <Badge 
                              key={participation.groupId} 
                              className={`text-xs ${
                                selectedStoreId && participation.groupId === parseInt(selectedStoreId)
                                  ? 'bg-green-100 text-green-800 border border-green-300'
                                  : 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {participation.group.name}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            {(!Array.isArray(upcomingPublicities) || upcomingPublicities.length === 0) && (
              <div className="text-center py-8">
                <p className="text-gray-600">Aucune publicité à venir</p>
                <p className="text-xs text-gray-400 mt-1">(API: {Array.isArray(upcomingPublicities) ? upcomingPublicities.length : 'NOT_ARRAY'})</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Section Rapprochement BL */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Statistiques des commandes clients */}
        <Card className="bg-white border border-gray-200 shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="pb-4 border-b border-gray-100">
            <CardTitle className="text-lg font-semibold text-gray-800 flex items-center">
              <User className="h-5 w-5 mr-3 text-purple-600" />
              Commandes Clients
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-6">
            <div className="flex items-center justify-between p-3 hover:bg-gray-50 transition-colors">
              <div className="flex items-center space-x-3">
                <div className="h-3 w-3 bg-red-500"></div>
                <span className="text-sm font-medium text-gray-700">En attente</span>
              </div>
              <span className="font-semibold text-red-600 text-lg">{customerOrderStats.waiting}</span>
            </div>
            <div className="flex items-center justify-between p-3 hover:bg-gray-50 transition-colors">
              <div className="flex items-center space-x-3">
                <div className="h-3 w-3 bg-orange-500"></div>
                <span className="text-sm font-medium text-gray-700">En cours</span>
              </div>
              <span className="font-semibold text-orange-600 text-lg">{customerOrderStats.inProgress}</span>
            </div>
            <div className="flex items-center justify-between p-3 hover:bg-gray-50 transition-colors">
              <div className="flex items-center space-x-3">
                <div className="h-3 w-3 bg-green-500"></div>
                <span className="text-sm font-medium text-gray-700">Disponibles</span>
              </div>
              <span className="font-semibold text-green-600 text-lg">{customerOrderStats.available}</span>
            </div>
            <div className="flex items-center justify-between p-3 hover:bg-gray-50 transition-colors">
              <div className="flex items-center space-x-3">
                <div className="h-3 w-3 bg-blue-500"></div>
                <span className="text-sm font-medium text-gray-700">Retirées</span>
              </div>
              <span className="font-semibold text-blue-600 text-lg">{customerOrderStats.withdrawn}</span>
            </div>
            <div className="flex items-center justify-between border-t border-gray-200 pt-3 mt-3 p-3">
              <div className="flex items-center space-x-3">
                <div className="h-3 w-3 bg-gray-500"></div>
                <span className="text-sm font-semibold text-gray-800">Total commandes</span>
              </div>
              <span className="font-bold text-xl text-gray-800">{customerOrderStats.total}</span>
            </div>
          </CardContent>
        </Card>

        {/* Tâches à faire */}
        <Card className="bg-white border border-gray-200 shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="pb-4 border-b border-gray-100">
            <CardTitle className="text-lg font-semibold text-gray-800 flex items-center">
              <CheckSquare className="h-5 w-5 mr-3 text-blue-600" />
              Tâches à faire
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-6">
            {Array.isArray(tasks) && tasks.length > 0 ? tasks
              .filter((task: any) => task.status !== 'completed')
              .sort((a: any, b: any) => {
                const dateA = safeDate(a.createdAt);
                const dateB = safeDate(b.createdAt);
                return (dateA ? dateA.getTime() : 0) - (dateB ? dateB.getTime() : 0);
              })
              .slice(0, 5)
              .map((task: any) => (
                <div key={task.id} className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors border-l-3 border-blue-500">
                  <div className="flex items-center space-x-3">
                    <div className="h-2 w-2 bg-blue-500"></div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 truncate">{task.title}</p>
                      <p className="text-sm text-gray-600 truncate">{task.assignedTo}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge 
                      variant={task.status === 'completed' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {task.status === 'completed' ? 'Terminé' : 'En cours'}
                    </Badge>
                    <p className="text-xs text-gray-500 mt-1">
                      {safeFormat(task.createdAt, "d MMM")}
                    </p>
                  </div>
                </div>
              )) : (
                <div className="text-center py-8">
                  <p className="text-gray-600">Aucune tâche en cours</p>
                  <p className="text-xs text-gray-400 mt-1">Toutes les tâches sont terminées</p>
                </div>
              )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}