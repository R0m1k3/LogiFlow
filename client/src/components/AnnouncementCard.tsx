import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Megaphone, 
  Plus, 
  Edit2, 
  X, 
  Info, 
  AlertTriangle, 
  CheckCircle, 
  AlertCircle 
} from "lucide-react";
import { useAuthUnified } from "@/hooks/useAuthUnified";
import { useStore } from "@/components/Layout";
import { safeFormat, safeDate } from "@/lib/dateUtils";
import { 
  insertAnnouncementSchema,
  type InsertAnnouncement, 
  type DashboardMessage 
} from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

// Type pour les annonces avec relations
type AnnouncementWithRelations = DashboardMessage & {
  author: {
    id: string | number;
    firstName?: string;
    lastName?: string;
    username: string;
  };
  group?: {
    id: number;
    name: string;
  };
};

// Configuration des priorités avec icônes
const getPriorityConfig = (type: string) => {
  switch (type) {
    case 'error':
      return { 
        label: 'Erreur', 
        color: 'bg-red-100 text-red-800',
        icon: AlertCircle,
        iconColor: 'text-red-600'
      };
    case 'warning':
      return { 
        label: 'Attention', 
        color: 'bg-orange-100 text-orange-800',
        icon: AlertTriangle,
        iconColor: 'text-orange-600'
      };
    case 'success':
      return { 
        label: 'Succès', 
        color: 'bg-green-100 text-green-800',
        icon: CheckCircle,
        iconColor: 'text-green-600'
      };
    case 'info':
    default:
      return { 
        label: 'Information', 
        color: 'bg-blue-100 text-blue-800',
        icon: Info,
        iconColor: 'text-blue-600'
      };
  }
};

