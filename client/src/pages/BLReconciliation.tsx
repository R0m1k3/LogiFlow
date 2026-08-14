import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { safeFormat } from "@/lib/dateUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useStore } from "@/contexts/StoreContext";
import { useAuthUnified } from "@/hooks/useAuthUnified";
import { usePermissions } from "@shared/permissions";
import { Pagination, usePagination } from "@/components/ui/pagination";
import { Search, Edit, FileText, Settings, Eye, AlertTriangle, X, Check, Trash2, Ban, Filter, Upload, CheckCircle, XCircle, Clock, MessageSquare, Mail } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import ReconciliationComments from "@/components/ReconciliationComments";
import ReconciliationModal from "@/components/modals/ReconciliationModal";

export default function BLReconciliation() {
  const { user } = useAuthUnified();
  const { selectedStoreId } = useStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const permissions = usePermissions(user?.role);
  
  // Redirection pour les employés
  if (user?.role === 'employee') {
    return (
      <div className="p-4 sm:p-6">
        <div className="bg-orange-50 border-l-4 border-orange-400 p-4 rounded-r-lg">
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
  
  const [activeTab, setActiveTab] = useState("manual");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDelivery, setSelectedDelivery] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // État pour le modal d'envoi de facture
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [selectedDeliveryForInvoice, setSelectedDeliveryForInvoice] = useState<any>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // État pour le modal d'attente du webhook
  const [showWaitingModal, setShowWaitingModal] = useState(false);
  const [processingSeconds, setProcessingSeconds] = useState(0);
  const [processingTimeout, setProcessingTimeout] = useState<NodeJS.Timeout | null>(null);
  
  // État pour le système de vérification de facture
  const [verificationResults, setVerificationResults] = useState<Record<number, any>>({});
  const [verifyingDeliveries, setVerifyingDeliveries] = useState<Set<number>>(new Set());
  // Livraisons dont le mail fournisseur est en cours d'envoi
  const [sendingMailDeliveries, setSendingMailDeliveries] = useState<Set<number>>(new Set());

  // État pour le modal de commentaire
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [selectedDeliveryForComment, setSelectedDeliveryForComment] = useState<any>(null);

  // Récupérer les fournisseurs pour la logique automatique
  const { data: suppliers = [] } = useQuery<any[]>({
    queryKey: ['/api/suppliers'],
  });

  // ---------------------------------------------------------------------------
  // File d'attente des vérifications de facture
  //
  // Sans limite, une page de 200 livraisons déclenchait 200 requêtes simultanées
  // (+ autant de PUT d'auto-remplissage), ce qui saturait le navigateur
  // (net::ERR_INSUFFICIENT_RESOURCES). On limite donc le nombre de requêtes en
  // vol et on dédoublonne les livraisons déjà en attente.
  // ---------------------------------------------------------------------------
  const MAX_CONCURRENT_VERIFICATIONS = 3;
  const verificationQueueRef = useRef<Array<{ delivery: any; forceRefresh: boolean; silent: boolean }>>([]);
  const activeVerificationsRef = useRef(0);
  // Livraisons en file d'attente ou en cours (dédoublonnage synchrone)
  const pendingVerificationIdsRef = useRef<Set<number>>(new Set());
  // Livraisons déjà vérifiées automatiquement : jamais relancées par l'effet
  const autoRequestedIdsRef = useRef<Set<number>>(new Set());
  // Invalidation de cache différée : une seule fois quand la file est vidée
  const needsCacheInvalidationRef = useRef(false);

  // Fonction de vérification de facture
  const verifyInvoiceMutation = useMutation({
    mutationFn: async ({ deliveryId, invoiceReference, blNumber, forceRefresh }: { deliveryId: number; invoiceReference?: string; blNumber?: string; forceRefresh?: boolean; silent?: boolean }) => {
      try {
        const result = await apiRequest(`/api/deliveries/${deliveryId}/verify-invoice`, 'POST', { 
          invoiceReference, 
          blNumber,
          forceRefresh: forceRefresh || false
        });
        return result;
      } catch (error: any) {
        console.error('Erreur API vérification:', error);
        throw new Error(error.message || 'Erreur de vérification');
      }
    },
    onSuccess: (result, variables) => {
      setVerificationResults(prev => ({
        ...prev,
        [variables.deliveryId]: result
      }));
      
      // Pas de toast - affichage silencieux des coches vertes/rouges
      
      // Auto-remplissage si facture trouvée (référence facture OU numéro BL)
      if (result.exists) {
        console.log('🔍 DEBUG - Résultat complet de vérification:', {
          deliveryId: variables.deliveryId,
          exists: result.exists,
          matchType: result.matchType,
          invoiceReference: result.invoiceReference,
          invoiceAmount: result.invoiceAmount,
          dueDate: result.dueDate,
          hasInvoiceRef: !!result.invoiceReference,
          hasAmount: result.invoiceAmount !== undefined && result.invoiceAmount !== null,
          hasDueDate: !!result.dueDate
        });
        
        // Auto-remplir les champs dans la livraison via API
        const updateData: any = {};
        
        // Ajouter la référence de facture SEULEMENT si trouvée via BL (pas déjà renseignée)
        if (result.invoiceReference && result.matchType === 'bl_number') {
          updateData.invoiceReference = result.invoiceReference;
          console.log('✅ Ajout invoiceReference:', result.invoiceReference);
        } else {
          console.log('⚠️ Pas d\'ajout invoiceReference:', { hasRef: !!result.invoiceReference, matchType: result.matchType });
        }
        
        // TOUJOURS mettre à jour le montant si disponible (peu importe le matchType)
        if (result.invoiceAmount !== undefined && result.invoiceAmount !== null) {
          updateData.invoiceAmount = result.invoiceAmount;
          console.log('✅ Ajout invoiceAmount:', result.invoiceAmount);
        } else {
          console.log('⚠️ Pas d\'ajout invoiceAmount:', { amount: result.invoiceAmount });
        }
        
        // TOUJOURS mettre à jour la date d'échéance si disponible (peu importe le matchType)
        if (result.dueDate) {
          updateData.dueDate = result.dueDate;
          console.log('✅ Ajout dueDate:', result.dueDate);
        } else {
          console.log('⚠️ Pas d\'ajout dueDate:', { dueDate: result.dueDate });
        }
        
        console.log('📝 Données finales à sauvegarder:', { deliveryId: variables.deliveryId, updateData, matchType: result.matchType });
        
        // Ne faire l'appel que si on a des données à mettre à jour
        if (Object.keys(updateData).length > 0) {
          apiRequest(`/api/deliveries/${variables.deliveryId}`, "PUT", updateData)
            .then(() => {
              console.log('✅ Données sauvegardées avec succès');
              // Invalidation différée : sinon chaque auto-remplissage relance un
              // refetch complet de la liste, qui relance l'effet, qui relance des
              // vérifications... jusqu'à saturer le navigateur.
              needsCacheInvalidationRef.current = true;
            })
            .catch((error) => {
              console.error('❌ Erreur auto-remplissage:', error);
            });
        } else {
          console.log('⚠️ Aucune donnée à sauvegarder');
        }
      }
      
      setVerifyingDeliveries(prev => {
        const newSet = new Set(prev);
        newSet.delete(variables.deliveryId);
        return newSet;
      });
    },
    onError: (error, variables) => {
      console.error('Erreur vérification facture:', error);
      setVerificationResults(prev => ({
        ...prev,
        [variables.deliveryId]: {
          exists: false,
          matchType: 'none',
          errorMessage: error instanceof Error ? error.message : 'Erreur inconnue'
        }
      }));
      
      setVerifyingDeliveries(prev => {
        const newSet = new Set(prev);
        newSet.delete(variables.deliveryId);
        return newSet;
      });
      
      // Les vérifications automatiques restent silencieuses (coche rouge) :
      // sinon une panne réseau génère autant de toasts que de lignes affichées.
      if (!variables.silent) {
        toast({
          title: "Erreur de vérification",
          description: error instanceof Error ? error.message : 'Erreur inconnue',
          variant: "destructive",
        });
      }
    }
  });


  // Dépile la file d'attente en respectant la limite de requêtes simultanées
  const drainVerificationQueue = () => {
    while (
      activeVerificationsRef.current < MAX_CONCURRENT_VERIFICATIONS &&
      verificationQueueRef.current.length > 0
    ) {
      const next = verificationQueueRef.current.shift();
      if (!next) break;

      const { delivery, forceRefresh, silent } = next;
      activeVerificationsRef.current += 1;

      if (import.meta.env.DEV) {
        console.log('🔍 Déclenchement vérification:', {
          deliveryId: delivery.id,
          invoiceReference: delivery.invoiceReference,
          blNumber: delivery.blNumber,
          supplier: delivery.supplier?.name,
          enAttente: verificationQueueRef.current.length
        });
      }

      verifyInvoiceMutation
        .mutateAsync({
          deliveryId: delivery.id,
          invoiceReference: delivery.invoiceReference,
          blNumber: delivery.blNumber,
          forceRefresh,
          silent
        })
        // Les erreurs sont déjà tracées et affichées par onError
        .catch(() => undefined)
        .finally(() => {
          activeVerificationsRef.current -= 1;
          pendingVerificationIdsRef.current.delete(delivery.id);
          drainVerificationQueue();

          // File vidée : on rafraîchit la liste une seule fois
          if (
            activeVerificationsRef.current === 0 &&
            verificationQueueRef.current.length === 0 &&
            needsCacheInvalidationRef.current
          ) {
            needsCacheInvalidationRef.current = false;
            queryClient.invalidateQueries({ queryKey: ['/api/deliveries/bl'] });
            queryClient.invalidateQueries({ queryKey: ['/api/deliveries'] });
          }
        });
    }
  };

  // Fonction pour déclencher la vérification (mise en file d'attente)
  // silent = déclenchement automatique : aucun toast, seules les coches parlent
  const handleVerifyInvoice = (
    delivery: any,
    forceRefresh: boolean = false,
    silent: boolean = false
  ) => {
    // Accepter soit une référence de facture soit un numéro BL
    const hasInvoiceRef = delivery.invoiceReference?.trim();
    const hasBlNumber = delivery.blNumber?.trim();

    if (!hasInvoiceRef && !hasBlNumber) {
      if (!silent) {
        toast({
          title: "Référence manquante",
          description: "Veuillez saisir une référence de facture ou un numéro BL avant la vérification",
          variant: "destructive",
        });
      }
      return;
    }

    if (!delivery.group?.nocodbTableName && !delivery.group?.nocodbConfigId && !delivery.group?.webhookUrl) {
      if (!silent) {
        toast({
          title: "Vérification non disponible",
          description: "Ce magasin n'a pas de configuration NocoDB",
          variant: "destructive",
        });
      }
      return;
    }

    // Déjà en file d'attente ou en cours : on ne l'ajoute pas une seconde fois
    if (pendingVerificationIdsRef.current.has(delivery.id)) {
      return;
    }

    pendingVerificationIdsRef.current.add(delivery.id);
    verificationQueueRef.current.push({ delivery, forceRefresh, silent });
    setVerifyingDeliveries(prev => new Set(prev).add(delivery.id));

    drainVerificationQueue();
  };

  // Fonction pour vérifier toutes les factures avec un bouton
  const handleVerifyAllInvoices = () => {
    const deliveriesToVerify = manualNotValidatedDeliveries.filter((delivery: any) => 
      (delivery.invoiceReference?.trim() || delivery.blNumber?.trim()) && 
      (delivery.group?.nocodbTableName || delivery.group?.nocodbConfigId || delivery.group?.webhookUrl)
    );

    if (deliveriesToVerify.length === 0) {
      toast({
        title: "Aucune facture à vérifier",
        description: "Aucune livraison avec référence de facture ou numéro BL trouvée",
      });
      return;
    }

    // La file d'attente limite déjà le nombre de requêtes simultanées :
    // on peut tout empiler d'un coup sans surcharger le navigateur.
    deliveriesToVerify.forEach((delivery: any) => {
      handleVerifyInvoice(delivery, true); // Force refresh pour toutes
    });

    toast({
      title: "Vérification lancée",
      description: `Vérification de ${deliveriesToVerify.length} facture(s)/BL en cours...`,
    });
  };

  // Récupérer les livraisons validées avec BL - CACHE INVALIDÉ après modifications
  const { data: deliveriesWithBL = [], isLoading, refetch } = useQuery({
    queryKey: ['/api/deliveries/bl', selectedStoreId],
    queryFn: async () => {
      const params = new URLSearchParams({});
      if (selectedStoreId && (user?.role === 'admin' || user?.role === 'directeur')) {
        params.append('storeId', selectedStoreId.toString());
      }
      
      const response = await fetch(`/api/deliveries?${params.toString()}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch deliveries');
      }
      
      const deliveries = await response.json();
      
      // Debug désactivé en production pour éviter latence
      if (import.meta.env.DEV && deliveries[0]) {
        console.log('🔍 DEBUG - Première livraison:', deliveries[0]);
      }
      const filtered = Array.isArray(deliveries) ? deliveries.filter((d: any) => d.status === 'delivered') : [];
      
      return filtered.sort((a: any, b: any) => new Date(b.deliveredDate || b.updatedAt).getTime() - new Date(a.deliveredDate || a.updatedAt).getTime());
    },
    enabled: !!user,
    staleTime: 0 // Éviter la mise en cache pour toujours avoir les dernières données BL
  });

  // VÉRIFICATION AUTOMATIQUE AU CHARGEMENT avec système de cache
  //
  // Cet effet ne dépend QUE des données (livraisons + fournisseurs) : y ajouter
  // verificationResults/verifyingDeliveries le relançait à chaque résultat reçu,
  // ce qui reprogrammait en boucle les mêmes vérifications.
  // Le dédoublonnage s'appuie sur autoRequestedIdsRef (ref, pas state) pour être
  // effectif immédiatement, sans attendre un re-rendu.
  useEffect(() => {
    if (!deliveriesWithBL.length || !suppliers.length) return;

    if (import.meta.env.DEV) {
      console.log('🔄 Déclenchement vérifications automatiques...');
    }

    // Résultats déduits localement (sans appel réseau) pour afficher les coches
    const cachedResults: Record<number, any> = {};

    deliveriesWithBL.forEach((delivery: any) => {
      const hasVerifiableData = delivery.invoiceReference || delivery.blNumber;

      if (delivery.reconciled) {
        // Livraison déjà réconciliée → coche verte sans vérification
        cachedResults[delivery.id] = {
          exists: true,
          matchType: delivery.invoiceReference ? 'invoice_reference' : 'bl_number',
          fromCache: true,
          permanent: true,
          reconciled: true
        };

        // CAS SPÉCIAL : réconciliée mais cellules vides → auto-remplissage (une seule fois)
        const hasEmptyCells = !delivery.invoiceReference || !delivery.invoiceAmount || !delivery.dueDate;
        const hasBLNumber = delivery.blNumber?.trim();

        if (hasEmptyCells && hasBLNumber && !autoRequestedIdsRef.current.has(delivery.id)) {
          autoRequestedIdsRef.current.add(delivery.id);
          handleVerifyInvoice(delivery, false, true);
        }
        return;
      }

      // Facture déjà trouvée (montant renseigné) → coche verte sans appel réseau
      if (hasVerifiableData && delivery.invoiceAmount) {
        cachedResults[delivery.id] = {
          exists: true,
          matchType: delivery.invoiceReference ? 'invoice_reference' : 'bl_number',
          fromCache: true,
          permanent: true,
          invoiceAmount: delivery.invoiceAmount
        };
        return;
      }

      // Sinon : vérification réseau, une seule fois par livraison
      if (hasVerifiableData && !autoRequestedIdsRef.current.has(delivery.id)) {
        autoRequestedIdsRef.current.add(delivery.id);
        handleVerifyInvoice(delivery, false, true);
      }
    });

    // Application des résultats déduits, sans écraser ceux déjà obtenus
    setVerificationResults(prev => {
      const merged = { ...prev };
      let changed = false;

      Object.entries(cachedResults).forEach(([id, result]) => {
        if (!merged[Number(id)]) {
          merged[Number(id)] = result;
          changed = true;
        }
      });

      return changed ? merged : prev;
    });
  }, [deliveriesWithBL, suppliers]);

  // Séparer les livraisons : non validées manuelles et toutes les validées
  const manualNotValidatedDeliveries = deliveriesWithBL.filter((delivery: any) => {
    const supplier = suppliers.find(s => s.id === delivery.supplierId);
    const isManual = supplier?.automaticReconciliation !== true;
    const isNotValidated = delivery.reconciled !== true && delivery.reconciled !== 1;
    return isManual && isNotValidated;
  });

  const allValidatedDeliveries = deliveriesWithBL.filter((delivery: any) => {
    return delivery.reconciled === true || delivery.reconciled === 1;
  });

  // Fonctions de gestion
  const handleOpenModal = (delivery: any) => {
    setSelectedDelivery(delivery);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setSelectedDelivery(null);
    setIsModalOpen(false);
  };

  const handleSaveReconciliation = async () => {
    try {
      // Force refetch immédiat pour mettre à jour l'affichage
      await queryClient.refetchQueries({ queryKey: ['/api/deliveries/bl'] });
      await queryClient.refetchQueries({ queryKey: ['/api/deliveries'] });
      handleCloseModal();
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour les données",
        variant: "destructive",
      });
    }
  };

  // Nouvelles fonctions pour le modal d'envoi de facture
  const handleOpenInvoiceModal = (delivery: any) => {
    setSelectedDeliveryForInvoice(delivery);
    setSelectedFile(null);
    setShowInvoiceModal(true);
  };

  // Fonctions pour le modal de commentaire
  const handleOpenCommentModal = (delivery: any) => {
    setSelectedDeliveryForComment(delivery);
    setShowCommentModal(true);
  };

  const handleCloseCommentModal = () => {
    setShowCommentModal(false);
    setSelectedDeliveryForComment(null);
  };

  const handleCloseInvoiceModal = () => {
    setShowInvoiceModal(false);
    setSelectedDeliveryForInvoice(null);
    setSelectedFile(null);
    setIsUploading(false);
  };

  const handleCloseWaitingModal = () => {
    setShowWaitingModal(false);
    setProcessingSeconds(0);
    if (processingTimeout) {
      clearTimeout(processingTimeout);
      setProcessingTimeout(null);
    }
  };

  const startProcessingTimer = () => {
    setProcessingSeconds(0);
    const interval = setInterval(() => {
      setProcessingSeconds(prev => {
        if (prev >= 60) {
          clearInterval(interval);
          return 60;
        }
        return prev + 1;
      });
    }, 1000);
    setProcessingTimeout(interval);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
    } else {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner un fichier PDF",
        variant: "destructive",
      });
    }
  };

  const handleSendInvoice = async () => {
    if (!selectedDeliveryForInvoice || !selectedFile) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner un fichier PDF",
        variant: "destructive",
      });
      return;
    }

    if (!selectedDeliveryForInvoice.group?.webhookUrl) {
      toast({
        title: "Erreur",
        description: "Aucun webhook configuré pour ce magasin",
        variant: "destructive",
      });
      return;
    }

    // Fermer le modal de sélection et ouvrir le modal d'attente
    setShowInvoiceModal(false);
    setShowWaitingModal(true);
    setIsUploading(true);
    startProcessingTimer();

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('webhookUrl', selectedDeliveryForInvoice.group.webhookUrl);
      formData.append('supplier', selectedDeliveryForInvoice.supplier?.name || '');
      formData.append('blNumber', selectedDeliveryForInvoice.blNumber || '');
      formData.append('type', 'Facture');

      // Envoyer via route backend proxy (résout problèmes CORS)
      const response = await fetch('/api/reconciliation/send-invoice', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erreur inconnue' }));
        throw new Error(errorData.error || `Erreur ${response.status}`);
      }

      handleCloseWaitingModal();
      
      toast({
        title: "Succès",
        description: "Facture traitée avec succès via le webhook",
      });

      // Reset des données
      setSelectedDeliveryForInvoice(null);
      setSelectedFile(null);

      // Relancer la vérification de la facture qui vient d'être traitée
      try {
        // Invalidation des caches pour forcer le rechargement des données
        queryClient.invalidateQueries({ queryKey: ['/api/deliveries/bl'] });
        queryClient.invalidateQueries({ queryKey: ['/api/deliveries'] });
        
        // Recharger les données
        await refetch();
        
        // Attendre un peu que les données soient à jour, puis vérifier cette livraison spécifique
        setTimeout(() => {
          handleVerifyInvoice(selectedDeliveryForInvoice, true);
        }, 1000);
        
        console.log('🔄 Vérification automatique relancée pour la livraison traitée par webhook');
      } catch (error) {
        console.error('Erreur lors de la relance de la vérification:', error);
      }
      
    } catch (error: any) {
      handleCloseWaitingModal();
      
      let errorMessage = "Impossible d'envoyer la facture";
      if (error.name === 'AbortError') {
        errorMessage = "Le traitement a pris trop de temps (timeout de 60 secondes)";
      } else if (error.message) {
        errorMessage = `Impossible d'envoyer la facture: ${error.message}`;
      }
      
      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive",
      });
      
      // Réouvrir le modal de sélection en cas d'erreur
      setShowInvoiceModal(true);
    } finally {
      setIsUploading(false);
    }
  };

  // Fonction pour déterminer si le bouton "Envoyer Facture" doit être affiché
  const shouldShowInvoiceButton = (delivery: any) => {
    // Conditions : ligne non validée OU pas de RefFacture renseignée
    const isNotValidated = !delivery.reconciled;
    const hasNoInvoiceReference = !delivery.invoiceReference;
    
    // Et il faut qu'il y ait un magasin assigné avec un webhook
    const hasValidGroup = delivery.group && delivery.group.webhookUrl;
    
    // Debug uniquement en développement
    if (import.meta.env.DEV && delivery && delivery.supplier?.name) {
      console.log(`🔍 Debug bouton facture pour ${delivery.supplier.name}:`, {
        isNotValidated,
        hasNoInvoiceReference,
        hasValidGroup,
        shouldShow: (isNotValidated || hasNoInvoiceReference) && hasValidGroup
      });
    }
    
    return (isNotValidated || hasNoInvoiceReference) && hasValidGroup;
  };

  // Email du fournisseur : donnée jointe à la livraison, avec repli sur la liste des fournisseurs
  const getSupplierEmail = (delivery: any): string => {
    const fromDelivery = delivery?.supplier?.email;
    if (fromDelivery && String(fromDelivery).trim()) {
      return String(fromDelivery).trim();
    }

    const supplier = suppliers.find((s: any) => s.id === delivery?.supplierId);
    return supplier?.email ? String(supplier.email).trim() : '';
  };

  // Envoi de la demande de facture (PDF) / BL (Excel) au fournisseur.
  // Le mail part du serveur SMTP configuré sur la fiche du magasin.
  const sendSupplierMailMutation = useMutation({
    mutationFn: async (delivery: any) => {
      return await apiRequest(`/api/deliveries/${delivery.id}/send-supplier-mail`, 'POST');
    },
    onSuccess: (result: any) => {
      toast({
        title: "Mail envoyé",
        description: `Demande envoyée à ${result?.supplierName || 'le fournisseur'} (${result?.sentTo})`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Envoi impossible",
        description: error?.message || "Le mail n'a pas pu être envoyé",
        variant: "destructive",
      });
    },
    onSettled: (_result, _error, delivery: any) => {
      setSendingMailDeliveries(prev => {
        const next = new Set(prev);
        next.delete(delivery.id);
        return next;
      });
    },
  });

  const handleRequestDocumentsByEmail = (delivery: any) => {
    const supplierEmail = getSupplierEmail(delivery);

    if (!supplierEmail) {
      toast({
        title: "Email fournisseur manquant",
        description: `Aucune adresse email renseignée pour ${delivery.supplier?.name || 'ce fournisseur'}. Ajoutez-la depuis la page Contacts ou Fournisseurs.`,
        variant: "destructive",
      });
      return;
    }

    // Envoi direct : on bloque la ligne le temps de la requête pour éviter
    // qu'un double clic ne déclenche deux mails au même fournisseur.
    if (sendingMailDeliveries.has(delivery.id)) return;

    setSendingMailDeliveries(prev => new Set(prev).add(delivery.id));
    sendSupplierMailMutation.mutate(delivery);
  };

  const handleQuickValidate = async (delivery: any) => {
    try {
      await apiRequest(`/api/deliveries/${delivery.id}`, "PUT", {
        reconciled: true,
        validatedAt: new Date().toISOString()
      });
      
      toast({
        title: "Succès",
        description: "Rapprochement validé avec succès",
      });
      
      // Mise à jour optimiste du cache local pour disparition immédiate
      queryClient.setQueryData(['/api/deliveries/bl', selectedStoreId], (oldData: any) => {
        if (!oldData) return oldData;
        return oldData.map((d: any) => 
          d.id === delivery.id 
            ? { ...d, reconciled: true, validatedAt: new Date().toISOString() }
            : d
        );
      });
      
      // Force refetch pour synchroniser avec le serveur
      queryClient.refetchQueries({ queryKey: ['/api/deliveries/bl'] });
      queryClient.refetchQueries({ queryKey: ['/api/deliveries'] });
    } catch (error) {
      // En cas d'erreur, refetch pour annuler la mise à jour optimiste
      queryClient.refetchQueries({ queryKey: ['/api/deliveries/bl'] });
      toast({
        title: "Erreur",
        description: "Impossible de valider le rapprochement",
        variant: "destructive",
      });
    }
  };

  const handleDevalidateReconciliation = async (deliveryId: number) => {
    if (!permissions.canEdit('reconciliation') && !permissions.canValidate('reconciliation')) {
      toast({
        title: "Accès refusé",
        description: "Vous n'avez pas les permissions nécessaires pour dévalider les rapprochements",
        variant: "destructive",
      });
      return;
    }

    if (!window.confirm("Êtes-vous sûr de vouloir dévalider ce rapprochement ?")) {
      return;
    }

    try {
      await apiRequest(`/api/deliveries/${deliveryId}`, "PUT", {
        reconciled: false,
        validatedAt: null
      });
      
      toast({
        title: "Succès",
        description: "Rapprochement dévalidé avec succès",
      });
      
      // Force refetch immédiat pour déplacer la facture dans l'onglet manuel
      await queryClient.refetchQueries({ queryKey: ['/api/deliveries/bl'] });
      await queryClient.refetchQueries({ queryKey: ['/api/deliveries'] });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de dévalider le rapprochement",
        variant: "destructive",
      });
    }
  };

  const handleDeleteDelivery = async (deliveryId: number) => {
    if (!permissions.canDelete('reconciliation')) {
      toast({
        title: "Accès refusé",
        description: "Seuls les administrateurs peuvent supprimer les livraisons",
        variant: "destructive",
      });
      return;
    }

    if (!window.confirm("Êtes-vous sûr de vouloir supprimer cette livraison ? Cette action est irréversible.")) {
      return;
    }

    try {
      await apiRequest(`/api/deliveries/${deliveryId}`, "DELETE");
      
      toast({
        title: "Succès",
        description: "Livraison supprimée avec succès",
      });
      
      // Mise à jour optimiste du cache local pour disparition immédiate
      queryClient.setQueryData(['/api/deliveries/bl', selectedStoreId], (oldData: any) => {
        if (!oldData) return oldData;
        return oldData.filter((d: any) => d.id !== deliveryId);
      });
      
      // Force refetch pour synchroniser avec le serveur
      queryClient.refetchQueries({ queryKey: ['/api/deliveries/bl'] });
      queryClient.refetchQueries({ queryKey: ['/api/deliveries'] });
    } catch (error) {
      // En cas d'erreur, refetch pour annuler la mise à jour optimiste
      queryClient.refetchQueries({ queryKey: ['/api/deliveries/bl'] });
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la livraison",
        variant: "destructive",
      });
    }
  };

  // Filtrage des livraisons par recherche uniquement
  const filterDeliveries = (deliveries: any[]) => {
    if (!searchTerm) return deliveries;
    
    const searchLower = searchTerm.toLowerCase();
    return deliveries.filter((delivery: any) => {
      return (
        delivery.supplier?.name?.toLowerCase().includes(searchLower) ||
        delivery.blNumber?.toLowerCase().includes(searchLower) ||
        delivery.invoiceReference?.toLowerCase().includes(searchLower) ||
        delivery.group?.name?.toLowerCase().includes(searchLower)
      );
    });
  };

  const filteredManualDeliveries = filterDeliveries(manualNotValidatedDeliveries);
  const filteredValidatedDeliveries = filterDeliveries(allValidatedDeliveries);

  // Pagination pour les rapprochements manuels
  const {
    currentPage: manualCurrentPage,
    setCurrentPage: setManualCurrentPage,
    itemsPerPage: manualItemsPerPage,
    setItemsPerPage: setManualItemsPerPage,
    totalPages: manualTotalPages,
    paginatedData: paginatedManualDeliveries,
    totalItems: manualTotalItems
  } = usePagination(filteredManualDeliveries, 20);

  // Pagination pour les livraisons validées
  const {
    currentPage: validatedCurrentPage,
    setCurrentPage: setValidatedCurrentPage,
    itemsPerPage: validatedItemsPerPage,
    setItemsPerPage: setValidatedItemsPerPage,
    totalPages: validatedTotalPages,
    paginatedData: paginatedValidatedDeliveries,
    totalItems: validatedTotalItems
  } = usePagination(filteredValidatedDeliveries, 20);

  const canModify = user?.role === 'directeur' || user?.role === 'admin';

  if (isLoading) {
    return <div className="flex justify-center items-center h-64">Chargement...</div>;
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4 sm:p-6 shadow-sm -m-4 sm:-m-6 mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 flex items-center">
              <FileText className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3 text-blue-600" />
              Rapprochement BL/Factures
            </h2>
            <p className="text-gray-600 mt-1 text-sm sm:text-base">
              Gestion des rapprochements manuels et automatiques
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            <Badge variant="outline" className="text-xs sm:text-sm border border-gray-300">
              {manualNotValidatedDeliveries.length} à traiter
            </Badge>
            <Badge variant="outline" className="text-xs sm:text-sm border border-gray-300 bg-green-50">
              {allValidatedDeliveries.length} validées
            </Badge>
            <Button
              onClick={handleVerifyAllInvoices}
              variant="outline"
              size="sm"
              className="text-xs sm:text-sm bg-green-50 border-green-300 text-green-700 hover:bg-green-100"
            >
              <Search className="w-4 h-4 mr-1" />
              Vérifier toutes les factures
            </Button>
          </div>
        </div>

        {/* Onglets */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="manual" className="flex items-center space-x-2">
              <Edit className="w-4 h-4" />
              <span>Rapprochement Manuel</span>
              <Badge variant="secondary" className="ml-2">
                {manualNotValidatedDeliveries.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="validated" className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4" />
              <span>Livraisons Validées</span>
              <Badge variant="secondary" className="ml-2">
                {allValidatedDeliveries.length}
              </Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Barre de recherche */}
      <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Rechercher par fournisseur, BL, facture ou magasin..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 border border-gray-300 shadow-sm w-full"
          />
        </div>
      </div>

      {/* Contenu des onglets */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsContent value="manual" className="space-y-6">
          {filteredManualDeliveries.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Aucun rapprochement manuel trouvé
              </h3>
              <p className="text-gray-600">
                Les livraisons de fournisseurs en mode manuel apparaîtront ici.
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              <div className="bg-white border border-gray-200 shadow-lg overflow-hidden">
                {/* Pagination du haut */}
                <div className="p-4 border-b border-gray-200">
                  <Pagination
                    currentPage={manualCurrentPage}
                    totalPages={manualTotalPages}
                    totalItems={manualTotalItems}
                    itemsPerPage={manualItemsPerPage}
                    onPageChange={setManualCurrentPage}
                    onItemsPerPageChange={setManualItemsPerPage}
                  />
                </div>
                
                <div className="table-container">
                  <table className="w-full min-w-[900px]">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Fournisseur
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          N° BL
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date Livr.
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Montant BL
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Ref. Facture
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Montant Fact.
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Échéance
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Écart
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Magasin
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {paginatedManualDeliveries.map((delivery: any) => (
                        <tr 
                          key={delivery.id} 
                          className={`hover:bg-gray-50 ${
                            delivery.reconciled === true 
                              ? 'bg-gray-100 opacity-60 text-gray-500' 
                              : 'bg-white'
                          }`}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                              <div className={`truncate max-w-32 ${
                                delivery.reconciled !== true 
                                  ? 'font-bold text-gray-900' 
                                  : 'font-medium text-gray-900'
                              }`}>
                                {delivery.supplier?.name}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-sm">
                              <div className={`${
                                delivery.reconciled !== true 
                                  ? 'font-bold text-gray-900' 
                                  : 'text-gray-900'
                              }`}>
                                {delivery.blNumber || (
                                  <span 
                                    className="text-gray-400 italic text-xs hover:text-blue-500 cursor-pointer hover:underline transition-colors"
                                    onClick={() => handleOpenModal(delivery)}
                                    title="Cliquer pour modifier"
                                  >
                                    Non renseigné
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                {safeFormat(delivery.scheduledDate, 'dd/MM/yy')}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className={`text-sm ${delivery.reconciled !== true ? 'font-medium text-gray-900' : 'text-gray-600'}`}>
                                {delivery.blAmount ? 
                                  `${parseFloat(delivery.blAmount).toFixed(2)}€` :
                                  <span 
                                    className="text-gray-400 italic hover:text-blue-500 cursor-pointer hover:underline transition-colors"
                                    onClick={() => handleOpenModal(delivery)}
                                    title="Cliquer pour modifier"
                                  >
                                    Non renseigné
                                  </span>
                                }
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center space-x-2">
                                {/* Icône de vérification de facture */}
                                {(delivery.group?.nocodbTableName || delivery.group?.nocodbConfigId || delivery.group?.webhookUrl) && (
                                  <div className="flex items-center">
                                    {verifyingDeliveries.has(delivery.id) ? (
                                      <Clock className="h-4 w-4 text-blue-500 animate-spin" />
                                    ) : verificationResults[delivery.id] ? (
                                      verificationResults[delivery.id].exists ? (
                                        <CheckCircle className="h-4 w-4 text-green-500 cursor-help" />
                                      ) : (
                                        <XCircle className="h-4 w-4 text-red-500 cursor-help" />
                                      )
                                    ) : (
                                      <button
                                        onClick={() => handleVerifyInvoice(delivery)}
                                        className="h-4 w-4 text-gray-400 hover:text-blue-500 transition-colors"
                                        title="Cliquer pour vérifier la facture"
                                      >
                                        <Search className="h-4 w-4" />
                                      </button>
                                    )}
                                  </div>
                                )}
                                
                                <div className={`text-sm ${delivery.reconciled !== true ? 'font-medium text-gray-900' : 'text-gray-600'}`}>
                                  {delivery.invoiceReference || (
                                    <span 
                                      className="text-gray-400 italic hover:text-blue-500 cursor-pointer hover:underline transition-colors"
                                      onClick={() => handleOpenModal(delivery)}
                                      title="Cliquer pour modifier"
                                    >
                                      Non renseigné
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className={`text-sm ${delivery.reconciled !== true ? 'font-medium text-gray-900' : 'text-gray-600'}`}>
                                {delivery.invoiceAmount ? 
                                  `${parseFloat(delivery.invoiceAmount).toFixed(2)}€` : 
                                  <span 
                                    className="text-gray-400 italic hover:text-blue-500 cursor-pointer hover:underline transition-colors"
                                    onClick={() => handleOpenModal(delivery)}
                                    title="Cliquer pour modifier"
                                  >
                                    Non renseigné
                                  </span>
                                }
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm">
                                {delivery.dueDate ? (
                                  <span className={delivery.reconciled !== true ? 'font-medium text-gray-900' : 'text-gray-600'}>
                                    {safeFormat(delivery.dueDate, 'dd/MM/yyyy')}
                                  </span>
                                ) : (
                                  <span className="text-gray-400 italic text-xs">-</span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              {(() => {
                                const blAmount = delivery.blAmount ? parseFloat(delivery.blAmount) : 0;
                                const invoiceAmount = delivery.invoiceAmount ? parseFloat(delivery.invoiceAmount) : 0;
                                if (blAmount && invoiceAmount) {
                                  const diff = invoiceAmount - blAmount;
                                  const diffAbs = Math.abs(diff);
                                  return (
                                    <div className={`font-medium text-center ${
                                      diff === 0 ? 'text-green-600' : 
                                      diffAbs > 10 ? 'text-red-600' : 'text-orange-600'
                                    }`}>
                                      {diff > 0 ? '+' : ''}{diff.toFixed(2)}€
                                    </div>
                                  );
                                }
                                return <span className="text-gray-400 italic text-xs">-</span>;
                              })()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                {delivery.group?.name}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right">
                              <div className="flex items-center justify-end space-x-2">
                                {(() => {
                                  const supplierEmail = getSupplierEmail(delivery);
                                  const isSending = sendingMailDeliveries.has(delivery.id);
                                  return (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      disabled={isSending}
                                      onClick={() => handleRequestDocumentsByEmail(delivery)}
                                      className={`h-8 w-8 p-0 ${
                                        supplierEmail
                                          ? 'text-blue-600 hover:text-blue-700 border-blue-300'
                                          : 'text-gray-400 hover:text-gray-500'
                                      }`}
                                      title={
                                        isSending
                                          ? "Envoi en cours..."
                                          : supplierEmail
                                            ? `Demander la facture (PDF) ou le BL (Excel) à ${delivery.supplier?.name || 'ce fournisseur'} (${supplierEmail})`
                                            : `Aucune adresse email renseignée pour ${delivery.supplier?.name || 'ce fournisseur'}`
                                      }
                                    >
                                      {isSending ? (
                                        <Clock className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <Mail className="h-4 w-4" />
                                      )}
                                    </Button>
                                  );
                                })()}
                                {shouldShowInvoiceButton(delivery) && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleOpenInvoiceModal(delivery)}
                                    className="h-8 w-8 p-0 text-green-600 hover:text-green-700"
                                    title="Envoyer Facture/Avoir"
                                  >
                                    <Upload className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleOpenCommentModal(delivery)}
                                  className={`h-8 w-8 p-0 ${
                                    delivery.reconciliationCommentsCount && delivery.reconciliationCommentsCount > 0
                                      ? 'text-blue-600 hover:text-blue-700 border-blue-300' 
                                      : 'text-gray-600 hover:text-gray-700'
                                  } ${delivery.reconciled ? 'opacity-70' : ''}`}
                                  title={`Voir/Gérer les commentaires ${
                                    delivery.reconciliationCommentsCount ? `(${delivery.reconciliationCommentsCount})` : ''
                                  }`}
                                >
                                  <MessageSquare className={`h-4 w-4 ${
                                    delivery.reconciliationCommentsCount && delivery.reconciliationCommentsCount > 0
                                      ? 'fill-blue-100' 
                                      : ''
                                  }`} />
                                </Button>
                                {!delivery.reconciled ? (
                                  <>
                                    {permissions.canValidate('reconciliation') && verificationResults[delivery.id]?.exists === true ? (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleQuickValidate(delivery)}
                                        className="h-8 w-8 p-0 text-green-600 hover:text-green-700"
                                        title="Valider le rapprochement (facture vérifiée)"
                                      >
                                        <Check className="w-4 h-4" />
                                      </Button>
                                    ) : permissions.canValidate('reconciliation') && verificationResults[delivery.id]?.exists === false ? (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        disabled
                                        className="h-8 w-8 p-0 text-gray-400 cursor-not-allowed"
                                        title="Validation impossible : la facture n'a pas été trouvée (coche rouge). Vérifiez la référence de facture."
                                      >
                                        <Check className="w-4 h-4" />
                                      </Button>
                                    ) : permissions.canValidate('reconciliation') ? (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        disabled
                                        className="h-8 w-8 p-0 text-gray-400 cursor-not-allowed"
                                        title="Validation impossible : veuillez d'abord vérifier la facture en cliquant sur l'icône de recherche"
                                      >
                                        <Check className="w-4 h-4" />
                                      </Button>
                                    ) : null}
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleOpenModal(delivery)}
                                      className="h-8 w-8 p-0"
                                      title="Modifier les données"
                                    >
                                      <Edit className="w-4 h-4" />
                                    </Button>
                                    {permissions.canDelete('reconciliation') && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleDeleteDelivery(delivery.id)}
                                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                                        title="Supprimer la livraison"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    )}
                                  </>
                                ) : (
                                  <>
                                    {user?.role === 'admin' && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleDevalidateReconciliation(delivery.id)}
                                        className="h-8 w-8 p-0 text-orange-600 hover:text-orange-700"
                                        title="Dévalider le rapprochement"
                                      >
                                        <Ban className="w-4 h-4" />
                                      </Button>
                                    )}
                                    {permissions.canDelete('reconciliation') && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleDeleteDelivery(delivery.id)}
                                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                                        title="Supprimer la livraison"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    )}
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                
                {/* Pagination du bas */}
                <div className="p-4 border-t border-gray-200">
                  <Pagination
                    currentPage={manualCurrentPage}
                    totalPages={manualTotalPages}
                    totalItems={manualTotalItems}
                    itemsPerPage={manualItemsPerPage}
                    onPageChange={setManualCurrentPage}
                    onItemsPerPageChange={setManualItemsPerPage}
                  />
                </div>
              </div>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="validated" className="space-y-6">
          {/* Message d'information */}
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-start space-x-3">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-green-900">Livraisons validées</h4>
                <p className="text-sm text-green-700 mt-1">
                  Cette section regroupe toutes les livraisons validées (manuellement ou automatiquement).
                  {(permissions.canEdit('reconciliation') || permissions.canValidate('reconciliation')) ? (
                    " Vous pouvez dévalider ces rapprochements si nécessaire."
                  ) : (
                    " Seuls les utilisateurs autorisés peuvent dévalider ces rapprochements."
                  )}
                </p>
              </div>
            </div>
          </div>

          {filteredValidatedDeliveries.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Aucune livraison validée trouvée
              </h3>
              <p className="text-gray-600">
                Les livraisons validées apparaîtront ici.
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              <div className="bg-white border border-gray-200 shadow-lg overflow-hidden">
                {/* Pagination du haut */}
                <div className="p-4 border-b border-gray-200">
                  <Pagination
                    currentPage={validatedCurrentPage}
                    totalPages={validatedTotalPages}
                    totalItems={validatedTotalItems}
                    itemsPerPage={validatedItemsPerPage}
                    onPageChange={setValidatedCurrentPage}
                    onItemsPerPageChange={setValidatedItemsPerPage}
                  />
                </div>
                
                <div className="table-container">
                  <table className="w-full min-w-[900px]">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Fournisseur
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          N° BL
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date Livr.
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Ref. Facture
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Montant BL
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Montant Fact.
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Échéance
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Écart
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Magasin
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {paginatedValidatedDeliveries.map((delivery: any) => {
                          const supplier = suppliers.find(s => s.id === delivery.supplierId);
                          const isAutomatic = supplier?.automaticReconciliation === true;
                          const ecart = delivery.blAmount && delivery.invoiceAmount ? 
                            ((parseFloat(delivery.invoiceAmount) - parseFloat(delivery.blAmount)) / parseFloat(delivery.blAmount) * 100).toFixed(1) : 
                            null;
                          
                          // Log pour déboguer le problème des commentaires
                          if (import.meta.env.DEV && delivery.reconciliationCommentsCount) {
                            console.log('🔍 Validated delivery comments:', {
                              deliveryId: delivery.id,
                              commentsCount: delivery.reconciliationCommentsCount,
                              hasComments: delivery.reconciliationCommentsCount > 0
                            });
                          }
                          
                          return (
                            <tr key={delivery.id} className="hover:bg-gray-50 bg-green-50">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center space-x-2">
                                  <div className="font-medium text-gray-900 truncate max-w-32">
                                    {delivery.supplier?.name}
                                  </div>
                                  {isAutomatic && (
                                    <Badge variant="secondary" className="text-xs">AUTO</Badge>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">
                                  {delivery.blNumber || (
                                    <span className="text-gray-400 italic text-xs">Non renseigné</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">
                                  {safeFormat(delivery.scheduledDate, 'dd/MM/yy')}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">
                                  {delivery.invoiceReference || (
                                    <span className="text-gray-400 italic text-xs">Non renseignée</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">
                                  {delivery.blAmount ? 
                                    `${parseFloat(delivery.blAmount).toFixed(2)}€` :
                                    <span className="text-gray-400 italic text-xs">Non renseigné</span>
                                  }
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">
                                  {delivery.invoiceAmount ? 
                                    `${parseFloat(delivery.invoiceAmount).toFixed(2)}€` :
                                    <span className="text-gray-400 italic text-xs">Non renseigné</span>
                                  }
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm">
                                  {delivery.dueDate ? (
                                    <span className="text-gray-900">
                                      {safeFormat(delivery.dueDate, 'dd/MM/yyyy')}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400 italic text-xs">-</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-center">
                                {ecart !== null ? (
                                  <Badge 
                                    variant={parseFloat(ecart) === 0 ? "outline" : Math.abs(parseFloat(ecart)) > 5 ? "destructive" : "secondary"}
                                    className="text-xs"
                                  >
                                    {parseFloat(ecart) > 0 ? '+' : ''}{ecart}%
                                  </Badge>
                                ) : (
                                  <span className="text-gray-400 text-xs">-</span>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">
                                  {delivery.group?.name}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right">
                                <div className="flex items-center justify-end space-x-2">
                                  {(() => {
                                    const supplierEmail = getSupplierEmail(delivery);
                                    const isSending = sendingMailDeliveries.has(delivery.id);
                                    return (
                                      <button
                                        disabled={isSending}
                                        onClick={() => handleRequestDocumentsByEmail(delivery)}
                                        className={`transition-colors duration-200 p-1 rounded opacity-70 ${
                                          supplierEmail
                                            ? 'text-blue-600 hover:text-blue-700 hover:bg-blue-50'
                                            : 'text-gray-400 hover:text-gray-500 hover:bg-gray-50'
                                        }`}
                                        title={
                                          isSending
                                            ? "Envoi en cours..."
                                            : supplierEmail
                                              ? `Demander la facture (PDF) ou le BL (Excel) à ${delivery.supplier?.name || 'ce fournisseur'} (${supplierEmail})`
                                              : `Aucune adresse email renseignée pour ${delivery.supplier?.name || 'ce fournisseur'}`
                                        }
                                      >
                                        {isSending ? (
                                          <Clock className="w-4 h-4 animate-spin" />
                                        ) : (
                                          <Mail className="w-4 h-4" />
                                        )}
                                      </button>
                                    );
                                  })()}
                                  <button
                                    onClick={() => handleOpenCommentModal(delivery)}
                                    className={`transition-colors duration-200 p-1 rounded ${
                                      delivery.reconciliationCommentsCount && delivery.reconciliationCommentsCount > 0
                                        ? 'text-blue-600 hover:text-blue-700 hover:bg-blue-50'
                                        : 'text-gray-600 hover:text-gray-700 hover:bg-gray-50'
                                    } opacity-70`}
                                    title={`Voir/Gérer les commentaires ${
                                      delivery.reconciliationCommentsCount ? `(${delivery.reconciliationCommentsCount})` : ''
                                    }`}
                                  >
                                    <MessageSquare className={`h-4 w-4 ${
                                      delivery.reconciliationCommentsCount && delivery.reconciliationCommentsCount > 0
                                        ? 'fill-blue-200'
                                        : ''
                                    }`} />
                                  </button>
                                  {(permissions.canEdit('reconciliation') || permissions.canValidate('reconciliation')) && (
                                    <button
                                      onClick={() => handleDevalidateReconciliation(delivery.id)}
                                      className="text-gray-600 hover:text-orange-600 transition-colors duration-200 p-1 hover:bg-orange-50 rounded"
                                      title="Dévalider le rapprochement"
                                    >
                                      <Ban className="w-4 h-4" />
                                    </button>
                                  )}
                                  {permissions.canDelete('reconciliation') && (
                                    <button
                                      onClick={() => handleDeleteDelivery(delivery.id)}
                                      className="text-gray-600 hover:text-red-600 transition-colors duration-200 p-1 hover:bg-red-50 rounded"
                                      title="Supprimer la livraison"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleOpenModal(delivery)}
                                    className="text-gray-600 hover:text-blue-600 transition-colors duration-200 p-1 hover:bg-blue-50 rounded"
                                    title="Voir les détails"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                
                {/* Pagination du bas */}
                <div className="p-4 border-t border-gray-200">
                  <Pagination
                    currentPage={validatedCurrentPage}
                    totalPages={validatedTotalPages}
                    totalItems={validatedTotalItems}
                    itemsPerPage={validatedItemsPerPage}
                    onPageChange={setValidatedCurrentPage}
                    onItemsPerPageChange={setValidatedItemsPerPage}
                  />
                </div>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Modal de rapprochement */}
      {selectedDelivery && (
        <ReconciliationModal
          isOpen={isModalOpen}
          delivery={selectedDelivery}
          onSave={handleSaveReconciliation}
          onClose={handleCloseModal}
        />
      )}

      {/* Modal d'envoi de facture */}
      <Dialog open={showInvoiceModal} onOpenChange={setShowInvoiceModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Envoyer Facture</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {selectedDeliveryForInvoice && (
              <div className="bg-gray-50 p-3 rounded-md">
                <div className="text-sm">
                  <div className="font-medium">{selectedDeliveryForInvoice.supplier?.name}</div>
                  <div className="text-gray-600">
                    BL: {selectedDeliveryForInvoice.blNumber || 'Non renseigné'}
                  </div>
                  <div className="text-gray-600">
                    Magasin: {selectedDeliveryForInvoice.group?.name}
                  </div>
                </div>
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="pdf-file">Fichier PDF</Label>
              <input
                id="pdf-file"
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="w-full p-2 border border-gray-300 rounded-md"
              />
              {selectedFile && (
                <div className="text-sm text-green-600">
                  Fichier sélectionné: {selectedFile.name}
                </div>
              )}
            </div>

            {selectedDeliveryForInvoice?.group?.webhookUrl && (
              <div className="text-xs text-gray-500">
                Envoi via: {selectedDeliveryForInvoice.group.webhookUrl}
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseInvoiceModal}>
              Annuler
            </Button>
            <Button 
              onClick={handleSendInvoice}
              disabled={!selectedFile || isUploading}
            >
              {isUploading ? "Envoi..." : "Envoyer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal d'attente pour le traitement du webhook */}
      <Dialog open={showWaitingModal} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-blue-600 animate-spin" />
              <span>Traitement en cours</span>
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-6 py-6">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 relative">
                <div className="w-16 h-16 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-bold text-blue-600">{processingSeconds}s</span>
                </div>
              </div>
              
              <div className="space-y-2">
                <h3 className="font-medium text-gray-900">
                  Traitement de votre facture en cours...
                </h3>
                <p className="text-sm text-gray-600">
                  Le workflow peut prendre jusqu'à 1 minute.
                  <br />
                  Veuillez patienter.
                </p>
              </div>
              
              <div className="mt-4 bg-gray-100 rounded-full h-2 w-full">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${Math.min((processingSeconds / 60) * 100, 100)}%` }}
                ></div>
              </div>
              
              <div className="mt-2 text-xs text-gray-500">
                {processingSeconds < 60 ? `${60 - processingSeconds}s restantes (max)` : 'Finalisation...'}
              </div>
            </div>
            
            {selectedDeliveryForInvoice && (
              <div className="bg-blue-50 p-3 rounded-md">
                <div className="text-sm">
                  <div className="font-medium text-blue-900">
                    {selectedDeliveryForInvoice.supplier?.name}
                  </div>
                  <div className="text-blue-700">
                    BL: {selectedDeliveryForInvoice.blNumber || 'Non renseigné'}
                  </div>
                  <div className="text-blue-700">
                    Fichier: {selectedFile?.name}
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de commentaires de rapprochement */}
      <Dialog open={showCommentModal} onOpenChange={setShowCommentModal}>
        <DialogContent className="sm:max-w-[800px]">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <MessageSquare className="w-5 h-5 text-blue-600" />
              <span>Commentaires de rapprochement</span>
            </DialogTitle>
          </DialogHeader>
          
          {selectedDeliveryForComment && (
            <div className="grid gap-4 py-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-sm font-medium text-gray-900">
                  {selectedDeliveryForComment.supplier?.name}
                </div>
                <div className="text-sm text-gray-600">
                  BL: {selectedDeliveryForComment.blNumber || 'Non renseigné'} | 
                  Facture: {selectedDeliveryForComment.invoiceReference || 'Non renseignée'}
                </div>
                <div className="text-sm text-gray-600">
                  Date prévue: {selectedDeliveryForComment.scheduledDate ? new Date(selectedDeliveryForComment.scheduledDate).toLocaleDateString('fr-FR') : 'Non renseignée'}
                </div>
              </div>
              
              {/* Composant de commentaires de rapprochement */}
              <ReconciliationComments 
                deliveryId={selectedDeliveryForComment.id}
                className="max-h-[400px] overflow-y-auto"
              />
            </div>
          )}
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={handleCloseCommentModal}
            >
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}