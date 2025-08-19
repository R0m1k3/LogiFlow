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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { apiRequest } from "@/lib/queryClient";
import { insertTaskSchema, Task, Group } from "@shared/schema";
import { z } from "zod";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

// Version simplifiée du schéma sans startDate pour éviter les erreurs de production
const simpleTaskFormSchema = z.object({
  title: z.string().min(1, "Le titre est requis"),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  status: z.enum(["pending", "completed"]).default("pending"),
  assignedTo: z.string().min(1, "L'assignation est requise"),
  dueDate: z.date().optional(), // Seulement la date d'échéance
});

type SimpleTaskFormData = z.infer<typeof simpleTaskFormSchema>;

type TaskWithRelations = Task & {
  assignedUser?: { id: string; username: string; firstName?: string; lastName?: string; };
  creator?: { id: string; username: string; firstName?: string; lastName?: string; };
  group?: { id: number; name: string; color: string; };
};

interface SimpleTaskFormProps {
  task?: TaskWithRelations;
  onClose: () => void;
}

export default function SimpleTaskForm({ task, onClose }: SimpleTaskFormProps) {
  const { user } = useAuthUnified();
  const { selectedStoreId } = useStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // État local pour gérer le magasin sélectionné
  const [localSelectedStoreId, setLocalSelectedStoreId] = useState<number | null>(null);

  // Récupération sécurisée des magasins
  const { data: groupsData = [] } = useQuery<Group[]>({
    queryKey: ['/api/groups'],
    enabled: !!user,
    onError: (error) => console.warn('Erreur lors du chargement des magasins:', error)
  });
  
  const groups = Array.isArray(groupsData) ? groupsData.filter(g => g && g.id) : [];

  // Auto-sélection du magasin
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

  const form = useForm<SimpleTaskFormData>({
    resolver: zodResolver(simpleTaskFormSchema),
    defaultValues: {
      title: task?.title || "",
      description: task?.description || "",
      priority: (task?.priority as "low" | "medium" | "high") || "medium",
      status: (task?.status as "pending" | "completed") || "pending",
      assignedTo: task?.assignedTo || "",
      dueDate: task?.dueDate ? new Date(task.dueDate) : undefined,
    },
  });

  // Mutations sécurisées
  const createMutation = useMutation({
    mutationFn: (data: any) => {
      const taskData = {
        ...data,
        groupId: localSelectedStoreId,
        createdBy: user?.id,
        dueDate: data.dueDate || null
      };
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

  const onSubmit = (data: SimpleTaskFormData) => {
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
          <h2 className="text-xl font-semibold">
            {task ? "Modifier la tâche" : "Nouvelle tâche"}
          </h2>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Titre */}
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

          {/* Description */}
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

          {/* Date d'échéance */}
          <FormField
            control={form.control}
            name="dueDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Date d'échéance</FormLabel>
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