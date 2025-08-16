import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthUnified } from "@/hooks/useAuthUnified";
import { useStore } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Megaphone, Plus, X, AlertTriangle, Clock, Circle, Edit2 } from "lucide-react";
import { useState } from "react";
import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertAnnouncementSchema } from "@shared/schema";
import type { AnnouncementWithRelations } from "@shared/schema";
import { z } from "zod";
import { safeFormat, safeDate } from "@/lib/dateUtils";
import { useToast } from "@/hooks/use-toast";

// Schéma simplifié pour tester
const formSchema = z.object({
  title: z.string().min(1, "Le titre est obligatoire"),
  content: z.string().min(1, "Le contenu est obligatoire"),
  priority: z.enum(["normal", "important", "urgent"]).default("normal"),
  groupId: z.number().optional().nullable(),
});

export default function AnnouncementCard() {
  const { user } = useAuthUnified();
  const { selectedStoreId } = useStore();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<AnnouncementWithRelations | null>(null);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      content: "",
      priority: "normal",
      groupId: undefined,
    },
  });

  // Reset form when editing announcement changes
  React.useEffect(() => {
    if (editingAnnouncement) {
      form.reset({
        title: editingAnnouncement.title,
        content: editingAnnouncement.content,
        priority: editingAnnouncement.priority as "normal" | "important" | "urgent",
        groupId: editingAnnouncement.groupId || undefined,
      });
    } else {
      form.reset({
        title: "",
        content: "",
        priority: "normal",
        groupId: undefined,
      });
    }
  }, [editingAnnouncement, form]);

  // Fetch announcements
  const { data: announcements = [], isLoading } = useQuery<AnnouncementWithRelations[]>({
    queryKey: ['/api/announcements', selectedStoreId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedStoreId && user?.role === 'admin') {
        params.append('storeId', selectedStoreId.toString());
      }
      
      const response = await fetch(`/api/announcements?${params}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch announcements');
      }
      
      return response.json();
    },
    enabled: !!user,
  });

  // Fetch groups for admin
  const { data: groups = [] } = useQuery<any[]>({
    queryKey: ['/api/groups'],
    enabled: user?.role === 'admin',
  });

  // Create/Update announcement mutation
  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      const isEditing = !!editingAnnouncement;
      console.log('📢 Submitting announcement:', { data, isEditing });
      
      const url = isEditing 
        ? `/api/announcements/${editingAnnouncement.id}`
        : '/api/announcements';
      
      const method = isEditing ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      
      console.log('📢 Announcement response:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('📢 Announcement failed:', errorText);
        throw new Error(`Failed to ${isEditing ? 'update' : 'create'} announcement: ${response.status} - ${errorText}`);
      }
      
      const result = await response.json();
      console.log('📢 Announcement success:', result);
      return result;
    },
    onSuccess: (data) => {
      const isEditing = !!editingAnnouncement;
      console.log('📢 Announcement success callback:', data);
      queryClient.invalidateQueries({ queryKey: ['/api/announcements'] });
      setIsCreateDialogOpen(false);
      setEditingAnnouncement(null);
      form.reset();
      toast({
        title: "Succès",
        description: isEditing ? "Information modifiée avec succès" : "Information créée avec succès",
      });
    },
    onError: (error) => {
      const isEditing = !!editingAnnouncement;
      console.error('📢 Announcement error:', error);
      toast({
        title: "Erreur",
        description: error.message || `Impossible de ${isEditing ? 'modifier' : 'créer'} l'information`,
        variant: "destructive",
      });
    },
  });

  // Delete announcement mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/announcements/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete announcement');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/announcements'] });
    },
  });

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    console.log('🔥 [FORM] onSubmit called with data:', data);
    console.log('🔥 [FORM] Form errors:', form.formState.errors);
    console.log('🔥 [FORM] Form is valid:', form.formState.isValid);
    console.log('🔥 [FORM] Form is submitting:', form.formState.isSubmitting);
    
    if (!data.title || !data.content) {
      console.error('🔥 [FORM] Missing required fields:', { title: data.title, content: data.content });
      toast({
        title: "Erreur",
        description: "Le titre et le contenu sont obligatoires",
        variant: "destructive",
      });
      return;
    }
    
    console.log('🔥 [FORM] Calling createMutation.mutate');
    createMutation.mutate(data);
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return <AlertTriangle className="h-4 w-4" />;
      case 'important':
        return <Bell className="h-4 w-4" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'important':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      default:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Informations</CardTitle>
          <Megaphone className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getPriorityConfig = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return { 
          color: 'destructive' as const, 
          icon: AlertTriangle, 
          label: 'Urgente' 
        };
      case 'important':
        return { 
          color: 'default' as const, 
          icon: Clock, 
          label: 'Importante' 
        };
      case 'normal':
      default:
        return { 
          color: 'secondary' as const, 
          icon: Circle, 
          label: 'Normale' 
        };
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Informations</CardTitle>
        <div className="flex items-center gap-2">
          {user?.role === 'admin' && (
            <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
              setIsCreateDialogOpen(open);
              if (!open) {
                setEditingAnnouncement(null);
                form.reset();
              }
            }}>
              <DialogTrigger asChild>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                  <Plus className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>
                    {editingAnnouncement ? 'Modifier l\'information' : 'Nouvelle information'}
                  </DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Titre</FormLabel>
                          <FormControl>
                            <Input placeholder="Titre de l'information" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="content"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contenu</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Contenu de l'information" 
                              rows={4}
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="priority"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Priorité</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Sélectionner une priorité" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="normal">Normale</SelectItem>
                              <SelectItem value="important">Importante</SelectItem>
                              <SelectItem value="urgent">Urgente</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="groupId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Magasin (optionnel)</FormLabel>
                          <Select onValueChange={(value) => field.onChange(value === 'all' ? null : parseInt(value))}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Tous les magasins" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="all">Tous les magasins</SelectItem>
                              {groups.map((group: any) => (
                                <SelectItem key={group.id} value={group.id.toString()}>
                                  {group.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end space-x-2 pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsCreateDialogOpen(false)}
                      >
                        Annuler
                      </Button>
                      <Button 
                        type="submit" 
                        disabled={createMutation.isPending}
                        onClick={() => console.log('🔥 [BUTTON] Submit button clicked')}
                      >
                        {createMutation.isPending 
                          ? (editingAnnouncement ? 'Modification...' : 'Création...') 
                          : (editingAnnouncement ? 'Modifier' : 'Créer')
                        }
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          )}
          <Megaphone className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        {announcements.length === 0 ? (
          <div className="text-center py-6">
            <Megaphone className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              Aucune information disponible
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {announcements.map((announcement) => {
              const priorityConfig = getPriorityConfig(announcement.priority);
              const PriorityIcon = priorityConfig.icon;
              
              return (
                <div key={announcement.id} className="flex items-start justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-sm truncate">
                        {announcement.title}
                      </h4>
                      <Badge variant={priorityConfig.color} className="flex items-center gap-1 text-xs">
                        <PriorityIcon className="w-2.5 h-2.5" />
                        {priorityConfig.label}
                      </Badge>
                    </div>
                    
                    {announcement.content && (
                      <p className="text-xs text-muted-foreground mb-1 line-clamp-1">
                        {announcement.content}
                      </p>
                    )}
                    
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>
                        {safeFormat(safeDate(announcement.createdAt), 'dd/MM à HH:mm')}
                      </span>
                      <span>
                        {announcement.author.firstName} {announcement.author.lastName}
                        {announcement.group && ` • ${announcement.group.name}`}
                      </span>
                    </div>
                  </div>
                  {user?.role === 'admin' && (
                    <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-blue-600"
                        onClick={() => {
                          setEditingAnnouncement(announcement);
                          setIsCreateDialogOpen(true);
                        }}
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteMutation.mutate(announcement.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}