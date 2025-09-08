import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, FileText, CheckCircle, AlertCircle, Clock, Edit, Trash2, UserCheck, Send, Upload, XCircle } from "lucide-react";
import { useStore } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

// Types
interface Avoir {
  id: number;
  supplierId: number;
  groupId: number;
  invoiceReference?: string;
  amount?: number;
  comment?: string;
  commercialProcessed: boolean;
  status: 'En attente de demande' | 'Demandé' | 'Reçu';
  webhookSent: boolean;
  nocodbVerified: boolean;
  nocodbVerifiedAt?: Date;
  processedAt?: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  supplier: {
    id: number;
    name: string;
    contact?: string;
  };
  group: {
    id: number;
    name: string;
    color: string;
    nocodbTableName?: string;
    nocodbConfigId?: number;
  };
  creator: {
    id: string;
    firstName?: string;
    lastName?: string;
    username: string;
  };
}

interface Supplier {
  id: number;
  name: string;
}

interface Group {
  id: number;
  name: string;
  color: string;
  nocodbTableName?: string;
  nocodbConfigId?: number;
}

// Schema for form validation
const avoirSchema = z.object({
  supplierId: z.coerce.number().min(1, "Veuillez sélectionner un fournisseur"),
  groupId: z.coerce.number().min(1, "Veuillez sélectionner un magasin"),
  invoiceReference: z.string().optional(),
  amount: z.union([
    z.null().transform(() => undefined),
    z.undefined().transform(() => undefined), 
    z.literal("").transform(() => undefined),
    z.string().transform((val) => {
      const num = parseFloat(val);
      if (isNaN(num)) {
        throw new Error("Montant invalide");
      }
      if (num <= 0) {
        throw new Error("Le montant doit être supérieur à 0");
      }
      return num;
    })
  ]).optional(),
  comment: z.string().optional(),
  commercialProcessed: z.boolean().default(false),
  status: z.enum(["En attente de demande", "Demandé", "Reçu"]).optional(),
});

type AvoirFormData = z.infer<typeof avoirSchema>;

// Type étendu pour les mises à jour incluant les champs de validation
type AvoirUpdateData = AvoirFormData & {
  nocodbVerified?: boolean;
  nocodbVerifiedAt?: Date | null;
};

