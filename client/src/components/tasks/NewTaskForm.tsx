import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useAuthUnified } from "@/hooks/useAuthUnified";
import { useStore } from "@/components/Layout";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { apiRequest } from "@/lib/queryClient";
import { insertTaskSchema, Task, Group } from "@shared/schema";
import { z } from "zod";
import { CalendarIcon, Clock, AlertTriangle, Info } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

type TaskWithRelations = Task & {
  assignedUser?: { id: string; username: string; firstName?: string; lastName?: string; };
  creator?: { id: string; username: string; firstName?: string; lastName?: string; };
  group?: { id: number; name: string; color: string; };
  isFutureTask?: boolean;
};

// Schéma avec les deux dates : départ et échéance
const taskFormSchema = z.object({
  title: z.string().min(1, "Le titre est requis"),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  status: z.enum(["pending", "completed"]).default("pending"),
  assignedTo: z.string().min(1, "L'assignation est requise"),
  startDate: z.date().optional(), // Date de départ
  dueDate: z.date().optional(), // Date d'échéance
}).refine((data) => {
  // Validation : la date d'échéance ne peut pas être antérieure à la date de départ
  if (data.startDate && data.dueDate) {
    return data.dueDate >= data.startDate;
  }
  return true;
}, {
  message: "La date d'échéance ne peut pas être antérieure à la date de départ",
  path: ["dueDate"]
});

type TaskFormData = z.infer<typeof taskFormSchema>;

interface NewTaskFormProps {
  task?: TaskWithRelations;
  onClose: () => void;
}

