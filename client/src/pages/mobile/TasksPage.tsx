import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthUnified } from "@/hooks/useAuthUnified";
import { useStore } from "@/contexts/StoreContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
    ListTodo,
    Plus,
    Search,
    CheckCircle,
    Edit,
    Trash2,
    Calendar,
    AlertTriangle,
    Clock,
    Circle,
    X
} from "lucide-react";
import { format, isPast, differenceInDays, isToday } from "date-fns";
import { fr } from "date-fns/locale";
import type { Task } from "@shared/schema";

type TaskWithRelations = Task & {
    assignedUser?: { id: string; username: string; firstName?: string; lastName?: string; };
    creator?: { id: string; username: string; firstName?: string; lastName?: string; };
    group?: { id: number; name: string; color: string; };
    isFutureTask?: boolean;
};

// Mobile Task Form Component
function MobileTaskForm({ task, onClose, selectedStoreId, user }: any) {
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmitting(true);

        const formData = new FormData(e.currentTarget);
        const title = formData.get('title') as string;
        const description = formData.get('description') as string;
        const priority = formData.get('priority') as string;
        const assignedTo = formData.get('assignedTo') as string;
        const dueDate = formData.get('dueDate') as string;

        if (!title?.trim()) {
            toast({ title: "Erreur", description: "Le titre est requis", variant: "destructive" });
            setIsSubmitting(false);
            return;
        }

        try {
            const taskData = {
                title: title.trim(),
                description: description?.trim() || "",
                priority: priority || "medium",
                status: task?.status || "pending",
                assignedTo: assignedTo?.trim() || "Non assigné",
                dueDate: dueDate || null,
            };

            const url = task ? `/api/tasks/${task.id}` : '/api/tasks';
            const method = task ? 'PUT' : 'POST';

            if (!task) {
                (taskData as any).groupId = selectedStoreId ? parseInt(selectedStoreId.toString()) : 1;
                (taskData as any).createdBy = user?.username || 'admin';
            }

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(taskData),
            });

            if (!response.ok) throw new Error(`Erreur ${response.status}`);

            toast({
                title: "Succès",
                description: task ? "Tâche modifiée" : "Tâche créée",
            });
            window.location.reload();

        } catch (error) {
            toast({ title: "Erreur", description: "Erreur lors de l'opération", variant: "destructive" });
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-white z-50 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b bg-white sticky top-0">
                <h2 className="text-lg font-semibold">{task ? "Modifier" : "Nouvelle tâche"}</h2>
                <Button variant="ghost" size="icon" onClick={onClose}>
                    <X className="w-5 h-5" />
                </Button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-auto p-4 space-y-4">
                <div>
                    <label className="text-sm font-medium mb-2 block">Titre *</label>
                    <Input
                        name="title"
                        defaultValue={task?.title || ""}
                        placeholder="Titre de la tâche"
                        required
                        className="h-12 text-base"
                    />
                </div>

                <div>
                    <label className="text-sm font-medium mb-2 block">Description</label>
                    <textarea
                        name="description"
                        defaultValue={task?.description || ""}
                        placeholder="Description (optionnel)"
                        rows={3}
                        className="w-full p-3 border rounded-md text-base resize-none"
                    />
                </div>

                <div>
                    <label className="text-sm font-medium mb-2 block">Priorité</label>
                    <select
                        name="priority"
                        defaultValue={task?.priority || "medium"}
                        className="w-full h-12 p-3 border rounded-md text-base bg-white"
                    >
                        <option value="low">🟢 Faible</option>
                        <option value="medium">🟡 Moyenne</option>
                        <option value="high">🔴 Élevée</option>
                    </select>
                </div>

                <div>
                    <label className="text-sm font-medium mb-2 block">Date d'échéance</label>
                    <Input
                        name="dueDate"
                        type="date"
                        defaultValue={task?.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : ""}
                        className="h-12 text-base"
                    />
                </div>

                <div>
                    <label className="text-sm font-medium mb-2 block">Assigné à</label>
                    <Input
                        name="assignedTo"
                        defaultValue={task?.assignedTo || ""}
                        placeholder="Nom de la personne"
                        className="h-12 text-base"
                    />
                </div>

                {/* Submit Button - Fixed at bottom */}
                <div className="pt-4 pb-safe">
                    <Button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full h-14 text-base font-semibold bg-blue-600 hover:bg-blue-700"
                    >
                        {isSubmitting ? "..." : (task ? "Modifier" : "Créer la tâche")}
                    </Button>
                </div>
            </form>
        </div>
    );
}