export default function Avoirs() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedAvoir, setSelectedAvoir] = useState<Avoir | null>(null);
  
  // État pour le modal d'envoi d'avoir
  const [showAvoirModal, setShowAvoirModal] = useState(false);
  const [selectedAvoirForUpload, setSelectedAvoirForUpload] = useState<Avoir | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // État pour le modal d'attente du webhook
  const [showWaitingModal, setShowWaitingModal] = useState(false);
  const [processingSeconds, setProcessingSeconds] = useState(0);
  const [processingTimeout, setProcessingTimeout] = useState<NodeJS.Timeout | null>(null);
  
  // États pour le système de vérification de facture
  const [avoirVerificationResults, setAvoirVerificationResults] = useState<Record<number, any>>({});
  const [verifyingAvoirs, setVerifyingAvoirs] = useState<Set<number>>(new Set());
  // Utiliser le contexte global du magasin
  const { selectedStoreId } = useStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch user profile
  const { data: user } = useQuery({
    queryKey: ['/api/user'],
  });

  // Fetch groups for store filter
  const { data: groups = [] } = useQuery<Group[]>({
    queryKey: ['/api/groups'],
    enabled: !!user,
  });

  // Fetch suppliers
  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ['/api/suppliers'],
    enabled: !!user,
  });

  // Fetch avoirs avec filtrage par groupe (comme Orders/Deliveries)
  const avoirsUrl = `/api/avoirs${selectedStoreId ? `?storeId=${selectedStoreId}` : ''}`;
  const { data: avoirs = [], isLoading } = useQuery<Avoir[]>({
    queryKey: [avoirsUrl, selectedStoreId, (user as any)?.role],
    queryFn: async () => {
      console.log('💰 Fetching avoirs from:', avoirsUrl);
      const response = await fetch(avoirsUrl, { credentials: 'include' });
      if (!response.ok) {
        throw new Error('Failed to fetch avoirs');
      }
      const data = await response.json();
      console.log('💰 Avoirs received:', Array.isArray(data) ? data.length : 'NOT_ARRAY', 'items');
      return Array.isArray(data) ? data : [];
    },
    enabled: !!user,
  });

  // Create avoir mutation
  const createAvoirMutation = useMutation({
    mutationFn: async (data: AvoirFormData) => {
      const response = await fetch('/api/avoirs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to create avoir');
      }
      return response.json();
    },
    onSuccess: () => {
      // ✅ FIX: Invalider toutes les variations de queryKey avoirs
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          return query.queryKey[0]?.toString().includes('/api/avoirs') || false;
        }
      });
      setIsCreateDialogOpen(false);
      toast({
        title: "Avoir créé",
        description: "L'avoir a été créé avec succès.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de la création de l'avoir",
        variant: "destructive",
      });
    }
  });

  // Edit avoir mutation
  const editAvoirMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: AvoirUpdateData }) => {
      const response = await fetch(`/api/avoirs/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to edit avoir');
      }
      return response.json();
    },
    onSuccess: () => {
      // ✅ FIX: Invalider toutes les variations de queryKey avoirs
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          return query.queryKey[0]?.toString().includes('/api/avoirs') || false;
        }
      });
      setIsEditDialogOpen(false);
      setSelectedAvoir(null);
      toast({
        title: "Avoir modifié",
        description: "L'avoir a été modifié avec succès.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de la modification",
        variant: "destructive",
      });
    }
  });

  // Delete avoir mutation
  const deleteAvoirMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/avoirs/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to delete avoir');
      }
      return response.json();
    },
    onSuccess: () => {
      // ✅ FIX: Invalider toutes les variations de queryKey avoirs
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          return query.queryKey[0]?.toString().includes('/api/avoirs') || false;
        }
      });
      setIsDeleteDialogOpen(false);
      setSelectedAvoir(null);
      toast({
        title: "Avoir supprimé",
        description: "L'avoir a été supprimé avec succès.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de la suppression",
        variant: "destructive",
      });
    }
  });

  // Initialize create form
  const form = useForm<AvoirFormData>({
    resolver: zodResolver(avoirSchema),
    defaultValues: {
      supplierId: 0,
      groupId: 0,
      invoiceReference: "",
      amount: undefined,
      comment: "",
      commercialProcessed: false,
      status: "En attente de demande",
    },
  });

  // Initialize edit form
  const editForm = useForm<AvoirFormData>({
    resolver: zodResolver(avoirSchema),
    defaultValues: {
      supplierId: 0,
      groupId: 0,
      invoiceReference: "",
      amount: undefined,
      comment: "",
      commercialProcessed: false,
      status: "En attente de demande",
    },
  });

  // Handle form submission
  const onSubmit = (data: AvoirFormData) => {
    createAvoirMutation.mutate(data);
  };

  // Handle edit form submission
  const onEditSubmit = (data: AvoirFormData) => {
    if (selectedAvoir) {
      console.log('💰 Editing avoir - Form data sent:', {
        originalCommercial: selectedAvoir.commercialProcessed,
        formCommercial: data.commercialProcessed,
        fullData: data
      });
      editAvoirMutation.mutate({ id: selectedAvoir.id, data });
    }
  };

  // Handle edit action
  const handleEdit = (avoir: Avoir) => {
    setSelectedAvoir(avoir);
    editForm.reset({
      supplierId: avoir.supplierId,
      groupId: avoir.groupId,
      invoiceReference: avoir.invoiceReference || "",
      amount: avoir.amount,
      comment: avoir.comment || "",
      commercialProcessed: avoir.commercialProcessed,
      status: avoir.status as "En attente de demande" | "Demandé" | "Reçu",
    });
    setIsEditDialogOpen(true);
  };

  // Handle delete action
  const handleDelete = (avoir: Avoir) => {
    setSelectedAvoir(avoir);
    setIsDeleteDialogOpen(true);
  };

  // Handle status change
  const handleStatusChange = (avoirId: number, newStatus: string) => {
    const avoir = avoirs.find(a => a.id === avoirId);
    if (avoir) {
      editAvoirMutation.mutate({ 
        id: avoirId, 
        data: {
          supplierId: avoir.supplierId,
          groupId: avoir.groupId,
          invoiceReference: avoir.invoiceReference || "",
          amount: avoir.amount,
          comment: avoir.comment || "",
          commercialProcessed: avoir.commercialProcessed,
          status: newStatus as "En attente de demande" | "Demandé" | "Reçu",
        }
      });
    }
  };

  // Handle validation/devalidation
  const handleValidateAvoir = async (avoirId: number) => {
    try {
      // Utiliser la route spécifique pour la vérification NocoDB
      await apiRequest(`/api/avoirs/${avoirId}/nocodb-verification`, 'PUT', {
        verified: true
      });

      // Marquer le cache comme réconcilié (permanent)
      const avoir = avoirs.find(a => a.id === avoirId);
      if (avoir?.invoiceReference) {
        try {
          await apiRequest('/api/cache/mark-reconciled', 'POST', {
            invoiceReference: avoir.invoiceReference,
            groupId: avoir.groupId
          });
        } catch (cacheError) {
          console.warn('Cache marking failed but verification succeeded:', cacheError);
        }
      }

      // Recharger les avoirs pour voir les changements
      queryClient.invalidateQueries({ queryKey: ['/api/avoirs'] });
      
      toast({
        title: "Avoir validé",
        description: "L'avoir a été marqué comme validé avec succès",
      });
    } catch (error) {
      toast({
        title: "Erreur de validation",
        description: error instanceof Error ? error.message : "Erreur lors de la validation",
        variant: "destructive",
      });
    }
  };

  const handleDevalidateAvoir = async (avoirId: number) => {
    try {
      // Utiliser la route spécifique pour la vérification NocoDB
      await apiRequest(`/api/avoirs/${avoirId}/nocodb-verification`, 'PUT', {
        verified: false
      });

      // Recharger les avoirs pour voir les changements
      queryClient.invalidateQueries({ queryKey: ['/api/avoirs'] });
      
      toast({
        title: "Avoir dévalidé",
        description: "L'avoir a été marqué comme non-validé avec succès",
      });
    } catch (error) {
      toast({
        title: "Erreur de dévalidation", 
        description: error instanceof Error ? error.message : "Erreur lors de la dévalidation",
        variant: "destructive",
      });
    }
  };

  // 🔍 FONCTION DE VÉRIFICATION DE FACTURE (comme rapprochement)
  const verifyAvoirInvoiceMutation = useMutation({
    mutationFn: async ({ avoirId, invoiceReference, forceRefresh }: { avoirId: number; invoiceReference?: string; forceRefresh?: boolean }) => {
      try {
        const result = await apiRequest(`/api/avoirs/${avoirId}/verify-invoice`, 'POST', { 
          invoiceReference,
          forceRefresh: forceRefresh || false
        });
        return result;
      } catch (error: any) {
        console.error('Erreur API vérification avoir:', error);
        throw new Error(error.message || 'Erreur de vérification');
      }
    },
    onSuccess: (result, variables) => {
      setAvoirVerificationResults(prev => ({
        ...prev,
        [variables.avoirId]: result
      }));

      // Auto-remplissage si facture trouvée et montant disponible
      if (result?.exists && result?.invoiceAmount !== undefined && result?.invoiceAmount !== null) {
        // Auto-remplir le montant dans l'avoir via API
        const avoir = avoirs?.find(a => a?.id === variables.avoirId);
        if (avoir && avoir.supplierId && avoir.groupId) {
          try {
            editAvoirMutation.mutate({
              id: variables.avoirId,
              data: {
                supplierId: avoir.supplierId,
                groupId: avoir.groupId,
                invoiceReference: avoir.invoiceReference || "",
                amount: result.invoiceAmount, // Auto-remplissage du montant
                comment: avoir.comment || "",
                commercialProcessed: avoir.commercialProcessed || false,
                status: avoir.status as "En attente de demande" | "Demandé" | "Reçu",
              }
            });
          } catch (autoFillError) {
            console.error('Erreur auto-remplissage montant:', autoFillError);
            // Ne pas faire échouer la vérification si l'auto-remplissage échoue
          }
        }
      }
      
      setVerifyingAvoirs(prev => {
        const newSet = new Set(prev);
        newSet.delete(variables.avoirId);
        return newSet;
      });
    },
    onError: (error, variables) => {
      console.error('Erreur vérification facture avoir:', error);
      setAvoirVerificationResults(prev => ({
        ...prev,
        [variables.avoirId]: {
          exists: false,
          matchType: 'none',
          errorMessage: error instanceof Error ? error.message : 'Erreur inconnue'
        }
      }));
      
      setVerifyingAvoirs(prev => {
        const newSet = new Set(prev);
        newSet.delete(variables.avoirId);
        return newSet;
      });
      
      toast({
        title: "Erreur de vérification",
        description: error instanceof Error ? error.message : 'Erreur inconnue',
        variant: "destructive",
      });
    }
  });

  // Fonction pour déclencher la vérification d'un avoir
  const handleVerifyAvoirInvoice = (avoir: Avoir, forceRefresh: boolean = false) => {
    const hasInvoiceRef = avoir.invoiceReference?.trim();
    
    if (!hasInvoiceRef) {
      toast({
        title: "Référence manquante",
        description: "Veuillez saisir une référence de facture avant la vérification",
        variant: "destructive",
      });
      return;
    }

    if (!avoir.group?.nocodbTableName && !avoir.group?.nocodbConfigId) {
      toast({
        title: "Vérification non disponible", 
        description: "Ce magasin n'a pas de configuration NocoDB",
        variant: "destructive",
      });
      return;
    }

    console.log('🔍 Déclenchement vérification avoir:', {
      avoirId: avoir.id,
      invoiceReference: avoir.invoiceReference,
      supplier: avoir.supplier?.name,
      group: avoir.group?.name
    });
    
    setVerifyingAvoirs(prev => new Set(prev).add(avoir.id));
    
    verifyAvoirInvoiceMutation.mutate({
      avoirId: avoir.id,
      invoiceReference: avoir.invoiceReference,
      forceRefresh
    });
  };

  // Fonction pour vérifier tous les avoirs avec une référence facture
  const handleVerifyAllAvoirInvoices = () => {
    const avoirsToVerify = avoirs.filter(avoir => 
      avoir.invoiceReference?.trim() && 
      (avoir.group?.nocodbTableName || avoir.group?.nocodbConfigId)
    );

    if (avoirsToVerify.length === 0) {
      toast({
        title: "Aucun avoir à vérifier",
        description: "Aucun avoir avec référence de facture trouvé",
      });
      return;
    }

    avoirsToVerify.forEach((avoir, index) => {
      // Délai échelonné pour éviter la surcharge
      setTimeout(() => {
        handleVerifyAvoirInvoice(avoir, true); // Force refresh pour tous
      }, index * 200); // 200ms entre chaque vérification
    });

    toast({
      title: "Vérification lancée",
      description: `Vérification de ${avoirsToVerify.length} avoir(s) en cours...`,
    });
  };

  // Charger les résultats de vérification depuis le cache au démarrage
  useEffect(() => {
    const loadVerificationResults = async () => {
      if (!avoirs || avoirs.length === 0) return;

      const avoirsWithReferences = avoirs.filter(avoir => 
        avoir.invoiceReference?.trim() && 
        (avoir.group?.nocodbTableName || avoir.group?.nocodbConfigId)
      );

      if (avoirsWithReferences.length === 0) return;

      console.log(`🔍 Chargement des résultats de vérification pour ${avoirsWithReferences.length} avoirs`);

      // Charger les résultats depuis le cache en parallèle
      const results = await Promise.allSettled(
        avoirsWithReferences.map(async (avoir) => {
          try {
            const result = await apiRequest(`/api/avoirs/${avoir.id}/verify-invoice`, 'POST', { 
              invoiceReference: avoir.invoiceReference,
              forceRefresh: false // Utiliser le cache si disponible
            });
            return { avoirId: avoir.id, result };
          } catch (error) {
            console.error(`Erreur chargement cache avoir ${avoir.id}:`, error);
            return { 
              avoirId: avoir.id, 
              result: { 
                exists: false, 
                matchType: 'none', 
                errorMessage: 'Erreur de chargement' 
              } 
            };
          }
        })
      );

      // Appliquer les résultats chargés
      const newResults: Record<number, any> = {};
      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          const { avoirId, result: verificationResult } = result.value;
          newResults[avoirId] = verificationResult;
        }
      });

      setAvoirVerificationResults(newResults);
      console.log(`✅ Résultats de vérification chargés pour ${Object.keys(newResults).length} avoirs`);
    };

    loadVerificationResults();
  }, [avoirs]); // Se déclenche quand les avoirs sont chargés

  // 🔥 FONCTIONS WEBHOOK MODAL (comme rapprochement)
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

  const handleOpenAvoirModal = (avoir: Avoir) => {
    setSelectedAvoirForUpload(avoir);
    setSelectedFile(null);
    setShowAvoirModal(true);
  };

  const handleCloseAvoirModal = () => {
    setShowAvoirModal(false);
    setSelectedAvoirForUpload(null);
    setSelectedFile(null);
    setIsUploading(false);
  };

  const startProcessingTimer = () => {
    setProcessingSeconds(0);
    const interval = setInterval(() => {
      setProcessingSeconds(prev => prev + 1);
    }, 1000);
    setProcessingTimeout(interval);
  };

  const handleCloseWaitingModal = () => {
    setShowWaitingModal(false);
    setIsUploading(false);
    setProcessingSeconds(0);
    if (processingTimeout) {
      clearInterval(processingTimeout);
      setProcessingTimeout(null);
    }
  };

  const handleSendAvoir = async () => {
    if (!selectedFile || !selectedAvoirForUpload) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner un fichier PDF",
        variant: "destructive",
      });
      return;
    }

    // Utiliser groupe par défaut (1) pour admin si pas de groupe sélectionné
    const groupId = selectedAvoirForUpload.groupId || ((user as any)?.role === 'admin' ? 1 : selectedAvoirForUpload.groupId);
    const groups = await queryClient.fetchQuery({ queryKey: ['/api/groups'] });
    const group = (groups as any[]).find(g => g.id === groupId);
    
    if (!group?.webhookUrl) {
      toast({
        title: "Erreur",
        description: "Aucun webhook configuré pour ce magasin",
        variant: "destructive",
      });
      return;
    }

    // Fermer le modal de sélection et ouvrir le modal d'attente
    setShowAvoirModal(false);
    setShowWaitingModal(true);
    setIsUploading(true);
    startProcessingTimer();

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('supplier', selectedAvoirForUpload.supplier?.name || '');
      formData.append('invoiceReference', selectedAvoirForUpload.invoiceReference || '');
      formData.append('type', 'Avoir');

      // Créer un AbortController pour gérer le timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 secondes

      const response = await fetch(group.webhookUrl, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Erreur ${response.status}: ${response.statusText}`);
      }

      handleCloseWaitingModal();
      
      toast({
        title: "Succès",
        description: "Avoir traité avec succès via le webhook",
      });

      // Vérification automatique de la facture après envoi réussi
      if (selectedAvoirForUpload.invoiceReference?.trim()) {
        setTimeout(() => {
          handleVerifyAvoirInvoice(selectedAvoirForUpload, true);
        }, 1000); // Délai de 1 seconde pour laisser le temps aux données de se synchroniser
      }

      // Reset des données
      setSelectedAvoirForUpload(null);
      setSelectedFile(null);

      // Invalider les caches pour recharger
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          return query.queryKey[0]?.toString().includes('/api/avoirs') || false;
        }
      });
      
    } catch (error: any) {
      handleCloseWaitingModal();
      
      let errorMessage = "Impossible d'envoyer l'avoir";
      if (error.name === 'AbortError') {
        errorMessage = "Le traitement a pris trop de temps (timeout de 60 secondes)";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Erreur d'envoi",
        description: errorMessage,
        variant: "destructive",
      });
      
      // Rouvrir le modal de sélection en cas d'erreur
      setShowAvoirModal(true);
    }
  };

  // Confirm delete
  const confirmDelete = () => {
    if (selectedAvoir) {
      deleteAvoirMutation.mutate(selectedAvoir.id);
    }
  };

  // Filter avoirs based on search term
  const filteredAvoirs = avoirs.filter(avoir =>
    avoir.invoiceReference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    avoir.supplier?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    avoir.comment?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (avoir.creator.firstName && avoir.creator.lastName 
      ? `${avoir.creator.firstName} ${avoir.creator.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
      : avoir.creator.username.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  // Status badge variant
  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'Reçu':
        return 'default';
      case 'Demandé':
        return 'secondary';
      case 'En attente de demande':
        return 'outline';
      default:
        return 'outline';
    }
  };

  // Status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Reçu':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'Demandé':
        return <Clock className="h-4 w-4 text-blue-600" />;
      case 'En attente de demande':
        return <AlertCircle className="h-4 w-4 text-orange-600" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  if (!user) {
    return <div>Chargement...</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Avoirs</h1>
          <p className="text-muted-foreground">
            Gestion des demandes d'avoirs et de remboursements
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          {/* Bouton Vérifier tous si des avoirs avec référence existent */}
          {avoirs.some(avoir => avoir.invoiceReference?.trim()) && (
            <Button 
              variant="outline" 
              onClick={handleVerifyAllAvoirInvoices}
              disabled={verifyingAvoirs.size > 0}
            >
              <Search className="h-4 w-4 mr-2" />
              {verifyingAvoirs.size > 0 ? "Vérification..." : "Vérifier tous"}
            </Button>
          )}
          
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nouvel avoir
              </Button>
            </DialogTrigger>
          </Dialog>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Créer un nouvel avoir</DialogTitle>
              <DialogDescription>
                Remplissez les informations pour créer une nouvelle demande d'avoir.
              </DialogDescription>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="supplierId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fournisseur</FormLabel>
                      <Select 
                        onValueChange={(value) => field.onChange(parseInt(value))}
                        value={field.value?.toString()}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner un fournisseur" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {suppliers.map((supplier) => (
                            <SelectItem key={supplier.id} value={supplier.id.toString()}>
                              {supplier.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="groupId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Magasin</FormLabel>
                      <Select 
                        onValueChange={(value) => field.onChange(parseInt(value))}
                        value={field.value?.toString()}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner un magasin" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {groups
                            .filter((group) => {
                              // Admin voit tous les groupes
                              if ((user as any)?.role === 'admin') return true;
                              // Autres rôles voient seulement leurs groupes assignés
                              const userGroupIds = (user as any)?.userGroups?.map((ug: any) => ug.groupId) || [];
                              return userGroupIds.includes(group.id);
                            })
                            .map((group) => (
                            <SelectItem key={group.id} value={group.id.toString()}>
                              <div className="flex items-center">
                                <div 
                                  className="w-3 h-3 rounded-full mr-2" 
                                  style={{ backgroundColor: group.color }}
                                />
                                {group.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="invoiceReference"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Référence facture (optionnel)</FormLabel>
                      <FormControl>
                        <Input placeholder="Numéro de facture" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Montant (€) (optionnel)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01" 
                          placeholder="0.00"
                          {...field}
                          onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="comment"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Commentaire</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Raison de l'avoir, détails..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="commercialProcessed"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>
                          Avoir fait par commercial
                        </FormLabel>
                      </div>
                    </FormItem>
                  )}
                />

                <div className="flex justify-end space-x-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsCreateDialogOpen(false)}
                  >
                    Annuler
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createAvoirMutation.isPending}
                  >
                    {createAvoirMutation.isPending ? "Création..." : "Créer"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col space-y-4 sm:flex-row sm:space-y-0 sm:space-x-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Rechercher par référence, fournisseur, commentaire..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        {/* Filtrage maintenant géré par le contexte global Layout */}
      </div>

      {/* Avoirs List - Format Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-4">
              <div className="animate-pulse space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-16 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          ) : filteredAvoirs.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-4 text-sm font-medium text-gray-900">Aucun avoir</h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchTerm ? "Aucun avoir ne correspond à votre recherche." : "Commencez par créer votre premier avoir."}
              </p>
              {!searchTerm && (
                <Button className="mt-4" onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Créer un avoir
                </Button>
              )}
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fournisseur
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Statut
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Référence
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Magasin
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Montant
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Créé le
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Vérification
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAvoirs.map((avoir) => {
                  const canEditDelete = ['admin', 'directeur'].includes((user as any)?.role);
                  
                  return (
                    <tr key={avoir.id} className={`hover:bg-gray-50 ${avoir.nocodbVerified ? 'bg-gray-100 opacity-75' : ''}`}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {avoir.supplier?.name || 'Fournisseur non défini'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Select 
                          value={avoir.status}
                          onValueChange={(newStatus) => handleStatusChange(avoir.id, newStatus)}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="En attente de demande">En attente de demande</SelectItem>
                            <SelectItem value="Demandé">Demandé</SelectItem>
                            <SelectItem value="Reçu">Reçu</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        #{avoir.invoiceReference || 'Sans référence'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center">
                          <div 
                            className="w-3 h-3 rounded-full mr-2" 
                            style={{ backgroundColor: avoir.group?.color || '#gray' }}
                          />
                          {avoir.group?.name || 'Magasin non défini'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        <div className="flex items-center">
                          {avoir.amount !== null && avoir.amount !== undefined ? `${avoir.amount.toFixed(2)} €` : 'Non spécifié'}
                          {avoir.commercialProcessed && (
                            <div title="Avoir fait par commercial">
                              <UserCheck className="h-4 w-4 text-blue-600 ml-2" />
                            </div>
                          )}
                          {avoir.webhookSent && (
                            <div title="Webhook envoyé">
                              <Send className="h-4 w-4 text-green-600 ml-2" />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div>
                          <div>{format(new Date(avoir.createdAt), "dd/MM/yyyy", { locale: fr })}</div>
                          <div className="text-xs text-gray-400">
                            Par {avoir.creator.firstName && avoir.creator.lastName 
                              ? `${avoir.creator.firstName} ${avoir.creator.lastName}`
                              : avoir.creator.username
                            }
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                        {avoir.invoiceReference?.trim() ? (
                          <div className="flex items-center justify-center">
                            {verifyingAvoirs.has(avoir.id) ? (
                              <Clock className="h-4 w-4 text-blue-500 animate-spin" />
                            ) : avoirVerificationResults[avoir.id] ? (
                              avoirVerificationResults[avoir.id].exists ? (
                                <CheckCircle className="h-4 w-4 text-green-500 cursor-help" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-500 cursor-help" />
                              )
                            ) : (
                              <button
                                onClick={() => handleVerifyAvoirInvoice(avoir)}
                                className="h-4 w-4 text-gray-400 hover:text-blue-500 transition-colors"
                                title="Cliquer pour vérifier la facture"
                              >
                                <Search className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">Sans réf.</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center space-x-2">
                          {/* 📋 Icône Upload pour avoirs "Reçu" */}
                          {avoir.status === 'Reçu' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              title="Envoyer fichier avoir"
                              onClick={() => handleOpenAvoirModal(avoir)}
                            >
                              <Upload className="h-4 w-4" />
                            </Button>
                          )}

                          {/* Bouton Valider - apparaît si vérification réussie et pas encore validé */}
                          {avoirVerificationResults[avoir.id]?.exists && !avoir.nocodbVerified && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                              title="Valider l'avoir"
                              onClick={() => handleValidateAvoir(avoir.id)}
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          )}

                          {/* Bouton Dévalider - pour admins sur avoirs validés */}
                          {avoir.nocodbVerified && canEditDelete && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 p-0 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                              title="Dévalider l'avoir"
                              onClick={() => handleDevalidateAvoir(avoir.id)}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          )}

                          {canEditDelete && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0"
                                title="Modifier"
                                onClick={() => handleEdit(avoir)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                title="Supprimer"
                                onClick={() => handleDelete(avoir)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {!canEditDelete && avoir.status !== 'Reçu' && (
                            <span className="text-gray-400 text-xs">Lecture seule</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Modifier l'avoir</DialogTitle>
            <DialogDescription>
              Modifiez les informations de l'avoir.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="supplierId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fournisseur *</FormLabel>
                    <Select 
                      value={field.value.toString()} 
                      onValueChange={(value) => field.onChange(parseInt(value))}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionnez un fournisseur" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {suppliers.map((supplier) => (
                          <SelectItem key={supplier.id} value={supplier.id.toString()}>
                            {supplier.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="invoiceReference"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Référence facture</FormLabel>
                    <FormControl>
                      <Input placeholder="Référence de la facture (optionnel)" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Montant</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01" 
                        placeholder="Montant en euros (optionnel)" 
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Statut</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="En attente de demande">En attente de demande</SelectItem>
                        <SelectItem value="Demandé">Demandé</SelectItem>
                        <SelectItem value="Reçu">Reçu</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="comment"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Commentaire</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Commentaire ou description (optionnel)" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="commercialProcessed"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>
                        Avoir fait par commercial
                      </FormLabel>
                    </div>
                  </FormItem>
                )}
              />

              <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Annuler
                </Button>
                <Button 
                  type="submit" 
                  disabled={editAvoirMutation.isPending}
                >
                  {editAvoirMutation.isPending ? "Modification..." : "Modifier"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Modal */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer cet avoir ? Cette action ne peut pas être annulée.
              {selectedAvoir && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <div className="text-sm">
                    <div><strong>Fournisseur:</strong> {selectedAvoir.supplier?.name || 'Fournisseur non défini'}</div>
                    <div><strong>Référence:</strong> {selectedAvoir.invoiceReference || 'Sans référence'}</div>
                    <div><strong>Montant:</strong> {selectedAvoir.amount !== null && selectedAvoir.amount !== undefined ? `${selectedAvoir.amount.toFixed(2)} €` : 'Non spécifié'}</div>
                  </div>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              disabled={deleteAvoirMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteAvoirMutation.isPending ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 🌐 Modal d'envoi d'avoir (comme rapprochement) */}
      <Dialog open={showAvoirModal} onOpenChange={setShowAvoirModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Envoyer Fichier Avoir</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {selectedAvoirForUpload && (
              <div className="bg-gray-50 p-3 rounded-md">
                <div className="text-sm">
                  <div className="font-medium">{selectedAvoirForUpload.supplier?.name || 'Fournisseur non défini'}</div>
                  <div className="text-gray-600">
                    Référence: {selectedAvoirForUpload.invoiceReference || 'Non renseigné'}
                  </div>
                  <div className="text-gray-600">
                    Magasin: {selectedAvoirForUpload.group?.name || 'Magasin non défini'}
                  </div>
                  <div className="text-gray-600">
                    Montant: {selectedAvoirForUpload.amount !== null && selectedAvoirForUpload.amount !== undefined ? `${selectedAvoirForUpload.amount.toFixed(2)} €` : 'Non spécifié'}
                  </div>
                </div>
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="avoir-pdf-file">Fichier PDF</Label>
              <input
                id="avoir-pdf-file"
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

            {selectedAvoirForUpload && (
              <div className="text-xs text-gray-500">
                Envoi via webhook configuré pour {selectedAvoirForUpload.group?.name || 'magasin'}
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseAvoirModal}>
              Annuler
            </Button>
            <Button 
              onClick={handleSendAvoir}
              disabled={!selectedFile || isUploading}
            >
              {isUploading ? "Envoi..." : "Envoyer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ⏱️ Modal d'attente pour le traitement du webhook */}
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
                  Traitement de votre avoir en cours...
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
            
            {selectedAvoirForUpload && (
              <div className="bg-blue-50 p-3 rounded-md">
                <div className="text-sm">
                  <div className="font-medium text-blue-900">
                    {selectedAvoirForUpload.supplier?.name || 'Fournisseur non défini'}
                  </div>
                  <div className="text-blue-700">
                    Référence: {selectedAvoirForUpload.invoiceReference || 'Non renseigné'}
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
    </div>
  );
}