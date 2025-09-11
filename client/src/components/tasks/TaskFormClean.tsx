import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useAuthUnified } from "@/hooks/useAuthUnified";
import { useStore } from "@/contexts/StoreContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { apiRequest } from "@/lib/queryClient";
import { insertTaskSchema, Task, Group } from "@shared/schema";
import { z } from "zod";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

// Schéma robuste avec dates de début et d'échéance pour production
const taskFormSchema = z.object({
  title: z.string().min(1, "Le titre est requis"),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  status: z.enum(["pending", "completed"]).default("pending"),
  assignedTo: z.string().min(1, "L'assignation est requise"),
  startDate: z.date().optional(),
  dueDate: z.date().optional(),
}).refine((data) => {
  if (data.startDate && data.dueDate) {
    return data.dueDate >= data.startDate;
  }
  return true;
}, {
  message: "La date d'échéance ne peut pas être antérieure à la date de début",
  path: ["dueDate"]
});

type TaskFormData = z.infer<typeof taskFormSchema>;

type TaskWithRelations = Task & {
  assignedUser?: { id: string; username: string; firstName?: string; lastName?: string; };
  creator?: { id: string; username: string; firstName?: string; lastName?: string; };
  group?: { id: number; name: string; color: string; };
};

interface TaskFormProps {
  task?: TaskWithRelations;
  onClose: () => void;
}

export default function TaskForm({ task, onClose }: TaskFormProps) {
  const { user } = useAuthUnified();
  const { selectedStoreId } = useStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [localSelectedStoreId, setLocalSelectedStoreId] = useState<number | null>(null);

  const { data: groupsData = [], error: groupsError } = useQuery<Group[]>({
    queryKey: ['/api/groups'],
    enabled: !!user,
  });
  
  if (groupsError) {
    console.warn('Erreur lors du chargement des magasins:', groupsError);
  }
  
  const groups = Array.isArray(groupsData) ? groupsData.filter(g => g && typeof g === 'object' && g.id) : [];

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

  const createMutation = useMutation({
    mutationFn: (data: any) => {
      const taskData = {
        ...data,
        groupId: localSelectedStoreId,
        createdBy: user?.id,
        startDate: data.startDate || null,
        dueDate: data.dueDate || null
      };
      return apiRequest("/api/tasks", "POST", taskData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      toast({
        title: "Succès",
        description: "Tâche créée avec succès",
      });
      onClose();
    },
    onError: (error) => {
      console.error('Erreur création tâche:', error);
      toast({
        title: "Erreur",
        description: "Erreur lors de la création de la tâche",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => {
      return apiRequest(`/api/tasks/${task?.id}`, "PATCH", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      toast({
        title: "Succès",
        description: "Tâche modifiée avec succès",
      });
      onClose();
    },
    onError: (error) => {
      console.error('Erreur modification tâche:', error);
      toast({
        title: "Erreur",
        description: "Erreur lors de la modification de la tâche",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: TaskFormData) => {
    if (!localSelectedStoreId) {
      toast({
        title: "Erreur",
        description: "Aucun magasin disponible",
        variant: "destructive",
      });
      return;
    }

    if (task) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <p className="text-sm text-muted-foreground">
            📅 Date de début = Quand la tâche devient visible<br/>
            ⏰ Date d'échéance = Quand la tâche doit être terminée
          </p>
        </div>
        <Button variant="outline" onClick={onClose}>
          Annuler
        </Button>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Titre *</FormLabel>
                <FormControl>
                  <Input placeholder="Titre de la tâche" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Description de la tâche (optionnel)"
                    rows={3}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-4">
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="startDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel className="flex items-center gap-2">
                    📅 Date de début
                    <span className="text-xs text-muted-foreground">(optionnel)</span>
                  </FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={field.value ? "w-full pl-3 text-left font-normal" : "w-full pl-3 text-left font-normal text-muted-foreground"}
                        >
                          {field.value ? (
                            format(field.value, "PPP", { locale: fr })
                          ) : (
                            <span>Sélectionner une date</span>
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

            <FormField
              control={form.control}
              name="dueDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel className="flex items-center gap-2">
                    ⏰ Date d'échéance
                    <span className="text-xs text-muted-foreground">(optionnel)</span>
                  </FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={field.value ? "w-full pl-3 text-left font-normal" : "w-full pl-3 text-left font-normal text-muted-foreground"}
                        >
                          {field.value ? (
                            format(field.value, "PPP", { locale: fr })
                          ) : (
                            <span>Sélectionner une date</span>
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

          <FormField
            control={form.control}
            name="assignedTo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Assigné à *</FormLabel>
                <FormControl>
                  <Input placeholder="Nom d'utilisateur" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending
                ? "En cours..."
                : task
                ? "Modifier"
                : "Créer"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}