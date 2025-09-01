import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthUnified } from "@/hooks/useAuthUnified";
import { useStore } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar, Package, ShoppingCart, TrendingUp, Clock, MapPin, User, AlertTriangle, CheckCircle, Truck, FileText, BarChart3, Megaphone, Shield, XCircle, CheckSquare, Circle, Info, Star, Sparkles, X } from "lucide-react";
import { safeFormat, safeDate } from "@/lib/dateUtils";
import type { PublicityWithRelations, DashboardMessage } from "@shared/schema";
import AnnouncementCard from "@/components/AnnouncementCard";

export default function Dashboard() {
  const { user } = useAuthUnified();
  const { selectedStoreId } = useStore();
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);

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

  // Récupérer la dernière annonce récente (créée il y a moins de 2 jours)
  const { data: recentAnnouncement } = useQuery<DashboardMessage | null>({
    queryKey: ['/api/announcements/recent', selectedStoreId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedStoreId && user?.role === 'admin') {
        params.append('storeId', selectedStoreId.toString());
      }
      params.append('recent', 'true');
      
      const response = await fetch(`/api/announcements?${params.toString()}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        return null;
      }
      
      const announcements: DashboardMessage[] = await response.json();
      
      // Filtrer les annonces créées il y a moins de 2 jours côté client
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      
      const recentAnnouncements = announcements.filter(announcement => {
        if (!announcement.createdAt) return false;
        const createdAt = safeDate(announcement.createdAt);
        return createdAt && createdAt >= twoDaysAgo;
      });
      
      // Retourner la plus récente
      return recentAnnouncements.length > 0 
        ? recentAnnouncements.sort((a, b) => {
            const dateA = safeDate(a.createdAt);
            const dateB = safeDate(b.createdAt);
            return (dateB?.getTime() || 0) - (dateA?.getTime() || 0);
          })[0]
        : null;
    },
    enabled: !!user,
  });

  // Fonction pour obtenir la configuration des priorités d'annonces
  const getAnnouncementPriorityConfig = (type: string) => {
    switch (type) {
      case 'error':
        return { 
          label: 'Nouveauté', 
          color: 'bg-purple-100 text-purple-800',
          icon: Sparkles,
          iconColor: 'text-purple-600'
        };
      case 'warning':
        return { 
          label: 'Attention', 
          color: 'bg-orange-100 text-orange-800',
          icon: AlertTriangle,
          iconColor: 'text-orange-600'
        };
      case 'success':
        return { 
          label: 'Important', 
          color: 'bg-red-100 text-red-800',
          icon: Star,
          iconColor: 'text-red-600'
        };
      case 'info':
      default:
        return { 
          label: 'Information', 
          color: 'bg-blue-100 text-blue-800',
          icon: Info,
          iconColor: 'text-blue-600'
        };
    }
  };

  // Effet pour afficher automatiquement le modal si une annonce récente existe
  useEffect(() => {
    if (recentAnnouncement && !showAnnouncementModal) {
      // Vérifier si l'utilisateur a déjà vu cette annonce (localStorage)
      const dismissedAnnouncements = JSON.parse(localStorage.getItem('dismissedAnnouncements') || '[]');
      if (!dismissedAnnouncements.includes(recentAnnouncement.id)) {
        setShowAnnouncementModal(true);
      }
    }
  }, [recentAnnouncement, showAnnouncementModal]);

  // Fonction pour fermer le modal et marquer l'annonce comme vue
  const handleCloseAnnouncementModal = () => {
    setShowAnnouncementModal(false);
    if (recentAnnouncement) {
      const dismissedAnnouncements = JSON.parse(localStorage.getItem('dismissedAnnouncements') || '[]');
      if (!dismissedAnnouncements.includes(recentAnnouncement.id)) {
        dismissedAnnouncements.push(recentAnnouncement.id);
        localStorage.setItem('dismissedAnnouncements', JSON.stringify(dismissedAnnouncements));
      }
    }
  };

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
    .slice(0, 4) : []; // Afficher les 4 dernières commandes

  // Toutes les commandes en attente
  const pendingOrders = Array.isArray(allOrders) ? allOrders
    .filter((order: any) => order.status === 'pending')
    .sort((a: any, b: any) => {
      const dateA = safeDate(a.createdAt);
      const dateB = safeDate(b.createdAt);
      return (dateB ? dateB.getTime() : 0) - (dateA ? dateA.getTime() : 0);
    }) : []; // Afficher toutes les commandes en attente
  
  const upcomingDeliveries = Array.isArray(allDeliveries) ? allDeliveries
    .filter((d: any) => {
      const isPlanned = d.status === 'planned';
      console.log('🚚 Dashboard - Delivery filter:', { id: d.id, status: d.status, isPlanned, scheduledDate: d.scheduledDate });
      return isPlanned;
    })
    .sort((a: any, b: any) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime())
    .slice(0, 4) : []; // Afficher les 4 prochaines livraisons
    
  console.log('🚚 Dashboard - Upcoming deliveries result:', upcomingDeliveries.length, upcomingDeliveries);

  // Calculs pour les statistiques
  const pendingOrdersCount = Array.isArray(allOrders) ? allOrders.filter((order: any) => order.status === 'pending').length : 0;
  const averageDeliveryTime = Math.round(stats?.averageDeliveryTime || 0);
  const deliveredThisMonth = Array.isArray(allDeliveries) ? allDeliveries.filter((delivery: any) => {
    const deliveryDate = safeDate(delivery.deliveredDate || delivery.createdAt);
    if (!deliveryDate) return false;
    const now = new Date();
    return deliveryDate.getMonth() === now.getMonth() && 
           deliveryDate.getFullYear() === now.getFullYear() && 
           delivery.status === 'delivered';
  }).length : 0;

  // Calculer le total des palettes pour les livraisons 'delivered' du mois en cours
  const totalPalettes = Array.isArray(allDeliveries) ? allDeliveries.reduce((total: number, delivery: any) => {
    if (delivery.status === 'delivered' && delivery.unit === 'palettes') {
      const deliveryDate = safeDate(delivery.deliveredDate || delivery.createdAt);
      if (!deliveryDate) return total;
      const now = new Date();
      if (deliveryDate.getMonth() === now.getMonth() && deliveryDate.getFullYear() === now.getFullYear()) {
        return total + (delivery.quantity || 0);
      }
    }
    return total;
  }, 0) : 0;

  // Fonction pour obtenir la configuration des priorités (identique au module Tasks)
  const getPriorityConfig = (priority: string) => {
    switch (priority) {
      case 'high':
        return { 
          color: 'destructive' as const, 
          icon: AlertTriangle, 
          label: 'Élevée' 
        };
      case 'medium':
        return { 
          color: 'default' as const, 
          icon: Clock, 
          label: 'Moyenne' 
        };
      case 'low':
        return { 
          color: 'secondary' as const, 
          icon: Circle, 
          label: 'Faible' 
        };
      default:
        return { 
          color: 'secondary' as const, 
          icon: Circle, 
          label: 'Moyenne' 
        };
    }
  };

  console.log('📊 Dashboard Debug - Raw Data:', {
    allOrders: Array.isArray(allOrders) ? allOrders.length : 'NOT_ARRAY',
    allDeliveries: Array.isArray(allDeliveries) ? allDeliveries.length : 'NOT_ARRAY', 
    customerOrders: Array.isArray(customerOrders) ? customerOrders.length : 'NOT_ARRAY',
    upcomingPublicities: Array.isArray(upcomingPublicities) ? upcomingPublicities.length : 'NOT_ARRAY',
    stats: stats,
    samples: {
      order: Array.isArray(allOrders) && allOrders.length > 0 ? allOrders[0] : null,
      delivery: Array.isArray(allDeliveries) && allDeliveries.length > 0 ? allDeliveries[0] : null,
      customerOrder: Array.isArray(customerOrders) && customerOrders.length > 0 ? customerOrders[0] : null,
      publicity: Array.isArray(upcomingPublicities) && upcomingPublicities.length > 0 ? upcomingPublicities[0] : null
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
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4 sm:p-6 shadow-sm -m-4 sm:-m-6 mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 flex items-center">
              <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3 text-blue-600" />
              Tableau de Bord
            </h2>
            <p className="text-gray-600 mt-1 text-sm sm:text-base">
              Vue d'ensemble des performances et statistiques
            </p>
          </div>
        </div>
      </div>

      {/* Alerts */}
      <div className="space-y-3">
        
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <Card className="bg-white border border-gray-200 shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-600">Livraisons ce mois</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1 sm:mt-2">{deliveredThisMonth}</p>
              </div>
              <div className="h-10 w-10 sm:h-12 sm:w-12 bg-green-100 flex items-center justify-center rounded-lg">
                <Truck className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border border-gray-200 shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-600">Commandes en attente</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1 sm:mt-2">{pendingOrdersCount}</p>
              </div>
              <div className="h-10 w-10 sm:h-12 sm:w-12 bg-orange-100 flex items-center justify-center rounded-lg">
                <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border border-gray-200 shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-600">Délai moyen (jours)</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1 sm:mt-2">{averageDeliveryTime}</p>
              </div>
              <div className="h-10 w-10 sm:h-12 sm:w-12 bg-blue-100 flex items-center justify-center rounded-lg">
                <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border border-gray-200 shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-600">Total palettes</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1 sm:mt-2">{totalPalettes}</p>
              </div>
              <div className="h-10 w-10 sm:h-12 sm:w-12 bg-purple-100 flex items-center justify-center rounded-lg">
                <Package className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Commandes en Attente */}
        <Card className="bg-white border border-gray-200 shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="pb-4 border-b border-gray-100">
            <CardTitle className="text-lg font-semibold text-gray-800 flex items-center">
              <Clock className="h-5 w-5 mr-3 text-orange-600" />
              Commandes en Attente
              {pendingOrders.length > 0 && (
                <Badge variant="destructive" className="ml-2 text-xs">
                  {pendingOrders.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-6 max-h-96 overflow-y-auto">
            {pendingOrders.length > 0 ? pendingOrders.map((order: any) => {
              // Calculer le nombre de jours en attente
              const orderDate = safeDate(order.createdAt);
              const daysPending = orderDate ? Math.floor((new Date().getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;
              const isOverdue = daysPending > 10;
              
              return (
                <div key={order.id} className={`flex items-center justify-between p-4 transition-colors border-l-3 ${
                  isOverdue ? 'bg-red-50 hover:bg-red-100 border-red-500' : 'bg-orange-50 hover:bg-orange-100 border-orange-500'
                }`}>
                  <div className="flex items-center space-x-3">
                    <div className={`h-2 w-2 ${isOverdue ? 'bg-red-500' : 'bg-orange-500'}`}></div>
                    <div>
                      <p className="font-medium text-gray-900">{order.supplier?.name}</p>
                      <p className="text-sm text-gray-600">{order.group?.name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge 
                      variant={isOverdue ? 'destructive' : 'secondary'}
                      className="text-xs"
                    >
                      {daysPending} jour{daysPending > 1 ? 's' : ''}
                    </Badge>
                    <p className="text-xs text-gray-500 mt-1">
                      {safeFormat(order.plannedDate, "d MMM")}
                    </p>
                  </div>
                </div>
              );
            }) : (
              <p className="text-gray-600 text-center py-8">Aucune commande en attente</p>
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
                const isCurrentStoreParticipating = selectedStoreId && participatingStores.some((p: any) => p.groupId === parseInt(selectedStoreId.toString()));
                
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
                          {participatingStores.map((participation: any) => {
                            const isCurrentStore = selectedStoreId && participation.groupId === parseInt(selectedStoreId.toString());
                            const groupColor = participation.group?.color || '#1976D2';
                            
                            return (
                              <Badge 
                                key={participation.groupId} 
                                className={`text-xs text-white border ${isCurrentStore ? 'ring-2 ring-white ring-offset-1' : ''}`}
                                style={{ 
                                  backgroundColor: groupColor,
                                  borderColor: groupColor
                                }}
                              >
                                {participation.group.name}
                              </Badge>
                            );
                          })}
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Système d'informations - Remplace les commandes clients */}
        <AnnouncementCard />

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
              .map((task: any) => {
                const priorityConfig = getPriorityConfig(task.priority);
                const PriorityIcon = priorityConfig.icon;
                
                return (
                  <div key={task.id} className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors border-l-3 border-blue-500">
                    <div className="flex items-center space-x-3">
                      <div className="h-2 w-2 bg-blue-500"></div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 truncate">{task.title}</p>
                        <p className="text-sm text-gray-600 truncate">{task.assignedUser?.username || task.assignedTo}</p>
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      <div className="flex items-center justify-end space-x-2">
                        <Badge 
                          className={`text-xs flex items-center gap-1 ${priorityConfig.color}`}
                        >
                          <PriorityIcon className="h-3 w-3" />
                          {priorityConfig.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-500">
                        {safeFormat(task.createdAt, "d MMM")}
                      </p>
                    </div>
                  </div>
                );
              }) : (
                <div className="text-center py-8">
                  <p className="text-gray-600">Aucune tâche en cours</p>
                  <p className="text-xs text-gray-400 mt-1">Toutes les tâches sont terminées</p>
                </div>
              )}
          </CardContent>
        </Card>
      </div>

      {/* Modal pour les annonces récentes */}
      <Dialog open={showAnnouncementModal} onOpenChange={handleCloseAnnouncementModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-blue-600" />
              Nouvelle Annonce
            </DialogTitle>
          </DialogHeader>
          
          {recentAnnouncement && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {(() => {
                    const config = getAnnouncementPriorityConfig(recentAnnouncement.type);
                    const IconComponent = config.icon;
                    return (
                      <>
                        <IconComponent className={`h-4 w-4 ${config.iconColor}`} />
                        <Badge className={config.color}>
                          {config.label}
                        </Badge>
                      </>
                    );
                  })()}
                </div>
                <p className="text-sm text-gray-500">
                  {safeFormat(recentAnnouncement.createdAt, "d MMMM yyyy 'à' HH:mm")}
                </p>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {recentAnnouncement.title}
                </h3>
                <div className="prose prose-sm max-w-none">
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {recentAnnouncement.content}
                  </p>
                </div>
              </div>
              
              {recentAnnouncement.createdBy && (
                <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                  <User className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-600">
                    Publié par {recentAnnouncement.createdBy}
                  </span>
                </div>
              )}
            </div>
          )}
          
          <div className="flex justify-end pt-4">
            <Button onClick={handleCloseAnnouncementModal} className="flex items-center gap-2">
              <X className="h-4 w-4" />
              Fermer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}