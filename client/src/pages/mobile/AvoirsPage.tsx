/**
 * MobileAvoirsPage.tsx
 * Version mobile de la page Gestion des Avoirs
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
    FileText,
    Search,
    Plus,
    Filter,
    CheckCircle,
    AlertCircle,
    Clock,
    MoreVertical,
    Trash2,
    Ban
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
} from "@/components/ui/form";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const avoirSchema = z.object({
    supplierId: z.coerce.number().min(1, "Fournisseur requis"),
    invoiceReference: z.string().optional(),
    amount: z.coerce.number().optional(),
    comment: z.string().optional(),
    status: z.enum(["En attente de demande", "Demandé", "Reçu"]).default("En attente de demande"),
});

export default function MobileAvoirsPage() {
    const { user } = useAuthUnified();
    const { selectedStoreId } = useStore();
    const [searchTerm, setSearchTerm] = useState("");
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const { toast } = useToast();
    const queryClient = useQueryClient();

    // Queries
    const { data: avoirs = [], isLoading } = useQuery({
        queryKey: ["/api/avoirs", selectedStoreId],
        queryFn: async () => {
            if (!selectedStoreId) return [];
            const res = await fetch(`/api/avoirs?storeId=${selectedStoreId}`, { credentials: 'include' });
            if (!res.ok) throw new Error("Erreur fetch Avoirs");
            return res.json();
        },
        enabled: !!selectedStoreId && !!user,
    });

    const { data: suppliers = [] } = useQuery({
        queryKey: ['/api/suppliers'],
        queryFn: () => apiRequest('/api/suppliers')
    });

    const { data: groups = [] } = useQuery({
        queryKey: ['/api/groups'],
        queryFn: () => apiRequest('/api/groups')
    });

    // Mutations
    const createMutation = useMutation({
        mutationFn: (data: any) => apiRequest('/api/avoirs', 'POST', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/avoirs"] });
            toast({ title: "Avoir créé avec succès" });
            setIsCreateOpen(false);
            form.reset();
        },
        onError: (err: any) => toast({ title: "Erreur", description: err.message, variant: "destructive" })
    });

    const updateStatusMutation = useMutation({
        mutationFn: ({ id, data }: { id: number, data: any }) => apiRequest(`/api/avoirs/${id}`, 'PUT', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/avoirs"] });
            toast({ title: "Statut mis à jour" });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id: number) => apiRequest(`/api/avoirs/${id}`, 'DELETE'),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/avoirs"] });
            toast({ title: "Avoir supprimé" });
        }
    });

    // Form
    const form = useForm({
        resolver: zodResolver(avoirSchema),
        defaultValues: {
            supplierId: 0,
            invoiceReference: "",
            amount: 0,
            comment: "",
            status: "En attente de demande"
        }
    });

    const onSubmit = (data: any) => {
        let groupId = selectedStoreId;
        if (!groupId && user?.userGroups?.[0]?.groupId) groupId = user.userGroups[0].groupId;
        if (!groupId && groups.length > 0 && user?.role === 'admin') groupId = groups[0].id;

        if (!groupId) {
            toast({ title: "Erreur", description: "Aucun magasin sélectionné", variant: "destructive" });
            return;
        }

        createMutation.mutate({
            ...data,
            groupId,
            commercialProcessed: false
        });
    };

    const sortedAvoirs = [...avoirs].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const filteredAvoirs = sortedAvoirs.filter((a: any) =>
        (a.supplier?.name?.toLowerCase().includes(searchTerm.toLowerCase()) || "") ||
        (a.invoiceReference?.toLowerCase().includes(searchTerm.toLowerCase()) || "")
    );

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "En attente de demande": return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">En attente</Badge>;
            case "Demandé": return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Demandé</Badge>;
            case "Reçu": return <Badge className="bg-green-100 text-green-800 border-green-200">Reçu</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };

    return (
        <MobileLayout>
            <div className="p-4 space-y-4 pb-20">
                {/* Header */}
                <div className="flex items-center gap-2">
                    <FileText className="h-6 w-6 text-indigo-600" />
                    <h1 className="text-xl font-bold text-gray-900">Suivi des Avoirs</h1>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                    <Input
                        placeholder="Fournisseur, Facture..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 h-10"
                    />
                </div>

                {/* List */}
                <div className="space-y-3">
                    {isLoading ? (
                        <div className="flex justify-center p-8">
                            <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
                        </div>
                    ) : filteredAvoirs.length === 0 ? (
                        <div className="text-center py-10 text-gray-500 bg-white rounded-lg border border-dashed border-gray-300">
                            <FileText className="h-10 w-10 mx-auto text-gray-300 mb-2" />
                            <p>Aucun avoir trouvé</p>
                        </div>
                    ) : (
                        filteredAvoirs.map((avoir: any) => (
                            <Card key={avoir.id} className="overflow-hidden">
                                <CardContent className="p-4">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex-1">
                                            <div className="flex items-center justify-between mb-1">
                                                {getStatusBadge(avoir.status)}
                                                <span className="text-xs text-gray-500">
                                                    {format(new Date(avoir.createdAt), "dd/MM", { locale: fr })}
                                                </span>
                                            </div>
                                            <h3 className="font-bold text-gray-900">{avoir.supplier?.name}</h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                {avoir.invoiceReference && (
                                                    <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 font-mono">
                                                        {avoir.invoiceReference}
                                                    </span>
                                                )}
                                                {avoir.amount && (
                                                    <span className="text-sm font-bold text-indigo-700">
                                                        {parseFloat(avoir.amount).toFixed(2)} €
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 -mr-2">
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => updateStatusMutation.mutate({
                                                    id: avoir.id,
                                                    data: { ...avoir, status: 'En attente de demande' }
                                                })}>
                                                    Marquer En attente
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => updateStatusMutation.mutate({
                                                    id: avoir.id,
                                                    data: { ...avoir, status: 'Demandé' }
                                                })}>
                                                    Marquer Demandé
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => updateStatusMutation.mutate({
                                                    id: avoir.id,
                                                    data: { ...avoir, status: 'Reçu' }
                                                })}>
                                                    Marquer Reçu
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onClick={() => deleteMutation.mutate(avoir.id)}
                                                    className="text-red-600"
                                                >
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    Supprimer
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>

                                    {avoir.comment && (
                                        <div className="bg-gray-50 p-2 rounded text-xs text-gray-600 italic mt-2">
                                            "{avoir.comment}"
                                        </div>
                                    )}

                                    {avoir.nocodbVerified && (
                                        <div className="mt-2 flex items-center gap-1.5 text-xs text-green-700 bg-green-50 p-1.5 rounded w-fit">
                                            <CheckCircle className="h-3 w-3" />
                                            Vérifié Compta
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            </div>

            {/* Create Sheet */}
            <Sheet open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <SheetContent side="bottom" className="h-[85vh] overflow-y-auto rounded-t-xl px-4 py-6">
                    <SheetHeader className="mb-6">
                        <SheetTitle className="text-left flex items-center gap-2">
                            <Plus className="h-5 w-5 bg-indigo-100 text-indigo-600 rounded p-0.5" />
                            Nouvel Avoir
                        </SheetTitle>
                    </SheetHeader>

                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pb-8">
                            <FormField
                                control={form.control}
                                name="supplierId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Fournisseur</FormLabel>
                                        <Select
                                            onValueChange={(val) => field.onChange(parseInt(val))}
                                            defaultValue={field.value ? field.value.toString() : undefined}
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

                            <div className="flex gap-3">
                                <FormField
                                    control={form.control}
                                    name="invoiceReference"
                                    render={({ field }) => (
                                        <FormItem className="flex-1">
                                            <FormLabel>Réf. Facture</FormLabel>
                                            <FormControl><Input {...field} /></FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="amount"
                                    render={({ field }) => (
                                        <FormItem className="w-1/3">
                                            <FormLabel>Montant</FormLabel>
                                            <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <FormField
                                control={form.control}
                                name="comment"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Commentaire / Raison</FormLabel>
                                        <FormControl>
                                            <Textarea placeholder="Erreur prix, manquant..." {...field} />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />

                            <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 h-12 text-lg font-bold shadow-lg mt-4" disabled={createMutation.isPending}>
                                {createMutation.isPending ? "Création..." : "Créer la demande"}
                            </Button>
                        </form>
                    </Form>
                </SheetContent>
            </Sheet>

            {/* FAB */}
            <Button
                className="fixed bottom-20 right-4 h-14 w-14 rounded-full shadow-lg bg-indigo-600 hover:bg-indigo-700 p-0 flex items-center justify-center z-50"
                onClick={() => setIsCreateOpen(true)}
            >
                <Plus className="h-6 w-6 text-white" />
            </Button>
        </MobileLayout>
    );
}
