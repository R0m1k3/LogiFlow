import { useQuery } from "@tanstack/react-query";
import { useAuthUnified } from "@/hooks/useAuthUnified";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ListTodo, 
  Circle,
  Clock,
  AlertTriangle,
  ArrowRight
} from "lucide-react";
import { format, addDays, isAfter, isBefore } from "date-fns";
import { fr } from "date-fns/locale";
import { useLocation } from "wouter";
import { useStore } from "@/components/Layout";
import { Task } from "@shared/schema";

type TaskWithRelations = Task & {
  assignedUser: { id: string; username: string; firstName?: string; lastName?: string; };
  creator: { id: string; username: string; firstName?: string; lastName?: string; };
  group: { id: number; name: string; color: string; };
};

export default function RecentTasksCard() {
  const { user } = useAuthUnified();
  const { selectedStoreId } = useStore();
  const [, navigate] = useLocation();

  // Fetch tasks
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

  // Filtrer les tâches des 7 prochains jours qui ne sont pas terminées
  const upcomingTasks = tasks
    .filter((task: TaskWithRelations) => {
      // Seulement les tâches incomplètes
      if (task.status === 'completed') return false;
      
      // Tâches avec date d'échéance dans les 7 prochains jours
      if (task.dueDate) {
        const dueDate = new Date(task.dueDate);
        const now = new Date();
        const sevenDaysFromNow = addDays(now, 7);
        return isAfter(dueDate, now) && isBefore(dueDate, sevenDaysFromNow);
      }
      
      return false;
    })
    .sort((a: TaskWithRelations, b: TaskWithRelations) => {
      // Trier par priorité (high -> medium -> low) puis par date
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const priorityDiff = (priorityOrder[b.priority as keyof typeof priorityOrder] || 2) - 
                          (priorityOrder[a.priority as keyof typeof priorityOrder] || 2);
      
      if (priorityDiff !== 0) return priorityDiff;
      
      // Si même priorité, trier par date d'échéance
      if (a.dueDate && b.dueDate) {
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      
      return 0;
    })
    .slice(0, 5); // Limite à 5 tâches

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

  const handleViewAllTasks = () => {
    navigate("/tasks");
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Tâches à venir</CardTitle>
          <ListTodo className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Tâches à venir</CardTitle>
        <ListTodo className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {upcomingTasks.length === 0 ? (
          <div className="text-center py-6">
            <ListTodo className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              Aucune tâche à venir dans les 7 prochains jours
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {upcomingTasks.map((task: TaskWithRelations) => {
              const priorityConfig = getPriorityConfig(task.priority);
              const PriorityIcon = priorityConfig.icon;
              
              return (
                <div key={task.id} className="flex items-start justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-sm truncate">
                        {task.title}
                      </h4>
                      <Badge variant={priorityConfig.color} className="flex items-center gap-1 text-xs">
                        <PriorityIcon className="w-2.5 h-2.5" />
                        {priorityConfig.label}
                      </Badge>
                    </div>
                    
                    {task.description && (
                      <p className="text-xs text-muted-foreground mb-1 line-clamp-1">
                        {task.description}
                      </p>
                    )}
                    
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {task.dueDate && (
                        <span>
                          {format(new Date(task.dueDate), 'dd/MM à HH:mm', { locale: fr })}
                        </span>
                      )}
                      <span>
                        {task.assignedTo}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
            
            <Button 
              variant="ghost" 
              className="w-full justify-center mt-4"
              onClick={handleViewAllTasks}
            >
              Voir toutes les tâches
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}