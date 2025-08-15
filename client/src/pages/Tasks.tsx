import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthUnified } from "@/hooks/useAuthUnified";
import { useStore } from "@/components/Layout";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Pagination, usePagination } from "@/components/ui/pagination";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ListTodo, 
  Plus, 
  Search, 
  Circle,
  Clock,
  AlertTriangle,
  CheckCircle,
  Edit,
  Trash2,
  Calendar,
  CalendarX,
  CalendarClock,
  Kanban
} from "lucide-react";
import { format, isToday, isThisWeek, isPast, differenceInDays } from "date-fns";
import { fr } from "date-fns/locale";
import TaskForm from "@/components/tasks/TaskForm";
import { Task } from "@shared/schema";

type TaskWithRelations = Task & {
  assignedUser: { id: string; username: string; firstName?: string; lastName?: string; };
  creator: { id: string; username: string; firstName?: string; lastName?: string; };
  group: { id: number; name: string; color: string; };
};

export default function Tasks() {
  const { user } = useAuthUnified();
  const { selectedStoreId } = useStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // États locaux
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [dueDateFilter, setDueDateFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<string>("kanban");
  
  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskWithRelations | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<TaskWithRelations | null>(null);

  // Fetch tasks
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["/api/tasks", selectedStoreId],
    queryFn: () => {
      const params = new URLSearchParams();
      if (selectedStoreId) {
        params.append('storeId', selectedStoreId.toString());
      }
      return fetch(`/api/tasks?${params.toString()}`, {
        credentials: 'include'
      }).then(res => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      });
    },
    enabled: !!user,
  });

  // Fetch users for task assignment - seulement pour admin/manager/directeur
  const { data: users = [] } = useQuery({
    queryKey: ["/api/users"],
    queryFn: () => fetch('/api/users', {
      credentials: 'include'
    }).then(res => {
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      return res.json();
    }),
    enabled: !!user && (user.role === 'admin' || user.role === 'manager' || user.role === 'directeur'),
  });



  const handleEditTask = (task: TaskWithRelations) => {
    setSelectedTask(task);
    setShowEditModal(true);
  };

  const handleCompleteTask = async (taskId: number) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la completion de la tâche');
      }

      await queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({
        title: "Succès",
        description: "Tâche marquée comme terminée",
      });
    } catch (error) {
      console.error("Error completing task:", error);
      toast({
        title: "Erreur",
        description: "Impossible de terminer la tâche",
        variant: "destructive",
      });
    }
  };

  const handleDeleteClick = (task: TaskWithRelations) => {
    setTaskToDelete(task);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!taskToDelete) return;

    try {
      const response = await fetch(`/api/tasks/${taskToDelete.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la suppression');
      }

      await queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({
        title: "Succès",
        description: "Tâche supprimée avec succès",
      });
      
      setShowDeleteModal(false);
      setTaskToDelete(null);
    } catch (error) {
      console.error("Error deleting task:", error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la tâche",
        variant: "destructive",
      });
    }
  };

  // Filtrer et trier les tâches
  const filteredTasks = tasks
    .filter((task: TaskWithRelations) => {
      // Filtre par recherche
      if (searchTerm && !task.title.toLowerCase().includes(searchTerm.toLowerCase()) && 
          !task.description?.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }

      // Filtre par statut
      if (statusFilter !== "all" && task.status !== statusFilter) {
        return false;
      }

      // Filtre par priorité
      if (priorityFilter !== "all" && task.priority !== priorityFilter) {
        return false;
      }

      // Filtre par date d'échéance
      if (dueDateFilter !== "all" && task.dueDate) {
        const dueDate = new Date(task.dueDate);
        switch (dueDateFilter) {
          case "today":
            if (!isToday(dueDate)) return false;
            break;
          case "this_week":
            if (!isThisWeek(dueDate)) return false;
            break;
          case "overdue":
            if (!isPast(dueDate) || task.status === 'done' || task.status === 'archived') return false;
            break;
          case "no_due_date":
            if (task.dueDate) return false;
            break;
        }
      } else if (dueDateFilter === "no_due_date" && task.dueDate) {
        return false;
      }

      return true;
    })
    .sort((a: TaskWithRelations, b: TaskWithRelations) => {
      // Ordre des statuts (backlog > todo > in_progress > review > testing > done > archived)
      const statusOrder = { 
        backlog: 7, 
        todo: 6, 
        in_progress: 5, 
        review: 4, 
        testing: 3, 
        done: 2, 
        archived: 1 
      };
      const aStatusOrder = statusOrder[a.status as keyof typeof statusOrder] || 0;
      const bStatusOrder = statusOrder[b.status as keyof typeof statusOrder] || 0;
      
      if (aStatusOrder !== bStatusOrder) {
        return bStatusOrder - aStatusOrder; // Ordre décroissant
      }
      
      // Pour les tâches de même statut, trier par priorité (high > medium > low)
      const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
      const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] || 2;
      const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] || 2;
      
      if (aPriority !== bPriority) {
        return bPriority - aPriority; // Ordre décroissant (high en premier)
      }
      
      // Enfin, trier par date de création (plus récent en premier)
      const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bDate - aDate;
    });

  // Pagination
  const {
    currentPage,
    setCurrentPage,
    itemsPerPage,
    setItemsPerPage,
    totalPages,
    paginatedData: paginatedTasks,
    totalItems
  } = usePagination(filteredTasks, 10);

  const getPriorityConfig = (priority: string) => {
    switch (priority) {
      case 'high':
        return { 
          color: 'destructive' as const, 
          icon: AlertTriangle, 
          label: 'Élevée' 
        };
      case 'medium':
        return { 
          color: 'default' as const, 
          icon: Clock, 
          label: 'Moyenne' 
        };
      case 'low':
        return { 
          color: 'secondary' as const, 
          icon: Circle, 
          label: 'Faible' 
        };
      default:
        return { 
          color: 'secondary' as const, 
          icon: Circle, 
          label: 'Moyenne' 
        };
    }
  };

  const getDueDateStatus = (dueDate: string | Date | null, status: string) => {
    if (!dueDate || status === 'done' || status === 'archived') return null;
    
    const due = new Date(dueDate);
    const now = new Date();
    const daysDiff = differenceInDays(due, now);
    
    if (isPast(due)) {
      return {
        type: 'overdue',
        color: 'destructive' as const,
        icon: CalendarX,
        label: `En retard de ${Math.abs(daysDiff)} jour${Math.abs(daysDiff) > 1 ? 's' : ''}`,
        text: 'En retard'
      };
    } else if (isToday(due)) {
      return {
        type: 'today',
        color: 'secondary' as const,
        icon: CalendarClock,
        label: "Échéance aujourd'hui",
        text: "Aujourd'hui"
      };
    } else if (daysDiff <= 3) {
      return {
        type: 'soon',
        color: 'default' as const,
        icon: Calendar,
        label: `Dans ${daysDiff} jour${daysDiff > 1 ? 's' : ''}`,
        text: `${daysDiff}j`
      };
    }
    
    return {
      type: 'normal',
      color: 'outline' as const,
      icon: Calendar,
      label: format(due, 'dd/MM/yyyy', { locale: fr }),
      text: format(due, 'dd/MM', { locale: fr })
    };
  };

  // Fonction pour rendre une carte Kanban
  const renderKanbanCard = (task: TaskWithRelations, canEditTasks: boolean, isCompleted = false) => {
    const priorityConfig = getPriorityConfig(task.priority);
    const PriorityIcon = priorityConfig.icon;
    const dueDateStatus = getDueDateStatus(task.dueDate, task.status);
    const DueDateIcon = dueDateStatus?.icon;
    
    return (
      <Card key={task.id} className={`hover:shadow-md transition-shadow cursor-pointer ${isCompleted ? 'opacity-75' : ''}`}>
        <CardContent className="p-2">
          <div className="flex items-start justify-between mb-1">
            <h5 className={`font-medium text-gray-900 text-xs ${isCompleted ? 'line-through' : ''}`}>{task.title}</h5>
            <Badge variant={priorityConfig.color} className="flex items-center gap-1 text-xs">
              <PriorityIcon className="w-2 h-2" />
              {priorityConfig.label.charAt(0)}
            </Badge>
          </div>
          
          {task.description && (
            <p className="text-xs text-gray-600 mb-1 line-clamp-1">
              {task.description}
            </p>
          )}
          
          <div className="text-xs text-gray-500 mb-1">
            {task.assignedTo}
          </div>
          
          {dueDateStatus && DueDateIcon && (
            <div className="flex items-center gap-1 mb-1">
              <Badge variant={dueDateStatus.color} className="flex items-center gap-1 text-xs">
                <DueDateIcon className="w-2 h-2" />
                {dueDateStatus.text}
              </Badge>
            </div>
          )}
          
          {isCompleted && (
            <div className="text-xs text-gray-500 mb-1">
              {task.completedAt ? format(new Date(task.completedAt), 'dd/MM', { locale: fr }) : ''}
            </div>
          )}
          
          <div className="flex items-center gap-1 mt-1">
            {canEditTasks && (
              <>
                {!isCompleted && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCompleteTask(task.id)}
                    className="text-green-600 hover:text-green-700 text-xs h-5 w-5 p-0"
                  >
                    <CheckCircle className="w-2 h-2" />
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleEditTask(task)}
                  className="text-xs h-5 w-5 p-0"
                >
                  <Edit className="w-2 h-2" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDeleteClick(task)}
                  className="text-red-600 hover:text-red-700 text-xs h-5 w-5 p-0"
                >
                  <Trash2 className="w-2 h-2" />
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const canCreateTasks = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'directeur';
  const canEditTasks = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'directeur';

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-6 shadow-sm -m-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 flex items-center">
              <ListTodo className="w-6 h-6 mr-3 text-blue-600" />
              Gestion des Tâches
            </h2>
            <p className="text-gray-600 mt-1">
              {totalItems} tâche{totalItems !== 1 ? 's' : ''} trouvée{totalItems !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Sélecteur de vue */}
            <Tabs value={viewMode} onValueChange={setViewMode} className="w-auto">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="kanban" className="flex items-center gap-2">
                  <Kanban className="w-4 h-4" />
                  Kanban
                </TabsTrigger>
                <TabsTrigger value="list" className="flex items-center gap-2">
                  <ListTodo className="w-4 h-4" />
                  Liste
                </TabsTrigger>
              </TabsList>
            </Tabs>
            
            {canCreateTasks && (
              <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
                <DialogTrigger asChild>
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-md">
                    <Plus className="w-4 h-4 mr-2" />
                    Nouvelle Tâche
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Créer une nouvelle tâche</DialogTitle>
                  </DialogHeader>
                  <TaskForm
                    onClose={() => setShowCreateModal(false)}
                  />
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Sidebar avec filtres */}
        <div className="w-80 bg-gray-50 border-r border-gray-200 p-4 flex-shrink-0">
          {/* Filtres */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Filtres</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Recherche */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Rechercher..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Filtre par statut */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Statut
                </label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes</SelectItem>
                    <SelectItem value="backlog">Backlog</SelectItem>
                    <SelectItem value="todo">À faire</SelectItem>
                    <SelectItem value="in_progress">En cours</SelectItem>
                    <SelectItem value="review">Révision</SelectItem>
                    <SelectItem value="testing">Test</SelectItem>
                    <SelectItem value="done">Terminé</SelectItem>
                    <SelectItem value="archived">Archivé</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Filtre par priorité */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Priorité
                </label>
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes</SelectItem>
                    <SelectItem value="high">Élevée</SelectItem>
                    <SelectItem value="medium">Moyenne</SelectItem>
                    <SelectItem value="low">Faible</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Filtre par échéance */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Échéance
                </label>
                <Select value={dueDateFilter} onValueChange={setDueDateFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes</SelectItem>
                    <SelectItem value="today">Aujourd'hui</SelectItem>
                    <SelectItem value="this_week">Cette semaine</SelectItem>
                    <SelectItem value="overdue">En retard</SelectItem>
                    <SelectItem value="no_due_date">Sans échéance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Zone principale avec les tâches */}
        <div className="flex-1">
          {/* Contenu selon la vue sélectionnée */}
          <Tabs value={viewMode} onValueChange={setViewMode} className="h-full">
            <TabsContent value="kanban" className="mt-0">
              {/* Vue Kanban avec 7 colonnes */}
              <div className="p-6">
                <div className="grid grid-cols-7 gap-3 h-full text-sm">
                  {/* Colonne Backlog */}
                  <div className="bg-gray-50 rounded-lg p-3">
                    <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2 text-xs">
                      <Circle className="w-4 h-4 text-gray-400" />
                      Backlog ({filteredTasks.filter((task: TaskWithRelations) => task.status === 'backlog').length})
                    </h3>
                    <div className="space-y-2 max-h-[500px] overflow-y-auto">
                      {filteredTasks.filter((task: TaskWithRelations) => task.status === 'backlog').map((task: TaskWithRelations) => {
                        return renderKanbanCard(task, canEditTasks);
                      })}
                    </div>
                  </div>

                  {/* Colonne À faire */}
                  <div className="bg-blue-50 rounded-lg p-3">
                    <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2 text-xs">
                      <Circle className="w-4 h-4 text-blue-500" />
                      À faire ({filteredTasks.filter((task: TaskWithRelations) => task.status === 'todo').length})
                    </h3>
                    <div className="space-y-2 max-h-[500px] overflow-y-auto">
                      {filteredTasks.filter((task: TaskWithRelations) => task.status === 'todo').map((task: TaskWithRelations) => {
                        return renderKanbanCard(task, canEditTasks);
                      })}
                    </div>
                  </div>

                  {/* Colonne En cours */}
                  <div className="bg-yellow-50 rounded-lg p-3">
                    <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2 text-xs">
                      <Clock className="w-4 h-4 text-yellow-500" />
                      En cours ({filteredTasks.filter((task: TaskWithRelations) => task.status === 'in_progress').length})
                    </h3>
                    <div className="space-y-2 max-h-[500px] overflow-y-auto">
                      {filteredTasks.filter((task: TaskWithRelations) => task.status === 'in_progress').map((task: TaskWithRelations) => {
                        return renderKanbanCard(task, canEditTasks);
                      })}
                    </div>
                  </div>

                  {/* Colonne Révision */}
                  <div className="bg-purple-50 rounded-lg p-3">
                    <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2 text-xs">
                      <Edit className="w-4 h-4 text-purple-500" />
                      Révision ({filteredTasks.filter((task: TaskWithRelations) => task.status === 'review').length})
                    </h3>
                    <div className="space-y-2 max-h-[500px] overflow-y-auto">
                      {filteredTasks.filter((task: TaskWithRelations) => task.status === 'review').map((task: TaskWithRelations) => {
                        return renderKanbanCard(task, canEditTasks);
                      })}
                    </div>
                  </div>

                  {/* Colonne Test */}
                  <div className="bg-orange-50 rounded-lg p-3">
                    <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2 text-xs">
                      <AlertTriangle className="w-4 h-4 text-orange-500" />
                      Test ({filteredTasks.filter((task: TaskWithRelations) => task.status === 'testing').length})
                    </h3>
                    <div className="space-y-2 max-h-[500px] overflow-y-auto">
                      {filteredTasks.filter((task: TaskWithRelations) => task.status === 'testing').map((task: TaskWithRelations) => {
                        return renderKanbanCard(task, canEditTasks);
                      })}
                    </div>
                  </div>

                  {/* Colonne Terminé */}
                  <div className="bg-green-50 rounded-lg p-3">
                    <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2 text-xs">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Terminé ({filteredTasks.filter((task: TaskWithRelations) => task.status === 'done').length})
                    </h3>
                    <div className="space-y-2 max-h-[500px] overflow-y-auto">
                      {filteredTasks.filter((task: TaskWithRelations) => task.status === 'done').map((task: TaskWithRelations) => {
                        return renderKanbanCard(task, canEditTasks, true);
                      })}
                    </div>
                  </div>

                  {/* Colonne Archivé */}
                  <div className="bg-gray-100 rounded-lg p-3">
                    <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2 text-xs">
                      <Circle className="w-4 h-4 text-gray-400" />
                      Archivé ({filteredTasks.filter((task: TaskWithRelations) => task.status === 'archived').length})
                    </h3>
                    <div className="space-y-2 max-h-[500px] overflow-y-auto">
                      {filteredTasks.filter((task: TaskWithRelations) => task.status === 'archived').map((task: TaskWithRelations) => {
                        return renderKanbanCard(task, canEditTasks, true);
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="list" className="mt-0">
              {/* Liste des tâches */}
              <div className="p-6">
            {totalItems === 0 ? (
              <div className="text-center py-12">
                <ListTodo className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Aucune tâche
                </h3>
                <p className="text-gray-600">
                  Aucune tâche trouvée avec les filtres sélectionnés.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Tâches actives (non terminées/archivées) */}
                {paginatedTasks.filter(task => !['done', 'archived'].includes(task.status)).length > 0 && (
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-3">
                      Tâches actives ({paginatedTasks.filter(task => !['done', 'archived'].includes(task.status)).length})
                    </h4>
                    <div className="space-y-3">
                      {paginatedTasks
                        .filter(task => !['done', 'archived'].includes(task.status))
                        .map((task) => {
                          const priorityConfig = getPriorityConfig(task.priority);
                          const PriorityIcon = priorityConfig.icon;
                          
                          return (
                            <Card key={task.id} className="hover:shadow-md transition-shadow">
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 mb-2">
                                      <h5 className="font-medium text-gray-900 truncate">
                                        {task.title}
                                      </h5>
                                      <Badge variant={priorityConfig.color} className="flex items-center gap-1">
                                        <PriorityIcon className="w-3 h-3" />
                                        {priorityConfig.label}
                                      </Badge>
                                      <Badge variant="outline" className="text-xs">
                                        {task.status === 'backlog' ? 'Backlog' :
                                         task.status === 'todo' ? 'À faire' :
                                         task.status === 'in_progress' ? 'En cours' :
                                         task.status === 'review' ? 'Révision' :
                                         task.status === 'testing' ? 'Test' : task.status}
                                      </Badge>
                                    </div>
                                    
                                    {task.description && (
                                      <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                                        {task.description}
                                      </p>
                                    )}
                                    
                                    <div className="flex items-center gap-4 text-xs text-gray-500 mb-2">
                                      <span>
                                        Assigné à: {task.assignedTo}
                                      </span>
                                      <span>
                                        Créée: {format(new Date(task.createdAt), 'dd/MM/yyyy HH:mm', { locale: fr })}
                                      </span>
                                    </div>
                                    
                                    {/* Affichage de l'échéance */}
                                    {(() => {
                                      const dueDateStatus = getDueDateStatus(task.dueDate, task.status);
                                      if (dueDateStatus) {
                                        const DueDateIcon = dueDateStatus.icon;
                                        return (
                                          <div className="flex items-center gap-2">
                                            <Badge variant={dueDateStatus.color} className="flex items-center gap-1 text-xs">
                                              <DueDateIcon className="w-3 h-3" />
                                              {dueDateStatus.text}
                                            </Badge>
                                            <span className="text-xs text-gray-500">{dueDateStatus.label}</span>
                                          </div>
                                        );
                                      } else if (task.dueDate) {
                                        return (
                                          <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="flex items-center gap-1 text-xs">
                                              <Calendar className="w-3 h-3" />
                                              {format(new Date(task.dueDate), 'dd/MM', { locale: fr })}
                                            </Badge>
                                          </div>
                                        );
                                      }
                                      return null;
                                    })()}
                                  </div>
                                  
                                  <div className="flex items-center gap-2 ml-4">
                                    {canEditTasks && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleCompleteTask(task.id)}
                                        className="text-green-600 hover:text-green-700"
                                      >
                                        <CheckCircle className="w-4 h-4" />
                                      </Button>
                                    )}
                                    {canEditTasks && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleEditTask(task)}
                                      >
                                        <Edit className="w-4 h-4" />
                                      </Button>
                                    )}
                                    {canEditTasks && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleDeleteClick(task)}
                                        className="text-red-600 hover:text-red-700"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                    </div>
                  </div>
                )}

                {/* Tâches terminées et archivées */}
                {paginatedTasks.filter(task => ['done', 'archived'].includes(task.status)).length > 0 && (
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-3 mt-8">
                      Tâches terminées ({paginatedTasks.filter(task => ['done', 'archived'].includes(task.status)).length})
                    </h4>
                    <div className="space-y-3">
                      {paginatedTasks
                        .filter(task => ['done', 'archived'].includes(task.status))
                        .map((task) => {
                          const priorityConfig = getPriorityConfig(task.priority);
                          const PriorityIcon = priorityConfig.icon;
                          
                          return (
                            <Card key={task.id} className="opacity-60 bg-gray-50">
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 mb-2">
                                      <h5 className="font-medium text-gray-500 truncate line-through">
                                        {task.title}
                                      </h5>
                                      <Badge 
                                        variant={task.status === 'done' ? 'secondary' : 'outline'} 
                                        className="flex items-center gap-1"
                                      >
                                        <CheckCircle className="w-3 h-3" />
                                        {task.status === 'done' ? 'Terminée' : 'Archivée'}
                                      </Badge>
                                    </div>
                                    
                                    {task.description && (
                                      <p className="text-sm text-gray-400 mb-2 line-clamp-2 line-through">
                                        {task.description}
                                      </p>
                                    )}
                                    
                                    <div className="flex items-center gap-4 text-xs text-gray-500">
                                      <span>
                                        Assigné à: {task.assignedTo}
                                      </span>
                                      <span>
                                        Créée: {format(new Date(task.createdAt), 'dd/MM/yyyy HH:mm', { locale: fr })}
                                      </span>
                                      {task.completedAt && (
                                        <span>
                                          Terminée: {format(new Date(task.completedAt), 'dd/MM/yyyy HH:mm', { locale: fr })}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  
                                  <div className="flex items-center gap-2 ml-4">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleDeleteClick(task)}
                                      className="text-red-600 hover:text-red-700"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            )}
            
                {/* Pagination */}
                {totalItems > 0 && (
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={totalItems}
                    itemsPerPage={itemsPerPage}
                    onPageChange={setCurrentPage}
                    onItemsPerPageChange={setItemsPerPage}
                    className="mt-4 border-t border-gray-200 pt-4 mx-6"
                  />
                )}
              </div>
            </TabsContent>

            <TabsContent value="kanban" className="mt-0">
              {/* Vue Kanban */}
              <div className="p-6">
                <div className="grid grid-cols-7 gap-3 h-full text-sm">
                  {/* Colonne Backlog */}
                  <div className="bg-gray-50 rounded-lg p-3">
                    <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2 text-xs">
                      <Circle className="w-4 h-4 text-gray-400" />
                      Backlog ({filteredTasks.filter((task: TaskWithRelations) => task.status === 'backlog').length})
                    </h3>
                    <div className="space-y-2 max-h-[500px] overflow-y-auto">
                      {filteredTasks.filter((task: TaskWithRelations) => task.status === 'backlog').map((task: TaskWithRelations) => {
                        return renderKanbanCard(task, canEditTasks);
                      })}
                    </div>
                  </div>

                  {/* Colonne À faire */}
                  <div className="bg-blue-50 rounded-lg p-3">
                    <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2 text-xs">
                      <Circle className="w-4 h-4 text-blue-500" />
                      À faire ({filteredTasks.filter((task: TaskWithRelations) => task.status === 'todo').length})
                    </h3>
                    <div className="space-y-2 max-h-[500px] overflow-y-auto">
                      {filteredTasks.filter((task: TaskWithRelations) => task.status === 'todo').map((task: TaskWithRelations) => {
                        return renderKanbanCard(task, canEditTasks);
                      })}
                    </div>
                  </div>

                  {/* Colonne En cours */}
                  <div className="bg-yellow-50 rounded-lg p-3">
                    <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2 text-xs">
                      <Clock className="w-4 h-4 text-yellow-500" />
                      En cours ({filteredTasks.filter((task: TaskWithRelations) => task.status === 'in_progress').length})
                    </h3>
                    <div className="space-y-2 max-h-[500px] overflow-y-auto">
                      {filteredTasks.filter((task: TaskWithRelations) => task.status === 'in_progress').map((task: TaskWithRelations) => {
                        return renderKanbanCard(task, canEditTasks);
                      })}
                    </div>
                  </div>

                  {/* Colonne Révision */}
                  <div className="bg-purple-50 rounded-lg p-3">
                    <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2 text-xs">
                      <Edit className="w-4 h-4 text-purple-500" />
                      Révision ({filteredTasks.filter((task: TaskWithRelations) => task.status === 'review').length})
                    </h3>
                    <div className="space-y-2 max-h-[500px] overflow-y-auto">
                      {filteredTasks.filter((task: TaskWithRelations) => task.status === 'review').map((task: TaskWithRelations) => {
                        return renderKanbanCard(task, canEditTasks);
                      })}
                    </div>
                  </div>

                  {/* Colonne Test */}
                  <div className="bg-orange-50 rounded-lg p-3">
                    <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2 text-xs">
                      <AlertTriangle className="w-4 h-4 text-orange-500" />
                      Test ({filteredTasks.filter((task: TaskWithRelations) => task.status === 'testing').length})
                    </h3>
                    <div className="space-y-2 max-h-[500px] overflow-y-auto">
                      {filteredTasks.filter((task: TaskWithRelations) => task.status === 'testing').map((task: TaskWithRelations) => {
                        return renderKanbanCard(task, canEditTasks);
                      })}
                    </div>
                  </div>

                  {/* Colonne Terminé */}
                  <div className="bg-green-50 rounded-lg p-3">
                    <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2 text-xs">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Terminé ({filteredTasks.filter((task: TaskWithRelations) => task.status === 'done').length})
                    </h3>
                    <div className="space-y-2 max-h-[500px] overflow-y-auto">
                      {filteredTasks.filter((task: TaskWithRelations) => task.status === 'done').map((task: TaskWithRelations) => {
                        return renderKanbanCard(task, canEditTasks, true);
                      })}
                    </div>
                  </div>

                  {/* Colonne Archivé */}
                  <div className="bg-gray-100 rounded-lg p-3">
                    <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2 text-xs">
                      <Circle className="w-4 h-4 text-gray-400" />
                      Archivé ({filteredTasks.filter((task: TaskWithRelations) => task.status === 'archived').length})
                    </h3>
                    <div className="space-y-2 max-h-[500px] overflow-y-auto">
                      {filteredTasks.filter((task: TaskWithRelations) => task.status === 'archived').map((task: TaskWithRelations) => {
                        return renderKanbanCard(task, canEditTasks, true);
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Modal d'édition */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Modifier la tâche</DialogTitle>
          </DialogHeader>
          {selectedTask && (
            <TaskForm
              task={selectedTask}
              onClose={() => {
                setShowEditModal(false);
                setSelectedTask(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de confirmation de suppression */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Confirmer la suppression
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-gray-700">
              Êtes-vous sûr de vouloir supprimer la tâche "{taskToDelete?.title}" ?
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Cette action est irréversible.
            </p>
          </div>
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteModal(false);
                setTaskToDelete(null);
              }}
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Supprimer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}