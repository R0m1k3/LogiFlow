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
// TaskForm inline pour éviter les problèmes d'import en production
import { Task } from "@shared/schema";

type TaskWithRelations = Task & {
  assignedUser?: { id: string; username: string; firstName?: string; lastName?: string; };
  creator?: { id: string; username: string; firstName?: string; lastName?: string; };
  group?: { id: number; name: string; color: string; };
  isFutureTask?: boolean; // Pour les tâches futures (admin/directeur uniquement)
};

// Composant TaskForm inline - Version production ultra-simple
function TaskFormInline({ task, onClose }: any) {
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

    if (!assignedTo?.trim()) {
      toast({
        title: "Erreur", 
        description: "L'assignation est requise",
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
        assignedTo: assignedTo.trim(),
        startDate: startDate || null,
        dueDate: dueDate || null,
      };

      const url = task ? `/api/tasks/${task.id}` : '/api/tasks';
      const method = task ? 'PUT' : 'POST';

      if (!task) {
        (taskData as any).groupId = 1;
        (taskData as any).createdBy = 'admin';
      }

      console.log('📤 Sending request:', { url, method, taskData });
      
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
        <button
          type="button"
          onClick={onClose}
          style={{
            float: 'right',
            padding: '8px 16px',
            border: '1px solid #d1d5db',
            borderRadius: '0px',
            backgroundColor: 'white',
            cursor: 'pointer'
          }}
        >
          Annuler
        </button>
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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
              Priorité *
            </label>
            <select
              name="priority"
              defaultValue={task?.priority || "medium"}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '0px',
                fontSize: '14px'
              }}
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
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '0px',
                fontSize: '14px'
              }}
            >
              <option value="pending">⏳ En cours</option>
              <option value="completed">✅ Terminée</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
              📅 Date de début <span style={{ fontSize: '12px', color: '#6b7280' }}>(optionnel)</span>
            </label>
            <input
              name="startDate"
              type="date"
              defaultValue={task?.startDate ? new Date(task.startDate).toISOString().split('T')[0] : ""}
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
              ⏰ Date d'échéance <span style={{ fontSize: '12px', color: '#6b7280' }}>(optionnel)</span>
            </label>
            <input
              name="dueDate"
              type="date"
              defaultValue={task?.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : ""}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '0px',
                fontSize: '14px'
              }}
            />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
            Assigné à *
          </label>
          <input
            name="assignedTo"
            type="text"
            defaultValue={task?.assignedTo || ""}
            placeholder="Nom de la personne assignée"
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

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 16px',
              border: '1px solid #d1d5db',
              borderRadius: '0px',
              backgroundColor: 'white',
              cursor: 'pointer'
            }}
          >
            Annuler
          </button>
          <button
            type="submit"
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: '0px',
              backgroundColor: '#3b82f6',
              color: 'white',
              cursor: 'pointer'
            }}
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

  // États locaux
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [dueDateFilter, setDueDateFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<string>("list");
  
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
        if (selectedStoreId && user?.role === 'admin') {
          params.append('storeId', selectedStoreId.toString());
        }
        console.log('📋 TASKS QUERY - Fetching with params:', { 
          selectedStoreId, 
          userRole: user?.role,
          storeInitialized,
          url: `/api/tasks?${params.toString()}`
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
    enabled: !!user && (user.role !== 'admin' || storeInitialized),
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
                <TabsTrigger value="list" className="flex items-center gap-2">
                  <ListTodo className="w-4 h-4" />
                  Liste
                </TabsTrigger>
                <TabsTrigger value="kanban" className="flex items-center gap-2">
                  <Kanban className="w-4 h-4" />
                  Kanban
                </TabsTrigger>
              </TabsList>
            </Tabs>
            
{canCreateTasks && (
              <>
                <Button 
                  className="bg-blue-600 hover:bg-blue-700 text-white shadow-md"
                  onClick={() => setShowCreateModal(true)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Nouvelle Tâche
                </Button>
                
                {showCreateModal && (
                  <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    zIndex: 1000,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <div style={{
                      backgroundColor: 'white',
                      borderRadius: '8px',
                      maxWidth: '600px',
                      width: '90%',
                      maxHeight: '90vh',
                      overflow: 'auto',
                      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
                    }}>
                      <div style={{
                        padding: '24px 24px 16px',
                        borderBottom: '1px solid #e5e7eb'
                      }}>
                        <h2 style={{
                          fontSize: '18px',
                          fontWeight: '600',
                          margin: '0'
                        }}>
                          Créer une nouvelle tâche
                        </h2>
                      </div>
                      <TaskFormInline
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

        {/* Zone principale avec les tâches */}
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
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            <div style={{
              padding: '24px 24px 16px',
              borderBottom: '1px solid #e5e7eb'
            }}>
              <h2 style={{
                fontSize: '18px',
                fontWeight: '600',
                margin: '0'
              }}>
                Modifier la tâche
              </h2>
            </div>
            <TaskFormInline
              task={selectedTask}
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
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            maxWidth: '400px',
            width: '90%',
            padding: '24px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            <h2 style={{
              fontSize: '18px',
              fontWeight: '600',
              margin: '0 0 16px 0',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              ⚠️ Confirmer la suppression
            </h2>
            <div style={{ marginBottom: '24px' }}>
              <p style={{
                color: '#374151',
                lineHeight: '1.5',
                margin: '0 0 8px 0'
              }}>
                Êtes-vous sûr de vouloir supprimer la tâche "{taskToDelete.title}" ?
              </p>
              <p style={{
                fontSize: '14px',
                color: '#6b7280',
                margin: '0'
              }}>
                Cette action est irréversible.
              </p>
            </div>
            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setTaskToDelete(null);
                }}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #d1d5db',
                  borderRadius: '0px',
                  backgroundColor: 'white',
                  cursor: 'pointer'
                }}
              >
                Annuler
              </button>
              <button 
                onClick={handleConfirmDelete}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '0px',
                  backgroundColor: '#dc2626',
                  color: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
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