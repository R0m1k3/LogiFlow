import { useState, useEffect, useMemo, useRef, useDeferredValue } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, FileText, CheckCircle, AlertCircle, Clock, Edit, Trash2, UserCheck, Send, Upload, XCircle, MessageSquare, Settings } from "lucide-react";
import { useStore } from "@/contexts/StoreContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { useAuthUnified } from "@/hooks/useAuthUnified";

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
    z.number().transform((num) => {
      // Permettre tous les nombres existants (positifs, négatifs, zéro)
      return num;
    }),
    z.string().transform((val) => {
      if (val.trim() === '') return undefined; // Permettre les champs vides
      const num = parseFloat(val);
      if (isNaN(num)) {
        throw new Error("Montant invalide");
      }
      // Supprimer la restriction > 0 pour permettre zéro et les montants négatifs (avoirs)
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

// Tableau vide stable tant que la liste n'est pas chargée (évite de relancer
// effets et calculs mémoïsés à chaque rendu)
const NO_AVOIRS: Avoir[] = [];

// Nombre maximal de vérifications de facture simultanées
const MAX_CONCURRENT_VERIFICATIONS = 4;

// Le montant de l'avoir doit-il être remplacé par celui de la facture ?
// Oui s'il est vide ou différent au centime près ; sinon la mise à jour ne
// changerait rien et la requête est évitée.
function amountDiffers(current: unknown, invoiceAmount: number) {
  if (current === null || current === undefined || current === '') return true;
  return Math.round(Number(current) * 100) !== Math.round(Number(invoiceAmount) * 100);
}

// Filtrage par recherche (fournisseur, référence, commentaire)
function filterAvoirsBySearch(avoirsList: Avoir[], searchTerm: string) {
  const searchLower = searchTerm.toLowerCase();
  return avoirsList.filter((avoir) => (
    avoir.supplier?.name?.toLowerCase().includes(searchLower) ||
    avoir.invoiceReference?.toLowerCase().includes(searchLower) ||
    avoir.comment?.toLowerCase().includes(searchLower)
  ));
}

// Durée d'envoi affichée dans le modal d'attente. Le compteur vit dans ce
// composant pour ne pas re-rendre toute la page chaque seconde ; il repart de
// zéro à chaque ouverture du modal et s'arrête à sa fermeture.
function UploadElapsedTime() {
  const [processingSeconds, setProcessingSeconds] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProcessingSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <p className="text-sm text-gray-600 text-center">
        Envoi du fichier vers le webhook... {processingSeconds}s
      </p>
      {processingSeconds > 30 && (
        <p className="text-xs text-gray-500 mt-2 text-center">
          Le traitement peut prendre quelques minutes
        </p>
      )}
    </>
  );
}

export default function Avoirs() {
  const [activeTab, setActiveTab] = useState("pending");
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
  
  // État pour le modal d'attente du webhook (compteur dans UploadElapsedTime)
  const [showWaitingModal, setShowWaitingModal] = useState(false);
  
  // États pour le système de vérification de facture
  const [avoirVerificationResults, setAvoirVerificationResults] = useState<Record<number, any>>({});
  const [verifyingAvoirs, setVerifyingAvoirs] = useState<Set<number>>(new Set());

  // ✅ État local pour le champ montant d'édition pour éviter les conflits avec React Hook Form
  const [editAmountValue, setEditAmountValue] = useState<string>("");

  // État pour le modal de commentaire
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [selectedComment, setSelectedComment] = useState<string>("");
  // Utiliser le contexte global du magasin
  const { selectedStoreId } = useStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();


  // Utilisateur connecté : cache partagé par toute l'application (pas de requête supplémentaire)
  const { user } = useAuthUnified();

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
  const { data: avoirs = NO_AVOIRS, isLoading } = useQuery<Avoir[]>({
    queryKey: [avoirsUrl, selectedStoreId, (user as any)?.role],
    queryFn: async () => {
      const response = await fetch(avoirsUrl, { credentials: 'include' });
      if (!response.ok) {
        throw new Error('Failed to fetch avoirs');
      }
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!user,
  });

  // Recharge la liste des avoirs, quelle que soit la variante de clé
  // (avec ou sans magasin sélectionné, bureau ou mobile)
  const invalidateAvoirs = () => queryClient.invalidateQueries({
    predicate: (query) => {
      return query.queryKey[0]?.toString().includes('/api/avoirs') || false;
    }
  });

  // Données du PUT qui reporte le montant de la facture sur l'avoir : le serveur
  // remet à null les champs absents, on renvoie donc les valeurs actuelles
  const buildAmountUpdate = (avoir: Avoir, amount: number): AvoirUpdateData => ({
    supplierId: avoir.supplierId,
    groupId: avoir.groupId,
    invoiceReference: avoir.invoiceReference || "",
    amount,
    comment: avoir.comment || "",
    commercialProcessed: avoir.commercialProcessed || false,
    status: avoir.status as "En attente de demande" | "Demandé" | "Reçu",
  });

  // ---------------------------------------------------------------------------
  // File d'attente des vérifications de facture : au plus
  // MAX_CONCURRENT_VERIFICATIONS requêtes simultanées, au lieu d'une boucle
  // séquentielle au chargement ou d'une rafale de requêtes (« Vérifier toutes »).
  // ---------------------------------------------------------------------------
  const verificationQueueRef = useRef<Array<() => Promise<void>>>([]);
  const activeVerificationsRef = useRef(0);
  // Référence déjà vérifiée (ou en cours) pour chaque avoir : un rechargement de
  // la liste ne relance pas les vérifications déjà faites
  const verifiedReferencesRef = useRef<Map<number, string>>(new Map());
  // Dernière liste reçue, relue au moment de remplir un montant
  const avoirsRef = useRef<Avoir[]>(avoirs);
  avoirsRef.current = avoirs;

  const drainVerificationQueue = () => {
    while (
      activeVerificationsRef.current < MAX_CONCURRENT_VERIFICATIONS &&
      verificationQueueRef.current.length > 0
    ) {
      const task = verificationQueueRef.current.shift();
      if (!task) break;

      activeVerificationsRef.current += 1;
      task().finally(() => {
        activeVerificationsRef.current -= 1;
        drainVerificationQueue();
      });
    }
  };

  // Met les tâches en file ; la promesse est résolue quand toutes sont terminées
  // (chaque tâche traite elle-même ses erreurs)
  const runVerificationTasks = (tasks: Array<() => Promise<void>>) =>
    Promise.all(tasks.map(task => new Promise<void>(resolve => {
      verificationQueueRef.current.push(() => task().catch(() => undefined).finally(resolve));
      drainVerificationQueue();
    })));

  // 🔄 Charger les vérifications depuis le cache serveur à l'affichage de la liste.
  // Seuls les avoirs non validés dont la référence n'a pas encore été vérifiée
  // sont envoyés (un avoir validé affiche « Validé » quel que soit le résultat) ;
  // les résultats sont appliqués en une seule fois, comme auparavant.
  useEffect(() => {
    const avoirsToVerify = avoirs.filter(avoir =>
      avoir.invoiceReference?.trim() &&
      !avoir.nocodbVerified &&
      verifiedReferencesRef.current.get(avoir.id) !== avoir.invoiceReference
    );
    if (avoirsToVerify.length === 0) return;

    // Marquage immédiat : un rechargement pendant la vérification ne la double pas
    avoirsToVerify.forEach(avoir => verifiedReferencesRef.current.set(avoir.id, avoir.invoiceReference || ''));

    const cachedResults: Record<number, any> = {};
    runVerificationTasks(avoirsToVerify.map(avoir => async () => {
      try {
        const result = await apiRequest(`/api/avoirs/${avoir.id}/verify-invoice`, 'POST', {
          invoiceReference: avoir.invoiceReference,
          forceRefresh: false // Utiliser le cache si disponible
        });
        if (result?.exists !== undefined) {
          cachedResults[avoir.id] = result;
        }
      } catch {
        // Vérification silencieuse : la loupe reste disponible pour réessayer
      }
    })).then(() => {
      if (Object.keys(cachedResults).length > 0) {
        setAvoirVerificationResults(prev => ({ ...prev, ...cachedResults }));
      }
    });
  }, [avoirs]);

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
      invalidateAvoirs();
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
      invalidateAvoirs();
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
      invalidateAvoirs();
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

  // Calculate default group ID based on user role
  const getDefaultGroupId = () => {
    if ((user as any)?.role === 'admin') {
      // Admin : groupe 1 par défaut
      return 1;
    } else {
      // Utilisateurs : leur groupe assigné par défaut
      const userGroupIds = (user as any)?.userGroups?.map((ug: any) => ug.groupId) || [];
      return userGroupIds.length > 0 ? userGroupIds[0] : 0;
    }
  };

  // Initialize create form
  const form = useForm<AvoirFormData>({
    resolver: zodResolver(avoirSchema),
    defaultValues: {
      supplierId: 0,
      groupId: getDefaultGroupId(),
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
      // ✅ Utiliser la valeur de l'état local pour le montant
      const finalAmount = editAmountValue === "" ? undefined : parseFloat(editAmountValue);
      const finalData = {
        ...data,
        amount: finalAmount
      };
      
      editAvoirMutation.mutate({ id: selectedAvoir.id, data: finalData });
    }
  };

  // Handle edit action
  const handleEdit = (avoir: Avoir) => {
    if (!avoir || !avoir.id) return;
    
    setSelectedAvoir(avoir);
    // ✅ Initialiser l'état local du montant
    setEditAmountValue(avoir.amount !== null && avoir.amount !== undefined ? avoir.amount.toString() : "");
    
    editForm.reset({
      supplierId: avoir.supplierId || 0,
      groupId: avoir.groupId || 0,
      invoiceReference: avoir.invoiceReference || "",
      amount: avoir.amount ?? undefined,
      comment: avoir.comment || "",
      commercialProcessed: avoir.commercialProcessed || false,
      status: avoir.status || "En attente de demande",
    });
    setIsEditDialogOpen(true);
  };

  // Handle delete action
  const handleDelete = (avoir: Avoir) => {
    if (!avoir || !avoir.id) return;
    
    setSelectedAvoir(avoir);
    setIsDeleteDialogOpen(true);
  };

  // Handle comment view
  const handleViewComment = (comment: string) => {
    setSelectedComment(comment);
    setShowCommentModal(true);
  };

  // Handle status change
  const handleStatusChange = (avoirId: number, newStatus: string) => {
    const avoir = avoirs?.find(a => a?.id === avoirId);
    
    // Empêcher la modification du statut pour les avoirs validés, SAUF pour les administrateurs
    if (avoir?.nocodbVerified && (user as any)?.role !== 'admin') {
      toast({
        title: "Modification interdite",
        description: "Impossible de modifier le statut d'un avoir validé",
        variant: "destructive",
      });
      return;
    }
    
    // Empêcher les managers de mettre le statut en "Reçu"
    if ((user as any)?.role === 'manager' && newStatus === 'Reçu') {
      toast({
        title: "Accès refusé",
        description: "Vous n'avez pas les permissions pour marquer un avoir comme reçu",
        variant: "destructive",
      });
      return;
    }
    if (avoir && avoir.supplierId && avoir.groupId) {
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
      // Utiliser la route spécifique pour la vérification NocoDB. Elle marque
      // aussi le cache de vérification comme réconcilié (permanent) : un appel
      // séparé à /api/cache/mark-reconciled serait redondant.
      await apiRequest(`/api/avoirs/${avoirId}/nocodb-verification`, 'PUT', {
        verified: true
      });

      // ✅ Mettre à jour l'état local immédiatement pour affichage instantané
      setAvoirVerificationResults(prev => ({
        ...prev,
        [avoirId]: { exists: true, fromCache: true, permanent: true, validated: true }
      }));

      // Recharger les avoirs pour voir les changements en base (toutes les
      // variantes de clé : la clé contient l'URL avec le magasin sélectionné)
      invalidateAvoirs();

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

      // ✅ Retirer de l'état local immédiatement
      setAvoirVerificationResults(prev => {
        const updated = { ...prev };
        delete updated[avoirId]; // Supprimer complètement l'entrée
        return updated;
      });
      // L'avoir sera revérifié au rechargement de la liste
      verifiedReferencesRef.current.delete(avoirId);

      // Recharger les avoirs pour voir les changements en base (toutes les
      // variantes de clé : la clé contient l'URL avec le magasin sélectionné)
      invalidateAvoirs();

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

      // Auto-remplissage sécurisé si facture trouvée et montant disponible
      // (seulement si le montant change : sinon la mise à jour serait inutile)
      if (result?.exists === true && result?.invoiceAmount !== undefined && result?.invoiceAmount !== null) {
        const avoir = avoirs?.find(a => a?.id === variables.avoirId);
        if (avoir && avoir.supplierId && avoir.groupId && amountDiffers(avoir.amount, result.invoiceAmount)) {
          editAvoirMutation.mutate({
            id: variables.avoirId,
            data: buildAmountUpdate(avoir, result.invoiceAmount),
          });
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

    // Référence vérifiée : le rechargement de la liste ne la revérifiera pas
    verifiedReferencesRef.current.set(avoir.id, avoir.invoiceReference || '');
    setVerifyingAvoirs(prev => new Set(prev).add(avoir.id));
    
    verifyAvoirInvoiceMutation.mutate({
      avoirId: avoir.id,
      invoiceReference: avoir.invoiceReference,
      forceRefresh
    });
  };

  // Fonction pour vérifier tous les avoirs avec une référence facture.
  // File d'attente bornée, montants remplis sans recharger la liste à chaque
  // avoir (ni toast, ni fermeture de modale), puis un seul rafraîchissement et
  // un seul toast récapitulatif à la fin.
  const handleVerifyAllAvoirInvoices = async () => {
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

    toast({
      title: "Vérification lancée",
      description: `Vérification de ${avoirsToVerify.length} avoir(s) en cours...`,
    });

    setVerifyingAvoirs(prev => {
      const next = new Set(prev);
      avoirsToVerify.forEach(avoir => next.add(avoir.id));
      return next;
    });
    avoirsToVerify.forEach(avoir => verifiedReferencesRef.current.set(avoir.id, avoir.invoiceReference || ''));

    let found = 0;
    let notFound = 0;
    let failed = 0;
    let amountsUpdated = 0;

    await runVerificationTasks(avoirsToVerify.map(avoir => async () => {
      let result: any;
      let requestFailed = false;
      try {
        result = await apiRequest(`/api/avoirs/${avoir.id}/verify-invoice`, 'POST', {
          invoiceReference: avoir.invoiceReference,
          forceRefresh: true // Force refresh pour tous
        });
      } catch (error) {
        console.error('Erreur vérification facture avoir:', error);
        requestFailed = true;
        result = {
          exists: false,
          matchType: 'none',
          errorMessage: error instanceof Error ? error.message : 'Erreur inconnue'
        };
      }

      setAvoirVerificationResults(prev => ({ ...prev, [avoir.id]: result }));
      setVerifyingAvoirs(prev => {
        const next = new Set(prev);
        next.delete(avoir.id);
        return next;
      });

      if (requestFailed) {
        failed += 1;
        return;
      }
      if (result?.exists !== true) {
        notFound += 1;
        return;
      }
      found += 1;

      // Report du montant de la facture, à partir des données les plus récentes de l'avoir
      if (result.invoiceAmount === undefined || result.invoiceAmount === null) return;
      const current = avoirsRef.current.find(a => a?.id === avoir.id) ?? avoir;
      if (!current.supplierId || !current.groupId || !amountDiffers(current.amount, result.invoiceAmount)) return;
      try {
        await apiRequest(`/api/avoirs/${avoir.id}`, 'PUT', buildAmountUpdate(current, result.invoiceAmount));
        amountsUpdated += 1;
      } catch (error) {
        console.error('❌ Erreur auto-remplissage:', error);
      }
    }));

    // Un seul rechargement de la liste, seulement si des montants ont changé
    if (amountsUpdated > 0) {
      invalidateAvoirs();
    }

    const details = [`${found} facture(s) trouvée(s)`, `${notFound} introuvable(s)`];
    if (failed > 0) details.push(`${failed} erreur(s)`);
    if (amountsUpdated > 0) details.push(`${amountsUpdated} montant(s) mis à jour`);
    toast({
      title: "Vérification terminée",
      description: details.join(', '),
      variant: failed > 0 ? "destructive" : "default",
    });
  };

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

  const handleCloseWaitingModal = () => {
    setShowWaitingModal(false);
    setIsUploading(false);
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
      invalidateAvoirs();
      
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

  // Séparer les avoirs par statut : Finalisé = Reçu ET validé (recalculé
  // seulement quand la liste change, pas à chaque frappe ou résultat de vérification)
  const pendingAvoirs = useMemo(
    () => avoirs.filter(avoir => !(avoir.status === 'Reçu' && avoir.nocodbVerified)),
    [avoirs]
  );
  const completedAvoirs = useMemo(
    () => avoirs.filter(avoir => avoir.status === 'Reçu' && avoir.nocodbVerified),
    [avoirs]
  );

  // Filtrage par recherche, différée pour garder la saisie fluide
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const filteredPendingAvoirs = useMemo(
    () => filterAvoirsBySearch(pendingAvoirs, deferredSearchTerm),
    [pendingAvoirs, deferredSearchTerm]
  );
  const filteredCompletedAvoirs = useMemo(
    () => filterAvoirsBySearch(completedAvoirs, deferredSearchTerm),
    [completedAvoirs, deferredSearchTerm]
  );

  const canEditDelete = ['admin', 'directeur'].includes((user as any)?.role);

  // Fonction pour rendre le tableau d'avoirs
  const renderAvoirTable = (avoirsList: Avoir[]) => {
    if (isLoading) {
      return (
        <div className="p-4">
          <div className="animate-pulse space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      );
    }

    if (avoirsList.length === 0) {
      return (
        <div className="p-12 text-center">
          <FileText className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-sm font-medium text-gray-900">Aucun avoir</h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchTerm ? "Aucun avoir ne correspond à votre recherche." : "Aucun avoir dans cette catégorie."}
          </p>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
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
            {avoirsList?.filter(avoir => avoir && avoir.id).map((avoir) => (
              <tr key={avoir?.id || Math.random()} className={`hover:bg-gray-50 ${avoir?.nocodbVerified ? 'bg-gray-100 opacity-75' : ''}`}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {avoir.supplier?.name || 'Fournisseur non défini'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <Select 
                    value={avoir?.status || ''}
                    onValueChange={(newStatus) => handleStatusChange(avoir.id, newStatus)}
                    disabled={avoir.nocodbVerified}
                  >
                    <SelectTrigger className={`w-full ${avoir.nocodbVerified ? 'opacity-50 cursor-not-allowed' : ''}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="En attente de demande">En attente de demande</SelectItem>
                      <SelectItem value="Demandé">Demandé</SelectItem>
                      {(user as any)?.role !== 'manager' && (
                        <SelectItem value="Reçu">Reçu</SelectItem>
                      )}
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
                    {avoir.amount !== null && avoir.amount !== undefined ? `${Number(avoir.amount).toFixed(2)} €` : 'Non spécifié'}
                    {avoir.commercialProcessed && (
                      <div title="Traité par commercial">
                        <UserCheck className="ml-2 h-4 w-4 text-purple-600" />
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {format(new Date(avoir.createdAt), 'dd/MM/yyyy HH:mm', { locale: fr })}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                  {(avoirVerificationResults[avoir.id]?.exists === true || avoir.nocodbVerified) ? (
                    <div className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800 border border-green-200">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Validé
                    </div>
                  ) : avoir.invoiceReference && avoir.invoiceReference.trim() !== '' ? (
                    <div className="flex items-center justify-center">
                      {verifyingAvoirs.has(avoir.id) ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
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
                    {/* Upload pour avoirs "Reçu" - interdit aux managers et avoirs validés */}
                    {avoir?.status === 'Reçu' && (user as any)?.role !== 'manager' && !avoir.nocodbVerified && (
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

                    {/* Bouton Valider */}
                    {avoirVerificationResults[avoir.id]?.exists === true && !avoir.nocodbVerified && (
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

                    {/* Bouton Dévalider - Uniquement sur les avoirs validés */}
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

                    {/* Bouton Commentaire */}
                    {avoir.comment && avoir.comment.trim() !== '' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                        title="Voir le commentaire"
                        onClick={() => handleViewComment(avoir.comment || '')}
                      >
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                    )}

                    {canEditDelete && (!avoir.nocodbVerified || (user as any)?.role === 'admin') && (
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
                    {!canEditDelete && avoir?.status !== 'Reçu' && (
                      <span className="text-gray-400 text-xs">Lecture seule</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  if (!user) {
    return <div>Chargement...</div>;
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4 sm:p-6 shadow-sm -m-4 sm:-m-6 mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 flex items-center">
              <FileText className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3 text-blue-600" />
              Gestion des Avoirs
            </h2>
            <p className="text-gray-600 mt-1 text-sm sm:text-base">
              Gestion des demandes d'avoir et remboursements
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            <Badge variant="outline" className="text-xs sm:text-sm border border-gray-300">
              {pendingAvoirs.length} en cours
            </Badge>
            <Badge variant="outline" className="text-xs sm:text-sm border border-gray-300 bg-green-50">
              {completedAvoirs.length} finalisés
            </Badge>
            {/* Bouton Vérifier tous */}
            {avoirs.some(avoir => avoir.invoiceReference?.trim()) && (
              <Button
                onClick={handleVerifyAllAvoirInvoices}
                variant="outline"
                size="sm"
                className="text-xs sm:text-sm bg-green-50 border-green-300 text-green-700 hover:bg-green-100"
                disabled={verifyingAvoirs.size > 0}
              >
                <Search className="w-4 h-4 mr-1" />
                {verifyingAvoirs.size > 0 ? "Vérification..." : "Vérifier toutes"}
              </Button>
            )}
            <Button onClick={() => setIsCreateDialogOpen(true)} size="sm">
              <Plus className="w-4 h-4 mr-1" />
              Nouvel avoir
            </Button>
          </div>
        </div>

        {/* Onglets */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pending" className="flex items-center space-x-2">
              <Clock className="w-4 h-4" />
              <span>En cours</span>
              <Badge variant="secondary" className="ml-2">
                {pendingAvoirs.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="completed" className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4" />
              <span>Finalisés</span>
              <Badge variant="secondary" className="ml-2">
                {completedAvoirs.length}
              </Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Filters */}
      <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Rechercher par fournisseur, référence ou commentaire..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 border border-gray-300 shadow-sm w-full"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Contenu des onglets */}
      <Tabs value={activeTab} className="w-full">
        <TabsContent value="pending" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Avoirs en cours</span>
                <Badge variant="outline">{filteredPendingAvoirs.length} éléments</Badge>
              </CardTitle>
              <CardDescription>
                Avoirs en attente de demande ou en cours de traitement
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {/* Seul le tableau de l'onglet affiché est construit */}
              {activeTab === "pending" && renderAvoirTable(filteredPendingAvoirs)}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="completed" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Avoirs finalisés</span>
                <Badge variant="outline">{filteredCompletedAvoirs.length} éléments</Badge>
              </CardTitle>
              <CardDescription>
                Avoirs reçus et traités
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {activeTab === "completed" && renderAvoirTable(filteredCompletedAvoirs)}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal de création */}
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

      {/* Modal d'édition */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Modifier l'avoir</DialogTitle>
            <DialogDescription>
              Modifiez les informations de cet avoir
            </DialogDescription>
          </DialogHeader>

          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
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
                control={editForm.control}
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
                            if ((user as any)?.role === 'admin') return true;
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
                control={editForm.control}
                name="invoiceReference"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Référence facture</FormLabel>
                    <FormControl>
                      <Input placeholder="Numéro de facture" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div>
                <Label htmlFor="edit-amount">Montant (€)</Label>
                <Input
                  id="edit-amount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={editAmountValue}
                  onChange={(e) => setEditAmountValue(e.target.value)}
                />
              </div>

              <FormField
                control={editForm.control}
                name="comment"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Commentaire</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Raison de l'avoir, détails..." {...field} />
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

              <div className="flex justify-end space-x-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsEditDialogOpen(false)}
                >
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

      {/* Modal de suppression */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer cet avoir ? Cette action ne peut pas être annulée.
              {selectedAvoir && (
                <div className="mt-2 p-3 bg-gray-50 rounded">
                  <strong>Avoir:</strong> {selectedAvoir.supplier?.name} - {selectedAvoir.invoiceReference || 'Sans référence'}
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteAvoirMutation.isPending ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal d'envoi d'avoir (webhook) */}
      <Dialog open={showAvoirModal} onOpenChange={handleCloseAvoirModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Envoyer avoir</DialogTitle>
            <DialogDescription>
              Sélectionnez un fichier PDF à envoyer pour cet avoir
              {selectedAvoirForUpload && (
                <div className="mt-2 p-2 bg-blue-50 rounded text-sm">
                  <strong>{selectedAvoirForUpload.supplier?.name}</strong> - {selectedAvoirForUpload.invoiceReference || 'Sans référence'}
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <Upload className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-2 text-sm text-gray-600">
                  Cliquez pour sélectionner un fichier PDF
                </p>
              </label>
            </div>

            {selectedFile && (
              <div className="flex items-center p-3 bg-green-50 rounded">
                <FileText className="h-5 w-5 text-green-600 mr-2" />
                <span className="text-sm text-green-700">{selectedFile.name}</span>
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={handleCloseAvoirModal}>
              Annuler
            </Button>
            <Button 
              onClick={handleSendAvoir} 
              disabled={!selectedFile || isUploading}
            >
              {isUploading ? "Envoi..." : "Envoyer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal d'attente */}
      <Dialog open={showWaitingModal} onOpenChange={handleCloseWaitingModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Envoi en cours</DialogTitle>
            <DialogDescription>
              Veuillez patienter pendant l'envoi de votre fichier
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col items-center p-6">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <UploadElapsedTime />
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de commentaire */}
      <Dialog open={showCommentModal} onOpenChange={setShowCommentModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Commentaire</DialogTitle>
            <DialogDescription>
              Détails du commentaire de cet avoir
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {selectedComment}
              </p>
            </div>
          </div>
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setShowCommentModal(false)}>
              Fermer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
