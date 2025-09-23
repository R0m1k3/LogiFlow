import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuthUnified } from "@/hooks/useAuthUnified";
import { useStore } from "@/contexts/StoreContext";
import { CalendarIcon, Download, RefreshCw, TrendingUp, Package, CheckCircle2, Euro, Store, Truck, BarChart3, PieChart, Activity, FileDown } from "lucide-react";
import { addDays, format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfYear, endOfYear } from "date-fns";
import { fr } from "date-fns/locale";
import { LineChart, Line, BarChart, Bar, PieChart as RechartsChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

// Couleurs pour les graphiques
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#8DD1E1', '#D084D0', '#FFB3BA'];

export default function Analytics() {
  const { user } = useAuthUnified();
  const { selectedStoreId } = useStore();
  
  // États des filtres - élargir la période par défaut pour inclure plus de données
  const [dateRange, setDateRange] = useState({
    from: addDays(new Date(), -365), // Dernière année
    to: new Date()
  });
  const [selectedSuppliers, setSelectedSuppliers] = useState<number[]>([]);
  const [selectedStores, setSelectedStores] = useState<number[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string[]>([]);
  const [granularity, setGranularity] = useState<'day' | 'week' | 'month'>('day');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Périodes rapides
  const quickPeriods = [
    { label: "Aujourd'hui", value: () => ({ from: new Date(), to: new Date() }) },
    { label: "Cette semaine", value: () => ({ from: startOfWeek(new Date(), { locale: fr }), to: endOfWeek(new Date(), { locale: fr }) }) },
    { label: "Ce mois", value: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }) },
    { label: "Cette année", value: () => ({ from: startOfYear(new Date()), to: endOfYear(new Date()) }) },
    { label: "30 derniers jours", value: () => ({ from: addDays(new Date(), -30), to: new Date() }) },
    { label: "90 derniers jours", value: () => ({ from: addDays(new Date(), -90), to: new Date() }) }
  ];

  // Construction des paramètres de requête
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (dateRange.from) params.append('startDate', dateRange.from.toISOString());
    if (dateRange.to) params.append('endDate', dateRange.to.toISOString());
    if (selectedSuppliers.length) params.append('supplierIds', selectedSuppliers.join(','));
    if (selectedStores.length) params.append('groupIds', selectedStores.join(','));
    if (selectedStatus.length) params.append('status', selectedStatus.join(','));
    return params.toString();
  }, [dateRange, selectedSuppliers, selectedStores, selectedStatus]);

  // Récupération des données
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['/api/analytics/summary', queryParams],
    queryFn: async () => {
      console.log('📊 [ANALYTICS] Fetching summary with params:', queryParams);
      const response = await fetch(`/api/analytics/summary?${queryParams}`, {
        credentials: 'include'
      });
      if (!response.ok) {
        console.error('❌ [ANALYTICS] Summary fetch failed:', response.status, response.statusText);
        throw new Error('Failed to fetch summary');
      }
      const data = await response.json();
      console.log('✅ [ANALYTICS] Summary data received:', data);
      return data;
    },
    refetchInterval: isRefreshing ? 30000 : false
  });

  const { data: timeseries } = useQuery({
    queryKey: ['/api/analytics/timeseries', queryParams, granularity],
    queryFn: async () => {
      const url = `/api/analytics/timeseries?${queryParams}&granularity=${granularity}`;
      console.log('📊 [ANALYTICS] Fetching timeseries:', url);
      const response = await fetch(url, {
        credentials: 'include'
      });
      if (!response.ok) {
        console.error('❌ [ANALYTICS] Timeseries fetch failed:', response.status, response.statusText);
        throw new Error('Failed to fetch timeseries');
      }
      const data = await response.json();
      console.log('✅ [ANALYTICS] Timeseries data received:', data?.length || 0, 'entries');
      return data;
    }
  });

  const { data: bySupplier } = useQuery({
    queryKey: ['/api/analytics/by-supplier', queryParams],
    queryFn: async () => {
      const response = await fetch(`/api/analytics/by-supplier?${queryParams}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch by supplier');
      return response.json();
    }
  });

  const { data: byStore } = useQuery({
    queryKey: ['/api/analytics/by-store', queryParams],
    queryFn: async () => {
      const response = await fetch(`/api/analytics/by-store?${queryParams}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch by store');
      return response.json();
    }
  });

  const { data: suppliers } = useQuery({
    queryKey: ['/api/suppliers'],
  });

  const { data: stores } = useQuery({
    queryKey: ['/api/groups'],
  });

  // Fonction d'export
  const handleExport = async (type: string) => {
    const response = await fetch(`/api/analytics/export?${queryParams}&type=${type}`, {
      credentials: 'include'
    });
    if (response.ok) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics_${type}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }
  };

  if (summaryLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement des statistiques...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="bg-white border-b p-6 -m-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-primary" />
              Tableau de bord Analytics
            </h1>
            <p className="text-gray-600 mt-1">Analysez vos performances logistiques</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsRefreshing(!isRefreshing)}
              className={isRefreshing ? "animate-pulse" : ""}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              {isRefreshing ? "Actualisé" : "Temps réel"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport('summary')}
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>
      </div>

      {/* Filtres */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Filtres
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Périodes rapides */}
          <div className="flex flex-wrap gap-2">
            {quickPeriods.map(period => (
              <Button
                key={period.label}
                variant="outline"
                size="sm"
                onClick={() => setDateRange(period.value())}
              >
                {period.label}
              </Button>
            ))}
          </div>

          {/* Sélecteur de dates */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-1">
              <label className="text-sm font-medium mb-1 block">Période</label>
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange.from ? format(dateRange.from, 'dd/MM/yyyy', { locale: fr }) : 'Date début'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={dateRange.from}
                      onSelect={(date) => date && setDateRange(prev => ({ ...prev, from: date }))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <span className="text-gray-500 self-center">→</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange.to ? format(dateRange.to, 'dd/MM/yyyy', { locale: fr }) : 'Date fin'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={dateRange.to}
                      onSelect={(date) => date && setDateRange(prev => ({ ...prev, to: date }))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Granularité</label>
              <Select value={granularity} onValueChange={(value: any) => setGranularity(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Jour</SelectItem>
                  <SelectItem value="week">Semaine</SelectItem>
                  <SelectItem value="month">Mois</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Fournisseurs</label>
              <Select 
                value={selectedSuppliers.length === 0 ? "all" : 
                       selectedSuppliers.length === 1 ? selectedSuppliers[0].toString() : "multiple"}
                onValueChange={(value) => {
                  if (value === "all") {
                    setSelectedSuppliers([]);
                  } else if (value !== "multiple") {
                    // Basculer entre sélection unique ou multiple
                    const supplierId = parseInt(value);
                    if (selectedSuppliers.includes(supplierId)) {
                      setSelectedSuppliers(selectedSuppliers.filter(id => id !== supplierId));
                    } else {
                      setSelectedSuppliers([supplierId]);
                    }
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tous les fournisseurs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les fournisseurs</SelectItem>
                  {Array.isArray(suppliers) && suppliers.map((supplier: any) => (
                    <SelectItem key={supplier.id} value={supplier.id.toString()}>
                      {selectedSuppliers.includes(supplier.id) ? "✓ " : ""}{supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Magasins</label>
              <Select 
                value={selectedStores.length === 0 ? "all" : 
                       selectedStores.length === 1 ? selectedStores[0].toString() : "multiple"}
                onValueChange={(value) => {
                  if (value === "all") {
                    setSelectedStores([]);
                  } else if (value !== "multiple") {
                    // Basculer entre sélection unique ou multiple
                    const storeId = parseInt(value);
                    if (selectedStores.includes(storeId)) {
                      setSelectedStores(selectedStores.filter(id => id !== storeId));
                    } else {
                      setSelectedStores([storeId]);
                    }
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tous les magasins" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les magasins</SelectItem>
                  {Array.isArray(stores) && stores.map((store: any) => (
                    <SelectItem key={store.id} value={store.id.toString()}>
                      {selectedStores.includes(store.id) ? "✓ " : ""}{store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Commandes totales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">{summary?.totalOrders || 0}</div>
              <Package className="h-8 w-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Livraisons totales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">{summary?.totalDeliveries || 0}</div>
              <Truck className="h-8 w-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Taux de réconciliation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">
                {summary?.reconciliationRate ? `${summary.reconciliationRate.toFixed(1)}%` : '0%'}
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Montant total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">
                {summary?.totalAmount ? `${summary.totalAmount.toFixed(2)}€` : '0€'}
              </div>
              <Euro className="h-8 w-8 text-purple-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Graphiques */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Évolution temporelle */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Évolution temporelle
            </CardTitle>
            <CardDescription>Commandes vs Livraisons</CardDescription>
          </CardHeader>
          <CardContent>
            {Array.isArray(timeseries) && timeseries.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={timeseries}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="orders" stroke="#8884d8" name="Commandes" />
                  <Line type="monotone" dataKey="deliveries" stroke="#82ca9d" name="Livraisons" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <Activity className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">Aucune donnée temporelle</p>
                  <p className="text-sm mt-1">Vérifiez la période sélectionnée</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Répartition par fournisseur */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Répartition par fournisseur
            </CardTitle>
            <CardDescription>Top 5 fournisseurs</CardDescription>
          </CardHeader>
          <CardContent>
            {Array.isArray(bySupplier) && bySupplier.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <RechartsChart>
                  <Pie
                    data={bySupplier.slice(0, 5)}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => entry.supplierName}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="deliveries"
                  >
                    {bySupplier.slice(0, 5).map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </RechartsChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <PieChart className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">Aucune donnée fournisseur</p>
                  <p className="text-sm mt-1">Aucune livraison trouvée</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Performance par magasin */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              Performance par magasin
            </CardTitle>
            <CardDescription>Commandes et livraisons</CardDescription>
          </CardHeader>
          <CardContent>
            {Array.isArray(byStore) && byStore.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart 
                  data={byStore.slice(0, 5)} 
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="storeName" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value, name) => [value, name]}
                    labelFormatter={(label) => `Magasin : ${label}`}
                  />
                  <Legend />
                  <Bar dataKey="orders" fill="#8884d8" name="Commandes" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="deliveries" fill="#82ca9d" name="Livraisons" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <Store className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">Aucune donnée magasin</p>
                  <p className="text-sm mt-1">Aucune activité détectée</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top fournisseurs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Top 5 Fournisseurs
            </CardTitle>
            <CardDescription>Par volume et montant</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Array.isArray(summary?.topSuppliers) && summary.topSuppliers.length > 0 ? (
                summary.topSuppliers.map((supplier: any, index: number) => (
                  <div key={supplier.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="w-8 h-8 rounded-full p-0 flex items-center justify-center">
                        {index + 1}
                      </Badge>
                      <div>
                        <p className="font-medium">{supplier.name}</p>
                        <p className="text-sm text-gray-600">
                          {supplier.count} livraisons • {supplier.amount.toFixed(2)}€
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">{supplier.count}</div>
                      <div className="text-xs text-gray-600">livraisons</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-gray-500 py-4">
                  <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Aucune donnée disponible pour la période sélectionnée</p>
                  <p className="text-xs mt-1">Essayez d'élargir la plage de dates</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions d'export */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileDown className="h-5 w-5" />
            Export des données
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => handleExport('summary')}>
              Export Résumé
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport('timeseries')}>
              Export Évolution
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport('suppliers')}>
              Export Fournisseurs
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport('stores')}>
              Export Magasins
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}