export default function AnnouncementCard() {
  const { user } = useAuthUnified();
  const { selectedStoreId } = useStore();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<AnnouncementWithRelations | null>(null);

  // Configuration du formulaire
  const form = useForm<InsertAnnouncement>({
    resolver: zodResolver(insertAnnouncementSchema),
    defaultValues: {
      title: '',
      content: '',
      type: 'info',
      storeId: selectedStoreId ? parseInt(selectedStoreId.toString()) : null,
      createdBy: user?.username || '',
    },
  });

  // Construire l'URL avec les paramètres appropriés
  const buildApiUrl = () => {
    const params = new URLSearchParams();
    
    // Pour les admins, permettre le filtrage par magasin sélectionné
    if (user?.role === 'admin' && selectedStoreId) {
      params.append('storeId', selectedStoreId.toString());
    }
    
    return `/api/announcements${params.toString() ? `?${params.toString()}` : ''}`;
  };

  // Récupérer les annonces
  const { data: announcements = [], isLoading } = useQuery<AnnouncementWithRelations[]>({
    queryKey: ['/api/announcements', selectedStoreId, user?.role],
    queryFn: async () => {
      const url = buildApiUrl();
      console.log('🔍 [ANNOUNCEMENTS] Fetching from:', url);
      
      const response = await fetch(url, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        console.error('❌ [ANNOUNCEMENTS] Fetch failed:', response.status, response.statusText);
        if (response.status === 401) {
          console.log('🔑 [ANNOUNCEMENTS] Authentication required');
          return [];
        }
        throw new Error(`Failed to fetch announcements: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('✅ [ANNOUNCEMENTS] Data received:', data);
      
      if (!Array.isArray(data)) {
        console.warn('⚠️ [ANNOUNCEMENTS] Data is not an array:', data);
        return [];
      }
      
      return data;
    },
    enabled: !!user,
  });

  // Mutation pour créer/modifier une annonce
  const createMutation = useMutation({
    mutationFn: async (announcementData: InsertAnnouncement) => {
      const url = editingAnnouncement 
        ? `/api/announcements/${editingAnnouncement.id}`
        : '/api/announcements';
      
      const method = editingAnnouncement ? 'PUT' : 'POST';
      
      console.log(`🔍 [ANNOUNCEMENTS] ${method} ${url}`, announcementData);
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(announcementData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [ANNOUNCEMENTS] ${method} failed:`, response.status, errorText);
        throw new Error(`Failed to ${editingAnnouncement ? 'update' : 'create'} announcement: ${response.status}`);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/announcements'] });
      setIsCreateDialogOpen(false);
      setEditingAnnouncement(null);
      form.reset();
      toast({
        title: editingAnnouncement ? "Information modifiée" : "Information créée",
        description: editingAnnouncement ? "L'information a été modifiée avec succès." : "L'information a été créée avec succès.",
      });
    },
    onError: (error) => {
      console.error('❌ [ANNOUNCEMENTS] Mutation error:', error);
      toast({
        title: "Erreur",
        description: `Impossible de ${editingAnnouncement ? 'modifier' : 'créer'} l'information.`,
        variant: "destructive",
      });
    },
  });

  // Mutation pour supprimer une annonce
  const deleteMutation = useMutation({
    mutationFn: async (announcementId: number) => {
      const response = await fetch(`/api/announcements/${announcementId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to delete announcement: ${response.status}`);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/announcements'] });
      toast({
        title: "Information supprimée",
        description: "L'information a été supprimée avec succès.",
      });
    },
    onError: (error) => {
      console.error('❌ [ANNOUNCEMENTS] Delete error:', error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer l'information.",
        variant: "destructive",
      });
    },
  });

  // Soumission du formulaire
  const onSubmit = (data: InsertAnnouncement) => {
    console.log('🔍 [ANNOUNCEMENTS] Form submitted:', data);
    
    const announcementData = {
      ...data,
      createdBy: user?.username || '',
      storeId: data.storeId || null
    };
    
    createMutation.mutate(announcementData);
  };

  // Ouvrir le dialogue pour éditer
  const handleEdit = (announcement: AnnouncementWithRelations) => {
    setEditingAnnouncement(announcement);
    form.reset({
      title: announcement.title,
      content: announcement.content,
      type: announcement.type as any,
      storeId: announcement.storeId,
      createdBy: announcement.createdBy,
    });
    setIsCreateDialogOpen(true);
  };

  return (
    <>
      <Card className="bg-white border border-gray-200 shadow-lg hover:shadow-xl transition-shadow">
        <CardHeader className="pb-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-gray-800 flex items-center">
              <Megaphone className="h-5 w-5 mr-3 text-blue-600" />
              Informations
            </CardTitle>
            {user?.role === 'admin' && (
              <Button
                onClick={() => {
                  setEditingAnnouncement(null);
                  form.reset({
                    title: '',
                    content: '',
                    type: 'info',
                    storeId: selectedStoreId ? parseInt(selectedStoreId.toString()) : null,
                    createdBy: user?.username || '',
                  });
                  setIsCreateDialogOpen(true);
                }}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Nouvelle
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3 p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : !Array.isArray(announcements) || announcements.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600">Aucune information disponible</p>
              <p className="text-xs text-gray-400 mt-1">
                {user?.role === 'admin' ? 'Créez la première annonce' : 'Aucune annonce pour le moment'}
              </p>
            </div>
          ) : (
            announcements.map((announcement) => {
              const priorityConfig = getPriorityConfig(announcement.type);
              
              return (
                <div key={announcement.id} className="flex items-start justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors border-l-3 border-blue-500">
                  <div className="flex items-start space-x-3 flex-1 min-w-0">
                    <div className="h-2 w-2 bg-blue-500 mt-2 flex-shrink-0"></div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <priorityConfig.icon className={`h-4 w-4 ${priorityConfig.iconColor}`} />
                        <p className="font-medium text-gray-900">{announcement.title}</p>
                      </div>
                      {announcement.content && (
                        <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap break-words">{announcement.content}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        {announcement.author?.firstName} {announcement.author?.lastName}
                        {announcement.group && ` • ${announcement.group.name}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex items-center space-x-2">
                    <div>
                      <Badge className={`text-xs ${priorityConfig.color}`}>
                        {priorityConfig.label}
                      </Badge>
                      <p className="text-xs text-gray-500 mt-1">
                        {safeFormat(safeDate(announcement.createdAt), 'dd/MM à HH:mm')}
                      </p>
                    </div>
                    {user?.role === 'admin' && (
                      <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-blue-600"
                          onClick={() => handleEdit(announcement)}
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
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Dialog pour créer/modifier une annonce */}
      <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
        setIsCreateDialogOpen(open);
        if (!open) {
          setEditingAnnouncement(null);
          form.reset();
        }
      }}>
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
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner un type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="info">Information</SelectItem>
                        <SelectItem value="warning">Attention</SelectItem>
                        <SelectItem value="error">Erreur</SelectItem>
                        <SelectItem value="success">Succès</SelectItem>
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
    </>
  );
}