import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { safeFormat } from "@/lib/dateUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Pagination, usePagination } from "@/components/ui/pagination";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useStore } from "@/components/Layout";
import { useAuthUnified } from "@/hooks/useAuthUnified";
import { Search, Plus, Edit, FileText, Euro, Calendar, Building2, CheckCircle, X, Trash2, RefreshCw, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format as formatDate } from "date-fns";
import { DayPicker } from "react-day-picker";
import ConfirmDeleteModal from "@/components/modals/ConfirmDeleteModal";

const reconciliationSchema = z.object({
  blNumber: z.string().optional(),
  blAmount: z.string().optional().refine((val) => !val || val === '' || (!isNaN(Number(val)) && Number(val) >= 0), {
    message: "Le montant BL doit être un nombre positif ou vide",
  }),
  invoiceReference: z.string().optional(),
  invoiceAmount: z.string().optional().refine((val) => !val || val === '' || (!isNaN(Number(val)) && Number(val) >= 0), {
    message: "Le montant facture doit être un nombre positif ou vide",
  }),
});

type ReconciliationForm = z.infer<typeof reconciliationSchema>;

export default function BLReconciliation() {
  const { user } = useAuthUnified();
  const { selectedStoreId } = useStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Redirection pour les employés
  if (user?.role === 'employee') {
    return (
      <div className="p-6">
        <div className="bg-orange-50 border-l-4 border-orange-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <FileText className="h-5 w-5 text-orange-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-orange-700">
                <strong>Accès restreint</strong><br />
                Seuls les managers et administrateurs peuvent accéder au module de rapprochement BL/Factures.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  const [searchTerm, setSearchTerm] = useState("");
  const [showReconciliationModal, setShowReconciliationModal] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deliveryToDelete, setDeliveryToDelete] = useState<any>(null);
  const [invoiceVerifications, setInvoiceVerifications] = useState<Record<number, { exists: boolean; error?: string }>>({});
  const [isVerifyingInvoices, setIsVerifyingInvoices] = useState(false);
  const [isVerifyingCurrentInvoice, setIsVerifyingCurrentInvoice] = useState(false);

  // Récupérer les livraisons validées avec BL
  const { data: deliveriesWithBL = [], isLoading } = useQuery({
    queryKey: ['/api/deliveries/bl', selectedStoreId, selectedDate],
    queryFn: async () => {
      const params = new URLSearchParams({
        // Remove withBL filter - show all delivered deliveries regardless of BL status
      });
      if (selectedStoreId && user?.role === 'admin') {
        params.append('storeId', selectedStoreId.toString());
      }
      
      // Ajouter filtre par date si sélectionné
      if (selectedDate) {
        const dateStr = formatDate(selectedDate, 'yyyy-MM-dd');
        params.append('startDate', dateStr);
        params.append('endDate', dateStr);
      }
      
      const response = await fetch(`/api/deliveries?${params.toString()}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch deliveries');
      }
      
      const deliveries = await response.json();
      console.log('🚚 BL Reconciliation - All deliveries received:', Array.isArray(deliveries) ? deliveries.length : 'NOT_ARRAY', deliveries);
      const filtered = Array.isArray(deliveries) ? deliveries.filter((d: any) => d.status === 'delivered') : [];
      console.log('🚚 BL Reconciliation - Filtered deliveries:', filtered.length, filtered);
      
      // Ne filtrer que les livraisons livrées (status === 'delivered')
      // Toutes les livraisons livrées doivent apparaître, même sans BL encore saisi
      
      // Verify invoice references for deliveries with invoice data
      if (filtered.length > 0) {
        const invoiceReferencesToVerify = filtered
          .filter((delivery: any) => delivery.invoiceReference && delivery.groupId)
          .map((delivery: any) => ({
            groupId: delivery.groupId,
            invoiceReference: delivery.invoiceReference,
            deliveryId: delivery.id,
            supplierName: delivery.supplier?.name, // Include supplier name for verification
          }));
        
        if (Array.isArray(invoiceReferencesToVerify) && invoiceReferencesToVerify.length > 0) {
          try {
            const verificationResponse = await fetch('/api/verify-invoices', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ invoiceReferences: invoiceReferencesToVerify }),
            });
            
            if (verificationResponse.ok) {
              const verificationResults = await verificationResponse.json();
              setInvoiceVerifications(verificationResults);
            }
          } catch (error) {
            console.error('Error verifying invoice references:', error);
          }
        }
      }
      
      return filtered.sort((a: any, b: any) => new Date(b.deliveredDate).getTime() - new Date(a.deliveredDate).getTime());
    },
  });

  // Fonction pour vérifier automatiquement les BL sans facture
  const checkPendingInvoices = async () => {
    if (!deliveriesWithBL || deliveriesWithBL.length === 0) return;
    
    // Trouver les livraisons sans référence facture ou avec facture non vérifiée
    const unverifiedDeliveries = deliveriesWithBL.filter((delivery: any) => 
      delivery.blNumber && !delivery.invoiceReference
    );
    
    if (unverifiedDeliveries.length === 0) return;
    
    console.log(`🔍 Checking ${unverifiedDeliveries.length} deliveries for pending invoices...`);
    
    // TODO: Ici on pourrait ajouter une logique pour rechercher automatiquement
    // des factures basées sur les BL numbers ou autres critères
  };

  // Vérification automatique toutes les 30 minutes
  useEffect(() => {
    if (deliveriesWithBL && deliveriesWithBL.length > 0) {
      const interval = setInterval(() => {
        checkPendingInvoices();
      }, 30 * 60 * 1000); // 30 minutes
      
      return () => clearInterval(interval);
    }
  }, [deliveriesWithBL]);

  // Fonction pour vérifier les factures NocoDB
  const verifyAllInvoices = async () => {
    if (!deliveriesWithBL || deliveriesWithBL.length === 0) return;
    
    const invoiceReferencesToVerify = deliveriesWithBL
      .filter((delivery: any) => delivery.invoiceReference && delivery.invoiceReference.trim() !== '' && delivery.groupId)
      .map((delivery: any) => ({
        groupId: delivery.groupId,
        invoiceReference: delivery.invoiceReference,
        deliveryId: delivery.id,
        supplierName: delivery.supplier?.name,
      }));
    
    if (invoiceReferencesToVerify.length > 0) {
      setIsVerifyingInvoices(true);
      try {
        console.log('🔍 Verifying invoices:', invoiceReferencesToVerify);
        const verificationResponse = await fetch('/api/verify-invoices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ invoiceReferences: invoiceReferencesToVerify }),
        });
        
        if (verificationResponse.ok) {
          const verificationResults = await verificationResponse.json();
          console.log('✅ Verification results:', verificationResults);
          setInvoiceVerifications(verificationResults);
          toast({
            title: "Vérification terminée",
            description: `${invoiceReferencesToVerify.length} facture(s) vérifiée(s)`,
          });
        }
      } catch (error) {
        console.error('Error verifying invoice references:', error);
        toast({
          title: "Erreur",
          description: "Impossible de vérifier les factures",
          variant: "destructive",
        });
      } finally {
        setIsVerifyingInvoices(false);
      }
    } else {
      toast({
        title: "Aucune facture à vérifier",
        description: "Aucune référence facture trouvée dans les BL validés",
        variant: "default",
      });
    }
  };

  // Vérifier les factures NocoDB après chaque mise à jour des livraisons
  useEffect(() => {
    if (deliveriesWithBL && deliveriesWithBL.length > 0) {
      verifyAllInvoices();
    }
  }, [deliveriesWithBL]);

  const form = useForm<ReconciliationForm>({
    resolver: zodResolver(reconciliationSchema),
    defaultValues: {
      blNumber: "",
      blAmount: "",
      invoiceReference: "",
      invoiceAmount: "",
    },
  });

  // Fonction pour vérifier une facture en temps réel
  const verifyInvoiceRealtime = async (invoiceRef: string) => {
    if (!invoiceRef || !invoiceRef.trim() || !selectedDelivery) return;
    
    setIsVerifyingCurrentInvoice(true);
    try {
      console.log('🔍 Real-time verification for:', invoiceRef);
      const verificationResponse = await fetch('/api/verify-invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          invoiceReferences: [{
            groupId: selectedDelivery.groupId,
            invoiceReference: invoiceRef.trim(),
            deliveryId: selectedDelivery.id,
            supplierName: selectedDelivery.supplier?.name,
          }]
        }),
      });
      
      if (verificationResponse.ok) {
        const verificationResults = await verificationResponse.json();
        console.log('✅ Real-time verification result:', verificationResults);
        setInvoiceVerifications(prev => ({ ...prev, ...verificationResults }));
      }
    } catch (error) {
      console.error('Error in real-time verification:', error);
    } finally {
      setIsVerifyingCurrentInvoice(false);
    }
  };

  // Debounce pour la vérification en temps réel
  useEffect(() => {
    const invoiceRef = form.watch("invoiceReference");
    if (!invoiceRef || !invoiceRef.trim()) {
      setIsVerifyingCurrentInvoice(false);
      return;
    }
    
    const timeoutId = setTimeout(() => {
      verifyInvoiceRealtime(invoiceRef);
    }, 1000); // Attendre 1 seconde après la dernière saisie
    
    return () => clearTimeout(timeoutId);
  }, [form.watch("invoiceReference"), selectedDelivery]);

  const updateReconciliationMutation = useMutation({
    mutationFn: async (data: { id: number; blNumber: string; blAmount: string; invoiceReference: string; invoiceAmount: string }) => {
      console.log('🔄 Updating reconciliation data:', data);
      const response = await apiRequest(`/api/deliveries/${data.id}`, "PUT", {
        blNumber: data.blNumber,
        blAmount: data.blAmount,
        invoiceReference: data.invoiceReference,
        invoiceAmount: data.invoiceAmount,
      });
      console.log('✅ Reconciliation update response:', response);
      return response;
    },
    onSuccess: (data, variables) => {
      toast({
        title: "Succès",
        description: "Données de rapprochement mises à jour avec succès",
      });
      // Invalider tous les caches BL/Rapprochement avec toutes les variations de clés
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          query.queryKey[0] === '/api/deliveries/bl' || 
          query.queryKey[0] === '/api/deliveries'
      });
      
      // Vérifier immédiatement la facture si une référence a été ajoutée ou modifiée
      if (variables.invoiceReference && variables.invoiceReference.trim() !== '') {
        const verifyInvoice = async () => {
          try {
            console.log('🔍 Immediate verification for:', variables.invoiceReference);
            const verificationResponse = await fetch('/api/verify-invoices', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ 
                invoiceReferences: [{
                  groupId: selectedDelivery?.groupId,
                  invoiceReference: variables.invoiceReference,
                  deliveryId: variables.id,
                  supplierName: selectedDelivery?.supplier?.name,
                }]
              }),
            });
            
            if (verificationResponse.ok) {
              const verificationResults = await verificationResponse.json();
              console.log('✅ Immediate verification result:', verificationResults);
              setInvoiceVerifications(prev => ({ ...prev, ...verificationResults }));
              
              // Notification du résultat
              const result = verificationResults[variables.id];
              if (result) {
                toast({
                  title: result.exists ? "Facture trouvée" : "Facture non trouvée",
                  description: result.exists ? 
                    `La facture ${variables.invoiceReference} a été trouvée dans NocoDB` :
                    `La facture ${variables.invoiceReference} n'a pas été trouvée dans NocoDB`,
                  variant: result.exists ? "default" : "destructive",
                });
              }
            }
          } catch (error) {
            console.error('Error verifying invoice reference:', error);
            toast({
              title: "Erreur de vérification",
              description: "Impossible de vérifier la facture dans NocoDB",
              variant: "destructive",
            });
          }
        };
        
        verifyInvoice();
      }
      
      form.reset();
      setShowReconciliationModal(false);
      setSelectedDelivery(null);
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Non autorisé",
          description: "Vous êtes déconnecté. Reconnexion...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour les données de rapprochement",
        variant: "destructive",
      });
    },
  });

  const reconcileMutation = useMutation({
    mutationFn: async (id: number) => {
      console.log('🌐 API Request:', { url: `/api/deliveries/${id}`, method: "PUT", body: { reconciled: true } });
      await apiRequest(`/api/deliveries/${id}`, "PUT", {
        reconciled: true,
      });
    },
    onSuccess: () => {
      toast({
        title: "Succès",
        description: "Rapprochement validé avec succès",
      });
      // Invalider tous les caches BL/Rapprochement
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          query.queryKey[0] === '/api/deliveries/bl' || 
          query.queryKey[0] === '/api/deliveries'
      });
    },
    onError: (error) => {
      console.error('❌ Error reconciling delivery:', error);
      if (isUnauthorizedError(error)) {
        toast({
          title: "Non autorisé",
          description: "Vous êtes déconnecté. Reconnexion...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Erreur",
        description: `Impossible de valider le rapprochement: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const deleteDeliveryMutation = useMutation({
    mutationFn: async (id: number) => {
      console.log('🌐 API Request:', { url: `/api/deliveries/${id}`, method: "DELETE" });
      await apiRequest(`/api/deliveries/${id}`, "DELETE");
    },
    onSuccess: () => {
      toast({
        title: "Succès",
        description: "Livraison supprimée avec succès",
      });
      // Invalider tous les caches BL/Rapprochement
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          query.queryKey[0] === '/api/deliveries/bl' || 
          query.queryKey[0] === '/api/deliveries'
      });
    },
    onError: (error) => {
      console.error('❌ Error deleting delivery:', error);
      if (isUnauthorizedError(error)) {
        toast({
          title: "Non autorisé",
          description: "Vous êtes déconnecté. Reconnexion...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Erreur",
        description: `Impossible de supprimer la livraison: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const handleDeleteDelivery = (delivery: any) => {
    setDeliveryToDelete(delivery);
    setShowDeleteModal(true);
  };

  const confirmDeleteDelivery = () => {
    if (deliveryToDelete) {
      deleteDeliveryMutation.mutate(deliveryToDelete.id);
      setShowDeleteModal(false);
      setDeliveryToDelete(null);
    }
  };

  const handleEditReconciliation = (delivery: any) => {
    setSelectedDelivery(delivery);
    form.reset({
      blNumber: delivery.blNumber || "",
      blAmount: delivery.blAmount || "",
      invoiceReference: delivery.invoiceReference || "",
      invoiceAmount: delivery.invoiceAmount || "",
    });
    setShowReconciliationModal(true);
  };

  const onSubmit = (data: ReconciliationForm) => {
    if (selectedDelivery) {
      updateReconciliationMutation.mutate({
        id: selectedDelivery.id,
        blNumber: data.blNumber,
        blAmount: data.blAmount,
        invoiceReference: data.invoiceReference,
        invoiceAmount: data.invoiceAmount,
      });
    }
  };

  const calculateDifference = (blAmount: number, invoiceAmount?: number) => {
    if (!invoiceAmount) return null;
    return blAmount - invoiceAmount;
  };

  const getStatusBadge = (delivery: any) => {
    if (delivery.reconciled) {
      return <Badge className="bg-green-100 text-green-800">Validé</Badge>;
    }
    if (delivery.invoiceReference && delivery.invoiceAmount) {
      return <Badge className="bg-blue-100 text-blue-800">Prêt à valider</Badge>;
    }
    if (delivery.invoiceReference) {
      return <Badge className="bg-yellow-100 text-yellow-800">Facture partielle</Badge>;
    }
    return <Badge variant="secondary">En attente</Badge>;
  };

  const canValidate = (delivery: any) => {
    return delivery.invoiceReference && delivery.invoiceAmount && !delivery.reconciled;
  };

  const handleValidateReconciliation = (delivery: any) => {
    reconcileMutation.mutate(delivery.id);
  };

  const filteredDeliveries = Array.isArray(deliveriesWithBL) ? deliveriesWithBL.filter((delivery: any) => {
    if (!searchTerm) return true;
    return (
      delivery.supplier?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      delivery.blNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      delivery.invoiceReference?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }) : [];

  // Pagination
  const {
    currentPage,
    setCurrentPage,
    itemsPerPage,
    setItemsPerPage,
    totalPages,
    paginatedData: paginatedDeliveries,
    totalItems
  } = usePagination(filteredDeliveries, 10);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-6 shadow-sm -m-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 flex items-center">
              <FileText className="w-6 h-6 mr-3 text-blue-600" />
              Rapprochement
            </h2>
            <p className="text-gray-600 mt-1">
              Rapprochement des bons de livraison et factures
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <Badge variant="outline" className="text-sm border border-gray-300">
              {filteredDeliveries.length} bon(s) de livraison
            </Badge>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg">
        <div className="flex items-center space-x-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Rechercher par fournisseur, BL ou facture..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 border border-gray-300 shadow-sm"
            />
          </div>
          
          {/* Sélecteur de date */}
          <div className="flex items-center space-x-2">
            <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[240px] justify-start text-left font-normal border border-gray-300 shadow-sm",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {selectedDate ? formatDate(selectedDate, "d MMMM yyyy", { locale: fr }) : "Filtrer par date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <DayPicker
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    setSelectedDate(date);
                    setIsDatePickerOpen(false);
                  }}
                  locale={fr}
                  className="rounded-md border"
                />
              </PopoverContent>
            </Popover>
            
            {selectedDate && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedDate(null)}
                className="h-9 px-2"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
            
            <Button
              variant="outline"
              size="sm"
              onClick={verifyAllInvoices}
              disabled={isVerifyingInvoices}
              className="h-9 px-3"
              title="Vérifier toutes les factures avec NocoDB"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isVerifyingInvoices ? 'animate-spin' : ''}`} />
              Vérifier factures
            </Button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="p-4">
        {totalItems === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Aucun BL trouvé
            </h3>
            <p className="text-gray-600">
              Les livraisons validées avec numéro de BL apparaîtront ici.
            </p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-36">
                      Fournisseur
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                      N° BL
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
                      Date Livr.
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
                      Date Valid.
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
                      Montant BL
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-36">
                      Ref. Facture
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
                      Montant Fact.
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                      Écart
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                      Magasin
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedDeliveries.map((delivery: any) => {
                    const difference = calculateDifference(
                      parseFloat(delivery.blAmount || '0'),
                      delivery.invoiceAmount ? parseFloat(delivery.invoiceAmount) : undefined
                    );
                    
                    return (
                      <tr 
                        key={delivery.id} 
                        className={`hover:bg-gray-50 ${delivery.reconciled ? 'bg-gray-100 text-gray-600' : ''}`}
                      >
                        <td className="px-3 py-2 text-sm">
                          <div className="font-medium text-gray-900 truncate max-w-32">
                            {delivery.supplier?.name}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-sm">
                          <div className="text-gray-900">
                            {delivery.blNumber || (
                              <div className="flex items-center space-x-1">
                                <span className="text-gray-400 italic text-xs">Non renseigné</span>
                                <button
                                  onClick={() => handleEditReconciliation(delivery)}
                                  disabled={updateReconciliationMutation.isPending}
                                  className="text-gray-400 hover:text-blue-600 transition-colors duration-200 flex items-center justify-center w-5 h-5 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Ajouter un numéro de BL"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-sm">
                          <div className="text-gray-900">
                            {safeFormat(delivery.scheduledDate, 'dd/MM/yy')}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-sm">
                          <div className="text-gray-900">
                            {delivery.reconciled && delivery.updatedAt ? 
                              safeFormat(delivery.updatedAt, 'dd/MM/yy') : 
                              '-'
                            }
                          </div>
                        </td>
                        <td className="px-3 py-2 text-sm">
                          <div className="font-medium text-gray-900">
                            {delivery.blAmount ? 
                              `${parseFloat(delivery.blAmount).toFixed(2)}€` :
                              (
                                <div className="flex items-center space-x-1">
                                  <span className="text-gray-400 italic text-xs">Non renseigné</span>
                                  <button
                                    onClick={() => handleEditReconciliation(delivery)}
                                    disabled={updateReconciliationMutation.isPending}
                                    className="text-gray-400 hover:text-blue-600 transition-colors duration-200 flex items-center justify-center w-5 h-5 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Ajouter un montant BL"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                </div>
                              )
                            }
                          </div>
                        </td>
                        <td className="px-3 py-2 text-sm">
                          <div className="text-gray-900">
                            {delivery.invoiceReference ? (
                              <div className="flex items-center space-x-1">
                                <span className="truncate max-w-28">{delivery.invoiceReference}</span>
                                {invoiceVerifications[delivery.id] && (
                                  <div className="flex items-center">
                                    {invoiceVerifications[delivery.id].exists ? (
                                      <CheckCircle className="w-3 h-3 text-green-600" title="Facture trouvée" />
                                    ) : (
                                      <X className="w-3 h-3 text-red-600" title="Facture non trouvée" />
                                    )}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <button
                                onClick={() => handleEditReconciliation(delivery)}
                                disabled={updateReconciliationMutation.isPending}
                                className="text-gray-400 hover:text-blue-600 transition-colors duration-200 flex items-center justify-center w-6 h-6 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Ajouter une référence facture"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-sm">
                          <div className="text-gray-900">
                            {delivery.invoiceAmount ? 
                              `${parseFloat(delivery.invoiceAmount).toFixed(2)}€` : 
                              <button
                                onClick={() => handleEditReconciliation(delivery)}
                                disabled={updateReconciliationMutation.isPending}
                                className="text-gray-400 hover:text-blue-600 transition-colors duration-200 flex items-center justify-center w-6 h-6 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Ajouter un montant facture"
                              >
                                <Euro className="w-3.5 h-3.5" />
                              </button>
                            }
                          </div>
                        </td>
                        <td className="px-3 py-2 text-sm">
                          <div className={`font-medium ${
                            difference === null ? 'text-gray-400' :
                            difference === 0 ? 'text-green-600' :
                            difference > 0 ? 'text-orange-600' : 'text-red-600'
                          }`}>
                            {difference === null ? '-' : `${difference.toFixed(2)}€`}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-sm">
                          <div className="flex items-center space-x-1">
                            <div 
                              className="w-2 h-2" 
                              style={{ backgroundColor: delivery.group?.color }}
                            />
                            <span className="text-gray-900 text-xs truncate max-w-16">{delivery.group?.name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-sm">
                          <div className="flex items-center justify-end space-x-1">
                            {getStatusBadge(delivery)}
                            {!delivery.reconciled && (
                              <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditReconciliation(delivery)}
                                disabled={updateReconciliationMutation.isPending}
                                className="px-2 py-1 text-xs"
                              >
                                <Edit className="w-3 h-3 mr-1" />
                                Modifier
                              </Button>
                              {canValidate(delivery) && (
                                <Button
                                  size="sm"
                                  onClick={() => handleValidateReconciliation(delivery)}
                                  disabled={reconcileMutation.isPending}
                                  className="bg-green-600 hover:bg-green-700 text-white px-2 py-1 text-xs"
                                >
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Valider
                                </Button>
                              )}
                            </>
                          )}
                          {user?.role === 'admin' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeleteDelivery(delivery)}
                              disabled={deleteDeliveryMutation.isPending}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-1 text-xs"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          {totalItems > 0 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={setItemsPerPage}
              className="mt-4 border-t border-gray-200 pt-4"
            />
          )}
        </div>
      )}
    </div>

      {/* Reconciliation Modal */}
      <Dialog open={showReconciliationModal} onOpenChange={setShowReconciliationModal}>
        <DialogContent className="sm:max-w-lg" aria-describedby="reconciliation-modal-description">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <FileText className="w-5 h-5 text-primary" />
              <span>Modifier les données de rapprochement</span>
            </DialogTitle>
            <p id="reconciliation-modal-description" className="text-sm text-gray-600 mt-1">
              Modifier les informations du bon de livraison et de la facture
            </p>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Informations générales */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <h4 className="font-medium text-gray-900">Informations générales</h4>
                <div className="text-sm text-gray-600">
                  <p><strong>Fournisseur:</strong> {selectedDelivery?.supplier?.name}</p>
                  <p><strong>Magasin:</strong> {selectedDelivery?.group?.name}</p>
                </div>
              </div>

              {/* Données BL */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900 border-b pb-2">Bon de livraison</h4>
                
                <FormField
                  control={form.control}
                  name="blNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Numéro de BL</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Ex: BL-2024-001"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="blAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Montant BL (€)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number"
                          step="0.01"
                          placeholder="Ex: 1250.50"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Données facture */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900 border-b pb-2">Facture</h4>
                
                <FormField
                  control={form.control}
                  name="invoiceReference"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Référence Facture</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input 
                            placeholder="Ex: FAC-2024-001"
                            {...field}
                          />
                          {/* Indicateur de vérification en temps réel */}
                          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center space-x-2">
                            {isVerifyingCurrentInvoice && (
                              <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                            )}
                            {!isVerifyingCurrentInvoice && field.value && field.value.trim() && selectedDelivery && invoiceVerifications[selectedDelivery.id] && (
                              <div className="flex items-center space-x-1">
                                {invoiceVerifications[selectedDelivery.id].exists ? (
                                  <CheckCircle className="w-4 h-4 text-green-500" title="Facture trouvée dans NocoDB" />
                                ) : (
                                  <X className="w-4 h-4 text-red-500" title="Facture non trouvée dans NocoDB" />
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </FormControl>
                      <FormMessage />
                      {/* Status de vérification */}
                      {!isVerifyingCurrentInvoice && field.value && field.value.trim() && selectedDelivery && invoiceVerifications[selectedDelivery.id] && (
                        <div className="mt-2">
                          {invoiceVerifications[selectedDelivery.id].exists ? (
                            <p className="text-sm text-green-600 flex items-center space-x-1">
                              <CheckCircle className="w-3 h-3" />
                              <span>Facture trouvée dans NocoDB</span>
                            </p>
                          ) : (
                            <p className="text-sm text-red-600 flex items-center space-x-1">
                              <X className="w-3 h-3" />
                              <span>Facture non trouvée dans NocoDB</span>
                            </p>
                          )}
                        </div>
                      )}
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="invoiceAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Montant Facture (€)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number"
                          step="0.01"
                          placeholder="Ex: 1250.50"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Aperçu de l'écart */}
              {form.watch("blAmount") && form.watch("invoiceAmount") && (
                <div className="bg-blue-50 rounded-lg p-4 space-y-2">
                  <h4 className="font-medium text-gray-900">Aperçu de l'écart</h4>
                  <div className="text-sm">
                    <p><strong>Montant BL:</strong> {parseFloat(form.watch("blAmount") || "0").toFixed(2)} €</p>
                    <p><strong>Montant Facture:</strong> {parseFloat(form.watch("invoiceAmount") || "0").toFixed(2)} €</p>
                    <p className={`font-medium ${
                      Math.abs(parseFloat(form.watch("blAmount") || "0") - parseFloat(form.watch("invoiceAmount") || "0")) < 0.01 
                        ? 'text-green-600' 
                        : 'text-red-600'
                    }`}>
                      <strong>Écart:</strong> {(parseFloat(form.watch("blAmount") || "0") - parseFloat(form.watch("invoiceAmount") || "0")).toFixed(2)} €
                    </p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end space-x-3 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowReconciliationModal(false)}
                  disabled={updateReconciliationMutation.isPending}
                >
                  Annuler
                </Button>
                <Button 
                  type="submit"
                  disabled={updateReconciliationMutation.isPending}
                >
                  {updateReconciliationMutation.isPending ? "Enregistrement..." : "Enregistrer"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Modal de confirmation de suppression */}
      <ConfirmDeleteModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setDeliveryToDelete(null);
        }}
        onConfirm={confirmDeleteDelivery}
        title="Supprimer la livraison"
        description="Êtes-vous sûr de vouloir supprimer cette livraison du module rapprochement ?"
        itemName={deliveryToDelete ? `${deliveryToDelete.supplier?.name} - BL ${deliveryToDelete.blNumber}` : undefined}
        isLoading={deleteDeliveryMutation.isPending}
      />
    </div>
  );
}