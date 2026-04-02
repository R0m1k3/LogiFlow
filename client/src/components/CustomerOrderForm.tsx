import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { useAuthUnified } from "@/hooks/useAuthUnified";
import { useState, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { insertCustomerOrderFrontendSchema, type CustomerOrderWithRelations, type Group, type Supplier } from "@shared/schema";
import { useStore } from "@/contexts/StoreContext";

const customerOrderFormSchema = z.object({
  orderTaker: z.string().min(1, "Qui a pris la commande est requis"),
  customerName: z.string().min(1, "Nom du client est requis"),
  contactNumber: z.string().optional(),
  productName: z.string().min(1, "Désignation du produit est requise"),
  productReference: z.string().optional(),
  gencode: z.string().optional(),
  quantity: z.coerce.number().int().positive().default(1),
  supplierId: z.coerce.number().int().positive().default(1),
  groupId: z.coerce.number().int().positive(),
  deposit: z.coerce.number().default(0),
  isPromotionalPrice: z.boolean().default(false),
  customerNotified: z.boolean().default(false),
  notes: z.string().optional(),
  customerEmail: z.string().optional(),
});

type CustomerOrderFormData = z.infer<typeof customerOrderFormSchema>;

interface CustomerOrderFormProps {
  order?: CustomerOrderWithRelations;
  onSubmit: (data: CustomerOrderFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const STATUS_OPTIONS = [
  "En attente de Commande",
  "Commande en Cours", 
  "Disponible",
  "Retiré",
  "Annulé"
];

export function CustomerOrderForm({ 
  order, 
  onSubmit, 
  onCancel, 
  isLoading = false 
}: CustomerOrderFormProps) {
  const { user } = useAuthUnified();
  const { selectedStoreId } = useStore();


  // Fetch groups for store selection
  const { data: groups = [] } = useQuery<Group[]>({
    queryKey: ['/api/groups'],
  });

  // Fetch suppliers for supplier selection
  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ['/api/suppliers'],
  });

  // Get user's assigned group automatically - no selection needed
  const getUserAssignedGroupId = () => {
    // Priority 1: User's first assigned group (employees have exactly one group)
    if (user?.userGroups?.[0]?.groupId) {
      return user.userGroups[0].groupId;
    }
    
    // Priority 2: Admin can use selected store
    if (user?.role === 'admin' && selectedStoreId) {
      return selectedStoreId;
    }
    
    // Priority 3: Admin gets first available group if no store selected
    if (user?.role === 'admin' && groups.length > 0) {
      return groups[0].id;
    }
    
    return null;
  };

  const form = useForm<CustomerOrderFormData>({
    resolver: zodResolver(customerOrderFormSchema),
    defaultValues: {
      orderTaker: order?.orderTaker || user?.name || "",
      customerName: order?.customerName || "",
      contactNumber: order?.customerPhone || "",
      productName: order?.productDesignation || "",
      productReference: order?.productReference || "",
      gencode: order?.gencode || "",
      quantity: order?.quantity || 1,
      supplierId: order?.supplierId || 1,
      status: "En attente de Commande", // Statut fixe
      deposit: order?.deposit || 0,
      isPromotionalPrice: order?.isPromotionalPrice || false,
      customerNotified: order?.customerNotified || false,
      groupId: order?.groupId || getUserAssignedGroupId() || 1,
    },
  });

  const handleSubmit = (data: CustomerOrderFormData) => {
    if (!data.customerName || data.customerName.trim() === '') return;

    const groupId = getUserAssignedGroupId();
    if (!groupId) {
      alert("ERREUR: Votre utilisateur n'a pas de magasin assigné. Contactez l'administrateur.");
      return;
    }

    const submitData = {
      orderTaker: data.orderTaker || user?.firstName + ' ' + user?.lastName || user?.username || "Inconnu",
      customerName: data.customerName.trim(),
      customerPhone: data.contactNumber || '',
      customerEmail: data.customerEmail || '',
      productDesignation: data.productName || '',
      productReference: data.productReference || '',
      gencode: data.gencode || '',
      quantity: data.quantity,
      supplierId: data.supplierId || 1,
      status: data.status || "En attente de Commande",
      deposit: data.deposit || 0,
      isPromotionalPrice: data.isPromotionalPrice || false,
      customerNotified: data.customerNotified || false,
      notes: data.notes || '',
      groupId: groupId,
    };
    onSubmit(submitData);
  };

  // Auto-ensure groupId is always set to user's assigned group
  const currentGroupId = form.getValues('groupId');
  const userGroupId = getUserAssignedGroupId();
  if (!currentGroupId && userGroupId) {
    form.setValue('groupId', userGroupId);
  }

  // Lookup API ffnancy par gencode ou référence
  const [articleLookupLoading, setArticleLookupLoading] = useState(false);
  const [articleNotFound, setArticleNotFound] = useState(false);
  // Flag pour éviter que le remplissage auto de productReference ne redéclenche une recherche
  const autoFilledRef = useRef(false);
  // En mode édition, ignorer les watchers au premier rendu (valeurs déjà remplies)
  const initialGencodeSkipRef = useRef(!!order);
  const initialRefSkipRef = useRef(!!order);
  const lookupDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gencodeValue = form.watch("gencode");
  const referenceValue = form.watch("productReference");

  const fetchAndFillArticle = async (params: URLSearchParams) => {
    setArticleLookupLoading(true);
    setArticleNotFound(false);
    try {
      const res = await fetch(`/api/ffnancy/articles?${params}&limit=1`, { credentials: 'include' });
      if (!res.ok) { setArticleNotFound(true); return; }
      const data = await res.json();
      const article = data.articles?.[0];
      if (!article) { setArticleNotFound(true); return; }

      setArticleNotFound(false);
      autoFilledRef.current = true; // bloquer le watcher référence
      form.setValue("productName", article.libelle1, { shouldValidate: true });
      if (article.gtin) form.setValue("gencode", article.gtin, { shouldValidate: true });
      if (article.ref_fou_principale) form.setValue("productReference", article.ref_fou_principale, { shouldValidate: true });

      // Fournisseur : dernière entrée en stock en priorité
      let codefouToMatch = article.codefou_principal;
      try {
        const mvtRes = await fetch(
          `/api/ffnancy/mouvements/entrees?artNoId=${article.no_id}&limit=1&dateDebut=2000-01-01`,
          { credentials: 'include' }
        );
        if (mvtRes.ok) {
          const mvtData = await mvtRes.json();
          const lastEntree = mvtData.entrees?.[0];
          if (lastEntree?.codefou) codefouToMatch = lastEntree.codefou;
        }
      } catch { /* fallback codefou_principal */ }

      if (codefouToMatch) {
        const matched = (suppliers as any[]).find((s: any) =>
          s.codefou && s.codefou.trim().toLowerCase() === codefouToMatch.trim().toLowerCase()
        ) || (suppliers as any[]).find((s: any) =>
          s.name.toLowerCase().trim().includes(article.nom_fou_principal?.toLowerCase().trim() || '') ||
          (article.nom_fou_principal?.toLowerCase().trim() || '').includes(s.name.toLowerCase().trim())
        );
        if (matched) form.setValue("supplierId", matched.id, { shouldValidate: true });
      }
    } catch { setArticleNotFound(true); } finally {
      setArticleLookupLoading(false);
    }
  };

  useEffect(() => {
    if (initialGencodeSkipRef.current) { initialGencodeSkipRef.current = false; return; }
    if (!gencodeValue || gencodeValue.length < 8) { setArticleNotFound(false); return; }
    if (lookupDebounceRef.current) clearTimeout(lookupDebounceRef.current);
    lookupDebounceRef.current = setTimeout(() => {
      fetchAndFillArticle(new URLSearchParams({ ean: gencodeValue }));
    }, 600);
    return () => { if (lookupDebounceRef.current) clearTimeout(lookupDebounceRef.current); };
  }, [gencodeValue]);

  useEffect(() => {
    // Si la valeur a été remplie automatiquement, on ignore ce cycle
    if (autoFilledRef.current) { autoFilledRef.current = false; return; }
    if (initialRefSkipRef.current) { initialRefSkipRef.current = false; return; }
    if (!referenceValue || referenceValue.length < 3) { setArticleNotFound(false); return; }
    if (lookupDebounceRef.current) clearTimeout(lookupDebounceRef.current);
    lookupDebounceRef.current = setTimeout(() => {
      fetchAndFillArticle(new URLSearchParams({ codein: referenceValue }));
    }, 600);
    return () => { if (lookupDebounceRef.current) clearTimeout(lookupDebounceRef.current); };
  }, [referenceValue]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <div className="space-y-4">
          {/* Informations de commande */}
          <h3 className="text-lg font-medium">Informations de commande</h3>
            
            <FormField
              control={form.control}
              name="orderTaker"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Qui a pris la commande</FormLabel>
                  <FormControl>
                    <Input placeholder="Nom de l'employé" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="customerName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom du client</FormLabel>
                  <FormControl>
                    <Input placeholder="Nom complet du client" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contactNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>N° de téléphone</FormLabel>
                  <FormControl>
                    <Input placeholder="0X XX XX XX XX" {...field} />
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
                  <Select onValueChange={field.onChange} value={field.value?.toString() || "1"}>
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

            {/* Magasin automatiquement assigné selon l'utilisateur */}
          
            <h3 className="text-lg font-medium">Informations produit</h3>
            
            <FormField
              control={form.control}
              name="productName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Désignation du produit</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Description détaillée du produit"
                      rows={3}
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="productReference"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Référence (optionnel)</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input placeholder="REF-123456" {...field} className={articleLookupLoading ? "pr-8" : ""} />
                      {articleLookupLoading && <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-blue-500" />}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="gencode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Gencode (obligatoire)</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input placeholder="Code à barres" {...field} className={articleLookupLoading ? "pr-8" : ""} />
                      {articleLookupLoading && <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-blue-500" />}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantité</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      min="1"
                      placeholder="1"
                      {...field}
                      value={field.value?.toString() || "1"}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Statut fixé automatiquement à "En attente de Commande" */}

            {/* Options supplémentaires */}
            <h3 className="text-lg font-medium">Options supplémentaires</h3>
            
            <FormField
              control={form.control}
              name="deposit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Acompte (€)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      step="0.01" 
                      min="0"
                      placeholder="0.00" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isPromotionalPrice"
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
                      Prix publicité
                    </FormLabel>
                    <p className="text-sm text-muted-foreground">
                      Cocher si le produit était en promotion
                    </p>
                  </div>
                </FormItem>
              )}
            />

            {/* Case "Client appelé" cachée pour nouvelles commandes */}
        </div>

        {/* Produit non référencé — uniquement en création */}
        {articleNotFound && !order && (
          <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <span className="font-medium">Produit non référencé</span> — ce produit n'existe pas dans la base. La commande ne peut pas être créée.
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end space-x-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
          >
            Annuler
          </Button>
          <Button
            type="submit"
            disabled={isLoading || (articleNotFound && !order) || articleLookupLoading}
          >
            {isLoading ? "Enregistrement..." : order ? "Modifier" : "Créer"}
          </Button>
        </div>
      </form>
    </Form>
  );
}