// Task Card Component
function TaskCard({
    task,
    onComplete,
    onEdit,
    onDelete,
    canEdit
}: {
    task: TaskWithRelations;
    onComplete: () => void;
    onEdit: () => void;
    onDelete: () => void;
    canEdit: boolean;
}) {
    const getPriorityConfig = (priority: string) => {
        switch (priority) {
            case 'high': return { color: 'bg-red-100 text-red-700 border-red-200', icon: AlertTriangle, label: 'Élevée' };
            case 'medium': return { color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: Clock, label: 'Moyenne' };
            case 'low': return { color: 'bg-green-100 text-green-700 border-green-200', icon: Circle, label: 'Faible' };
            default: return { color: 'bg-gray-100 text-gray-700 border-gray-200', icon: Circle, label: 'Moyenne' };
        }
    };

    const getDueDateInfo = () => {
        if (!task.dueDate || task.status === 'completed') return null;
        const due = new Date(task.dueDate);
        const daysDiff = differenceInDays(due, new Date());

        if (isPast(due) && !isToday(due)) {
            return { text: `En retard (${Math.abs(daysDiff)}j)`, color: 'text-red-600' };
        } else if (isToday(due)) {
            return { text: "Aujourd'hui", color: 'text-orange-600' };
        } else if (daysDiff <= 3) {
            return { text: `Dans ${daysDiff}j`, color: 'text-yellow-600' };
        }
        return { text: format(due, 'dd/MM', { locale: fr }), color: 'text-gray-500' };
    };

    const priority = getPriorityConfig(task.priority);
    const PriorityIcon = priority.icon;
    const dueDateInfo = getDueDateInfo();
    const isCompleted = task.status === 'completed';

    return (
        <Card className={`mb-3 ${isCompleted ? 'opacity-60' : ''}`}>
            <CardContent className="p-4">
                {/* Header: Priority + Due Date */}
                <div className="flex items-center justify-between mb-2">
                    <Badge className={`${priority.color} border text-xs`}>
                        <PriorityIcon className="w-3 h-3 mr-1" />
                        {priority.label}
                    </Badge>
                    {dueDateInfo && (
                        <span className={`text-xs font-medium ${dueDateInfo.color}`}>
                            <Calendar className="w-3 h-3 inline mr-1" />
                            {dueDateInfo.text}
                        </span>
                    )}
                </div>

                {/* Title */}
                <h3 className={`font-semibold text-base mb-1 ${isCompleted ? 'line-through text-gray-500' : ''}`}>
                    {task.title}
                </h3>

                {/* Description */}
                {task.description && (
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">{task.description}</p>
                )}

                {/* Assigned To */}
                {task.assignedTo && (
                    <p className="text-xs text-gray-500 mb-3">👤 {task.assignedTo}</p>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2 border-t">
                    {!isCompleted && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onComplete}
                            className="flex-1 h-10 text-green-600 border-green-200 hover:bg-green-50"
                        >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Terminer
                        </Button>
                    )}
                    {canEdit && (
                        <>
                            <Button variant="outline" size="sm" onClick={onEdit} className="h-10 px-3">
                                <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="outline" size="sm" onClick={onDelete} className="h-10 px-3 text-red-600 border-red-200 hover:bg-red-50">
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

// Main Mobile Tasks Page
export default function MobileTasksPage() {
    const { user } = useAuthUnified();
    const { selectedStoreId } = useStore();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const [searchTerm, setSearchTerm] = useState("");
    const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'completed'>('pending');
    const [showForm, setShowForm] = useState(false);
    const [editingTask, setEditingTask] = useState<TaskWithRelations | null>(null);
    const [deletingTask, setDeletingTask] = useState<TaskWithRelations | null>(null);

    // Fetch tasks
    const { data: tasks = [], isLoading } = useQuery({
        queryKey: ["/api/tasks", selectedStoreId],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (selectedStoreId) params.append('storeId', selectedStoreId.toString());

            const response = await fetch(`/api/tasks?${params.toString()}`, { credentials: 'include' });
            if (!response.ok) throw new Error('Erreur chargement');

            const data = await response.json();
            return Array.isArray(data) ? data.filter((t: any) => t && t.id) : [];
        },
        enabled: !!user,
    });

    // Filter tasks
    const filteredTasks = tasks
        .filter((task: TaskWithRelations) => {
            // Tab filter
            if (activeTab === 'pending' && task.status === 'completed') return false;
            if (activeTab === 'completed' && task.status !== 'completed') return false;

            // Search filter
            if (searchTerm && !task.title.toLowerCase().includes(searchTerm.toLowerCase())) {
                return false;
            }
            return true;
        })
        .sort((a: TaskWithRelations, b: TaskWithRelations) => {
            // Pending first, then by priority
            if (a.status !== b.status) return a.status === 'pending' ? -1 : 1;
            const priorityOrder = { high: 3, medium: 2, low: 1 };
            return (priorityOrder[b.priority as keyof typeof priorityOrder] || 2) -
                (priorityOrder[a.priority as keyof typeof priorityOrder] || 2);
        });

    // Handlers
    const handleComplete = async (taskId: number) => {
        try {
            await fetch(`/api/tasks/${taskId}/complete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({}),
            });
            queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
            toast({ title: "✅ Tâche terminée" });
        } catch (error) {
            toast({ title: "Erreur", variant: "destructive" });
        }
    };

    const handleDelete = async () => {
        if (!deletingTask) return;
        try {
            await fetch(`/api/tasks/${deletingTask.id}`, { method: 'DELETE', credentials: 'include' });
            queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
            toast({ title: "🗑️ Tâche supprimée" });
            setDeletingTask(null);
        } catch (error) {
            toast({ title: "Erreur", variant: "destructive" });
        }
    };

    const canEdit = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'directeur';

    // Loading
    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-24">
            {/* Header */}
            <div className="bg-white border-b sticky top-0 z-40">
                <div className="p-4">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <ListTodo className="w-6 h-6 text-blue-600" />
                            <h1 className="text-xl font-bold">Tâches</h1>
                        </div>
                        <Badge variant="secondary">{filteredTasks.length}</Badge>
                    </div>

                    {/* Search */}
                    <div className="relative mb-3">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                            placeholder="Rechercher..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 h-11"
                        />
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-2">
                        {(['pending', 'completed', 'all'] as const).map((tab) => (
                            <Button
                                key={tab}
                                variant={activeTab === tab ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setActiveTab(tab)}
                                className="flex-1 h-10"
                            >
                                {tab === 'pending' && 'En cours'}
                                {tab === 'completed' && 'Terminées'}
                                {tab === 'all' && 'Toutes'}
                            </Button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Task List */}
            <div className="p-4">
                {filteredTasks.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                        <ListTodo className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>Aucune tâche trouvée</p>
                    </div>
                ) : (
                    filteredTasks.map((task: TaskWithRelations) => (
                        <TaskCard
                            key={task.id}
                            task={task}
                            onComplete={() => handleComplete(task.id)}
                            onEdit={() => { setEditingTask(task); setShowForm(true); }}
                            onDelete={() => setDeletingTask(task)}
                            canEdit={canEdit}
                        />
                    ))
                )}
            </div>

            {/* FAB Button */}
            {canEdit && (
                <Button
                    onClick={() => { setEditingTask(null); setShowForm(true); }}
                    className="fixed bottom-20 right-4 w-14 h-14 rounded-full shadow-lg bg-blue-600 hover:bg-blue-700 z-40"
                >
                    <Plus className="w-6 h-6" />
                </Button>
            )}

            {/* Form Modal */}
            {showForm && (
                <MobileTaskForm
                    task={editingTask}
                    onClose={() => { setShowForm(false); setEditingTask(null); }}
                    selectedStoreId={selectedStoreId}
                    user={user}
                />
            )}

            {/* Delete Confirmation */}
            {deletingTask && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
                    <div className="bg-white w-full rounded-t-xl p-4 pb-8">
                        <h3 className="font-semibold text-lg mb-2">Supprimer cette tâche ?</h3>
                        <p className="text-gray-600 mb-4">{deletingTask.title}</p>
                        <div className="flex gap-3">
                            <Button variant="outline" onClick={() => setDeletingTask(null)} className="flex-1 h-12">
                                Annuler
                            </Button>
                            <Button variant="destructive" onClick={handleDelete} className="flex-1 h-12">
                                Supprimer
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
