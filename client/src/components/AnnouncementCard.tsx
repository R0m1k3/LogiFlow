import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthUnified } from "@/hooks/useAuthUnified";
import { useStore } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Megaphone, Plus, X, AlertTriangle, Info, Bell } from "lucide-react";
import { useState } from "react";
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

  // Fetch announcements
  const { data: announcements = [] } = useQuery<AnnouncementWithRelations[]>({
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
  });

  // Fetch groups for admin
  const { data: groups = [] } = useQuery<any[]>({
    queryKey: ['/api/groups'],
    enabled: user?.role === 'admin',
  });

  // Create announcement mutation
  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      console.log('📢 Creating announcement with data:', data);
      
      const response = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      
      console.log('📢 Create announcement response:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('📢 Create announcement failed:', errorText);
        throw new Error(`Failed to create announcement: ${response.status} - ${errorText}`);
      }
      
      const result = await response.json();
      console.log('📢 Announcement created successfully:', result);
      return result;
    },
    onSuccess: (data) => {
      console.log('📢 Announcement creation success callback:', data);
      queryClient.invalidateQueries({ queryKey: ['/api/announcements'] });
      setIsCreateDialogOpen(false);
      form.reset();
      // Add success toast
      toast({
        title: "Succès",
        description: "Annonce créée avec succès",
      });
    },
    onError: (error) => {
      console.error('📢 Announcement creation error:', error);
      // Add error toast
      toast({
        title: "Erreur",
        description: error.message || "Impossible de créer l'annonce",
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

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="flex items-center space-x-2">
          <Megaphone className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-lg">Informations</CardTitle>
        </div>
        {user?.role === 'admin' && (
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-1" />
                Nouveau
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Nouvelle information</DialogTitle>
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
                        <Select onValueChange={(value) => field.onChange(value === 'all' ? undefined : parseInt(value))}>
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
                      {createMutation.isPending ? 'Création...' : 'Créer'}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        {announcements.length === 0 ? (
          <div className="text-center text-muted-foreground py-6">
            <Megaphone className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Aucune information disponible</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {announcements.map((announcement) => (
              <div
                key={announcement.id}
                className="p-3 bg-muted/50 rounded-lg space-y-2"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      {getPriorityIcon(announcement.priority)}
                      <h4 className="font-medium text-sm truncate">
                        {announcement.title}
                      </h4>
                      <Badge variant="secondary" className={getPriorityColor(announcement.priority)}>
                        {announcement.priority === 'urgent' ? 'Urgent' : 
                         announcement.priority === 'important' ? 'Important' : 'Normal'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {announcement.content}
                    </p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
                      <span>
                        Par {announcement.author.firstName} {announcement.author.lastName}
                        {announcement.group && ` • ${announcement.group.name}`}
                      </span>
                      <span>
                        {safeFormat(safeDate(announcement.createdAt), 'dd/MM/yyyy HH:mm')}
                      </span>
                    </div>
                  </div>
                  {user?.role === 'admin' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 ml-2 flex-shrink-0"
                      onClick={() => deleteMutation.mutate(announcement.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}