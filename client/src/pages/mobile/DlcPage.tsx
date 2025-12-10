/**
 * MobileDlcPage.tsx
 * Version mobile de la page Gestion des DLC
 */
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthUnified } from "@/hooks/useAuthUnified";
import { useStore } from "@/contexts/StoreContext";
import MobileLayout from "./MobileLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Clock,
    Search,
    Plus,
    Filter,
    AlertTriangle,
    CheckCircle,
    X,
    Calendar,
    MoreVertical
} from "lucide-react";
import { format, parseISO } from "date-fns";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const dlcFormSchema = z.object({
    productName: z.string().min(1, "Nom du produit requis"),
    gencode: z.string().optional(),
    dlcDate: z.string().min(1, "Date requise"),
    dateType: z.enum(["dlc", "ddm", "dluo"]).default("dlc"),
    supplierId: z.coerce.number().min(1, "Fournisseur requis"),
    status: z.string().default("en_cours"),
    notes: z.string().optional(),
});

export default function MobileDlcPage() {
    const { user } = useAuthUnified();
    const { selectedStoreId } = useStore();
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("en_cours"); // en_cours, expires_soon, expires, valides
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const { toast } = useToast();
    const queryClient = useQueryClient();

    // Data fetching
    const { data: dlcProducts = [], isLoading } = useQuery({
        queryKey: ["/api/dlc-products", selectedStoreId, statusFilter, searchTerm],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (selectedStoreId) params.append("storeId", selectedStoreId.toString());
            // Simplify fetching everything client side for mobile smoothness or filter server side?
            // Let's filter client side for better UX given the likely smaller dataset per store
            if (selectedStoreId) {
                const res = await fetch(`/api/dlc-products?storeId=${selectedStoreId}`, { credentials: 'include' });
                return res.json();
            }
            return [];
        },
        enabled: !!selectedStoreId && !!user,
    });

    const { data: suppliers = [] } = useQuery({
        queryKey: ["/api/suppliers", "dlc"],
        queryFn: () => apiRequest("/api/suppliers?dlc=true"),
    });

    const { data: groups = [] } = useQuery({
        queryKey: ["/api/groups"],
        queryFn: () => apiRequest("/api/groups"),
    });

    // Mutations
    const createMutation = useMutation({
        mutationFn: (data: any) => apiRequest("/api/dlc-products", "POST", data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/dlc-products"] });
            toast({ title: "Produit ajouté" });
            setIsCreateOpen(false);
            form.reset();
        },
        onError: (err: any) => toast({ title: "Erreur", description: err.message, variant: "destructive" })
    });

    const validateMutation = useMutation({
        mutationFn: (id: number) => apiRequest(`/api/dlc-products/${id}/validate`, "POST"),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/dlc-products"] });
            toast({ title: "Produit validé (retiré)" });
        }
    });

    // Form
    const form = useForm({
        resolver: zodResolver(dlcFormSchema),
        defaultValues: {
            productName: "",
            gencode: "",
            dlcDate: format(new Date(), 'yyyy-MM-dd'),
            dateType: "dlc",
            supplierId: 1,
            status: "en_cours",
            notes: ""
        }
    });

    const onSubmit = (data: any) => {
        let groupId = selectedStoreId;
        if (!groupId && user?.userGroups?.[0]?.groupId) groupId = user.userGroups[0].groupId;
        if (!groupId && groups.length > 0 && user?.role === 'admin') groupId = groups[0].id;

        if (!groupId) {
            toast({ title: "Erreur", description: "Magasin introuvable", variant: "destructive" });
            return;
        }

        const submitData = {
            ...data,
            name: data.productName,
            expiryDate: new Date(data.dlcDate),
            quantity: 1,
            unit: "unité",
            location: "Magasin",
            alertThreshold: 15,
            groupId
        };
        createMutation.mutate(submitData);
    };

    // Filtering logic
    const filteredProducts = useMemo(() => {
        if (!Array.isArray(dlcProducts)) return [];

        let filtered = dlcProducts;

        // Search
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            filtered = filtered.filter((p: any) =>
                p.productName.toLowerCase().includes(lower) ||
                (p.gencode && p.gencode.includes(lower))
            );
        }

        // Status logic
        const today = new Date();
        filtered = filtered.filter((p: any) => {
            const expiry = new Date(p.expiryDate);
            const daysUntil = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

            if (p.status === 'valides') return statusFilter === 'valides';

            if (statusFilter === 'expires') return daysUntil < 0;
            if (statusFilter === 'expires_soon') return daysUntil >= 0 && daysUntil <= 15;
            if (statusFilter === 'en_cours') return daysUntil > 15;

            return true; // 'all'
        });

        return filtered.sort((a: any, b: any) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
    }, [dlcProducts, searchTerm, statusFilter]);

    const getDaysBadge = (dateStr: string) => {
        const today = new Date();
        const expiry = new Date(dateStr);
        const days = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        if (days < 0) return <Badge variant="destructive">Expiré J{days}</Badge>;
        if (days <= 3) return <Badge className="bg-red-500 hover:bg-red-600">J-{days}</Badge>;
        if (days <= 15) return <Badge className="bg-orange-500 hover:bg-orange-600">J-{days}</Badge>;
        return <Badge variant="outline" className="text-green-600 border-green-200">J-{days}</Badge>;
    };

    return (
        <MobileLayout>
            <div className="p-4 space-y-4 pb-20">
                {/* Header */}
                <div className="flex items-center gap-2">
                    <Clock className="h-6 w-6 text-orange-600" />
                    <h1 className="text-xl font-bold text-gray-900">Gestion DLC</h1>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                    <Input
                        placeholder="Rechercher..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 h-10"
                    />
                </div>

                {/* Tabs for quick filtering */}
                <Tabs defaultValue="en_cours" value={statusFilter} onValueChange={setStatusFilter} className="w-full">
                    <TabsList className="grid w-full grid-cols-4 h-9">
                        <TabsTrigger value="en_cours" className="text-xs px-0">OK</TabsTrigger>
                        <TabsTrigger value="expires_soon" className="text-xs px-0">Bientôt</TabsTrigger>
                        <TabsTrigger value="expires" className="text-xs px-0">Expirés</TabsTrigger>
                        <TabsTrigger value="valides" className="text-xs px-0">Validés</TabsTrigger>
                    </TabsList>
                </Tabs>

                {/* List */}
                <div className="space-y-3">
                    {isLoading ? (
                        <div className="flex justify-center p-8">
                            <div className="animate-spin h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full" />
                        </div>
                    ) : filteredProducts.length === 0 ? (
                        <div className="text-center py-10 text-gray-500 bg-white rounded-lg border border-dashed border-gray-300">
                            <Clock className="h-10 w-10 mx-auto text-gray-300 mb-2" />
                            <p>Aucun produit trouvé</p>
                        </div>
                    ) : (
                        filteredProducts.map((p: any) => (
                            <Card key={p.id} className="overflow-hidden">
                                <CardContent className="p-3">
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                {getDaysBadge(p.expiryDate)}
                                                <span className="text-xs text-gray-500 font-mono">
                                                    {format(new Date(p.expiryDate), 'dd/MM/yy')}
                                                </span>
                                            </div>
                                            <h3 className="font-bold text-gray-900">{p.productName}</h3>
                                            <p className="text-xs text-gray-500 mt-1">
                                                {p.supplier?.name} {p.gencode ? `• ${p.gencode}` : ''}
                                            </p>
                                        </div>

                                        {statusFilter !== 'valides' && (
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 -mr-2">
                                                        <MoreVertical className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => validateMutation.mutate(p.id)}>
                                                        <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
                                                        Valider (Sortir)
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            </div>

            {/* Create Sheet */}
            <Sheet open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <SheetContent side="bottom" className="h-[90vh] overflow-y-auto rounded-t-xl px-4 py-6">
                    <SheetHeader className="mb-6">
                        <SheetTitle className="text-left flex items-center gap-2">
                            <Plus className="h-5 w-5 bg-orange-100 text-orange-600 rounded p-0.5" />
                            Nouveau Produit DLC
                        </SheetTitle>
                    </SheetHeader>

                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pb-8">
                            <FormField
                                control={form.control}
                                name="productName"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Nom du produit</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Beurre, Yaourt..." {...field} />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />

                            <div className="grid grid-cols-2 gap-3">
                                <FormField
                                    control={form.control}
                                    name="dlcDate"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Date Expiration</FormLabel>
                                            <FormControl>
                                                <Input type="date" {...field} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="dateType"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Type</FormLabel>
                                            <Select
                                                onValueChange={field.onChange}
                                                defaultValue={field.value}
                                            >
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="dlc">DLC</SelectItem>
                                                    <SelectItem value="ddm">DDM</SelectItem>
                                                    <SelectItem value="dluo">DLUO</SelectItem>
                                                </SelectContent>
                                            </Select>
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

                            <FormField
                                control={form.control}
                                name="notes"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Notes internes</FormLabel>
                                        <FormControl>
                                            <Textarea placeholder="Remarques..." className="h-20" {...field} />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />

                            <Button type="submit" className="w-full bg-orange-600 hover:bg-orange-700 h-12 text-lg font-bold shadow-lg mt-4" disabled={createMutation.isPending}>
                                {createMutation.isPending ? "Ajout..." : "Ajouter le produit"}
                            </Button>
                        </form>
                    </Form>
                </SheetContent>
            </Sheet>

            {/* FAB */}
            <Button
                className="fixed bottom-20 right-4 h-14 w-14 rounded-full shadow-lg bg-orange-600 hover:bg-orange-700 p-0 flex items-center justify-center z-50"
                onClick={() => setIsCreateOpen(true)}
            >
                <Plus className="h-6 w-6 text-white" />
            </Button>
        </MobileLayout>
    );
}
