import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";

// Version PRODUCTION - Zero dépendance externe problématique
export default function TaskFormProduction({ task, onClose }: any) {
  const [title, setTitle] = useState(task?.title || "");
  const [description, setDescription] = useState(task?.description || "");
  const [priority, setPriority] = useState(task?.priority || "medium");
  const [status, setStatus] = useState(task?.status || "pending");
  const [assignedTo, setAssignedTo] = useState(task?.assignedTo || "admin");
  const [startDate, setStartDate] = useState<Date | undefined>(
    task?.startDate ? new Date(task.startDate) : undefined
  );
  const [dueDate, setDueDate] = useState<Date | undefined>(
    task?.dueDate ? new Date(task.dueDate) : undefined
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      alert("Le titre est requis");
      return;
    }

    if (!assignedTo.trim()) {
      alert("L'assignation est requise");
      return;
    }

    if (startDate && dueDate && dueDate < startDate) {
      alert("La date d'échéance ne peut pas être antérieure à la date de début");
      return;
    }

    setIsSubmitting(true);

    try {
      const taskData = {
        title: title.trim(),
        description: description.trim(),
        priority,
        status,
        assignedTo: assignedTo.trim(),
        startDate: startDate ? startDate.toISOString() : null,
        dueDate: dueDate ? dueDate.toISOString() : null,
      };

      const url = task ? `/api/tasks/${task.id}` : '/api/tasks';
      const method = task ? 'PATCH' : 'POST';

      if (!task) {
        // Créer nouvelle tâche
        (taskData as any).groupId = 1; // Store ID par défaut
        (taskData as any).createdBy = 'admin'; // User ID par défaut
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(taskData),
      });

      if (!response.ok) {
        throw new Error(`Erreur ${response.status}`);
      }

      // Succès
      alert(task ? "Tâche modifiée avec succès" : "Tâche créée avec succès");
      
      // Force reload de la page pour actualiser les données
      window.location.reload();
      
    } catch (error) {
      console.error('Erreur:', error);
      alert("Erreur lors de l'opération");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <p className="text-sm text-gray-600">
            📅 Date de début = Quand la tâche devient visible<br/>
            ⏰ Date d'échéance = Quand la tâche doit être terminée
          </p>
        </div>
        <Button variant="outline" onClick={onClose}>
          Annuler
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="text-sm font-medium">Titre *</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titre de la tâche"
            required
          />
        </div>

        <div>
          <label className="text-sm font-medium">Description</label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description de la tâche (optionnel)"
            rows={3}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Priorité *</label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une priorité" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">🟢 Faible</SelectItem>
                <SelectItem value="medium">🟡 Moyenne</SelectItem>
                <SelectItem value="high">🔴 Élevée</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium">Statut</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">⏳ En cours</SelectItem>
                <SelectItem value="completed">✅ Terminée</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col">
            <label className="text-sm font-medium flex items-center gap-2 mb-2">
              📅 Date de début
              <span className="text-xs text-gray-500">(optionnel)</span>
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={startDate ? "w-full pl-3 text-left font-normal" : "w-full pl-3 text-left font-normal text-gray-500"}
                >
                  {startDate ? (
                    formatDate(startDate)
                  ) : (
                    <span>Sélectionner une date</span>
                  )}
                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={setStartDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex flex-col">
            <label className="text-sm font-medium flex items-center gap-2 mb-2">
              ⏰ Date d'échéance
              <span className="text-xs text-gray-500">(optionnel)</span>
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={dueDate ? "w-full pl-3 text-left font-normal" : "w-full pl-3 text-left font-normal text-gray-500"}
                >
                  {dueDate ? (
                    formatDate(dueDate)
                  ) : (
                    <span>Sélectionner une date</span>
                  )}
                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dueDate}
                  onSelect={setDueDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium">Assigné à *</label>
          <Input
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            placeholder="Nom de la personne assignée"
            required
          />
        </div>

        <div className="flex gap-3 justify-end">
          <Button variant="outline" type="button" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "..." : (task ? "Modifier" : "Créer")}
          </Button>
        </div>
      </form>
    </div>
  );
}