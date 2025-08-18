import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pagination, usePagination } from "@/components/ui/pagination";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, Plus, Eye, Edit, Trash2, CheckCircle, Package, Clock, AlertCircle, Filter, Download, FileText, PackageX, RotateCcw } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useAuthUnified } from "@/hooks/useAuthUnified";
import { useStore } from "@/components/Layout";
import { apiRequest } from "@/lib/queryClient";
import type { DlcProductWithRelations, InsertDlcProduct } from "@shared/schema";

const dlcFormSchema = z.object({
  productName: z.string().min(1, "Le nom du produit est obligatoire"),
  gencode: z.string().optional(),
  dlcDate: z.string().min(1, "La date d'expiration est obligatoire"),
  dateType: z.enum(["dlc", "ddm", "dluo"], { required_error: "Le type de date est obligatoire" }),
  supplierId: z.number().min(1, "Le fournisseur est obligatoire"),
  status: z.enum(["en_cours", "expires_soon", "expires", "valides"]).default("en_cours"),
  notes: z.string().optional(),
});

type DlcFormData = z.infer<typeof dlcFormSchema>;

export default function DlcPage() {
  const { user, isLoading: authLoading } = useAuthUnified();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedStoreId } = useStore();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [supplierFilter, setSupplierFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<DlcProductWithRelations | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<number | null>(null);

  // Debounce search term to reduce API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch stores/groups - optimized cache
  const { data: stores = [] } = useQuery({
    queryKey: ["/api/groups"],
    enabled: !authLoading,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });

  // Fetch suppliers with DLC enabled only - optimized cache
  const { data: suppliers = [] } = useQuery({
    queryKey: ["/api/suppliers", "dlc"],
    queryFn: () => apiRequest("/api/suppliers?dlc=true"),
    enabled: !authLoading,
    staleTime: 10 * 60 * 1000, // 10 minutes cache
  });

  // Fetch DLC products - optimized with server-side search
  const { data: dlcProducts = [], isLoading: productsLoading } = useQuery({
    queryKey: ["/api/dlc-products", selectedStoreId, statusFilter, supplierFilter, debouncedSearchTerm],
    queryFn: () => {
      const params = new URLSearchParams();
      if (selectedStoreId && user?.role === 'admin') params.append("storeId", selectedStoreId.toString());
      if (statusFilter && statusFilter !== "all") params.append("status", statusFilter);
      if (supplierFilter && supplierFilter !== "all") params.append("supplierId", supplierFilter);
      if (debouncedSearchTerm) params.append("search", debouncedSearchTerm);
      
      return apiRequest(`/api/dlc-products?${params.toString()}`);
    },
    enabled: !authLoading,
    staleTime: 2 * 60 * 1000, // 2 minutes cache for DLC data
  });

  // Fetch DLC stats - optimized cache
  const { data: stats = { active: 0, expiringSoon: 0, expired: 0 } } = useQuery({
    queryKey: ["/api/dlc-products/stats", selectedStoreId],
    queryFn: () => {
      const params = new URLSearchParams();
      if (selectedStoreId && user?.role === 'admin') params.append("storeId", selectedStoreId.toString());
      return apiRequest(`/api/dlc-products/stats?${params.toString()}`);
    },
    enabled: !authLoading,
    staleTime: 5 * 60 * 1000, // 5 minutes cache for stats
  });

  // Form setup
  const form = useForm<DlcFormData>({
    resolver: zodResolver(dlcFormSchema),
    defaultValues: {
      productName: "",
      gencode: "",
      dateType: "dlc",
      status: "en_cours",
      notes: "",
    },
  });

  // Create mutation - optimized cache invalidation
  const createMutation = useMutation({
    mutationFn: (data: InsertDlcProduct) => apiRequest("/api/dlc-products", "POST", data),
    onSuccess: () => {
      // Selective cache invalidation
      queryClient.invalidateQueries({ queryKey: ["/api/dlc-products"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/dlc-products/stats"], exact: false });
      toast({ title: "Produit DLC créé avec succès" });
      setIsDialogOpen(false);
      form.reset();
      setEditingProduct(null);
    },
    onError: (error: any) => {
      toast({
        title: "Erreur lors de la création",
        description: error.message || "Une erreur est survenue",
        variant: "destructive",
      });
    },
  });

  // Update mutation - optimized cache invalidation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<InsertDlcProduct> }) =>
      apiRequest(`/api/dlc-products/${id}`, "PUT", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dlc-products"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/dlc-products/stats"], exact: false });
      toast({ title: "Produit DLC mis à jour avec succès" });
      setIsDialogOpen(false);
      form.reset();
      setEditingProduct(null);
    },
    onError: (error: any) => {
      toast({
        title: "Erreur lors de la mise à jour",
        description: error.message || "Une erreur est survenue",
        variant: "destructive",
      });
    },
  });

  // Validate mutation - optimized cache invalidation
  const validateMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/dlc-products/${id}/validate`, "PUT"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dlc-products"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/dlc-products/stats"], exact: false });
      toast({ title: "Produit validé avec succès" });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur lors de la validation",
        description: error.message || "Une erreur est survenue",
        variant: "destructive",
      });
    },
  });

  // Delete mutation - optimized cache invalidation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/dlc-products/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dlc-products"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/dlc-products/stats"], exact: false });
      toast({ title: "Produit supprimé avec succès" });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur lors de la suppression",
        description: error.message || "Une erreur est survenue",
        variant: "destructive",
      });
    },
  });

  // Stock épuisé mutation - accessible à tous
  const markStockEpuiseMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/dlc-products/${id}/stock-epuise`, "PUT"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dlc-products"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/dlc-products/stats"], exact: false });
      toast({ title: "Produit marqué comme stock épuisé" });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur lors du marquage",
        description: error.message || "Une erreur est survenue",
        variant: "destructive",
      });
    },
  });

  // Restaurer stock mutation - réservé aux admins, directeurs et managers
  const restoreStockMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/dlc-products/${id}/restore-stock`, "PUT"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dlc-products"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/dlc-products/stats"], exact: false });
      toast({ title: "Stock restauré avec succès" });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur lors de la restauration",
        description: error.message || "Une erreur est survenue",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: DlcFormData) => {
    // Calculer la date d'expiration et le seuil d'alerte (15 jours avant)
    const dlcDate = new Date(data.dlcDate);
    
    // Déterminer le groupId correctement selon le rôle utilisateur
    let groupId;
    
    // FORCE L'UTILISATION DU GROUPE ASSIGNÉ EN PREMIER
    if (user?.userGroups?.[0]?.groupId) {
      // Utilisateur avec groupe assigné : TOUJOURS utiliser ce groupe
      groupId = user.userGroups[0].groupId;
      console.log("🎯 DLC Frontend: Using user's assigned group (PRIORITY):", groupId);
    } else if (user?.role === 'admin' && selectedStoreId) {
      // Admin avec magasin sélectionné ET pas de groupe assigné
      groupId = selectedStoreId;
      console.log("🎯 DLC Frontend: Using admin selected store:", groupId);
    } else if (user?.role === 'admin' && stores?.[0]?.id) {
      // Admin sans sélection : premier magasin disponible
      groupId = stores[0].id;
      console.log("🎯 DLC Frontend: Using first available store for admin:", groupId);
    } else {
      // Fallback d'urgence
      groupId = 1;
      console.log("🚨 DLC Frontend: Using emergency fallback groupId:", groupId);
    }

    console.log("🏪 DLC GroupId Selection DEBUG:", {
      userRole: user?.role,
      selectedStoreId,
      userGroups: user?.userGroups?.map(ug => ({groupId: ug.groupId, groupName: ug.group?.name})),
      availableStores: stores.map(s => ({id: s.id, name: s.name})),
      userGroupsRaw: user?.userGroups,
      firstUserGroup: user?.userGroups?.[0],
      finalGroupId: groupId,
      logicPath: !groupId ? 'need-fallback' : 'already-set'
    });
    
    const dlcData: InsertDlcProduct = {
      ...data,
      expiryDate: dlcDate,
      quantity: 1, // Valeur par défaut
      unit: "unité", // Valeur par défaut
      location: "Magasin", // Valeur par défaut
      alertThreshold: 15, // Toujours 15 jours
      groupId,
    };

    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct.id, data: dlcData });
    } else {
      createMutation.mutate(dlcData);
    }
  };

  const handleEdit = (product: DlcProductWithRelations) => {
    setEditingProduct(product);
    form.reset({
      productName: product.productName,
      gencode: product.gencode || "",
      dlcDate: product.expiryDate ? format(new Date(product.expiryDate), "yyyy-MM-dd") : "",
      dateType: product.dateType as "dlc" | "ddm" | "dluo",
      supplierId: product.supplierId,
      status: product.status as "en_cours" | "expires_soon" | "expires" | "valides",
      notes: product.notes || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    setProductToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (productToDelete) {
      deleteMutation.mutate(productToDelete);
      setDeleteDialogOpen(false);
      setProductToDelete(null);
    }
  };

  const handleValidate = (id: number) => {
    validateMutation.mutate(id);
  };

  const handleMarkStockEpuise = (id: number) => {
    markStockEpuiseMutation.mutate(id);
  };

  const handleRestoreStock = (id: number) => {
    restoreStockMutation.mutate(id);
  };

  // Fonction pour déterminer si un produit doit afficher le bouton de validation
  const shouldShowValidateButton = (product: DlcProductWithRelations) => {
    const today = new Date();
    const expiry = new Date(product.expiryDate || new Date());
    const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    // Afficher le bouton si le produit expire dans 15 jours ou moins, ou est déjà expiré
    // ET si le produit n'est pas déjà validé
    return (daysUntilExpiry <= 15 && product.status !== "valides");
  };

  const getStatusBadge = (status: string, dlcDate: string | null, stockEpuise?: boolean) => {
    if (!dlcDate) return <Badge variant="outline">Non défini</Badge>;
    
    // LOGIQUE MISE À JOUR :
    // 1. Si stock épuisé, afficher "Stock épuisé" avec style spécifique
    // 2. Si le statut en base est "valides", afficher "Validé" (peu importe la date) 
    // 3. Sinon, calculer selon la date d'expiration
    
    if (stockEpuise) {
      return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-300">Stock épuisé</Badge>;
    }
    
    if (status === "valides") {
      return <Badge variant="outline" className="bg-gray-100 text-gray-800">Validé</Badge>;
    }
    
    // Pour tous les autres statuts, calculer selon la date
    const today = new Date();
    const expiry = new Date(dlcDate);
    const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilExpiry < 0) {
      return <Badge variant="destructive">Expiré</Badge>;
    } else if (daysUntilExpiry <= 15) {
      return <Badge variant="secondary" className="bg-orange-100 text-orange-800">Expire bientôt</Badge>;
    } else {
      return <Badge variant="default" className="bg-green-100 text-green-800">Actif</Badge>;
    }
  };

  const printExpiringSoon = () => {
    const expiringSoon = expiringSoonProducts;

    const printContent = `
      <html>
        <head>
          <title>Produits expirant bientôt</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            h1 { color: #ff6b35; }
          </style>
        </head>
        <body>
          <h1>Produits expirant dans les 15 prochains jours</h1>
          <p>Date d'impression: ${format(new Date(), "dd/MM/yyyy HH:mm")}</p>
          <table>
            <thead>
              <tr>
                <th>Produit</th>
                <th>Code EAN13</th>
                <th>Date d'expiration</th>
                <th>Type</th>
                <th>Fournisseur</th>
                <th>Jours restants</th>
              </tr>
            </thead>
            <tbody>
              ${expiringSoon.map(product => {
                const today = new Date();
                const expiry = new Date(product.dlcDate || new Date());
                const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                return `
                  <tr>
                    <td>${product.productName}</td>
                    <td>${product.gencode || '-'}</td>
                    <td>${product.dlcDate ? format(new Date(product.dlcDate), "dd/MM/yyyy") : 'N/A'}</td>
                    <td>${product.dateType.toUpperCase()}</td>
                    <td>${product.supplier?.name || 'N/A'}</td>
                    <td>${diffDays}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const printExpired = () => {
    const expired = expiredProducts;

    const printContent = `
      <html>
        <head>
          <title>Produits expirés</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            h1 { color: #dc2626; }
          </style>
        </head>
        <body>
          <h1>Produits expirés</h1>
          <p>Date d'impression: ${format(new Date(), "dd/MM/yyyy HH:mm")}</p>
          <table>
            <thead>
              <tr>
                <th>Produit</th>
                <th>Code EAN13</th>
                <th>Date d'expiration</th>
                <th>Type</th>
                <th>Fournisseur</th>
                <th>Jours dépassés</th>
              </tr>
            </thead>
            <tbody>
              ${expired.map(product => {
                const today = new Date();
                const expiry = new Date(product.dlcDate || new Date());
                const diffDays = Math.ceil((today.getTime() - expiry.getTime()) / (1000 * 60 * 60 * 24));
                return `
                  <tr>
                    <td>${product.productName}</td>
                    <td>${product.gencode || '-'}</td>
                    <td>${product.dlcDate ? format(new Date(product.dlcDate), "dd/MM/yyyy") : 'N/A'}</td>
                    <td>${product.dateType.toUpperCase()}</td>
                    <td>${product.supplier?.name || 'N/A'}</td>
                    <td>${diffDays}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  // Products are already filtered server-side, no client filtering needed
  const filteredProducts = dlcProducts || [];

  // Memoized calculations for print functions
  const { expiringSoonProducts, expiredProducts } = useMemo(() => {
    const today = new Date();
    const expiringSoon = filteredProducts.filter(product => {
      if (product.status === 'valides') return false;
      const expiryDate = new Date(product.dlcDate || new Date());
      const diffDays = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays <= 15 && diffDays > 0;
    });

    const expired = filteredProducts.filter(product => {
      if (product.status === 'valides') return false;
      const expiryDate = new Date(product.dlcDate || new Date());
      return expiryDate <= today;
    });

    return { expiringSoonProducts: expiringSoon, expiredProducts: expired };
  }, [filteredProducts]);

  // Pagination
  const {
    currentPage,
    setCurrentPage,
    itemsPerPage,
    setItemsPerPage,
    totalPages,
    paginatedData: paginatedProducts,
    totalItems
  } = usePagination(filteredProducts, 10);

  if (authLoading) {
    return <div className="flex justify-center items-center h-64">Chargement...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-6 shadow-sm -m-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 flex items-center">
              <Clock className="w-6 h-6 mr-3 text-orange-600" />
              Gestion DLC
            </h2>
            <p className="text-gray-600 mt-1">
              Gestion des dates limites de consommation
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-md">
                <Plus className="w-4 h-4 mr-2" />
                Nouveau produit DLC
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? "Modifier le produit DLC" : "Nouveau produit DLC"}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="productName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nom du produit</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Nom du produit" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
                            {suppliers.map((supplier: any) => (
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
                </div>

                <FormField
                  control={form.control}
                  name="gencode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Code EAN13 (optionnel)</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          value={field.value || ""} 
                          placeholder="1234567890123" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="dlcDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date d'expiration</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="dateType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type de date</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner le type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="dlc">DLC (Date Limite de Consommation)</SelectItem>
                            <SelectItem value="ddm">DDM (Date de Durabilité Minimale)</SelectItem>
                            <SelectItem value="dluo">DLUO (Date Limite d'Utilisation Optimale)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes (optionnel)</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Notes ou observations..." />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Annuler
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                    {editingProduct ? "Mettre à jour" : "Créer"}
                  </Button>
                </div>
            </form>
          </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filtres
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium">Statut</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="en_cours">Actifs</SelectItem>
                  <SelectItem value="expires_soon">Expire bientôt</SelectItem>
                  <SelectItem value="expires">Expirés</SelectItem>
                  <SelectItem value="valides">Validés</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Fournisseur</label>
              <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Tous les fournisseurs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les fournisseurs</SelectItem>
                  {suppliers.map((supplier: any) => (
                    <SelectItem key={supplier.id} value={supplier.id.toString()}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Recherche</label>
              <Input
                placeholder="Rechercher un produit..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Produits Actifs</CardTitle>
            <Package className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
            <p className="text-xs text-muted-foreground">Produits en cours</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expire Bientôt</CardTitle>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-600" />
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={printExpiringSoon}
                className="h-6 w-6 p-0 hover:bg-orange-100"
              >
                <FileText className="h-3 w-3 text-orange-600" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.expiringSoon}</div>
            <p className="text-xs text-muted-foreground">Dans les 15 prochains jours</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expirés</CardTitle>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={printExpired}
                className="h-6 w-6 p-0 hover:bg-red-100"
              >
                <FileText className="h-3 w-3 text-red-600" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.expired}</div>
            <p className="text-xs text-muted-foreground">Nécessitent une action</p>
          </CardContent>
        </Card>
      </div>

      {/* Products Table Section */}
      <div>
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Produits DLC ({totalItems})</CardTitle>
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Exporter PDF
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {productsLoading ? (
              <div className="flex justify-center items-center h-32">Chargement des produits...</div>
            ) : totalItems === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Aucun produit DLC trouvé
              </div>
            ) : (
              <div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produit</TableHead>
                      <TableHead>Code EAN13</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Date d'expiration</TableHead>
                      <TableHead>Fournisseur</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedProducts.map((product) => (
                      <TableRow 
                        key={product.id} 
                        className={
                          product.status === "valides" ? "opacity-60 bg-gray-50 dark:bg-gray-800" : 
                          product.stockEpuise ? "opacity-50 bg-yellow-50 dark:bg-yellow-900/20" : ""
                        }
                      >
                        <TableCell className="font-medium">{product.productName}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {product.gencode || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="uppercase">
                            {product.dateType}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {product.expiryDate ? format(new Date(product.expiryDate), "dd/MM/yyyy", { locale: fr }) : 'Date non définie'}
                        </TableCell>
                        <TableCell>{product.supplier?.name || 'Non défini'}</TableCell>
                        <TableCell>{getStatusBadge(product.status, product.expiryDate, product.stockEpuise)}</TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(product)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            {shouldShowValidateButton(product) && (user?.role === 'admin' || user?.role === 'manager' || user?.role === 'directeur') && (
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => handleValidate(product.id)}
                                disabled={validateMutation.isPending}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </Button>
                            )}
                            
                            {/* Bouton Stock épuisé - accessible à tous, seulement pour produits en cours */}
                            {!product.stockEpuise && product.status === "en_cours" && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleMarkStockEpuise(product.id)}
                                      disabled={markStockEpuiseMutation.isPending}
                                      className="border-yellow-300 text-yellow-700 hover:bg-yellow-50"
                                    >
                                      <PackageX className="w-4 h-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Marquer comme stock épuisé</p>
                                    <p className="text-xs text-muted-foreground">
                                      Indique que ce produit n'est plus en stock (différent de périmé)
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                            
                            {/* Bouton Restaurer stock - réservé aux admins, directeurs et managers */}
                            {product.stockEpuise && (user?.role === 'admin' || user?.role === 'manager' || user?.role === 'directeur') && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleRestoreStock(product.id)}
                                      disabled={restoreStockMutation.isPending}
                                      className="border-blue-300 text-blue-700 hover:bg-blue-50"
                                    >
                                      <RotateCcw className="w-4 h-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Restaurer le stock</p>
                                    <p className="text-xs text-muted-foreground">
                                      Marquer ce produit comme à nouveau disponible en stock
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDelete(product.id)}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            
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
          </CardContent>
        </Card>
      </div>

      {/* Modal de confirmation de suppression */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer ce produit DLC ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}