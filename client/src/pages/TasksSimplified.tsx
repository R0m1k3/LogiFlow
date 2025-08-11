import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthUnified } from "@/hooks/useAuthUnified";
import { useStore } from "@/components/Layout";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  ListTodo, 
  Plus, 
  Search, 
  Circle,
  Clock,
  AlertTriangle,
  CheckCircle,
  Edit,
  Trash2
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Task } from "@shared/schema";

type TaskWithRelations = Task & {
  creator: { id: string; username: string; name: string; };
  group: { id: number; name: string; color: string; };
};

export default function TasksSimplified() {
  const { user } = useAuthUnified();
  const { selectedStoreId } = useStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // États locaux
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  
  // Modals et tâche sélectionnée
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskWithRelations | null>(null);

  // Récupération des tâches
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["/api/tasks", selectedStoreId],
    queryFn: () => {
      const params = new URLSearchParams();
      if (selectedStoreId) {
        params.append('storeId', selectedStoreId);
      }
      return fetch(`/api/tasks?${params.toString()}`).then(res => res.json());
    },
    enabled: !!user,
  });

  // Récupération des magasins
  const { data: stores = [] } = useQuery({
    queryKey: ["/api/groups"],
    enabled: !!user,
  });

  // Filtrer les tâches
  const filteredTasks = tasks.filter((task: TaskWithRelations) => {
    const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         task.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         task.assignedTo?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || task.status === statusFilter;
    const matchesPriority = priorityFilter === "all" || task.priority === priorityFilter;
    
    return matchesSearch && matchesStatus && matchesPriority;
  });

  // Création d'une tâche
  const handleCreateTask = async (taskData: any) => {
    try {
      await apiRequest('/api/tasks', 'POST', {
        ...taskData,
        groupId: selectedStoreId ? parseInt(selectedStoreId) : stores[0]?.id
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setShowCreateModal(false);
      toast({
        title: "Succès",
        description: "Tâche créée avec succès",
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de créer la tâche",
        variant: "destructive",
      });
    }
  };

  // Modification d'une tâche
  const handleUpdateTask = async (taskData: any) => {
    if (!selectedTask) return;
    
    try {
      await apiRequest(`/api/tasks/${selectedTask.id}`, 'PUT', taskData);
      
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setShowEditModal(false);
      setSelectedTask(null);
      toast({
        title: "Succès",
        description: "Tâche modifiée avec succès",
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de modifier la tâche",
        variant: "destructive",
      });
    }
  };

  // Complétion d'une tâche
  const handleCompleteTask = async (taskId: number) => {
    try {
      await apiRequest(`/api/tasks/${taskId}/complete`, 'POST');
      
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({
        title: "Succès",
        description: "Tâche marquée comme terminée",
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de compléter la tâche",
        variant: "destructive",
      });
    }
  };

  // Suppression d'une tâche
  const handleDeleteTask = async (taskId: number) => {
    try {
      await apiRequest(`/api/tasks/${taskId}`, 'DELETE');
      
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({
        title: "Succès",
        description: "Tâche supprimée avec succès",
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la tâche",
        variant: "destructive",
      });
    }
  };

  const handleEditTask = (task: TaskWithRelations) => {
    setSelectedTask(task);
    setShowEditModal(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-green-100 text-green-800";
      case "pending": return "bg-yellow-100 text-yellow-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "bg-red-100 text-red-800";
      case "medium": return "bg-blue-100 text-blue-800";
      case "low": return "bg-green-100 text-green-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Chargement des tâches...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Vous devez être connecté pour accéder aux tâches.</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <ListTodo className="h-6 w-6 text-blue-600" />
          <h1 className="text-2xl font-bold">Gestion des Tâches</h1>
        </div>
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle Tâche
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Créer une nouvelle tâche</DialogTitle>
            </DialogHeader>
            <TaskForm onSubmit={handleCreateTask} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Filtres */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtres</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Rechercher une tâche..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="min-w-[150px]">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="completed">Terminée</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[150px]">
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Priorité" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes priorités</SelectItem>
                  <SelectItem value="high">Haute</SelectItem>
                  <SelectItem value="medium">Moyenne</SelectItem>
                  <SelectItem value="low">Basse</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Liste des tâches */}
      <div className="space-y-4">
        {filteredTasks.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center h-32">
              <div className="text-center">
                <ListTodo className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Aucune tâche trouvée</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          filteredTasks.map((task: TaskWithRelations) => (
            <Card key={task.id} className={`hover:shadow-md transition-shadow ${task.status === 'completed' ? 'opacity-60 bg-gray-50' : ''}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className={`font-semibold text-lg ${task.status === 'completed' ? 'line-through text-gray-500' : ''}`}>{task.title}</h3>
                      <Badge className={getStatusColor(task.status)}>
                        {task.status === "completed" ? "Terminée" : "En attente"}
                      </Badge>
                      <Badge className={getPriorityColor(task.priority)}>
                        {task.priority === "high" ? "Haute" : task.priority === "medium" ? "Moyenne" : "Basse"}
                      </Badge>
                    </div>
                    
                    {task.description && (
                      <p className={`mb-3 ${task.status === 'completed' ? 'text-gray-400 line-through' : 'text-gray-600'}`}>{task.description}</p>
                    )}
                    
                    <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                      <div className="flex items-center space-x-1">
                        <span className="font-medium">Assigné à:</span>
                        <span>{task.assignedTo || "Non assigné"}</span>
                      </div>
                      
                      <div className="flex items-center space-x-1">
                        <span className="font-medium">Magasin:</span>
                        <span className="px-2 py-1 rounded text-xs" style={{ backgroundColor: task.group.color + '20', color: task.group.color }}>
                          {task.group.name}
                        </span>
                      </div>
                      
                      <div className="flex items-center space-x-1">
                        <span className="font-medium">Créé par:</span>
                        <span>{task.creator.name || task.creator.username}</span>
                      </div>
                      
                      {task.dueDate && (
                        <div className="flex items-center space-x-1">
                          <Clock className="w-4 h-4" />
                          <span>
                            Échéance: {format(new Date(task.dueDate), 'dd/MM/yyyy HH:mm', { locale: fr })}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 ml-4">
                    {task.status !== "completed" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCompleteTask(task.id)}
                        className="text-green-600 hover:text-green-700"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEditTask(task)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDeleteTask(task.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Modal de modification */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier la tâche</DialogTitle>
          </DialogHeader>
          {selectedTask && (
            <TaskForm 
              initialData={selectedTask} 
              onSubmit={handleUpdateTask}
              isEditing={true}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Composant de formulaire simplifié
function TaskForm({ onSubmit, initialData, isEditing = false }: {
  onSubmit: (data: any) => void;
  initialData?: TaskWithRelations;
  isEditing?: boolean;
}) {
  const [title, setTitle] = useState(initialData?.title || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [assignedTo, setAssignedTo] = useState(initialData?.assignedTo || "");
  const [priority, setPriority] = useState(initialData?.priority || "medium");
  const [dueDate, setDueDate] = useState(
    initialData?.dueDate ? format(new Date(initialData.dueDate), 'yyyy-MM-dd') : ""
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || !assignedTo.trim()) {
      return;
    }

    const taskData = {
      title: title.trim(),
      description: description.trim() || undefined,
      assignedTo: assignedTo.trim(),
      priority,
      dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
    };

    onSubmit(taskData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="title" className="block text-sm font-medium mb-1">
          Titre de la tâche *
        </label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titre de la tâche"
          required
        />
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium mb-1">
          Description
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description de la tâche"
          className="w-full p-2 border rounded-md"
          rows={3}
        />
      </div>

      <div>
        <label htmlFor="assignedTo" className="block text-sm font-medium mb-1">
          Assigné à *
        </label>
        <Input
          id="assignedTo"
          value={assignedTo}
          onChange={(e) => setAssignedTo(e.target.value)}
          placeholder="Nom de la personne responsable"
          required
        />
      </div>

      <div>
        <label htmlFor="priority" className="block text-sm font-medium mb-1">
          Priorité
        </label>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="low">Basse</SelectItem>
            <SelectItem value="medium">Moyenne</SelectItem>
            <SelectItem value="high">Haute</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <label htmlFor="dueDate" className="block text-sm font-medium mb-1">
          Date d'échéance
        </label>
        <Input
          id="dueDate"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
      </div>

      <div className="flex justify-end space-x-2">
        <Button type="submit">
          {isEditing ? "Modifier" : "Créer"}
        </Button>
      </div>
    </form>
  );
}