export default function NewTaskForm({ task, onClose }: NewTaskFormProps) {
  const { user } = useAuthUnified();
  const { selectedStoreId } = useStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // État local pour gérer le magasin sélectionné (auto-sélection intelligente)
  const [localSelectedStoreId, setLocalSelectedStoreId] = useState<number | null>(null);

  // Récupération des magasins pour l'auto-sélection
  const { data: groupsData = [] } = useQuery<Group[]>({
    queryKey: ['/api/groups'],
    enabled: !!user, // Seulement si l'utilisateur est connecté
  });
  
  // Filtrer les groupes selon le magasin sélectionné pour les admins
  const groups = Array.isArray(groupsData) ? (
    user?.role === 'admin' && selectedStoreId 
      ? groupsData.filter(g => g && g.id === selectedStoreId)
      : groupsData.filter(g => g)
  ) : [];

  // Auto-sélectionner le magasin selon les règles
  useEffect(() => {
    if (groups.length > 0 && !localSelectedStoreId) {
      let defaultStoreId: number | null = null;
      
      if (user?.role === 'admin') {
        if (selectedStoreId && groups.find(g => g.id === selectedStoreId)) {
          defaultStoreId = selectedStoreId;
        } else {
          defaultStoreId = groups[0].id;
        }
      } else {
        defaultStoreId = groups[0].id;
      }
      
      if (defaultStoreId) {
        setLocalSelectedStoreId(defaultStoreId);
      }
    }
    
    if (user?.role === 'admin' && selectedStoreId && selectedStoreId !== localSelectedStoreId) {
      setLocalSelectedStoreId(selectedStoreId);
    }
  }, [groups, selectedStoreId, user?.role, localSelectedStoreId]);

  const form = useForm<TaskFormData>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: task?.title || "",
      description: task?.description || "",
      priority: (task?.priority as "low" | "medium" | "high") || "medium",
      status: (task?.status as "pending" | "completed") || "pending",
      assignedTo: task?.assignedTo || "",
      startDate: task?.startDate ? new Date(task.startDate) : undefined,
      dueDate: task?.dueDate ? new Date(task.dueDate) : undefined,
    },
  });

  // Mutation pour créer/modifier une tâche
  const createMutation = useMutation({
    mutationFn: (data: any) => {
      const taskData = {
        ...data,
        groupId: localSelectedStoreId,
        createdBy: user?.id,
        startDate: data.startDate || null,
        dueDate: data.dueDate || null
      };
      console.log('🚀 Creating task with complete data:', {
        ...taskData,
        startDate: taskData.startDate,
        startDateType: typeof taskData.startDate,
        dueDate: taskData.dueDate,
        dueDateType: typeof taskData.dueDate
      });
      return apiRequest("/api/tasks", "POST", taskData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({
        title: "Succès",
        description: "Tâche créée avec succès",
      });
      onClose();
    },
    onError: (error: any) => {
      console.error("Error creating task:", error);
      toast({
        title: "Erreur",
        description: "Impossible de créer la tâche",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => {
      console.log('🔄 Updating task with complete data:', {
        taskId: task?.id,
        data,
        startDate: data.startDate,
        startDateType: typeof data.startDate,
        dueDate: data.dueDate,
        dueDateType: typeof data.dueDate
      });
      return apiRequest(`/api/tasks/${task?.id}`, "PUT", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({
        title: "Succès",
        description: "Tâche modifiée avec succès",
      });
      onClose();
    },
    onError: (error: any) => {
      console.error("Error updating task:", error);
      toast({
        title: "Erreur",
        description: "Impossible de modifier la tâche",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: TaskFormData) => {
    console.log('📝 NewTaskForm onSubmit:', {
      isEdit: !!task,
      taskId: task?.id,
      formData: data,
      startDate: data.startDate,
      dueDate: data.dueDate,
      localSelectedStoreId
    });

    // Vérifier qu'un magasin est auto-sélectionné
    if (!localSelectedStoreId) {
      toast({
        title: "Erreur",
        description: "Aucun magasin disponible pour créer une tâche",
        variant: "destructive",
      });
      return;
    }

    if (task) {
      // Modification de tâche existante
      const submitData = {
        title: data.title,
        description: data.description,
        priority: data.priority,
        status: data.status,
        assignedTo: data.assignedTo,
        startDate: data.startDate || null,
        dueDate: data.dueDate || null,
      };
      console.log('🔄 Update task submitData:', submitData);
      updateMutation.mutate(submitData);
    } else {
      // Création d'une nouvelle tâche
      console.log('➕ Create task data:', data);
      createMutation.mutate(data);
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'high': return 'Élevée';
      case 'medium': return 'Moyenne';
      case 'low': return 'Faible';
      default: return 'Moyenne';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'En cours';
      case 'completed': return 'Terminée';
      default: return 'En cours';
    }
  };

  const today = new Date();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h2 className="text-xl font-semibold">
            {task ? "Modifier la tâche" : "Nouvelle tâche"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {task ? "Modifiez les informations de cette tâche" : "Créez une nouvelle tâche avec dates de départ et d'échéance"}
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-6">
          {/* Affichage du magasin auto-sélectionné */}
          {localSelectedStoreId && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Info className="h-5 w-5 text-blue-400" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-blue-800">
                    <span className="font-medium">Magasin sélectionné :</span>{" "}
                    {(() => {
                      const selectedGroup = groups.find(g => g.id === localSelectedStoreId);
                      return selectedGroup ? (
                        <span className="inline-flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: selectedGroup.color || "#1976D2" }}
                          />
                          {selectedGroup.name}
                        </span>
                      ) : `Magasin ID: ${localSelectedStoreId}`;
                    })()}
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* Avertissement si aucun magasin n'est disponible */}
          {!localSelectedStoreId && groups.length === 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
              <div className="flex">
                <div className="flex-shrink-0">
                  <AlertTriangle className="h-5 w-5 text-yellow-400" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-yellow-800">
                    Aucun magasin disponible. Veuillez contacter un administrateur.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Titre */}
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Titre *</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="Titre de la tâche"
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Description */}
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Description détaillée de la tâche (optionnel)"
                    rows={3}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Section des dates avec design clair */}
          <div className="border rounded-lg p-4 bg-gray-50">
            <div className="flex items-center mb-4">
              <Clock className="h-5 w-5 text-blue-600 mr-2" />
              <h3 className="font-medium text-gray-900">Planification temporelle</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Date de départ */}
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel className="text-sm font-medium">
                      📅 Date de départ
                    </FormLabel>
                    <FormDescription className="text-xs text-gray-600 mb-2">
                      Quand la tâche devient visible/active
                    </FormDescription>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP", { locale: fr })
                            ) : (
                              <span>Sélectionner la date de départ</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                          locale={fr}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Date d'échéance */}
              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel className="text-sm font-medium">
                      ⏰ Date d'échéance
                    </FormLabel>
                    <FormDescription className="text-xs text-gray-600 mb-2">
                      Date limite pour terminer la tâche
                    </FormDescription>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP", { locale: fr })
                            ) : (
                              <span>Sélectionner la date d'échéance</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                          locale={fr}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Information sur les règles de visibilité */}
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
              <div className="flex items-start">
                <Info className="h-4 w-4 text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-blue-700">
                  <p className="font-medium mb-1">Règles de visibilité :</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li><strong>Managers/Employés</strong> : voient la tâche uniquement à partir de la date de départ</li>
                    <li><strong>Admin/Directeur</strong> : voient toujours la tâche (avec style différent avant la date de départ)</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Priorité */}
            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Priorité *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner une priorité" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="low">🟢 Faible</SelectItem>
                      <SelectItem value="medium">🟡 Moyenne</SelectItem>
                      <SelectItem value="high">🔴 Élevée</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Statut */}
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Statut</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un statut" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="pending">⏳ En cours</SelectItem>
                      <SelectItem value="completed">✅ Terminée</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Assigné à */}
          <FormField
            control={form.control}
            name="assignedTo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Assigné à *</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="Nom de la personne assignée"
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Boutons d'action */}
          <div className="flex justify-end space-x-3 pt-6 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button 
              type="submit" 
              disabled={createMutation.isPending || updateMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {createMutation.isPending || updateMutation.isPending ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {task ? "Modification..." : "Création..."}
                </div>
              ) : (
                task ? "Modifier la tâche" : "Créer la tâche"
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}