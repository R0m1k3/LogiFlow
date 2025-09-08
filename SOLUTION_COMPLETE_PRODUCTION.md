# 🚀 SOLUTION COMPLÈTE - MODULE AVOIRS PRODUCTION

## 🔥 PROBLÈME RÉSOLU
- Erreur `contact_email` supprimée
- Interface React corrigée pour les champs optionnels
- Prêt pour la production

## 📋 ÉTAPES DE DÉPLOIEMENT

### ÉTAPE 1 - Base de données (Exécuter dans votre console PostgreSQL)
```sql
-- Corriger la structure de la table avoirs
ALTER TABLE avoirs ALTER COLUMN invoice_reference DROP NOT NULL;
ALTER TABLE avoirs ALTER COLUMN amount DROP NOT NULL;

-- Vérifier la correction
SELECT column_name, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'avoirs' 
AND column_name IN ('invoice_reference', 'amount');
```

### ÉTAPE 2 - Fichiers à remplacer sur votre serveur

#### A) shared/schema.ts (section avoirs uniquement)
Remplacez la section avoirs par :
```typescript
export const avoirs = pgTable("avoirs", {
  id: serial("id").primaryKey(),
  supplierId: integer("supplier_id").notNull(),
  groupId: integer("group_id").notNull(),
  invoiceReference: varchar("invoice_reference"), // OPTIONNEL
  amount: decimal("amount", { precision: 10, scale: 2 }), // OPTIONNEL
  comment: text("comment"),
  commercialProcessed: boolean("commercial_processed").default(false),
  status: varchar("status").notNull().default("En attente de demande"),
  webhookSent: boolean("webhook_sent").default(false),
  nocodbVerified: boolean("nocodb_verified").default(false),
  nocodbVerifiedAt: timestamp("nocodb_verified_at"),
  processedAt: timestamp("processed_at"),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAvoirSchema = createInsertSchema(avoirs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  webhookSent: true,
  nocodbVerified: true,
  nocodbVerifiedAt: true,
  processedAt: true,
});

export type Avoir = typeof avoirs.$inferSelect;
export type InsertAvoir = z.infer<typeof insertAvoirSchema>;
```

#### B) client/src/pages/Avoirs.tsx
**FICHIER COMPLET CORRIGÉ - Copiez tout :**

```typescript
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Plus, Search, FileText, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

// Types
interface Avoir {
  id: number;
  supplierId: number;
  groupId: number;
  invoiceReference?: string;  // OPTIONNEL
  amount?: number;           // OPTIONNEL
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
    phone?: string;
  };
  group: {
    id: number;
    name: string;
    color: string;
  };
  creator: {
    id: string;
    username: string;
    firstName?: string;
    lastName?: string;
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

  // Filter avoirs based on search term - CORRECTION CRITIQUE
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

  // Check permissions
  if ((user as any)?.role === 'employee') {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Accès refusé</h2>
          <p className="text-gray-600">Vous n'avez pas les permissions pour accéder aux avoirs.</p>
        </div>
      </div>
    );
  }

  const canCreate = ['admin', 'directeur', 'manager'].includes((user as any)?.role);
  const userGroups = (user as any)?.userGroups || [];
  const availableGroups = (user as any)?.role === 'admin' ? groups : userGroups.map((ug: any) => ug.group);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Avoirs</h1>
          <p className="text-gray-600 mt-2">
            Gestion des demandes d'avoirs et suivi des remboursements
          </p>
        </div>
        
        {canCreate && (
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Créer un avoir
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Créer un nouvel avoir</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="supplierId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fournisseur *</FormLabel>
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
                        <FormLabel>Magasin *</FormLabel>
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
                            {availableGroups.map((group: any) => (
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
                          <Input {...field} placeholder="FAC-2024-001" />
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
                        <FormLabel>Montant (optionnel)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01"
                            placeholder="0.00"
                            {...field}
                            onChange={(e) => {
                              const value = e.target.value;
                              field.onChange(value ? parseFloat(value) : undefined);
                            }}
                            value={field.value || ''}
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
        )}
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
                  <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : filteredAvoirs.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun avoir trouvé</h3>
            <p className="text-gray-500 text-center mb-6">
              {searchTerm ? "Aucun avoir ne correspond à votre recherche." : "Commencez par créer votre premier avoir."}
            </p>
            {canCreate && !searchTerm && (
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Créer un avoir
              </Button>
            )}
          </div>
        ) : (
          filteredAvoirs.map((avoir) => (
            <Card key={avoir.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center">
                    {getStatusIcon(avoir.status)}
                    <span className="ml-2">#{avoir.invoiceReference || 'Sans référence'}</span>
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
                    <span className="font-bold text-lg">{avoir.amount ? avoir.amount.toFixed(2) + ' €' : 'Non spécifié'}</span>
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
                  
                  <div className="flex items-center space-x-4 text-xs">
                    {avoir.webhookSent && (
                      <div className="flex items-center text-green-600">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Webhook envoyé
                      </div>
                    )}
                    {avoir.nocodbVerified && (
                      <div className="flex items-center text-blue-600">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        NocoDB vérifié
                      </div>
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
```

### ÉTAPE 3 - Redémarrer votre serveur
```bash
# Sur votre serveur
sudo systemctl restart votre-service-node
# ou
pm2 restart all
# ou simplement redémarrer Node.js
```

### ÉTAPE 4 - Test final
1. Ouvrez votre application
2. Allez dans le menu Avoirs
3. Créez un avoir sans référence facture ni montant
4. Vérifiez que ça fonctionne

## ✅ RÉSULTAT ATTENDU
- Plus d'erreur "contact_email"
- Interface qui se charge sans crash
- Possibilité de créer des avoirs avec champs optionnels
- Affichage correct des listes

## 🆘 SI ÇA NE MARCHE TOUJOURS PAS
Ouvrez la console de votre navigateur (F12) et copiez-moi EXACTEMENT les erreurs affichées.