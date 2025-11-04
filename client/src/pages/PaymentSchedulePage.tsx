import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useStore } from "@/contexts/StoreContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Calendar, DollarSign, Building, CreditCard, AlertCircle } from "lucide-react";
import { format, parseISO, startOfMonth, endOfMonth, eachMonthOfInterval, isWithinInterval } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PaymentSchedule {
  id: string | number;
  invoiceReference: string;
  dueDate: string;
  amount: number;
  amountTTC: number;
  supplierName: string;
  paymentMethod: string | null;
  groupId: number;
  groupName: string;
}

interface PaymentScheduleResponse {
  schedules: PaymentSchedule[];
  message?: string;
}

export default function PaymentSchedulePage() {
  const { selectedStoreId } = useStore();
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return format(now, 'yyyy-MM');
  });

  // Récupérer les échéances
  const { data, isLoading, error } = useQuery<PaymentScheduleResponse>({
    queryKey: ['/api/payment-schedule', selectedStoreId],
    queryFn: async () => {
      const response = await fetch(`/api/payment-schedule?groupId=${selectedStoreId}`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error(`Erreur ${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    enabled: !!selectedStoreId,
  });

  // Calculer les mois disponibles (12 derniers mois + 12 prochains mois)
  const availableMonths = useMemo(() => {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - 12, 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 12, 1);
    
    return eachMonthOfInterval({ start: startDate, end: endDate })
      .map(date => ({
        value: format(date, 'yyyy-MM'),
        label: format(date, 'MMMM yyyy', { locale: fr })
      }));
  }, []);

  // Filtrer les échéances par mois sélectionné
  const filteredSchedules = useMemo(() => {
    if (!data?.schedules) return [];
    
    const monthStart = parseISO(`${selectedMonth}-01`);
    const monthEnd = endOfMonth(monthStart);
    
    return data.schedules
      .filter(schedule => {
        try {
          const dueDate = parseISO(schedule.dueDate);
          return isWithinInterval(dueDate, { start: monthStart, end: monthEnd });
        } catch {
          return false;
        }
      })
      .sort((a, b) => {
        const dateA = parseISO(a.dueDate);
        const dateB = parseISO(b.dueDate);
        return dateA.getTime() - dateB.getTime();
      });
  }, [data?.schedules, selectedMonth]);

  // Calculer le total du mois (HT)
  const monthTotal = useMemo(() => {
    return filteredSchedules.reduce((sum, schedule) => sum + schedule.amount, 0);
  }, [filteredSchedules]);

  // Calculer le total du mois (TTC)
  const monthTotalTTC = useMemo(() => {
    return filteredSchedules.reduce((sum, schedule) => sum + schedule.amountTTC, 0);
  }, [filteredSchedules]);

  // Grouper par mode de paiement (HT)
  const paymentMethodTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    filteredSchedules.forEach(schedule => {
      const method = schedule.paymentMethod || 'Non défini';
      totals[method] = (totals[method] || 0) + schedule.amount;
    });
    return totals;
  }, [filteredSchedules]);

  // Grouper par mode de paiement (TTC)
  const paymentMethodTotalsTTC = useMemo(() => {
    const totals: Record<string, number> = {};
    filteredSchedules.forEach(schedule => {
      const method = schedule.paymentMethod || 'Non défini';
      totals[method] = (totals[method] || 0) + schedule.amountTTC;
    });
    return totals;
  }, [filteredSchedules]);

  if (!selectedStoreId) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Card className="w-96">
          <CardHeader className="text-center">
            <AlertCircle className="w-12 h-12 text-orange-500 mx-auto mb-4" />
            <CardTitle>Sélectionner un magasin</CardTitle>
            <CardDescription>
              Veuillez sélectionner un magasin pour afficher l'échéancier
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Card className="w-96">
          <CardHeader className="text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <CardTitle>Erreur</CardTitle>
            <CardDescription>
              Une erreur est survenue lors du chargement des échéances
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (data?.message) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Card className="w-96">
          <CardHeader className="text-center">
            <AlertCircle className="w-12 h-12 text-blue-500 mx-auto mb-4" />
            <CardTitle>Configuration requise</CardTitle>
            <CardDescription>{data.message}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* En-tête */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Échéancier des Paiements</h1>
          <p className="text-gray-600 mt-1">Gestion des échéances fournisseurs</p>
        </div>
        <div className="w-64">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger data-testid="select-month">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableMonths.map(month => (
                <SelectItem key={month.value} value={month.value}>
                  {month.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Statistiques du mois */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total du Mois</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="flex justify-between items-baseline">
                <span className="text-sm text-gray-600">HT:</span>
                <span className="text-xl font-bold" data-testid="text-month-total-ht">
                  {monthTotal.toFixed(2)} €
                </span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-sm text-gray-600">TTC:</span>
                <span className="text-xl font-bold text-blue-600" data-testid="text-month-total-ttc">
                  {monthTotalTTC.toFixed(2)} €
                </span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {filteredSchedules.length} échéance{filteredSchedules.length > 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Modes de Paiement</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm space-y-2">
              {Object.entries(paymentMethodTotals).map(([method, totalHT]) => (
                <div key={method} className="border-b pb-2 last:border-b-0">
                  <div className="font-medium text-gray-700 mb-1">{method}</div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">HT:</span>
                    <span className="font-semibold">{totalHT.toFixed(2)} €</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">TTC:</span>
                    <span className="font-semibold text-blue-600">
                      {paymentMethodTotalsTTC[method]?.toFixed(2) || '0.00'} €
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Période</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">
              {format(parseISO(`${selectedMonth}-01`), 'MMMM', { locale: fr })}
            </div>
            <p className="text-xs text-muted-foreground">
              {format(parseISO(`${selectedMonth}-01`), 'yyyy', { locale: fr })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Liste des échéances */}
      <Card>
        <CardHeader>
          <CardTitle>Échéances du Mois</CardTitle>
          <CardDescription>
            Liste détaillée des paiements à effectuer pour le mois sélectionné
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredSchedules.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Aucune échéance pour ce mois
            </div>
          ) : (
            <div className="space-y-3">
              {filteredSchedules.map((schedule, index) => (
                <div
                  key={`${schedule.id}-${index}`}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                  data-testid={`schedule-item-${index}`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <Calendar className="w-4 h-4 text-blue-600" />
                      <span className="font-semibold">
                        {format(parseISO(schedule.dueDate), 'dd/MM/yyyy', { locale: fr })}
                      </span>
                    </div>
                    <div className="mt-2 space-y-1 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <Building className="w-3 h-3" />
                        <span>{schedule.supplierName}</span>
                      </div>
                      <div>Facture: {schedule.invoiceReference}</div>
                      {schedule.paymentMethod && (
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-3 h-3" />
                          <span>{schedule.paymentMethod}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <div className="flex items-center gap-2 justify-end">
                      <span className="text-xs text-gray-500">HT:</span>
                      <span className="text-lg font-semibold">
                        {schedule.amount.toFixed(2)} €
                      </span>
                    </div>
                    <div className="flex items-center gap-2 justify-end">
                      <span className="text-xs text-gray-500">TTC:</span>
                      <span className="text-lg font-bold text-blue-600">
                        {schedule.amountTTC.toFixed(2)} €
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
