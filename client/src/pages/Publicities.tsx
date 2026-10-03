import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { Plus, Calendar, Edit, Trash2, Eye, Filter, Grid, List, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuthUnified } from "@/hooks/useAuthUnified";
import { useStore } from "@/contexts/StoreContext";
import { format, startOfMonth, endOfMonth, eachWeekOfInterval, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, startOfYear, endOfYear, getMonth } from "date-fns";
import { fr } from "date-fns/locale";
import { safeFormat, safeDate } from "@/lib/dateUtils";
import type { PublicityWithRelations, Group } from "@shared/schema";
import PublicityForm from "@/components/PublicityForm";

// Références stables tant que les données ne sont pas chargées (dépendances des useMemo)
const NO_PUBLICITIES: PublicityWithRelations[] = [];
const NO_GROUPS: Group[] = [];

export default function Publicities() {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear()); // Année courante par défaut
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth()); // Mois courant par défaut
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list'); // Mode d'affichage
  const [showYearOverview, setShowYearOverview] = useState(true); // Affichage vue d'ensemble
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedPublicity, setSelectedPublicity] = useState<PublicityWithRelations | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const { user } = useAuthUnified();
  const { selectedStoreId } = useStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Seuls les admins peuvent modifier/supprimer
  const canModify = user?.role === 'admin';

  // Generate year options (current year - 2 to current year + 10)
  const currentYear = new Date().getFullYear();
  const startYear = currentYear - 2;
  const yearOptions = Array.from({ length: 13 }, (_, i) => startYear + i);

  const { data: publicities = NO_PUBLICITIES, isLoading, isPlaceholderData } = useQuery<PublicityWithRelations[]>({
    queryKey: ['/api/ad-campaigns', selectedYear, selectedStoreId],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('year', selectedYear.toString());
      if (selectedStoreId) {
        params.append('storeId', selectedStoreId.toString());
      }
      const response = await fetch(`/api/ad-campaigns?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch publicities');
      }
      const data = await response.json();
      // Liste déjà triée par N° côté serveur (même tri numérique) : pas de second tri ici
      return Array.isArray(data) ? data : [];
    },
    // Les créations, modifications et suppressions invalident déjà cette clé
    staleTime: 5 * 60 * 1000,
    // Changement d'année : garder la liste affichée (atténuée) pendant le
    // chargement, mais jamais au changement de magasin
    placeholderData: (previousData, previousQuery) =>
      previousQuery?.queryKey[2] === selectedStoreId ? keepPreviousData(previousData) : undefined,
  });

  const { data: groups = NO_GROUPS } = useQuery<Group[]>({
    queryKey: ['/api/groups'],
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      // Try POST first (for production environments that block DELETE)
      try {
        const response = await fetch(`/api/ad-campaigns/${id}/delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });

        if (response.ok) {
          return response.json();
        } else if (response.status === 404) {
          // Route not found, try DELETE method as fallback (for dev environment)
          const deleteResponse = await fetch(`/api/ad-campaigns/${id}`, { method: 'DELETE' });

          if (!deleteResponse.ok) {
            const error = await deleteResponse.json();
            throw new Error(error.message || 'Erreur lors de la suppression');
          }

          // Handle empty response (204 No Content)
          if (deleteResponse.status === 204) {
            return { message: "Publicity deleted successfully" };
          }
          return deleteResponse.json();
        } else {
          const error = await response.json();
          throw new Error(error.message || 'Erreur lors de la suppression');
        }
      } catch (error) {
        console.error(`❌ [Frontend] Failed to delete publicity ${id}:`, error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ad-campaigns'] });
      toast({ description: "Publicité supprimée avec succès" });
      setIsDeleteModalOpen(false);
      setSelectedPublicity(null);
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        description: error.message || "Erreur lors de la suppression"
      });
    }
  });

  // Generate month options
  const monthOptions = Array.from({ length: 12 }, (_, i) => ({
    value: i,
    label: format(new Date(selectedYear, i, 1), 'MMMM', { locale: fr })
  }));

  // Magasins indexés par id (couleur et nom des pastilles)
  const groupsById = useMemo(() => new Map(groups.map(group => [group.id, group])), [groups]);

  // Dates de début et de fin converties une seule fois par publicité, et non
  // pour chaque semaine de la vue d'ensemble ou chaque jour du calendrier
  const publicityPeriods = useMemo(() => {
    if (!Array.isArray(publicities)) return [];
    return publicities.map(pub => ({
      pub,
      start: safeDate(pub.startDate),
      end: safeDate(pub.endDate),
    }));
  }, [publicities]);

  // Vue d'ensemble : semaines de l'année regroupées par mois, calculées
  // seulement quand la vue est affichée et que l'année ou les données changent
  const weeksByMonth = useMemo(() => {
    const byMonth = Array.from({ length: 12 }, () => [] as Array<{
      weekStart: Date;
      weekEnd: Date;
      weekNumber: number;
      month: number;
      publicities: PublicityWithRelations[];
      participatingStores: number[];
      storeColors: string[];
    }>);
    if (!showYearOverview) return byMonth;

    const yearStart = startOfYear(new Date(selectedYear, 0, 1));
    const yearEnd = endOfYear(new Date(selectedYear, 11, 31));

    const weeks = eachWeekOfInterval(
      { start: yearStart, end: yearEnd },
      { weekStartsOn: 1 }
    );

    weeks.forEach((weekStart, index) => {
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
      const weekNumber = index + 1;

      const weekMidpoint = new Date(weekStart.getTime() + (3.5 * 24 * 60 * 60 * 1000));
      let month = getMonth(weekMidpoint);

      if (weekStart.getFullYear() < selectedYear && weekEnd.getFullYear() === selectedYear) {
        month = 0; // Janvier
      } else if (weekStart.getFullYear() === selectedYear && weekEnd.getFullYear() > selectedYear) {
        month = 11; // Décembre
      }

      // Une publicité compte pour la semaine dès que sa période chevauche la semaine
      const weekPublicities = publicityPeriods
        .filter(({ start, end }) => start && end && (start <= weekEnd && end >= weekStart))
        .map(({ pub }) => pub);

      const participatingStores = new Set<number>();
      weekPublicities.forEach(pub => {
        // Vérifier que participations existe et est un tableau
        if (pub.participations && Array.isArray(pub.participations)) {
          pub.participations.forEach(participation => {
            participatingStores.add(participation.groupId);
          });
        }
      });

      byMonth[month].push({
        weekStart,
        weekEnd,
        weekNumber,
        month,
        publicities: weekPublicities,
        participatingStores: Array.from(participatingStores),
        storeColors: Array.from(participatingStores).map(storeId =>
          groupsById.get(storeId)?.color || '#666666'
        ),
      });
    });

    return byMonth;
  }, [showYearOverview, selectedYear, publicityPeriods, groupsById]);

  // Vue calendrier : jours du mois sélectionné avec leurs publicités, calculés
  // seulement quand cette vue est affichée
  const calendarDays = useMemo(() => {
    if (viewMode !== 'calendar') return [];

    const monthStart = startOfMonth(new Date(selectedYear, selectedMonth, 1));
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

    return eachDayOfInterval({ start: startDate, end: endDate }).map(day => {
      const dayPublicities = publicityPeriods
        .filter(({ start, end }) => start && end && day >= start && day <= end)
        .map(({ pub }) => pub);

      const participatingStores = new Set<number>();
      dayPublicities.forEach(pub => {
        pub.participations.forEach(participation => {
          participatingStores.add(participation.groupId);
        });
      });

      return {
        day,
        isCurrentMonth: isSameMonth(day, monthStart),
        dayPublicities,
        participatingStores: Array.from(participatingStores),
      };
    });
  }, [viewMode, selectedYear, selectedMonth, publicityPeriods]);

  // Compteurs des cartes : recalculés à chaque rendu car ils dépendent de l'heure courante
  const now = new Date();
  const activeCount = publicityPeriods.filter(({ start, end }) => start && end && start <= now && now <= end).length;
  const upcomingCount = publicityPeriods.filter(({ start }) => start && start > now).length;

  const handleView = (publicity: PublicityWithRelations) => {
    setSelectedPublicity(publicity);
    setIsViewModalOpen(true);
  };

  const handleEdit = (publicity: PublicityWithRelations) => {
    setSelectedPublicity(publicity);
    setIsEditModalOpen(true);
  };

  const handleDelete = (publicity: PublicityWithRelations) => {
    setSelectedPublicity(publicity);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = () => {
    if (selectedPublicity) {
      deleteMutation.mutate(selectedPublicity.id);
    }
  };

  const closeModals = () => {
    setIsCreateModalOpen(false);
    setIsEditModalOpen(false);
    setIsViewModalOpen(false);
    setIsDeleteModalOpen(false);
    setSelectedPublicity(null);
  };

  // Export CSV function for current year data
  const exportToCSV = () => {
    if (!publicities || publicities.length === 0) {
      toast({ variant: "destructive", description: "Aucune donnée à exporter" });
      return;
    }

    const headers = ["N° PUB", "Désignation", "Date Début", "Date Fin", "Année", "Statut", "Magasins", "Créé le"];

    const rows = publicities.map(pub => {
      const now = new Date();
      const start = safeDate(pub.startDate);
      const end = safeDate(pub.endDate);
      const status = start && end && now >= start && now <= end ? "En cours"
        : start && start > now ? "À venir"
          : "Terminée";
      const stores = pub.participations.map(p => p.group?.name || "").filter(Boolean).join(", ");

      return [
        pub.pubNumber,
        `"${(pub.designation || "").replace(/"/g, '""')}"`,
        safeFormat(pub.startDate, "dd/MM/yyyy"),
        safeFormat(pub.endDate, "dd/MM/yyyy"),
        pub.year,
        status,
        `"${stores}"`,
        safeFormat(pub.createdAt, "dd/MM/yyyy HH:mm")
      ].join(";");
    });

    // UTF-8 BOM for Excel compatibility with French accents
    const csvContent = "\uFEFF" + headers.join(";") + "\n" + rows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `publicites_${selectedYear}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast({ description: `Export CSV de ${publicities.length} publicités réussi` });
  };

  const canCreateOrEdit = user?.role === 'admin' || user?.role === 'manager';
  const canDelete = user?.role === 'admin';

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-6 shadow-sm -m-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 flex items-center">
              <Calendar className="w-6 h-6 mr-3 text-green-600" />
              Publicités
            </h2>
            <p className="text-gray-600 mt-1">
              Gestion des campagnes publicitaires
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="h-8"
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'calendar' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('calendar')}
                className="h-8"
              >
                <Grid className="h-4 w-4" />
              </Button>
            </div>

            {/* Year Overview Toggle */}
            <Button
              variant={showYearOverview ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowYearOverview(!showYearOverview)}
              className="h-8"
            >
              <Calendar className="h-4 w-4 mr-2" />
              Vue d'ensemble
            </Button>

            {/* Year Filter */}
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <Select
                value={selectedYear.toString()}
                onValueChange={(value) => setSelectedYear(parseInt(value))}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Month Filter (only for calendar view) */}
            {viewMode === 'calendar' && (
              <Select
                value={selectedMonth.toString()}
                onValueChange={(value) => setSelectedMonth(parseInt(value))}
              >
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((month) => (
                    <SelectItem key={month.value} value={month.value.toString()}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Export CSV Button */}
            <Button variant="outline" onClick={exportToCSV} className="h-9">
              <Download className="h-4 w-4 mr-2" />
              Exporter CSV
            </Button>

            {canModify && (
              <Button onClick={() => setIsCreateModalOpen(true)} className="bg-green-600 hover:bg-green-700 text-white shadow-md">
                <Plus className="mr-2 h-4 w-4" />
                Nouvelle publicité
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Données de l'année précédente affichées atténuées pendant le chargement de la nouvelle année */}
      <div
        className={`space-y-6 transition-opacity ${isPlaceholderData ? 'opacity-60' : ''}`}
        aria-busy={isPlaceholderData}
      >
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Calendar className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total {selectedYear}</p>
                  <p className="text-2xl font-semibold">{Array.isArray(publicities) ? publicities.length : 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Calendar className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">En cours</p>
                  <p className="text-2xl font-semibold">{activeCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Calendar className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">À venir</p>
                  <p className="text-2xl font-semibold">{upcomingCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Year Overview - Weekly Timeline */}
        {showYearOverview && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Vue d'ensemble {selectedYear} - Semaines avec publicités
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Months Grid */}
                <div className="grid grid-cols-12 gap-2">
                  {Array.from({ length: 12 }, (_, monthIndex) => {
                    const monthName = format(new Date(selectedYear, monthIndex, 1), 'MMM', { locale: fr });
                    const monthWeeks = weeksByMonth[monthIndex];

                    return (
                      <div key={monthIndex} className="space-y-2">
                        <div className="text-xs font-medium text-gray-600 text-center">
                          {monthName}
                        </div>
                        <div className="space-y-1">
                          {monthWeeks.map((week, weekIndex) => {
                            const hasPublicity = week.publicities.length > 0;
                            const storeColors = week.storeColors;

                            return (
                              <div
                                key={`${monthIndex}-${weekIndex}-${week.weekNumber}`}
                                className={`
                                h-8 rounded border text-xs flex flex-col items-center justify-center cursor-pointer relative
                                ${hasPublicity
                                    ? 'bg-blue-50 border-blue-200 text-blue-800'
                                    : 'bg-gray-50 border-gray-200 text-gray-500'
                                  }
                                hover:shadow-sm transition-shadow
                              `}
                                title={`Semaine ${week.weekNumber} (${format(week.weekStart, 'dd/MM', { locale: fr })} - ${format(week.weekEnd, 'dd/MM', { locale: fr })}) - ${hasPublicity ? `${week.publicities.map(p => p.pubNumber).join(', ')}` : 'Aucune publicité'}`}
                              >
                                <span className="text-xs font-medium">{week.weekNumber}</span>
                                {/* Store participation indicators */}
                                {storeColors.length > 0 && (
                                  <div className="absolute top-0.5 right-0.5 flex flex-wrap gap-0.5 max-w-[16px]">
                                    {storeColors.slice(0, 4).map((color, idx) => (
                                      <div
                                        key={idx}
                                        className="w-1.5 h-1.5 rounded-full"
                                        style={{ backgroundColor: color }}
                                        title={`Magasin ${idx + 1}`}
                                      />
                                    ))}
                                    {storeColors.length > 4 && (
                                      <div
                                        className="w-1.5 h-1.5 rounded-full bg-gray-400 text-white text-xs flex items-center justify-center"
                                        title={`+${storeColors.length - 4} autres magasins`}
                                      >
                                        +
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="space-y-2 pt-2 border-t">
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-blue-50 border border-blue-200 rounded"></div>
                        <span>Semaine avec publicité</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-gray-50 border border-gray-200 rounded"></div>
                        <span>Semaine sans publicité</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        {groups.slice(0, 3).map(group => (
                          <div
                            key={group.id}
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: group?.color || '#666666' }}
                          />
                        ))}
                      </div>
                      <span>Indicateurs magasins (coin supérieur droit)</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>• Survolez les semaines pour voir les détails des publicités</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : publicities.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Aucune publicité pour {selectedYear}
              </h3>
              <p className="text-gray-600 mb-6">
                Commencez par créer votre première campagne publicitaire.
              </p>
              {canModify && (
                <Button onClick={() => setIsCreateModalOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Créer une publicité
                </Button>
              )}
            </CardContent>
          </Card>
        ) : viewMode === 'calendar' ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Vue calendrier - {monthOptions[selectedMonth].label} {selectedYear}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-1">
                  {/* Days of week headers */}
                  {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(day => (
                    <div key={day} className="p-2 text-center text-sm font-medium text-gray-500">
                      {day}
                    </div>
                  ))}

                  {/* Calendar days */}
                  {calendarDays.map(({ day, isCurrentMonth, dayPublicities, participatingStores }) => {
                    return (
                      <div
                        key={day.toISOString()}
                        className={`
                          p-2 min-h-[60px] border border-gray-200 rounded-lg
                          ${isCurrentMonth ? 'bg-white' : 'bg-gray-50'}
                          ${dayPublicities.length > 0 ? 'ring-2 ring-blue-200' : ''}
                        `}
                      >
                        <div className="text-sm font-medium text-gray-900 mb-1">
                          {format(day, 'd')}
                        </div>
                        {dayPublicities.length > 0 && (
                          <div className="space-y-1">
                            {dayPublicities.slice(0, 2).map(pub => (
                              <div
                                key={pub.id}
                                className="text-xs bg-blue-100 text-blue-800 rounded px-1 py-0.5 truncate"
                                title={pub.designation}
                              >
                                {pub.pubNumber}
                              </div>
                            ))}
                            {dayPublicities.length > 2 && (
                              <div className="text-xs text-gray-500">
                                +{dayPublicities.length - 2} autre{dayPublicities.length > 3 ? 's' : ''}
                              </div>
                            )}
                          </div>
                        )}
                        {/* Store participation indicators */}
                        {participatingStores.length > 0 && (
                          <div className="flex gap-1 mt-1">
                            {participatingStores.slice(0, 3).map(storeId => {
                              const group = groupsById.get(storeId);
                              return (
                                <div
                                  key={storeId}
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: group?.color || '#666666' }}
                                  title={group?.name || 'Magasin'}
                                />
                              );
                            })}
                            {participatingStores.length > 3 && (
                              <div className="text-xs text-gray-500">+{participatingStores.length - 3}</div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Légende</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-blue-100 border border-blue-200 rounded"></div>
                      <span>Jour avec publicité</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        {groups.slice(0, 3).map(group => (
                          <div
                            key={group.id}
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: group?.color || '#666666' }}
                          />
                        ))}
                      </div>
                      <span>Magasins participants</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div>
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        N° PUB
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Désignation
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Période
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Statut
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Magasins
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Créé par
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {publicities
                      .map((publicity) => {
                        const now = new Date();
                        const start = safeDate(publicity.startDate);
                        const end = safeDate(publicity.endDate);
                        const isActive = start && end && now >= start && now <= end;
                        const isUpcoming = start && start > now;
                        const isPast = end && end < now;

                        return (
                          <tr key={publicity.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {publicity.pubNumber}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-gray-900 max-w-xs truncate">
                                {publicity.designation}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-600">
                                {safeFormat(publicity.startDate, "dd/MM/yy")} - {safeFormat(publicity.endDate, "dd/MM/yy")}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {isActive && <Badge className="bg-green-100 text-green-800">En cours</Badge>}
                              {isUpcoming && <Badge className="bg-blue-100 text-blue-800">À venir</Badge>}
                              {isPast && <Badge variant="secondary">Terminée</Badge>}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-wrap gap-1 max-w-xs">
                                {publicity.participations.length === 0 ? (
                                  <Badge className="text-xs bg-red-100 text-red-800 hover:bg-red-100">
                                    Aucun magasin
                                  </Badge>
                                ) : (
                                  <>
                                    {publicity.participations.slice(0, 2).map((participation) => (
                                      <Badge key={participation.groupId} variant="outline" className="text-xs">
                                        <div
                                          className="w-2 h-2 rounded-full mr-1"
                                          style={{ backgroundColor: participation.group?.color || '#666666' }}
                                        />
                                        {participation.group?.name || 'Magasin'}
                                      </Badge>
                                    ))}
                                    {publicity.participations.length > 2 && (
                                      <Badge variant="outline" className="text-xs">
                                        +{publicity.participations.length - 2}
                                      </Badge>
                                    )}
                                  </>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-600">
                                {publicity.creator?.name || publicity.creator?.username || 'Utilisateur'}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleView(publicity)}
                                  title="Voir les détails"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>

                                {canModify && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleEdit(publicity)}
                                      title="Modifier"
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>

                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDelete(publicity)}
                                      className="text-red-600 hover:text-red-700"
                                      title="Supprimer"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Créer une nouvelle publicité</DialogTitle>
            <DialogDescription>
              Remplissez les informations de la campagne publicitaire et sélectionnez les magasins participants.
            </DialogDescription>
          </DialogHeader>
          <PublicityForm
            groups={groups}
            selectedYear={selectedYear}
            onSuccess={closeModals}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Modifier la publicité</DialogTitle>
            <DialogDescription>
              Modifiez les informations de la campagne publicitaire.
            </DialogDescription>
          </DialogHeader>
          <PublicityForm
            publicity={selectedPublicity}
            groups={groups}
            selectedYear={selectedYear}
            onSuccess={closeModals}
          />
        </DialogContent>
      </Dialog>

      {/* View Modal */}
      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Détails de la publicité</DialogTitle>
            <DialogDescription>
              Informations complètes de la campagne publicitaire.
            </DialogDescription>
          </DialogHeader>

          {selectedPublicity && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">N° PUB</label>
                  <p className="text-lg">{selectedPublicity.pubNumber}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Année</label>
                  <p className="text-lg">{selectedPublicity.year}</p>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Désignation</label>
                <p className="mt-1">{selectedPublicity.designation}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Date de début</label>
                  <p>{safeFormat(selectedPublicity.startDate, "dd/MM/yyyy")}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Date de fin</label>
                  <p>{safeFormat(selectedPublicity.endDate, "dd/MM/yyyy")}</p>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Magasins participants</label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedPublicity.participations.length === 0 ? (
                    <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Aucun magasin</Badge>
                  ) : (
                    selectedPublicity.participations.map((participation) => (
                      <Badge key={participation.groupId} variant="outline">
                        <div
                          className="w-3 h-3 rounded-full mr-2"
                          style={{ backgroundColor: participation.group?.color || '#666666' }}
                        />
                        {participation.group?.name || 'Magasin'}
                      </Badge>
                    ))
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                <div>
                  <label className="font-medium">Créé par</label>
                  <p>{selectedPublicity.creator?.name || selectedPublicity.creator?.username || 'Utilisateur'}</p>
                </div>
                <div>
                  <label className="font-medium">Créé le</label>
                  <p>{safeFormat(selectedPublicity.createdAt, "dd/MM/yyyy à HH:mm")}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer la publicité</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer cette publicité ? Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>

          {selectedPublicity && (
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="font-medium">{selectedPublicity.pubNumber}</p>
                <p className="text-sm text-gray-600">{selectedPublicity.designation}</p>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>
                  Annuler
                </Button>
                <Button
                  variant="destructive"
                  onClick={confirmDelete}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? 'Suppression...' : 'Supprimer'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}