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
import { insertCustomerOrderFrontendSchema, type CustomerOrderWithRelations, type Group, type Supplier } from "@shared/schema";
import { useStore } from "@/components/Layout";

const customerOrderFormSchema = insertCustomerOrderFrontendSchema.extend({
  groupId: z.coerce.number().int().positive().optional(),
  createdBy: z.string().optional(),
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
      contactNumber: order?.customerPhone || "",
      productName: order?.productDesignation || "",
      productReference: order?.productReference || "",
      gencode: order?.gencode || "",
      quantity: order?.quantity || 1,
      supplierId: order?.supplierId || undefined,
      status: "En attente de Commande", // Statut fixe
      deposit: order?.deposit || 0,
      isPromotionalPrice: order?.isPromotionalPrice || false,
      customerNotified: order?.customerNotified || false,
      groupId: order?.groupId || (user?.userGroups?.[0]?.groupId || (user?.role === 'admin' && selectedStoreId ? selectedStoreId : 1)), // PRIORITÉ: groupe utilisateur assigné
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
    
    // Ensure groupId is set - force assignment for ALL users
    let groupId = data.groupId;
    
    console.log("🔍 CUSTOMER ORDER FRONTEND DEBUG - Complete user data:", {
      userRole: user?.role,
      selectedStoreId,
      userHasGroups: !!user?.userGroups,
      userGroupsLength: user?.userGroups?.length,
      userGroups: user?.userGroups?.map(ug => ({
        groupId: ug.groupId || ug.group?.id, 
        groupName: ug.group?.name,
        fullGroupData: ug
      })),
      initialGroupId: groupId,
      availableGroups: groups.map(g => ({id: g.id, name: g.name})),
      fullUserObject: user
    });
    
    // FORCE L'UTILISATION DU GROUPE ASSIGNÉ EN PREMIER - MÊME LOGIQUE QUE DLC
    if (!groupId) {
      if (user?.userGroups?.[0]?.groupId) {
        // Utilisateur avec groupe assigné : TOUJOURS utiliser ce groupe (PRIORITÉ)
        groupId = user.userGroups[0].groupId;
        console.log("🎯 Customer Order Frontend: Using user's assigned group (PRIORITY):", groupId);
      } else if (user?.role === 'admin' && selectedStoreId) {
        // Admin avec magasin sélectionné ET pas de groupe assigné
        groupId = selectedStoreId;
        console.log("🎯 Customer Order Frontend: Using admin selected store:", groupId);
      } else if (user?.role === 'admin' && groups.length > 0) {
        // Admin sans sélection : premier groupe disponible
        groupId = groups[0].id;
        console.log("🎯 Customer Order Frontend: Using first group for admin:", groupId);
      } else if (groups.length > 0) {
        // EMERGENCY FALLBACK: Force assignment to first available group
        groupId = groups[0].id;
        console.log("⚠️ Customer Order Frontend: Emergency fallback to first group:", groupId);
      } else {
        // LAST RESORT: Hard-coded fallback
        groupId = 1;
        console.log("🚨 Customer Order Frontend: Using hard-coded groupId 1");
      }
    }
    
    console.log("✅ CUSTOMER ORDER - Final groupId selected:", groupId, typeof groupId);
    
    // Prepare data with proper types for frontend schema
    const submitData = {
      customerName: data.customerName.trim(),
      contactNumber: data.contactNumber || '', 
      productName: data.productName || '',
      quantity: data.quantity,
      groupId: typeof groupId === 'number' ? groupId : parseInt(groupId.toString()),
      isPickup: false,
      notes: data.notes,
      deposit: data.deposit || 0,
      isPromotionalPrice: data.isPromotionalPrice || false,
      customerEmail: data.customerEmail,
      gencode: data.gencode || '',
      supplierId: data.supplierId || 1,
    };
    console.log("🔍 CUSTOMER ORDER - Frontend submit data final:", submitData);
    console.log("🔍 CUSTOMER ORDER - Submit data groupId:", submitData.groupId, typeof submitData.groupId);
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