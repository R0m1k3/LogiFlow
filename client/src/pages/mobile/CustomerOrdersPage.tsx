/**
 * MobileCustomerOrdersPage.tsx
 * Version mobile de la page Commandes Clients avec création
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthUnified } from "@/hooks/useAuthUnified";
import { useStore } from "@/contexts/StoreContext";
import MobileLayout from "./MobileLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Package,
    Search,
    Phone,
    User,
    ClipboardList,
    Plus,
    MoreVertical,
    X,
    Filter
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

// Schema for form validation
const customerOrderFormSchema = z.object({
    customerName: z.string().min(1, "Nom du client est requis"),
    contactNumber: z.string().optional(),
    productName: z.string().min(1, "Désignation est requise"),
    productReference: z.string().optional(),
    gencode: z.string().optional(),
    quantity: z.coerce.number().int().positive().default(1),
    supplierId: z.coerce.number().int().positive().default(1),
    orderTaker: z.string().optional(),
    notes: z.string().optional(),
    deposit: z.coerce.number().optional().default(0),
});

export default function MobileCustomerOrdersPage() {
    const { user } = useAuthUnified();
    const { selectedStoreId } = useStore();
    const [searchTerm, setSearchTerm] = useState("");
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const { toast } = useToast();
    const queryClient = useQueryClient();

    // Queries
    const { data: orders = [], isLoading } = useQuery({
        queryKey: ["/api/customer-orders", selectedStoreId],
        queryFn: async () => {
            if (!selectedStoreId) return [];
            const response = await fetch(
                `/api/customer-orders?storeId=${selectedStoreId}`,
                { credentials: 'include' }
            );
            if (!response.ok) throw new Error("Failed to fetch customer orders");
            return response.json();
        },
        enabled: !!selectedStoreId && !!user,
    });

    const { data: suppliers = [] } = useQuery({
        queryKey: ['/api/suppliers'],
        queryFn: async () => {
            const res = await fetch('/api/suppliers', { credentials: 'include' });
            return res.json();
        }
    });

    const { data: groups = [] } = useQuery({
        queryKey: ['/api/groups'],
        queryFn: async () => {
            const res = await fetch('/api/groups', { credentials: 'include' });
            return res.json();
        }
    });

    // Mutations
    const statusMutation = useMutation({
        mutationFn: ({ id, status }: { id: number; status: string }) =>
            apiRequest(`/api/customer-orders/${id}`, 'PUT', { status }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/customer-orders"] });
            toast({ title: "Statut mis à jour" });
        },
    });

    const createMutation = useMutation({
        mutationFn: (data: any) => apiRequest('/api/customer-orders', 'POST', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/customer-orders"] });
            toast({ title: "Commande créée avec succès" });
            setIsCreateOpen(false);
            form.reset();
        },
        onError: (err: any) => {
            toast({
                title: "Erreur lors de la création",
                description: err.message,
                variant: "destructive"
            });
        }
    });

    // Form setup
    const form = useForm({
        resolver: zodResolver(customerOrderFormSchema),
        defaultValues: {
            customerName: "",
            contactNumber: "",
            productName: "",
            productReference: "",
            gencode: "",
            quantity: 1,
            supplierId: 1,
            orderTaker: user?.username || "",
            notes: "",
            deposit: 0
        }
    });

    const onSubmit = (data: any) => {
        // Validation basique groupe
        let groupId = selectedStoreId;
        if (!groupId && user?.userGroups?.[0]?.groupId) {
            groupId = user.userGroups[0].groupId;
        }
        if (!groupId && groups.length > 0 && user?.role === 'admin') {
            groupId = groups[0].id;
        }

        if (!groupId) {
            toast({ title: "Erreur", description: "Impossible de déterminer le magasin", variant: "destructive" });
            return;
        }

        const submitData = {
            ...data,
            customerPhone: data.contactNumber,
            productDesignation: data.productName,
            status: "En attente de Commande",
            groupId,
            isPromotionalPrice: data.isPromotionalPrice,
            customerNotified: data.customerNotified
        };

        createMutation.mutate(submitData);
    };

    const filteredOrders = orders.filter((order: any) =>
        order.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.productDesignation.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (order.productReference && order.productReference.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const getStatusColor = (status: string) => {
        switch (status) {
            case "Disponible": return "bg-green-100 text-green-800 border-green-200";
            case "Commande en Cours": return "bg-blue-100 text-blue-800 border-blue-200";
            case "Retiré": return "bg-gray-100 text-gray-800 border-gray-200";
            case "Annulé": return "bg-red-100 text-red-800 border-red-200";
            default: return "bg-yellow-100 text-yellow-800 border-yellow-200";
        }
    };

    return (
        <MobileLayout>
            <div className="p-4 space-y-4 pb-20">
                {/* Header */}
                <div className="flex items-center gap-2">
                    <Package className="h-6 w-6 text-blue-600" />
                    <h1 className="text-xl font-bold text-gray-900">Commandes Clients</h1>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                    <Input
                        placeholder="Client, produit, rév..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 h-10"
                    />
                </div>

                {/* Orders List */}
                <div className="space-y-3">
                    {isLoading ? (
                        <div className="flex justify-center p-8">
                            <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
                        </div>
                    ) : filteredOrders.length === 0 ? (
                        <div className="text-center py-10 text-gray-500 bg-white rounded-lg border border-dashed border-gray-300">
                            <Package className="h-10 w-10 mx-auto text-gray-300 mb-2" />
                            <p>Aucune commande trouvée</p>
                        </div>
                    ) : (
                        filteredOrders.map((order: any) => (
                            <Card key={order.id} className="overflow-hidden">
                                <CardContent className="p-4">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex-1">
                                            <div className="flex items-center justify-between mb-1">
                                                <Badge className={`${getStatusColor(order.status)} border px-2 py-0.5 text-xs`}>
                                                    {order.status}
                                                </Badge>
                                                <span className="text-xs text-gray-500">
                                                    {format(new Date(order.createdAt), "dd/MM", { locale: fr })}
                                                </span>
                                            </div>
                                            <h3 className="font-bold text-gray-900 leading-tight">
                                                {order.customerName}
                                            </h3>
                                            <p className="text-sm text-gray-600 line-clamp-1 mt-1">
                                                {order.productDesignation}
                                            </p>
                                        </div>

                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 -mr-2">
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => statusMutation.mutate({ id: order.id, status: 'Disponible' })}>
                                                    Marquer Disponible
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => statusMutation.mutate({ id: order.id, status: 'Retiré' })}>
                                                    Marquer Retiré
                                                </DropdownMenuItem>
                                                <DropdownMenuItem className="text-red-600" onClick={() => statusMutation.mutate({ id: order.id, status: 'Annulé' })}>
                                                    Annuler
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>

                                    <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100 text-sm text-gray-600">
                                        {order.customerPhone && (
                                            <a
                                                href={`tel:${order.customerPhone}`}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 rounded-full hover:bg-green-100 transition-colors"
                                            >
                                                <Phone className="h-3.5 w-3.5" />
                                                <span className="font-medium">Appeler</span>
                                            </a>
                                        )}
                                        <div className="flex items-center gap-1.5 ml-auto">
                                            <div className="bg-gray-100 px-2 py-1 rounded text-xs">
                                                Qty: {order.quantity || 1}
                                            </div>
                                            {order.deposit && parseFloat(order.deposit) > 0 && (
                                                <div className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs font-medium">
                                                    Acompte: {parseFloat(order.deposit)}€
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

            {/* Create Order Sheet */}
            <Sheet open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <SheetContent side="bottom" className="h-[90vh] overflow-y-auto rounded-t-xl px-4 py-6">
                    <SheetHeader className="mb-6">
                        <SheetTitle className="text-left flex items-center gap-2">
                            <Plus className="h-5 w-5 bg-blue-100 text-blue-600 rounded p-0.5" />
                            Nouvelle Commande
                        </SheetTitle>
                    </SheetHeader>

                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pb-8">

                            <div className="bg-gray-50 p-3 rounded-lg space-y-3">
                                <h3 className="font-medium text-sm text-gray-500 uppercase">Client</h3>
                                <FormField
                                    control={form.control}
                                    name="customerName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Nom</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Nom du client" {...field} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="contactNumber"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Téléphone</FormLabel>
                                            <FormControl>
                                                <Input placeholder="06..." type="tel" {...field} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <div className="bg-gray-50 p-3 rounded-lg space-y-3">
                                <h3 className="font-medium text-sm text-gray-500 uppercase">Produit</h3>
                                <FormField
                                    control={form.control}
                                    name="productName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Désignation</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Nom du produit" {...field} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                <div className="flex gap-3">
                                    <FormField
                                        control={form.control}
                                        name="quantity"
                                        render={({ field }) => (
                                            <FormItem className="flex-1">
                                                <FormLabel>Qté</FormLabel>
                                                <FormControl>
                                                    <Input type="number" {...field} />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="deposit"
                                        render={({ field }) => (
                                            <FormItem className="flex-1">
                                                <FormLabel>Acompte (€)</FormLabel>
                                                <FormControl>
                                                    <Input type="number" step="0.01" {...field} />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                <FormField
                                    control={form.control}
                                    name="supplierId"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Fournisseur</FormLabel>
                                            <Select
                                                onValueChange={(val) => field.onChange(parseInt(val))}
                                                defaultValue={field.value.toString()}
                                            >
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Choisir..." />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {suppliers.map((s: any) => (
                                                        <SelectItem key={s.id} value={s.id.toString()}>
                                                            {s.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="gencode"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Gencode (Scanner si dispo)</FormLabel>
                                            <FormControl>
                                                <Input placeholder="EAN13" {...field} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <FormField
                                control={form.control}
                                name="isPromotionalPrice"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                                        <FormControl>
                                            <Checkbox
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                        </FormControl>
                                        <div className="space-y-1 leading-none">
                                            <FormLabel>
                                                Prix promotionnel / Pub
                                            </FormLabel>
                                        </div>
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="customerNotified"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                                        <FormControl>
                                            <Checkbox
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                        </FormControl>
                                        <div className="space-y-1 leading-none">
                                            <FormLabel>
                                                Client déjà notifié
                                            </FormLabel>
                                        </div>
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="notes"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Notes internes</FormLabel>
                                        <FormControl>
                                            <Textarea placeholder="..." className="h-20" {...field} />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />

                            <Button type="submit" className="w-full bg-blue-600 h-12 text-lg font-bold shadow-lg mt-4" disabled={createMutation.isPending}>
                                {createMutation.isPending ? "Création..." : "Valider la commande"}
                            </Button>
                        </form>
                    </Form>
                </SheetContent>
            </Sheet>

            {/* FAB */}
            <Button
                className="fixed bottom-20 right-4 h-14 w-14 rounded-full shadow-lg bg-blue-600 hover:bg-blue-700 p-0 flex items-center justify-center z-50 transition-transform active:scale-95"
                onClick={() => setIsCreateOpen(true)}
            >
                <Plus className="h-6 w-6 text-white" />
            </Button>
        </MobileLayout>
    );
}
