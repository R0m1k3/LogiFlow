import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, FileText, CheckCircle, AlertCircle, Clock, Edit, Trash2, UserCheck } from "lucide-react";
import { useStore } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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

export default function Avoirs() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedAvoir, setSelectedAvoir] = useState<Avoir | null>(null);
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
      queryClient.invalidateQueries({ queryKey: ['/api/avoirs'] });
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
    mutationFn: async ({ id, data }: { id: number, data: AvoirFormData }) => {
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
      queryClient.invalidateQueries({ queryKey: ['/api/avoirs'] });
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
      queryClient.invalidateQueries({ queryKey: ['/api/avoirs'] });
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

  // Confirm delete
  const confirmDelete = () => {
    if (selectedAvoir) {
      deleteAvoirMutation.mutate(selectedAvoir.id);
    }
  };

  // Filter avoirs based on search term
  const filteredAvoirs = avoirs.filter(avoir =>
    avoir.invoiceReference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    avoir.supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
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
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nouvel avoir
            </Button>
          </DialogTrigger>
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAvoirs.map((avoir) => {
                  const canEditDelete = ['admin', 'directeur'].includes((user as any)?.role);
                  
                  return (
                    <tr key={avoir.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {avoir.supplier.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {getStatusIcon(avoir.status)}
                          <Badge variant={getStatusVariant(avoir.status)} className="ml-2">
                            {avoir.status}
                          </Badge>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        #{avoir.invoiceReference || 'Sans référence'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center">
                          <div 
                            className="w-3 h-3 rounded-full mr-2" 
                            style={{ backgroundColor: avoir.group.color }}
                          />
                          {avoir.group.name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        <div className="flex items-center">
                          {avoir.amount ? `${avoir.amount.toFixed(2)} €` : 'Non spécifié'}
                          {avoir.commercialProcessed && (
                            <div title="Avoir fait par commercial">
                              <UserCheck className="h-4 w-4 text-blue-600 ml-2" />
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
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {canEditDelete ? (
                          <div className="flex items-center space-x-2">
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
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">Lecture seule</span>
                        )}
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
                    <div><strong>Fournisseur:</strong> {selectedAvoir.supplier.name}</div>
                    <div><strong>Référence:</strong> {selectedAvoir.invoiceReference || 'Sans référence'}</div>
                    <div><strong>Montant:</strong> {selectedAvoir.amount ? `${selectedAvoir.amount.toFixed(2)} €` : 'Non spécifié'}</div>
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
    </div>
  );
}