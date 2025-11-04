import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useStore } from "@/contexts/StoreContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Calendar, DollarSign, Building, CreditCard, AlertCircle, FileSpreadsheet, Download } from "lucide-react";
import { format, parseISO, startOfMonth, endOfMonth, eachMonthOfInterval, isWithinInterval } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

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
  const { toast } = useToast();
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return format(now, 'yyyy-MM');
  });
  
  // États pour la modale d'export
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedPaymentMethods, setSelectedPaymentMethods] = useState<string[]>([]);
  const [includeHT, setIncludeHT] = useState(true);
  const [includeTTC, setIncludeTTC] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

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

  // Récupérer tous les modes de paiement disponibles
  const availablePaymentMethods = useMemo(() => {
    const methods = new Set<string>();
    filteredSchedules.forEach(schedule => {
      methods.add(schedule.paymentMethod || 'Non défini');
    });
    return Array.from(methods).sort();
  }, [filteredSchedules]);

  // Handler pour ouvrir la modale d'export
  const handleOpenExportModal = () => {
    // Pré-sélectionner tous les modes de paiement par défaut
    setSelectedPaymentMethods(availablePaymentMethods);
    setShowExportModal(true);
  };

  // Handler pour basculer la sélection d'un mode de paiement
  const togglePaymentMethod = (method: string) => {
    setSelectedPaymentMethods(prev =>
      prev.includes(method)
        ? prev.filter(m => m !== method)
        : [...prev, method]
    );
  };

  // Handler pour sélectionner/désélectionner tous les modes de paiement
  const toggleAllPaymentMethods = () => {
    if (selectedPaymentMethods.length === availablePaymentMethods.length) {
      setSelectedPaymentMethods([]);
    } else {
      setSelectedPaymentMethods(availablePaymentMethods);
    }
  };

  // Handler pour exporter vers Excel
  const handleExport = async () => {
    if (selectedPaymentMethods.length === 0) {
      return;
    }

    setIsExporting(true);
    try {
      const response = await fetch('/api/payment-schedule/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          groupId: selectedStoreId,
          month: selectedMonth,
          paymentMethods: selectedPaymentMethods,
          includeHT,
          includeTTC,
        }),
      });

      if (!response.ok) {
        throw new Error('Erreur lors de l\'export');
      }

      // Télécharger le fichier
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `echeancier_${selectedMonth}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setShowExportModal(false);
      toast({
        title: "Export réussi",
        description: "Le fichier Excel a été téléchargé avec succès.",
      });
    } catch (error) {
      console.error('Erreur export:', error);
      toast({
        title: "Erreur d'export",
        description: "Une erreur est survenue lors de l'export du fichier Excel.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

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
        <div className="flex items-center gap-4">
          <Button
            onClick={handleOpenExportModal}
            variant="outline"
            className="gap-2"
            disabled={filteredSchedules.length === 0}
            data-testid="button-export-excel"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Exporter Excel
          </Button>
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

      {/* Tableau des échéances */}
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
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">Date</TableHead>
                    <TableHead>Fournisseur</TableHead>
                    <TableHead>Facture</TableHead>
                    <TableHead className="w-[140px]">Mode de paiement</TableHead>
                    <TableHead className="text-right w-[110px]">Montant HT</TableHead>
                    <TableHead className="text-right w-[110px]">Montant TTC</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSchedules.map((schedule, index) => (
                    <TableRow 
                      key={`${schedule.id}-${index}`}
                      data-testid={`schedule-item-${index}`}
                      className="hover:bg-gray-50"
                    >
                      <TableCell className="font-medium">
                        {format(parseISO(schedule.dueDate), 'dd/MM/yyyy', { locale: fr })}
                      </TableCell>
                      <TableCell>{schedule.supplierName}</TableCell>
                      <TableCell className="font-mono text-sm">{schedule.invoiceReference}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                          schedule.paymentMethod === 'Virement' ? 'bg-blue-100 text-blue-800' :
                          schedule.paymentMethod === 'Traite' ? 'bg-green-100 text-green-800' :
                          schedule.paymentMethod === 'Chèque' ? 'bg-yellow-100 text-yellow-800' :
                          schedule.paymentMethod === 'Traite Magnétique' ? 'bg-purple-100 text-purple-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {schedule.paymentMethod || 'Non défini'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {schedule.amount.toFixed(2)} €
                      </TableCell>
                      <TableCell className="text-right font-bold text-blue-600">
                        {schedule.amountTTC.toFixed(2)} €
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modale d'export Excel */}
      <Dialog open={showExportModal} onOpenChange={setShowExportModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-green-600" />
              Exporter vers Excel
            </DialogTitle>
            <DialogDescription>
              Sélectionnez les modes de paiement et les colonnes à inclure dans l'export
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Sélection des modes de paiement */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">Modes de paiement</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleAllPaymentMethods}
                  className="h-auto py-1 text-xs"
                  data-testid="button-toggle-all-methods"
                >
                  {selectedPaymentMethods.length === availablePaymentMethods.length
                    ? 'Tout désélectionner'
                    : 'Tout sélectionner'}
                </Button>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-3">
                {availablePaymentMethods.map((method) => (
                  <div key={method} className="flex items-center space-x-2">
                    <Checkbox
                      id={`payment-method-${method}`}
                      checked={selectedPaymentMethods.includes(method)}
                      onCheckedChange={() => togglePaymentMethod(method)}
                      data-testid={`checkbox-payment-method-${method}`}
                    />
                    <label
                      htmlFor={`payment-method-${method}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {method}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Options de colonnes */}
            <div className="space-y-3">
              <Label className="text-base font-medium">Colonnes à inclure</Label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="include-ht"
                    checked={includeHT}
                    onCheckedChange={(checked) => setIncludeHT(!!checked)}
                    data-testid="checkbox-include-ht"
                  />
                  <label
                    htmlFor="include-ht"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    Montant HT
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="include-ttc"
                    checked={includeTTC}
                    onCheckedChange={(checked) => setIncludeTTC(!!checked)}
                    data-testid="checkbox-include-ttc"
                  />
                  <label
                    htmlFor="include-ttc"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    Montant TTC
                  </label>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowExportModal(false)}
              disabled={isExporting}
            >
              Annuler
            </Button>
            <Button
              onClick={handleExport}
              disabled={
                isExporting ||
                selectedPaymentMethods.length === 0 ||
                (!includeHT && !includeTTC)
              }
              className="gap-2"
              data-testid="button-confirm-export"
            >
              {isExporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Export en cours...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Exporter
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
