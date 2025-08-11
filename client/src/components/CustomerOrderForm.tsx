import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { useAuthUnified } from "@/hooks/useAuthUnified";
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
import { insertCustomerOrderSchema, type CustomerOrderWithRelations, type Group, type Supplier } from "@shared/schema";
import { useStore } from "@/components/Layout";

const customerOrderFormSchema = insertCustomerOrderSchema.extend({
  deposit: z.string().optional(),
  gencode: z.string().min(1, "Le gencode est obligatoire"),
  customerName: z.string().min(1, "Le nom du client est obligatoire"),
  quantity: z.union([z.string(), z.number()]).transform(val => typeof val === 'string' ? parseInt(val) || 1 : val),
  supplierId: z.union([z.string(), z.number()]).transform(val => typeof val === 'string' ? parseInt(val) : val),
  groupId: z.union([z.string(), z.number()]).transform(val => typeof val === 'string' ? parseInt(val) : val).optional(),
  createdBy: z.string().optional(), // Will be set automatically
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

  const form = useForm<CustomerOrderFormData>({
    resolver: zodResolver(customerOrderFormSchema),
    defaultValues: {
      orderTaker: order?.orderTaker || user?.name || "",
      customerName: order?.customerName || "",
      customerPhone: order?.customerPhone || "",
      productDesignation: order?.productDesignation || "",
      productReference: order?.productReference || "",
      gencode: order?.gencode || "",
      quantity: order?.quantity || 1,
      supplierId: order?.supplierId || undefined,
      status: "En attente de Commande", // Statut fixe
      deposit: order?.deposit ? order.deposit.toString() : "0",
      isPromotionalPrice: order?.isPromotionalPrice || false,
      customerNotified: order?.customerNotified || false,
      groupId: order?.groupId || (user?.role === 'admin' && selectedStoreId ? selectedStoreId : user?.userGroups?.[0]?.groupId) || undefined, // Respect admin store selection
    },
  });

  const handleSubmit = (data: CustomerOrderFormData) => {
    console.log("Form submission data:", data);
    console.log("Form errors:", form.formState.errors);
    console.log("Form is valid:", form.formState.isValid);
    
    // Validate required fields
    if (!data.customerName || data.customerName.trim() === '') {
      console.error("Customer name is required but empty");
      return;
    }
    
    // Ensure groupId is set - prioritize selectedStoreId for admins
    let groupId = data.groupId;
    if (!groupId) {
      if (user?.role === 'admin' && selectedStoreId) {
        // Admin has selected a specific store - use it
        groupId = selectedStoreId;
        console.log("🏪 Using admin selected store:", selectedStoreId);
      } else if (user?.userGroups?.[0]?.groupId) {
        groupId = user.userGroups[0].groupId;
      } else if (user?.role === 'admin' && groups.length > 0) {
        groupId = groups[0].id; // Admin in "tous magasins" mode - use first group
      }
    }
    
    if (!groupId) {
      console.error("No groupId available - user groups:", user?.userGroups, "available groups:", groups);
      return;
    }
    
    // Prepare data with proper types
    const submitData = {
      ...data,
      customerName: data.customerName.trim(), // Clean the customer name
      deposit: data.deposit || "0.00", // Keep as string for decimal field
      groupId: typeof groupId === 'number' ? groupId : parseInt(groupId.toString()),
      createdBy: user?.id || '', // Add the current user ID
    };
    console.log("Processed submit data:", submitData);
    onSubmit(submitData);
  };

  // Get available groups for the user
  const availableGroups = user?.role === 'admin' 
    ? groups 
    : user?.userGroups?.map(ug => ug.group) || [];

  // Auto-select group for users respecting admin store selection
  const currentGroupId = form.getValues('groupId');
  if (!currentGroupId) {
    if (user?.role === 'admin' && selectedStoreId) {
      // Admin has selected a specific store - use it
      form.setValue('groupId', selectedStoreId);
      console.log("🏪 Auto-selecting admin store:", selectedStoreId);
    } else if (user?.userGroups?.[0]?.groupId) {
      // User has assigned groups - use first one
      form.setValue('groupId', user.userGroups[0].groupId);
    } else if (user?.role === 'admin' && groups.length > 0) {
      // Admin with no specific groups - use first available group
      form.setValue('groupId', groups[0].id);
    }
  }

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
              name="customerPhone"
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
                  <Select onValueChange={field.onChange} value={field.value?.toString()}>
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

            {/* Magasin automatiquement sélectionné - pas de champ visible */}
          
            <h3 className="text-lg font-medium">Informations produit</h3>
            
            <FormField
              control={form.control}
              name="productDesignation"
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
                    <Input placeholder="REF-123456" {...field} />
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
                    <Input placeholder="Code à barres" {...field} />
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
            disabled={isLoading}
            onClick={(e) => {
              console.log("Submit button clicked");
              console.log("Form state:", form.formState);
              console.log("Form values:", form.getValues());
              console.log("Form validation errors:", form.formState.errors);
              console.log("Current user context:", user?.userGroups, "available groups:", groups);
            }}
          >
            {isLoading ? "Enregistrement..." : order ? "Modifier" : "Créer"}
          </Button>
        </div>
      </form>
    </Form>
  );
}