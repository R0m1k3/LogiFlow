/**
 * MobilePublicitiesPage.tsx
 * Version mobile de la page Publicités
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthUnified } from "@/hooks/useAuthUnified";
import { useStore } from "@/contexts/StoreContext";
import MobileLayout from "./MobileLayout";
import { Card, CardContent } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Megaphone,
    Search,
    Calendar,
    User,
    Plus
} from "lucide-react";
import { format, isWithinInterval, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

export default function MobilePublicitiesPage() {
    const { user } = useAuthUnified();
    const { selectedStoreId } = useStore();
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [searchTerm, setSearchTerm] = useState("");

    // Générer les années pour le select (année courante - 2 ans à + 10 ans)
    const currentYear = new Date().getFullYear();
    const startYear = currentYear - 2;
    const years = Array.from({ length: 13 }, (_, i) => startYear + i);

    const { data: publicities = [], isLoading } = useQuery({
        queryKey: ["/api/ad-campaigns", selectedStoreId, selectedYear],
        queryFn: async () => {
            if (!selectedStoreId) return [];
            const response = await fetch(
                `/api/ad-campaigns?storeId=${selectedStoreId}&year=${selectedYear}`,
                { credentials: 'include' }
            );
            if (!response.ok) throw new Error("Failed to fetch publicities");
            return response.json();
        },
        enabled: !!selectedStoreId && !!user,
    });

    const filteredPublicities = publicities.filter((pub: any) =>
        pub.designation.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pub.pubNumber.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getStatusBadge = (startDate: string, endDate: string) => {
        const start = parseISO(startDate);
        const end = parseISO(endDate);
        const now = new Date();

        if (isWithinInterval(now, { start, end })) {
            return <Badge className="bg-green-500">En cours</Badge>;
        } else if (now > end) {
            return <Badge variant="secondary">Terminée</Badge>;
        } else {
            return <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">À venir</Badge>;
        }
    };

    return (
        <MobileLayout>
            <div className="p-4 space-y-4 pb-20">
                {/* Header & Filters */}
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <Megaphone className="h-6 w-6 text-purple-600" />
                        <h1 className="text-xl font-bold text-gray-900">Publicités</h1>
                    </div>
                </div>

                <div className="flex gap-2">
                    <div className="flex-1 relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                        <Input
                            placeholder="Rechercher une pub..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 h-10 w-full"
                        />
                    </div>
                    <Select
                        value={selectedYear.toString()}
                        onValueChange={(v) => setSelectedYear(parseInt(v))}
                    >
                        <SelectTrigger className="w-[100px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {years.map((y) => (
                                <SelectItem key={y} value={y.toString()}>
                                    {y}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* List */}
                <div className="space-y-3">
                    {isLoading ? (
                        <div className="flex justify-center p-8">
                            <div className="animate-spin h-8 w-8 border-4 border-purple-600 border-t-transparent rounded-full" />
                        </div>
                    ) : filteredPublicities.length === 0 ? (
                        <div className="text-center py-10 text-gray-500 bg-white rounded-lg border border-dashed border-gray-300">
                            <Megaphone className="h-10 w-10 mx-auto text-gray-300 mb-2" />
                            <p>Aucune publicité trouvée pour {selectedYear}</p>
                        </div>
                    ) : (
                        filteredPublicities.map((pub: any) => (
                            <Card key={pub.id} className="overflow-hidden">
                                <CardContent className="p-4">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <Badge variant="outline" className="font-mono text-xs">
                                                    {pub.pubNumber}
                                                </Badge>
                                                {getStatusBadge(pub.startDate, pub.endDate)}
                                            </div>
                                            <h3 className="font-bold text-gray-900 leading-tight">
                                                {pub.designation}
                                            </h3>
                                        </div>
                                    </div>

                                    <div className="text-sm text-gray-600 space-y-1.5 mt-3 pt-3 border-t border-gray-100">
                                        <div className="flex items-center gap-2">
                                            <Calendar className="h-4 w-4 text-gray-400" />
                                            <span>
                                                Du {format(parseISO(pub.startDate), "dd/MM", { locale: fr })} au {format(parseISO(pub.endDate), "dd/MM/yyyy", { locale: fr })}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <User className="h-4 w-4 text-gray-400" />
                                            <span>Créé par {pub.creator?.username || pub.createdBy}</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            </div>

            {/* FAB Add Button */}
            <Button
                className="fixed bottom-20 right-4 h-14 w-14 rounded-full shadow-lg bg-purple-600 hover:bg-purple-700 p-0 flex items-center justify-center z-50"
                onClick={() => {
                    // TODO: Ouvrir modal création mobile
                    // Pour l'instant on peut rediriger ou ouvrir un drawer
                }}
            >
                <Plus className="h-6 w-6 text-white" />
            </Button>
        </MobileLayout>
    );
}
