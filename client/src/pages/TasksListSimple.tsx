import { useState, useEffect } from "react";

// Interface pour les tâches
interface Task {
  id: number;
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'completed';
  assignedTo: string;
  startDate?: string | null;
  dueDate?: string | null;
  createdAt?: string;
  groupId?: number;
  createdBy?: string;
}

export default function TasksListSimple() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Charger les tâches
  const loadTasks = async () => {
    try {
      const response = await fetch('/api/tasks');
      if (response.ok) {
        const data = await response.json();
        setTasks(data);
      } else {
        console.error('Erreur lors du chargement des tâches:', response.status);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des tâches:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  // Créer une tâche
  const createTask = async (formData: FormData) => {
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const priority = formData.get('priority') as string;
    const status = formData.get('status') as string;
    const assignedTo = formData.get('assignedTo') as string;
    const startDate = formData.get('startDate') as string;
    const dueDate = formData.get('dueDate') as string;

    if (!title?.trim()) {
      alert("Le titre est requis");
      return false;
    }

    if (!assignedTo?.trim()) {
      alert("L'assignation est requise");
      return false;
    }

    try {
      const taskData = {
        title: title.trim(),
        description: description?.trim() || "",
        priority: priority || "medium",
        status: status || "pending",
        assignedTo: assignedTo.trim(),
        startDate: startDate || null,
        dueDate: dueDate || null,
        groupId: 1,
        createdBy: 'admin',
      };

      console.log('📤 Creating task:', taskData);
      
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Create Error:', { status: response.status, error: errorText });
        throw new Error(`Erreur ${response.status}: ${errorText}`);
      }

      alert("Tâche créée avec succès");
      loadTasks();
      return true;
    } catch (error) {
      console.error('Erreur lors de la création:', error);
      alert("Erreur lors de la création");
      return false;
    }
  };

  // Modifier une tâche
  const updateTask = async (id: number, formData: FormData) => {
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const priority = formData.get('priority') as string;
    const status = formData.get('status') as string;
    const assignedTo = formData.get('assignedTo') as string;
    const startDate = formData.get('startDate') as string;
    const dueDate = formData.get('dueDate') as string;

    if (!title?.trim()) {
      alert("Le titre est requis");
      return false;
    }

    if (!assignedTo?.trim()) {
      alert("L'assignation est requise");
      return false;
    }

    try {
      // Préparer les données exactement comme le serveur les attend
      const taskData: Partial<Task> = {
        title: title.trim(),
        description: description?.trim() || "",
        priority: (priority as Task['priority']) || "medium",
        status: (status as Task['status']) || "pending",
        assignedTo: assignedTo.trim(),
      };

      // Gestion spéciale des dates pour éviter les erreurs de format
      if (startDate && startDate.trim() !== '') {
        taskData.startDate = startDate;
      } else {
        taskData.startDate = null;
      }

      if (dueDate && dueDate.trim() !== '') {
        taskData.dueDate = dueDate;
      } else {
        taskData.dueDate = null;
      }

      console.log('📤 Updating task:', { id, taskData });
      
      const response = await fetch(`/api/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData),
      });

      console.log('📥 Update Response:', { status: response.status, ok: response.ok });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Update Error:', { status: response.status, error: errorText });
        throw new Error(`Erreur ${response.status}: ${errorText}`);
      }

      alert("Tâche modifiée avec succès");
      setEditingId(null);
      loadTasks();
      return true;
    } catch (error) {
      console.error('Erreur lors de la modification:', error);
      alert("Erreur lors de la modification");
      return false;
    }
  };

  // Filtrer les tâches
  const filteredTasks = tasks.filter(task => {
    const matchesSearch = !searchTerm || task.title?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || task.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Formulaire inline
  const TaskForm = ({ task, onSubmit, onCancel }: {
    task?: Task;
    onSubmit: (formData: FormData) => Promise<boolean>;
    onCancel: () => void;
  }) => {
    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      const success = await onSubmit(formData);
      if (success && !task) {
        (e.target as HTMLFormElement).reset();
      }
    };

    return (
      <tr style={{ backgroundColor: '#f9fafb' }}>
        <td colSpan={6} style={{ padding: '16px' }}>
          <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignItems: 'end' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', marginBottom: '4px' }}>
                Titre *
              </label>
              <input
                name="title"
                type="text"
                defaultValue={task?.title || ""}
                placeholder="Titre de la tâche"
                required
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', marginBottom: '4px' }}>
                Description
              </label>
              <input
                name="description"
                type="text"
                defaultValue={task?.description || ""}
                placeholder="Description (optionnel)"
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', marginBottom: '4px' }}>
                Priorité
              </label>
              <select
                name="priority"
                defaultValue={task?.priority || "medium"}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              >
                <option value="low">🟢 Faible</option>
                <option value="medium">🟡 Moyenne</option>
                <option value="high">🔴 Élevée</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', marginBottom: '4px' }}>
                Statut
              </label>
              <select
                name="status"
                defaultValue={task?.status || "pending"}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              >
                <option value="pending">⏳ En cours</option>
                <option value="completed">✅ Terminée</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', marginBottom: '4px' }}>
                📅 Date de début
              </label>
              <input
                name="startDate"
                type="date"
                defaultValue={task?.startDate ? new Date(task.startDate).toISOString().split('T')[0] : ""}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', marginBottom: '4px' }}>
                ⏰ Date d'échéance
              </label>
              <input
                name="dueDate"
                type="date"
                defaultValue={task?.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : ""}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', marginBottom: '4px' }}>
                Assigné à *
              </label>
              <input
                name="assignedTo"
                type="text"
                defaultValue={task?.assignedTo || "admin"}
                placeholder="Nom de la personne"
                required
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={onCancel}
                style={{
                  padding: '6px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  backgroundColor: 'white',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                Annuler
              </button>
              <button
                type="submit"
                style={{
                  padding: '6px 12px',
                  border: 'none',
                  borderRadius: '4px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                {task ? "Modifier" : "Créer"}
              </button>
            </div>
          </form>
        </td>
      </tr>
    );
  };

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <p>Chargement des tâches...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ 
        backgroundColor: 'white', 
        border: '1px solid #e5e7eb', 
        borderRadius: '8px',
        padding: '20px', 
        marginBottom: '20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: '600', margin: '0', color: '#1f2937' }}>
            📋 Gestion des Tâches
          </h1>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            style={{
              padding: '8px 16px',
              backgroundColor: showCreateForm ? '#dc2626' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            {showCreateForm ? '❌ Annuler' : '➕ Nouvelle Tâche'}
          </button>
        </div>

        {/* Filtres */}
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <input
              type="text"
              placeholder="🔍 Rechercher..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
          </div>
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                minWidth: '150px'
              }}
            >
              <option value="all">Tous les statuts</option>
              <option value="pending">En cours</option>
              <option value="completed">Terminées</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tableau des tâches */}
      <div style={{
        backgroundColor: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ backgroundColor: '#f9fafb' }}>
            <tr>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>Titre</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>Priorité</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>Statut</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>Assigné à</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>Dates</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {showCreateForm && (
              <TaskForm
                onSubmit={createTask}
                onCancel={() => setShowCreateForm(false)}
              />
            )}
            
            {filteredTasks.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '48px', textAlign: 'center', color: '#6b7280' }}>
                  Aucune tâche trouvée
                </td>
              </tr>
            ) : (
              filteredTasks.map((task) => (
                editingId === task.id ? (
                  <TaskForm
                    key={task.id}
                    task={task}
                    onSubmit={(formData) => updateTask(task.id, formData)}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <tr key={task.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div>
                        <div style={{
                          fontWeight: '500',
                          color: task.status === 'completed' ? '#6b7280' : '#1f2937',
                          textDecoration: task.status === 'completed' ? 'line-through' : 'none'
                        }}>
                          {task.title}
                        </div>
                        {task.description && (
                          <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                            {task.description}
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: '500',
                        backgroundColor: task.priority === 'high' ? '#fee2e2' : task.priority === 'medium' ? '#fef3c7' : '#d1fae5',
                        color: task.priority === 'high' ? '#dc2626' : task.priority === 'medium' ? '#d97706' : '#059669'
                      }}>
                        {task.priority === 'high' ? '🔴 Élevée' : task.priority === 'medium' ? '🟡 Moyenne' : '🟢 Faible'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: '500',
                        backgroundColor: task.status === 'completed' ? '#d1fae5' : '#fef3c7',
                        color: task.status === 'completed' ? '#059669' : '#d97706'
                      }}>
                        {task.status === 'completed' ? '✅ Terminée' : '⏳ En cours'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '14px', color: '#6b7280' }}>
                      {task.assignedTo}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '12px', color: '#6b7280' }}>
                      {task.startDate && (
                        <div>📅 {new Date(task.startDate).toLocaleDateString('fr-FR')}</div>
                      )}
                      {task.dueDate && (
                        <div>⏰ {new Date(task.dueDate).toLocaleDateString('fr-FR')}</div>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <button
                        onClick={() => setEditingId(task.id)}
                        style={{
                          padding: '4px 8px',
                          border: '1px solid #d1d5db',
                          borderRadius: '4px',
                          backgroundColor: 'white',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        ✏️ Modifier
                      </button>
                    </td>
                  </tr>
                )
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}