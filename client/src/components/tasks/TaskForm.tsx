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

import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { apiRequest } from "@/lib/queryClient";
import { insertTaskSchema, Task, Group } from "@shared/schema";
import { z } from "zod";

type TaskWithRelations = Task & {
  assignedUser: { id: string; username: string; firstName?: string; lastName?: string; };
  creator: { id: string; username: string; firstName?: string; lastName?: string; };
  group: { id: number; name: string; color: string; };
};

// Schéma simplifié sans magasin et sans date d'échéance
const taskFormSchema = insertTaskSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
  createdBy: true,
  groupId: true,
  dueDate: true, // Suppression du champ échéance
});

type TaskFormData = z.infer<typeof taskFormSchema>;

interface TaskFormProps {
  task?: TaskWithRelations;
  onClose: () => void;
}

export default function TaskForm({ task, onClose }: TaskFormProps) {
  const { user } = useAuthUnified();
  const { selectedStoreId } = useStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // État local pour gérer le magasin sélectionné (auto-sélection intelligente)
  const [localSelectedStoreId, setLocalSelectedStoreId] = useState<number | null>(null);

  // Récupération des magasins pour l'auto-sélection
  const { data: groupsData = [] } = useQuery<Group[]>({
    queryKey: ['/api/groups'],
  });
  
  // Filtrer les groupes selon le magasin sélectionné pour les admins
  const groups = Array.isArray(groupsData) ? (
    user?.role === 'admin' && selectedStoreId 
      ? groupsData.filter(g => g.id === selectedStoreId)
      : groupsData
  ) : [];

  // Auto-sélectionner le magasin selon les règles (même logique que CreateOrderModal)
  useEffect(() => {
    console.log('🏪 TaskForm - Store selection effect:', {
      groupsLength: groups.length,
      selectedStoreId,
      localSelectedStoreId,
      userRole: user?.role,
      allGroups: groups.map(g => ({ id: g.id, name: g.name })),
    });
    
    if (groups.length > 0 && !localSelectedStoreId) {
      let defaultStoreId: number | null = null;
      
      if (user?.role === 'admin') {
        // Pour l'admin : utiliser le magasin sélectionné dans le header (filtré), sinon le premier de la liste
        if (selectedStoreId && groups.find(g => g.id === selectedStoreId)) {
          defaultStoreId = selectedStoreId;
        } else {
          defaultStoreId = groups[0].id;
        }
        console.log('🏪 Admin task store selection:', { 
          selectedStoreId, 
          defaultStoreId, 
          firstGroupId: groups[0].id,
          groupsAvailable: groups.map(g => g.name)
        });
      } else {
        // Pour les autres rôles : prendre le premier magasin attribué
        defaultStoreId = groups[0].id;
        console.log('🏪 Non-admin task store selection:', { defaultStoreId, firstGroupId: groups[0].id });
      }
      
      if (defaultStoreId) {
        console.log('🏪 Setting default task store ID:', defaultStoreId, 'for group:', groups.find(g => g.id === defaultStoreId)?.name);
        setLocalSelectedStoreId(defaultStoreId);
      }
    }
    
    // Mettre à jour localSelectedStoreId si selectedStoreId change (pour les admins)
    if (user?.role === 'admin' && selectedStoreId && selectedStoreId !== localSelectedStoreId) {
      console.log('🔄 Updating task form store because header store changed:', { 
        oldStoreId: localSelectedStoreId, 
        newStoreId: selectedStoreId 
      });
      setLocalSelectedStoreId(selectedStoreId);
    }
  }, [groups, selectedStoreId, user?.role, localSelectedStoreId]);

  const form = useForm<TaskFormData>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: task?.title || "",
      description: task?.description || "",
      priority: task?.priority || "medium",
      status: task?.status || "pending",
      assignedTo: task?.assignedTo || "",

    },
  });

  // Mutation pour créer/modifier une tâche
  const createMutation = useMutation({
    mutationFn: (data: any) => {
      // Ajouter le groupId basé sur le magasin auto-sélectionné
      const taskData = {
        ...data,
        groupId: localSelectedStoreId,
        createdBy: user?.id,
        dueDate: data.dueDate || null
      };
      console.log('🚀 Creating task with data:', taskData);
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
    mutationFn: (data: any) => apiRequest(`/api/tasks/${task?.id}`, "PUT", data),
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
      };
      updateMutation.mutate(submitData);
    } else {
      // Création d'une nouvelle tâche - le groupId sera ajouté dans createMutation
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

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Affichage du magasin auto-sélectionné */}
        {localSelectedStoreId && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
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
                          style={{ backgroundColor: selectedGroup.color }}
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
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
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
                    <SelectItem value="low">Faible</SelectItem>
                    <SelectItem value="medium">Moyenne</SelectItem>
                    <SelectItem value="high">Élevée</SelectItem>
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
                    <SelectItem value="pending">En cours</SelectItem>
                    <SelectItem value="completed">Terminée</SelectItem>
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
        <div className="flex justify-end space-x-3 pt-6">
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
              task ? "Modifier" : "Créer"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}