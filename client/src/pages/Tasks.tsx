import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthUnified } from "@/hooks/useAuthUnified";
import { useStore } from "@/contexts/StoreContext";
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
  Kanban,
  Filter,
  X,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { format, isToday, isThisWeek, isPast, differenceInDays } from "date-fns";
import { fr } from "date-fns/locale";
// TaskForm inline pour éviter les problèmes d'import en production
import { Task } from "@shared/schema";

type TaskWithRelations = Task & {
  assignedUser?: { id: string; username: string; firstName?: string; lastName?: string; };
  creator?: { id: string; username: string; firstName?: string; lastName?: string; };
  group?: { id: number; name: string; color: string; };
  isFutureTask?: boolean; // Pour les tâches futures (admin/directeur uniquement)
};

// Composant TaskForm inline - Version production ultra-simple
function TaskFormInline({ task, onClose, selectedStoreId, user }: any) {
  const { toast } = useToast();
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    const formData = new FormData(e.currentTarget);
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const priority = formData.get('priority') as string;
    const status = formData.get('status') as string;
    const assignedTo = formData.get('assignedTo') as string;
    const startDate = formData.get('startDate') as string;
    const dueDate = formData.get('dueDate') as string;

    if (!title?.trim()) {
      toast({
        title: "Erreur",
        description: "Le titre est requis",
        variant: "destructive",
      });
      return;
    }


    const submitBtn = e.currentTarget.querySelector('button[type="submit"]') as HTMLButtonElement;
    submitBtn.disabled = true;
    submitBtn.textContent = "...";

    try {
      const taskData = {
        title: title.trim(),
        description: description?.trim() || "",
        priority: priority || "medium",
        status: status || "pending",
        assignedTo: assignedTo?.trim() || "Non assigné",
        startDate: startDate || null,
        dueDate: dueDate || null,
      };

      const url = task ? `/api/tasks/${task.id}` : '/api/tasks';
      const method = task ? 'PUT' : 'POST';

      if (!task) {
        // Utiliser le magasin sélectionné ou le premier disponible comme fallback
        (taskData as any).groupId = selectedStoreId ? parseInt(selectedStoreId.toString()) : 1;
        (taskData as any).createdBy = user?.username || 'admin';
      }

      console.log('📤 Tasks.tsx - Sending request:', { 
        url, 
        method, 
        taskData,
        selectedStoreId,
        finalGroupId: (taskData as any).groupId 
      });
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData),
      });

      console.log('📥 Response:', { status: response.status, ok: response.ok });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error:', { status: response.status, error: errorText });
        throw new Error(`Erreur ${response.status}: ${errorText}`);
      }

      toast({
        title: "Succès",
        description: task ? "Tâche modifiée avec succès" : "Tâche créée avec succès",
      });
      window.location.reload();
      
    } catch (error) {
      console.error('Erreur:', error);
      toast({
        title: "Erreur",
        description: "Erreur lors de l'opération",
        variant: "destructive",
      });
      submitBtn.disabled = false;
      submitBtn.textContent = task ? "Modifier" : "Créer";
    }
  };

  return (
    <div style={{ padding: '24px', backgroundColor: 'white' }}>
      <div style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: '16px', marginBottom: '24px' }}>
        <p style={{ fontSize: '14px', color: '#6b7280', margin: '0' }}>
          📅 Date de début = Quand la tâche devient visible<br/>
          ⏰ Date d'échéance = Quand la tâche doit être terminée
        </p>

      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
            Titre *
          </label>
          <input
            name="title"
            type="text"
            defaultValue={task?.title || ""}
            placeholder="Titre de la tâche"
            required
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '0px',
              fontSize: '14px'
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
            Description
          </label>
          <textarea
            name="description"
            defaultValue={task?.description || ""}
            placeholder="Description de la tâche (optionnel)"
            rows={3}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '0px',
              fontSize: '14px',
              resize: 'vertical'
            }}
          />
        </div>

        {/* Grille responsive pour priorité et statut */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
              Priorité *
            </label>
            <select
              name="priority"
              defaultValue={task?.priority || "medium"}
              className="w-full p-3 border border-gray-300 rounded-md text-base min-h-[44px] bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-white"
            >
              <option value="low">🟢 Faible</option>
              <option value="medium">🟡 Moyenne</option>
              <option value="high">🔴 Élevée</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
              Statut
            </label>
            <select
              name="status"
              defaultValue={task?.status || "pending"}
              className="w-full p-3 border border-gray-300 rounded-md text-base min-h-[44px] bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-white"
            >
              <option value="pending">⏳ En cours</option>
              <option value="completed">✅ Terminée</option>
            </select>
          </div>
        </div>

        {/* Grille responsive pour les dates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
              📅 Date de début <span style={{ fontSize: '12px', color: '#6b7280' }}>(optionnel)</span>
            </label>
            <input
              name="startDate"
              type="date"
              defaultValue={task?.startDate ? new Date(task.startDate).toISOString().split('T')[0] : ""}
              className="w-full p-3 border border-gray-300 rounded-md text-base min-h-[44px] bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-white"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
              ⏰ Date d'échéance <span style={{ fontSize: '12px', color: '#6b7280' }}>(optionnel)</span>
            </label>
            <input
              name="dueDate"
              type="date"
              defaultValue={task?.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : ""}
              className="w-full p-3 border border-gray-300 rounded-md text-base min-h-[44px] bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-white"
            />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
            Assigné à <span style={{ fontSize: '12px', color: '#6b7280' }}>(optionnel)</span>
          </label>
          <input
            name="assignedTo"
            type="text"
            defaultValue={task?.assignedTo || ""}
            placeholder="Nom de la personne assignée"
            className="w-full p-3 border border-gray-300 rounded-md text-base min-h-[44px] bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-white"
          />
        </div>

        {/* Boutons responsive - Stack sur mobile */}
        <div className="flex flex-col sm:flex-row gap-3 justify-stretch sm:justify-end mt-6">
          <button
            type="button"
            onClick={onClose}
            className="order-2 sm:order-1 px-4 py-3 border border-gray-300 rounded-md bg-white dark:bg-gray-800 cursor-pointer min-h-[44px] text-base hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-600 dark:text-white"
          >
            Annuler
          </button>
          <button
            type="submit"
            className="order-1 sm:order-2 px-4 py-3 border-none rounded-md bg-blue-600 text-white cursor-pointer min-h-[44px] text-base font-medium hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700"
          >
            {task ? "Modifier" : "Créer"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function Tasks() {
  const { user } = useAuthUnified();
  const { selectedStoreId, storeInitialized } = useStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Debug enablement condition for tasks query
  const isQueryEnabled = !!user && (user.role === 'admin' || (user.role === 'directeur' || user.role === 'manager' ? !!selectedStoreId : true));
  console.log('🔍 TASK QUERY ENABLEMENT DEBUG:', {
    hasUser: !!user,
    userRole: user?.role,
    selectedStoreId,
    isAdmin: user?.role === 'admin',
    isDirecteurOrManager: user?.role === 'directeur' || user?.role === 'manager',
    hasSelectedStore: !!selectedStoreId,
    finalEnabled: isQueryEnabled,
    storeInitialized,
    timestamp: new Date().toISOString()
  });

  // Force refresh when selectedStoreId changes for directeur/manager
  useEffect(() => {
    if (user && (user.role === 'directeur' || user.role === 'manager') && selectedStoreId) {
      console.log('🔄 FORCE REFRESH: selectedStoreId changed for directeur/manager:', {
        userRole: user.role,
        selectedStoreId,
        timestamp: new Date().toISOString()
      });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    }
  }, [selectedStoreId, user, queryClient]);

  // États locaux
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [dueDateFilter, setDueDateFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<string>("list");
  const [filtersOpen, setFiltersOpen] = useState(false);
  
  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskWithRelations | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<TaskWithRelations | null>(null);

  // Fetch tasks - attendre que l'initialisation des stores soit terminée pour les admins
  const { data: tasks = [], isLoading, error } = useQuery({
    queryKey: ["/api/tasks", selectedStoreId],
    queryFn: async () => {
      try {
        const params = new URLSearchParams();
        // CRITICAL FIX: Appliquer le filtrage par storeId pour TOUS les rôles, pas seulement admin
        if (selectedStoreId) {
          params.append('storeId', selectedStoreId.toString());
        }
        console.log('📋 TASKS QUERY - Fetching with params:', { 
          selectedStoreId, 
          userRole: user?.role,
          storeInitialized,
          url: `/api/tasks?${params.toString()}`,
          willFilterByStore: !!selectedStoreId,
          enabled: !!user,
          timestamp: new Date().toISOString(),
          userGroups: user?.userGroups?.map((ug: any) => ug.groupId) || 'NONE'
        });
        
        const response = await fetch(`/api/tasks?${params.toString()}`, {
          credentials: 'include'
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        console.log('📋 TASKS QUERY - Response received:', {
          dataType: typeof data,
          isArray: Array.isArray(data),
          length: data?.length,
          firstTask: data?.[0] ? {
            id: data[0].id,
            title: data[0].title,
            hasStartDate: !!data[0].startDate,
            hasGroup: !!data[0].group
          } : null
        });
        
        // Valider et nettoyer les données reçues
        if (!Array.isArray(data)) {
          console.error('Tasks API returned non-array data:', data);
          return [];
        }
        
        return data.filter(task => task && typeof task === 'object' && task.id);
        
      } catch (error) {
        console.error('Error fetching tasks:', error);
        throw error;
      }
    },
    enabled: !!user, // Charger les données dès que l'utilisateur est connecté
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
            if (!isPast(dueDate) || task.status === 'completed') return false;
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
      // Faire remonter les tâches non validées (pending) en premier
      if (a.status === 'pending' && b.status === 'completed') return -1;
      if (a.status === 'completed' && b.status === 'pending') return 1;
      
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

  const getDueDateStatus = (dueDate: Date | string | null, status: string) => {
    if (!dueDate || status === 'completed') return null;
    
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

  const getStartDateStatus = (startDate: Date | string | null) => {
    if (!startDate) return null;
    
    try {
      const start = new Date(startDate);
      if (isNaN(start.getTime())) return null;
      
      const now = new Date();
      const daysDiff = differenceInDays(start, now);
      
      if (isPast(start)) {
        return {
          type: 'started',
          color: 'default' as const,
          icon: CheckCircle,
          label: 'Démarrée',
          text: 'Active'
        };
      } else if (isToday(start)) {
        return {
          type: 'today',
          color: 'secondary' as const,
          icon: CalendarClock,
          label: "Démarre aujourd'hui",
          text: "Aujourd'hui"
        };
      } else {
        return {
          type: 'future',
          color: 'outline' as const,
          icon: Clock,
          label: `Démarre dans ${daysDiff} jour${daysDiff > 1 ? 's' : ''}`,
          text: `+${daysDiff}j`
        };
      }
    } catch (error) {
      console.warn('Error parsing start date:', error, startDate);
      return null;
    }
  };

  // Fonction pour déterminer si une tâche est future (pas encore commencée)
  const isTaskFuture = (task: TaskWithRelations) => {
    if (!task) return false;
    try {
      return task.isFutureTask || (task.startDate && !isPast(new Date(task.startDate)));
    } catch (error) {
      console.warn('Error checking if task is future:', error, task);
      return false;
    }
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
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4 sm:p-6 shadow-sm -m-3 sm:-m-6 mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 flex items-center">
              <ListTodo className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3 text-blue-600" />
              Gestion des Tâches
            </h2>
            <p className="text-gray-600 mt-1 text-sm sm:text-base">
              {totalItems} tâche{totalItems !== 1 ? 's' : ''} trouvée{totalItems !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Bouton filtres mobile */}
            <Button
              variant="outline"
              onClick={() => setFiltersOpen(!filtersOpen)}
              className="sm:hidden flex items-center justify-center gap-2"
              data-testid="button-mobile-filters"
            >
              <Filter className="w-4 h-4" />
              Filtres
              {filtersOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
            
            {/* Sélecteur de vue */}
            <Tabs value={viewMode} onValueChange={setViewMode} className="w-full sm:w-auto">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="list" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                  <ListTodo className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Liste</span>
                </TabsTrigger>
                <TabsTrigger value="kanban" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                  <Kanban className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Kanban</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
            
            {canCreateTasks && (
              <>
                <Button 
                  className="bg-blue-600 hover:bg-blue-700 text-white shadow-md text-xs sm:text-sm min-h-[44px] px-3 sm:px-4"
                  onClick={() => setShowCreateModal(true)}
                  data-testid="button-create-task"
                >
                  <Plus className="w-4 h-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Nouvelle Tâche</span>
                  <span className="sm:hidden">Créer</span>
                </Button>
                
                {showCreateModal && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 z-[1000] flex items-start sm:items-center justify-center p-4 sm:p-5">
                    <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-lg max-w-none sm:max-w-2xl w-full max-h-[calc(100vh-2rem)] sm:max-h-[90vh] overflow-auto shadow-2xl mt-5 sm:mt-0">
                      <div className="p-5 sm:p-6 pb-4 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
                        <h2 className="text-base sm:text-lg font-semibold m-0 pr-10 dark:text-white">
                          Créer une nouvelle tâche
                        </h2>
                        <button
                          onClick={() => setShowCreateModal(false)}
                          className="absolute top-4 right-4 bg-transparent border-none text-lg sm:text-xl cursor-pointer p-2 rounded text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors min-h-8 min-w-8 flex items-center justify-center"
                          data-testid="button-close-modal"
                        >
                          ✕
                        </button>
                      </div>
                      <TaskFormInline
                        selectedStoreId={selectedStoreId}
                        user={user}
                        onClose={() => setShowCreateModal(false)}
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Section filtres - Responsive */}
      <div className={`${filtersOpen ? 'block' : 'hidden'} lg:hidden mb-4`}>
        <Card className="mb-4 sm:mb-6">
          <CardHeader className="pb-3 sm:pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base sm:text-lg">Filtres</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFiltersOpen(false)}
                className="sm:hidden p-1"
                data-testid="button-close-filters"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4">
            {/* Recherche */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Rechercher..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-11 sm:h-10 text-base sm:text-sm"
                data-testid="input-search-tasks"
              />
            </div>

            {/* Filtres en grille responsive */}
            <div className="grid grid-cols-1 gap-3 sm:gap-4">
              {/* Filtre par statut */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Statut
                </label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-11 sm:h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes</SelectItem>
                    <SelectItem value="pending">En cours</SelectItem>
                    <SelectItem value="completed">Terminées</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Filtre par priorité */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Priorité
                </label>
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="h-11 sm:h-10">
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
                  <SelectTrigger className="h-11 sm:h-10">
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
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Zone principale mobile/tablet - Contenu pleine largeur */}
      <div className="block lg:hidden">
        <Tabs value={viewMode} onValueChange={setViewMode} className="h-full">
          <TabsContent value="list" className="mt-0">
            {/* Contenu mobile identique au desktop mais optimisé */}
            {totalItems === 0 ? (
              <div className="text-center py-8 sm:py-12">
                <ListTodo className="w-10 h-10 sm:w-12 sm:h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">
                  Aucune tâche
                </h3>
                <p className="text-gray-600 text-sm sm:text-base">
                  Aucune tâche trouvée avec les filtres sélectionnés.
                </p>
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {/* Tâches en cours - Mobile optimisé */}
                {paginatedTasks.filter(task => task.status === 'pending').length > 0 && (
                  <div>
                    <h4 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 px-1">
                      Tâches en cours ({paginatedTasks.filter(task => task.status === 'pending').length})
                    </h4>
                    <div className="space-y-2 sm:space-y-3">
                      {paginatedTasks
                        .filter(task => task.status === 'pending')
                        .map((task) => {
                          const priorityConfig = getPriorityConfig(task.priority);
                          const PriorityIcon = priorityConfig.icon;
                          const isFuture = isTaskFuture(task);
                          const startDateStatus = getStartDateStatus(task.startDate);
                          
                          return (
                            <Card key={task.id} className={`${isFuture ? 
                              "hover:shadow-md transition-all duration-200 bg-gray-50 border-dashed border-gray-300 opacity-75" : 
                              "hover:shadow-md transition-all duration-200 bg-white border-solid"} touch-manipulation`}
                              data-testid={`task-card-${task.id}`}>
                              <CardContent className="p-3 sm:p-4">
                                {/* Layout mobile : vertical stack */}
                                <div className="space-y-3">
                                  {/* Header de la tâche */}
                                  <div className="space-y-2">
                                    <div className="flex items-start justify-between gap-2">
                                      <h5 className={`font-medium text-sm sm:text-base leading-tight ${isFuture ? "text-gray-600 italic" : "text-gray-900"}`}>
                                        {task.title}
                                        {isFuture && " (Programmée)"}
                                      </h5>
                                    </div>
                                    
                                    {/* Badges de priorité et statut */}
                                    <div className="flex flex-wrap items-center gap-2">
                                      <Badge variant={priorityConfig.color} className="flex items-center gap-1 text-xs">
                                        <PriorityIcon className="w-3 h-3" />
                                        {priorityConfig.label}
                                      </Badge>
                                      {isFuture && (
                                        <Badge variant="outline" className="flex items-center gap-1 text-xs border-orange-300 text-orange-700 bg-orange-50">
                                          <Clock className="w-3 h-3" />
                                          Future
                                        </Badge>
                                      )}
                                    </div>
                                  </div>

                                  {/* Description */}
                                  {task.description && (
                                    <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                                      {task.description}
                                    </p>
                                  )}
                                  
                                  {/* Info assignation et création */}
                                  <div className="text-xs text-gray-500 space-y-1">
                                    <div>Assigné à: {task.assignedTo}</div>
                                    <div>Créée: {format(new Date(task.createdAt), 'dd/MM/yyyy HH:mm', { locale: fr })}</div>
                                  </div>

                                  {/* Dates importantes */}
                                  <div className="space-y-2">
                                    {[
                                      // Date de départ
                                      startDateStatus && (
                                        <div key="start" className="flex items-center gap-2">
                                          <Badge variant={startDateStatus.color} className="flex items-center gap-1 text-xs">
                                            <startDateStatus.icon className="w-3 h-3" />
                                            📅 {startDateStatus.text}
                                          </Badge>
                                          <span className="text-xs text-gray-500">
                                            {startDateStatus.label}
                                            {task.startDate && ` (${format(new Date(task.startDate), 'dd/MM/yyyy', { locale: fr })})`}
                                          </span>
                                        </div>
                                      ),
                                      // Date d'échéance
                                      (() => {
                                        const dueDateStatus = getDueDateStatus(task.dueDate, task.status);
                                        if (dueDateStatus) {
                                          const DueDateIcon = dueDateStatus.icon;
                                          return (
                                            <div key="due" className="flex items-center gap-2">
                                              <Badge variant={dueDateStatus.color} className="flex items-center gap-1 text-xs">
                                                <DueDateIcon className="w-3 h-3" />
                                                ⏰ {dueDateStatus.text}
                                              </Badge>
                                              <span className="text-xs text-gray-500">{dueDateStatus.label}</span>
                                            </div>
                                          );
                                        } else if (task.dueDate) {
                                          return (
                                            <div key="due-normal" className="flex items-center gap-2">
                                              <Badge variant="outline" className="flex items-center gap-1 text-xs">
                                                <Calendar className="w-3 h-3" />
                                                ⏰ {format(new Date(task.dueDate), 'dd/MM', { locale: fr })}
                                              </Badge>
                                            </div>
                                          );
                                        }
                                        return null;
                                      })()
                                    ].filter(Boolean)}
                                  </div>
                                  
                                  {/* Actions - Mobile friendly */}
                                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100">
                                    {isFuture && (
                                      <div className="text-xs text-orange-600 bg-orange-100 px-2 py-1 rounded">
                                        Visible en avance ({user?.role})
                                      </div>
                                    )}
                                    
                                    {canEditTasks && !isFuture && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleCompleteTask(task.id)}
                                        className="text-green-600 hover:text-green-700 min-h-[36px] px-3"
                                        data-testid={`button-complete-task-${task.id}`}
                                      >
                                        <CheckCircle className="w-4 h-4 mr-1" />
                                        <span className="text-xs">Terminer</span>
                                      </Button>
                                    )}
                                    {canEditTasks && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleEditTask(task)}
                                        className={`${isFuture ? "opacity-60" : ""} min-h-[36px] px-3`}
                                        data-testid={`button-edit-task-${task.id}`}
                                      >
                                        <Edit className="w-4 h-4 mr-1" />
                                        <span className="text-xs">Modifier</span>
                                      </Button>
                                    )}
                                    {canEditTasks && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleDeleteClick(task)}
                                        className={`${isFuture ? "text-red-600 hover:text-red-700 opacity-60" : "text-red-600 hover:text-red-700"} min-h-[36px] px-3`}
                                        data-testid={`button-delete-task-${task.id}`}
                                      >
                                        <Trash2 className="w-4 h-4 mr-1" />
                                        <span className="text-xs">Supprimer</span>
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

                {/* Tâches terminées - Mobile optimisé */}
                {paginatedTasks.filter(task => task.status === 'completed').length > 0 && (
                  <div>
                    <h4 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 mt-6 px-1">
                      Tâches terminées ({paginatedTasks.filter(task => task.status === 'completed').length})
                    </h4>
                    <div className="space-y-2 sm:space-y-3">
                      {paginatedTasks
                        .filter(task => task.status === 'completed')
                        .map((task) => {
                          const priorityConfig = getPriorityConfig(task.priority);
                          const PriorityIcon = priorityConfig.icon;
                          
                          return (
                            <Card key={task.id} className="hover:shadow-md transition-all duration-200 bg-green-50 border-green-200 touch-manipulation"
                              data-testid={`task-card-completed-${task.id}`}>
                              <CardContent className="p-3 sm:p-4">
                                <div className="space-y-2">
                                  <div className="flex items-start justify-between gap-2">
                                    <h5 className="font-medium text-sm sm:text-base text-gray-700 line-through">
                                      {task.title}
                                    </h5>
                                    <Badge variant="secondary" className="flex items-center gap-1 text-xs bg-green-100 text-green-700">
                                      <CheckCircle className="w-3 h-3" />
                                      Terminée
                                    </Badge>
                                  </div>
                                  
                                  {task.description && (
                                    <p className="text-xs sm:text-sm text-gray-500">
                                      {task.description}
                                    </p>
                                  )}
                                  
                                  <div className="flex items-center justify-between text-xs text-gray-500">
                                    <span>Assigné à: {task.assignedTo}</span>
                                    <span>Terminée: {format(new Date(task.updatedAt), 'dd/MM/yyyy', { locale: fr })}</span>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                    </div>
                  </div>
                )}
                
                {/* Pagination - Mobile friendly */}
                {totalPages > 1 && (
                  <div className="mt-6 flex justify-center">
                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      totalItems={totalItems}
                      onPageChange={setCurrentPage}
                      itemsPerPage={itemsPerPage}
                      onItemsPerPageChange={setItemsPerPage}
                    />
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Sidebar desktop uniquement */}
      <div className="hidden lg:flex gap-6">
        {/* Sidebar avec filtres desktop */}
        <div className="w-80 bg-gray-50 border-r border-gray-200 p-4 flex-shrink-0">
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
                    <SelectItem value="pending">En cours</SelectItem>
                    <SelectItem value="completed">Terminées</SelectItem>
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

        {/* Zone principale avec les tâches - Desktop */}
        <div className="flex-1">
          {/* Contenu selon la vue sélectionnée */}
          <Tabs value={viewMode} onValueChange={setViewMode} className="h-full">
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
                {/* Tâches en cours */}
                {paginatedTasks.filter(task => task.status === 'pending').length > 0 && (
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-3">
                      Tâches en cours ({paginatedTasks.filter(task => task.status === 'pending').length})
                    </h4>
                    <div className="space-y-3">
                      {paginatedTasks
                        .filter(task => task.status === 'pending')
                        .map((task) => {
                          const priorityConfig = getPriorityConfig(task.priority);
                          const PriorityIcon = priorityConfig.icon;
                          
                          const isFuture = isTaskFuture(task);
                          const startDateStatus = getStartDateStatus(task.startDate);
                          
                          return (
                            <Card key={task.id} className={isFuture ? 
                              "hover:shadow-md transition-all duration-200 bg-gray-50 border-dashed border-gray-300 opacity-75" : 
                              "hover:shadow-md transition-all duration-200 bg-white border-solid"}>
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 mb-2">
                                      <h5 className={isFuture ? "font-medium truncate text-gray-600 italic" : "font-medium truncate text-gray-900"}>
                                        {task.title}
                                        {isFuture && " (Programmée)"}
                                      </h5>
                                      <Badge variant={priorityConfig.color} className="flex items-center gap-1">
                                        <PriorityIcon className="w-3 h-3" />
                                        {priorityConfig.label}
                                      </Badge>
                                      {isFuture && (
                                        <Badge variant="outline" className="flex items-center gap-1 text-xs border-orange-300 text-orange-700 bg-orange-50">
                                          <Clock className="w-3 h-3" />
                                          Future
                                        </Badge>
                                      )}
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

                                    {/* Affichage des dates : départ et échéance */}
                                    <div className="flex items-center gap-4 mb-2">{[
                                      // Date de départ
                                      startDateStatus && (
                                        <div key="start" className="flex items-center gap-2">
                                          <Badge variant={startDateStatus.color} className="flex items-center gap-1 text-xs">
                                            <startDateStatus.icon className="w-3 h-3" />
                                            📅 {startDateStatus.text}
                                          </Badge>
                                          <span className="text-xs text-gray-500">
                                            {startDateStatus.label}
                                            {task.startDate && ` (${format(new Date(task.startDate), 'dd/MM/yyyy', { locale: fr })})`}
                                          </span>
                                        </div>
                                      ),
                                      // Date d'échéance
                                      (() => {
                                        const dueDateStatus = getDueDateStatus(task.dueDate, task.status);
                                        if (dueDateStatus) {
                                          const DueDateIcon = dueDateStatus.icon;
                                          return (
                                            <div key="due" className="flex items-center gap-2">
                                              <Badge variant={dueDateStatus.color} className="flex items-center gap-1 text-xs">
                                                <DueDateIcon className="w-3 h-3" />
                                                ⏰ {dueDateStatus.text}
                                              </Badge>
                                              <span className="text-xs text-gray-500">{dueDateStatus.label}</span>
                                            </div>
                                          );
                                        } else if (task.dueDate) {
                                          return (
                                            <div key="due-normal" className="flex items-center gap-2">
                                              <Badge variant="outline" className="flex items-center gap-1 text-xs">
                                                <Calendar className="w-3 h-3" />
                                                ⏰ {format(new Date(task.dueDate), 'dd/MM', { locale: fr })}
                                              </Badge>
                                            </div>
                                          );
                                        }
                                        return null;
                                      })()
                                    ].filter(Boolean)}</div>

                                  </div>
                                  
                                  <div className="flex items-center gap-2 ml-4">
                                    {/* Avertissement pour les tâches futures (admin/directeur) */}
                                    {isFuture && (
                                      <div className="text-xs text-orange-600 bg-orange-100 px-2 py-1 rounded mr-2">
                                        Visible en avance ({user?.role})
                                      </div>
                                    )}
                                    
                                    {canEditTasks && !isFuture && (
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
                                        className={isFuture ? "opacity-60" : ""}
                                      >
                                        <Edit className="w-4 h-4" />
                                      </Button>
                                    )}
                                    {canEditTasks && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleDeleteClick(task)}
                                        className={isFuture ? "text-red-600 hover:text-red-700 opacity-60" : "text-red-600 hover:text-red-700"}
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

                {/* Tâches terminées */}
                {paginatedTasks.filter(task => task.status === 'completed').length > 0 && (
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-3 mt-8">
                      Tâches terminées ({paginatedTasks.filter(task => task.status === 'completed').length})
                    </h4>
                    <div className="space-y-3">
                      {paginatedTasks
                        .filter(task => task.status === 'completed')
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
                                      <Badge variant="secondary" className="flex items-center gap-1">
                                        <CheckCircle className="w-3 h-3 border border-gray-300 rounded p-0.5" />
                                        Terminée
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
                <div className="grid grid-cols-2 gap-6 h-full">
                  {/* Colonne En cours */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <Circle className="w-5 h-5 text-yellow-500" />
                      En cours ({filteredTasks.filter((task: TaskWithRelations) => task.status === 'pending').length})
                    </h3>
                    <div className="space-y-3 max-h-[600px] overflow-y-auto">
                      {filteredTasks.filter((task: TaskWithRelations) => task.status === 'pending').map((task: TaskWithRelations) => {
                        const priorityConfig = getPriorityConfig(task.priority);
                        const PriorityIcon = priorityConfig.icon;
                        const dueDateStatus = getDueDateStatus(task.dueDate, task.status);
                        const DueDateIcon = dueDateStatus?.icon;
                        
                        return (
                          <Card key={task.id} className="hover:shadow-md transition-shadow cursor-pointer">
                            <CardContent className="p-3">
                              <div className="flex items-start justify-between mb-2">
                                <h5 className="font-medium text-gray-900 text-sm">{task.title}</h5>
                                <Badge variant={priorityConfig.color} className="flex items-center gap-1 text-xs">
                                  <PriorityIcon className="w-3 h-3" />
                                  {priorityConfig.label}
                                </Badge>
                              </div>
                              
                              {task.description && (
                                <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                                  {task.description}
                                </p>
                              )}
                              
                              <div className="text-xs text-gray-500 mb-2">
                                Assigné à: {task.assignedTo}
                              </div>
                              
                              {dueDateStatus && DueDateIcon && (
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge variant={dueDateStatus.color} className="flex items-center gap-1 text-xs">
                                    <DueDateIcon className="w-3 h-3" />
                                    {dueDateStatus.text}
                                  </Badge>
                                </div>
                              )}
                              
                              <div className="flex items-center gap-1 mt-2">
                                {canEditTasks && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleCompleteTask(task.id)}
                                      className="text-green-600 hover:text-green-700 text-xs h-7"
                                    >
                                      <CheckCircle className="w-3 h-3" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleEditTask(task)}
                                      className="text-xs h-7"
                                    >
                                      <Edit className="w-3 h-3" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleDeleteClick(task)}
                                      className="text-red-600 hover:text-red-700 text-xs h-7"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>

                  {/* Colonne Terminées */}
                  <div className="bg-green-50 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      Terminées ({filteredTasks.filter((task: TaskWithRelations) => task.status === 'completed').length})
                    </h3>
                    <div className="space-y-3 max-h-[600px] overflow-y-auto">
                      {filteredTasks.filter((task: TaskWithRelations) => task.status === 'completed').map((task: TaskWithRelations) => {
                        const priorityConfig = getPriorityConfig(task.priority);
                        const PriorityIcon = priorityConfig.icon;
                        
                        return (
                          <Card key={task.id} className="hover:shadow-md transition-shadow cursor-pointer opacity-75">
                            <CardContent className="p-3">
                              <div className="flex items-start justify-between mb-2">
                                <h5 className="font-medium text-gray-900 text-sm line-through">{task.title}</h5>
                                <Badge variant={priorityConfig.color} className="flex items-center gap-1 text-xs">
                                  <PriorityIcon className="w-3 h-3" />
                                  {priorityConfig.label}
                                </Badge>
                              </div>
                              
                              <div className="text-xs text-gray-500">
                                Terminée le: {task.completedAt ? format(new Date(task.completedAt), 'dd/MM/yyyy', { locale: fr }) : 'Date inconnue'}
                              </div>
                              
                              <div className="flex items-center gap-1 mt-2">
                                {canEditTasks && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleEditTask(task)}
                                      className="text-xs h-7"
                                    >
                                      <Edit className="w-3 h-3" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleDeleteClick(task)}
                                      className="text-red-600 hover:text-red-700 text-xs h-7"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        );
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
      {showEditModal && selectedTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[1000] flex items-start sm:items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-full sm:max-w-2xl w-full max-h-[calc(100vh-2rem)] overflow-y-auto shadow-2xl">
            <div className="p-6 pb-4 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800">
              <h2 className="text-lg font-semibold m-0 pr-10 dark:text-white">
                Modifier la tâche
              </h2>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedTask(null);
                }}
                className="absolute top-4 right-4 bg-transparent border-none text-xl cursor-pointer p-2 rounded text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                ✕
              </button>
            </div>
            <TaskFormInline
              task={selectedTask}
              selectedStoreId={selectedStoreId}
              user={user}
              onClose={() => {
                setShowEditModal(false);
                setSelectedTask(null);
              }}
            />
          </div>
        </div>
      )}

{/* Modal de confirmation de suppression */}
      {showDeleteModal && taskToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[1000] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-sm w-full p-6 shadow-2xl mx-4">
            <h2 className="text-lg font-semibold mb-4 text-red-600 dark:text-red-400 flex items-center gap-2">
              ⚠️ Confirmer la suppression
            </h2>
            <div className="mb-6">
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-2">
                Êtes-vous sûr de vouloir supprimer la tâche "{taskToDelete.title}" ?
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Cette action est irréversible.
              </p>
            </div>
            <div className="flex gap-3 flex-col sm:flex-row">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setTaskToDelete(null);
                }}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600 order-2 sm:order-1"
              >
                Annuler
              </button>
              <button 
                onClick={handleConfirmDelete}
                className="px-4 py-2 border-none rounded-md bg-red-600 text-white cursor-pointer hover:bg-red-700 flex items-center justify-center gap-2 order-1 sm:order-2"
              >
                🗑️ Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}