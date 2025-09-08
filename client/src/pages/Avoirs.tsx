import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, FileText, CheckCircle, AlertCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
  supplierId: z.number().min(1, "Veuillez sélectionner un fournisseur"),
  groupId: z.number().min(1, "Veuillez sélectionner un magasin"),
  invoiceReference: z.string().optional(),
  amount: z.number().optional(),
  comment: z.string().optional(),
  commercialProcessed: z.boolean().optional(),
});

type AvoirFormData = z.infer<typeof avoirSchema>;

export default function Avoirs() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState<string>("all");
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

  // Fetch avoirs
  const { data: avoirs = [], isLoading } = useQuery<Avoir[]>({
    queryKey: ['/api/avoirs', selectedStoreId],
    queryFn: () => apiRequest(`/api/avoirs${selectedStoreId !== 'all' ? `?storeId=${selectedStoreId}` : ''}`),
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

  // Initialize form
  const form = useForm<AvoirFormData>({
    resolver: zodResolver(avoirSchema),
    defaultValues: {
      supplierId: 0,
      groupId: 0,
      invoiceReference: "",
      amount: undefined,
      comment: "",
      commercialProcessed: false,
    },
  });

  // Handle form submission
  const onSubmit = (data: AvoirFormData) => {
    createAvoirMutation.mutate(data);
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
                          {groups.map((group) => (
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
        
        {(user as any)?.role === 'admin' && (
          <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Tous les magasins" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les magasins</SelectItem>
              {groups.map((group) => (
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
        )}
      </div>

      {/* Avoirs List */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-200 rounded"></div>
                  <div className="h-3 bg-gray-200 rounded w-4/5"></div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : filteredAvoirs.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <FileText className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Aucun avoir</h3>
            <p className="mt-1 text-sm text-gray-500">
              Commencez par créer votre premier avoir.
            </p>
          </div>
        ) : (
          filteredAvoirs.map((avoir) => (
            <Card key={avoir.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center">
                    {getStatusIcon(avoir.status)}
                    <span className="ml-2">#{avoir.invoiceReference}</span>
                  </CardTitle>
                  <Badge variant={getStatusVariant(avoir.status)}>
                    {avoir.status}
                  </Badge>
                </div>
                <CardDescription>
                  <div className="flex items-center">
                    <div 
                      className="w-3 h-3 rounded-full mr-2" 
                      style={{ backgroundColor: avoir.group.color }}
                    />
                    {avoir.group.name}
                  </div>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Fournisseur:</span>
                    <span className="font-medium">{avoir.supplier.name}</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Montant:</span>
                    <span className="font-bold text-lg">{avoir.amount.toFixed(2)} €</span>
                  </div>
                  
                  {avoir.comment && (
                    <div className="pt-2 border-t">
                      <p className="text-sm text-muted-foreground italic">
                        "{avoir.comment}"
                      </p>
                    </div>
                  )}
                  
                  <div className="pt-2 border-t">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>
                        Par {avoir.creator.firstName && avoir.creator.lastName 
                          ? `${avoir.creator.firstName} ${avoir.creator.lastName}`
                          : avoir.creator.username
                        }
                      </span>
                      <span>
                        {format(new Date(avoir.createdAt), "dd/MM/yyyy", { locale: fr })}
                      </span>
                    </div>
                  </div>
                  
                  {avoir.commercialProcessed && (
                    <div className="flex items-center text-xs text-green-600">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Traité par commercial
                    </div>
                  )}
                  
                  <div className="flex items-center space-x-2">
                    {avoir.webhookSent && (
                      <Badge variant="secondary" className="text-xs">
                        Webhook envoyé
                      </Badge>
                    )}
                    {avoir.nocodbVerified && (
                      <Badge variant="default" className="text-xs">
                        Vérifié NocoDB
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}