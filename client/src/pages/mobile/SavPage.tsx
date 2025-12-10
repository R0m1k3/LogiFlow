/**
 * MobileSavPage.tsx
 * Version mobile de la page SAV (Service Après-Vente)
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
    Wrench,
    Search,
    Plus,
    Filter,
    Camera,
    Image as ImageIcon,
    MoreVertical,
    CheckCircle,
    XCircle,
    Phone
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
    FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

// Schema
const savFormSchema = z.object({
    clientName: z.string().optional(),
    clientPhone: z.string().optional(),
    productGencode: z.string().min(1, "Gencode requis"),
    productReference: z.string().optional(),
    productDesignation: z.string().min(1, "Désignation requise"),
    supplierId: z.coerce.number().min(1, "Fournisseur requis"),
    problemType: z.enum(["defectueux", "pieces_manquantes", "non_conforme", "autre"]).default("defectueux"),
    problemDescription: z.string().min(1, "Description requise"),
    priority: z.enum(["faible", "normale", "haute", "critique"]).default("normale"),
});

export default function MobileSavPage() {
    const { user } = useAuthUnified();
    const { selectedStoreId } = useStore();
    const [searchTerm, setSearchTerm] = useState("");
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const { toast } = useToast();
    const queryClient = useQueryClient();

    // Queries
    const { data: tickets = [], isLoading } = useQuery({
        queryKey: ["/api/sav-tickets", selectedStoreId],
        queryFn: async () => {
            if (!selectedStoreId) return [];
            const res = await fetch(`/api/sav-tickets?storeId=${selectedStoreId}`, { credentials: 'include' });
            if (!res.ok) throw new Error("Erreur fetch SAV");
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
    const statusMutation = useMutation({
        mutationFn: ({ id, status }: { id: number; status: string }) =>
            apiRequest(`/api/sav-tickets/${id}/status`, 'PATCH', { status }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/sav-tickets"] });
            toast({ title: "Statut mis à jour" });
        }
    });

    const createMutation = useMutation({
        mutationFn: (data: any) => apiRequest('/api/sav-tickets', 'POST', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/sav-tickets"] });
            toast({ title: "Ticket SAV créé" });
            setIsCreateOpen(false);
            form.reset();
        },
        onError: (err: any) => toast({ title: "Erreur", description: err.message, variant: "destructive" })
    });

    // Form
    const form = useForm({
        resolver: zodResolver(savFormSchema),
        defaultValues: {
            clientName: "",
            clientPhone: "",
            productGencode: "",
            productReference: "",
            productDesignation: "",
            supplierId: 0,
            problemType: "defectueux",
            problemDescription: "",
            priority: "normale"
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
            status: "nouveau"
        });
    };

    const filteredTickets = tickets.filter((t: any) =>
        t.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.productDesignation?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.ticketNumber?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "nouveau": return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Nouveau</Badge>;
            case "en_cours": return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">En cours</Badge>;
            case "attente_pieces": return <Badge className="bg-orange-100 text-orange-800 border-orange-200">Pièces</Badge>;
            case "resolu": return <Badge className="bg-green-100 text-green-800 border-green-200">Résolu</Badge>;
            case "ferme": return <Badge className="bg-gray-100 text-gray-800 border-gray-200">Fermé</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };

    return (
        <MobileLayout>
            <div className="p-4 space-y-4 pb-20">
                {/* Header */}
                <div className="flex items-center gap-2">
                    <Wrench className="h-6 w-6 text-purple-600" />
                    <h1 className="text-xl font-bold text-gray-900">SAV / Réparations</h1>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                    <Input
                        placeholder="N° Ticket, Client, Produit..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 h-10"
                    />
                </div>

                {/* List */}
                <div className="space-y-3">
                    {isLoading ? (
                        <div className="flex justify-center p-8">
                            <div className="animate-spin h-8 w-8 border-4 border-purple-500 border-t-transparent rounded-full" />
                        </div>
                    ) : filteredTickets.length === 0 ? (
                        <div className="text-center py-10 text-gray-500 bg-white rounded-lg border border-dashed border-gray-300">
                            <Wrench className="h-10 w-10 mx-auto text-gray-300 mb-2" />
                            <p>Aucun ticket SAV</p>
                        </div>
                    ) : (
                        filteredTickets.map((ticket: any) => (
                            <Card key={ticket.id} className="overflow-hidden">
                                <CardContent className="p-4">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex-1">
                                            <div className="flex items-center justify-between mb-1">
                                                {getStatusBadge(ticket.status)}
                                                <span className="text-xs text-gray-500">
                                                    #{ticket.ticketNumber} • {format(new Date(ticket.createdAt), "dd/MM", { locale: fr })}
                                                </span>
                                            </div>
                                            <h3 className="font-bold text-gray-900">{ticket.clientName || 'Client inconnu'}</h3>
                                            <p className="text-sm text-gray-600 font-medium">{ticket.productDesignation}</p>
                                        </div>

                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 -mr-2">
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => statusMutation.mutate({ id: ticket.id, status: 'in_progress' })}>
                                                    En cours
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => statusMutation.mutate({ id: ticket.id, status: 'waiting_parts' })}>
                                                    Attente Pièces
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => statusMutation.mutate({ id: ticket.id, status: 'resolved' })} className="text-green-600">
                                                    Résolu
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => statusMutation.mutate({ id: ticket.id, status: 'closed' })} className="text-gray-600">
                                                    Fermer
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>

                                    <div className="bg-gray-50 p-2 rounded text-xs text-gray-700 line-clamp-2 mb-3">
                                        {ticket.problemDescription}
                                    </div>

                                    {ticket.clientPhone && (
                                        <div className="flex mt-2">
                                            <a href={`tel:${ticket.clientPhone}`} className="flex items-center gap-2 text-sm text-blue-600 font-medium bg-blue-50 px-3 py-1.5 rounded-full">
                                                <Phone className="h-3.5 w-3.5" />
                                                Appeler
                                            </a>
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
                <SheetContent side="bottom" className="h-[90vh] overflow-y-auto rounded-t-xl px-4 py-6">
                    <SheetHeader className="mb-6">
                        <SheetTitle className="text-left flex items-center gap-2">
                            <Plus className="h-5 w-5 bg-purple-100 text-purple-600 rounded p-0.5" />
                            Nouveau Ticket SAV
                        </SheetTitle>
                    </SheetHeader>

                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pb-8">
                            <div className="bg-gray-50 p-3 rounded-lg space-y-3">
                                <h3 className="font-medium text-sm text-gray-500 uppercase">Produit</h3>
                                <FormField
                                    control={form.control}
                                    name="productGencode"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Gencode (EAN13)</FormLabel>
                                            <FormControl><Input placeholder="Scanner..." {...field} /></FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="productDesignation"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Désignation</FormLabel>
                                            <FormControl><Input placeholder="Nom du produit" {...field} /></FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="supplierId"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Fournisseur</FormLabel>
                                            <Select onValueChange={(val) => field.onChange(parseInt(val))} defaultValue={field.value?.toString()}>
                                                <FormControl><SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    {suppliers.map((s: any) => (
                                                        <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="problemType"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Type de problème</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    <SelectItem value="defectueux">Défectueux</SelectItem>
                                                    <SelectItem value="pieces_manquantes">Pièces manquantes</SelectItem>
                                                    <SelectItem value="non_conforme">Non conforme</SelectItem>
                                                    <SelectItem value="autre">Autre</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <div className="bg-gray-50 p-3 rounded-lg space-y-3">
                                <h3 className="font-medium text-sm text-gray-500 uppercase">Description & Client</h3>
                                <FormField
                                    control={form.control}
                                    name="priority"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Priorité</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    <SelectItem value="faible">Faible</SelectItem>
                                                    <SelectItem value="normale">Normale</SelectItem>
                                                    <SelectItem value="haute">Haute</SelectItem>
                                                    <SelectItem value="critique">Critique</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="problemDescription"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Description Panne</FormLabel>
                                            <FormControl><Textarea {...field} className="h-20" /></FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="clientName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Nom Client</FormLabel>
                                            <FormControl><Input {...field} /></FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="clientPhone"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Téléphone</FormLabel>
                                            <FormControl><Input type="tel" {...field} /></FormControl>
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <Button type="submit" className="w-full bg-purple-600 hover:bg-purple-700 h-12 text-lg font-bold shadow-lg mt-4" disabled={createMutation.isPending}>
                                {createMutation.isPending ? "Création..." : "Créer le ticket"}
                            </Button>
                        </form>
                    </Form>
                </SheetContent>
            </Sheet>

            {/* FAB */}
            <Button
                className="fixed bottom-20 right-4 h-14 w-14 rounded-full shadow-lg bg-purple-600 hover:bg-purple-700 p-0 flex items-center justify-center z-50"
                onClick={() => setIsCreateOpen(true)}
            >
                <Plus className="h-6 w-6 text-white" />
            </Button>
        </MobileLayout>
    );
}
