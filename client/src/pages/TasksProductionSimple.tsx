import { useState, useEffect } from "react";

// Version 100% autonome sans aucune dépendance externe
export default function TasksProductionSimple() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Charger les tâches
  const loadTasks = async () => {
    try {
      const response = await fetch('/api/tasks');
      if (response.ok) {
        const data = await response.json();
        setTasks(data);
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

  // Filtrer les tâches
  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || task.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Composant formulaire inline
  const TaskForm = ({ task, onClose }: any) => {
    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      
      const formData = new FormData(e.currentTarget);
      const title = formData.get('title') as string;
      const description = formData.get('description') as string;
      const priority = formData.get('priority') as string;
      const status = formData.get('status') as string;
      const assignedTo = formData.get('assignedTo') as string;
      const startDate = formData.get('startDate') as string;
      const dueDate = formData.get('dueDate') as string;

      if (!title?.trim()) {
        alert("Le titre est requis");
        return;
      }

      if (!assignedTo?.trim()) {
        alert("L'assignation est requise");
        return;
      }

      const submitBtn = e.currentTarget.querySelector('button[type="submit"]') as HTMLButtonElement;
      submitBtn.disabled = true;
      submitBtn.textContent = "...";

      try {
        const taskData = {
          title: title.trim(),
          description: description?.trim() || "",
          priority: priority || "medium",
          status: status || "pending",
          assignedTo: assignedTo.trim(),
          startDate: startDate || null,
          dueDate: dueDate || null,
        };

        const url = task ? `/api/tasks/${task.id}` : '/api/tasks';
        const method = task ? 'PUT' : 'POST';

        if (!task) {
          (taskData as any).groupId = 1;
          (taskData as any).createdBy = 'admin';
        }

        console.log('📤 Sending request:', { url, method, taskData });
        
        const response = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(taskData),
        });

        console.log('📥 Response:', { status: response.status, ok: response.ok });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ API Error:', { status: response.status, error: errorText });
          throw new Error(`Erreur ${response.status}: ${errorText}`);
        }

        alert(task ? "Tâche modifiée avec succès" : "Tâche créée avec succès");
        onClose();
        loadTasks(); // Recharger les tâches
        
      } catch (error) {
        console.error('Erreur:', error);
        alert("Erreur lors de l'opération");
        submitBtn.disabled = false;
        submitBtn.textContent = task ? "Modifier" : "Créer";
      }
    };

    return (
      <div style={{ padding: '24px', backgroundColor: 'white' }}>
        <div style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: '16px', marginBottom: '24px' }}>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '0' }}>
            📅 Date de début = Quand la tâche devient visible<br/>
            ⏰ Date d'échéance = Quand la tâche doit être terminée
          </p>
          <button
            type="button"
            onClick={onClose}
            style={{
              float: 'right',
              padding: '8px 16px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              backgroundColor: 'white',
              cursor: 'pointer'
            }}
          >
            Annuler
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
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
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
              Description
            </label>
            <textarea
              name="description"
              defaultValue={task?.description || ""}
              placeholder="Description de la tâche (optionnel)"
              rows={3}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                resize: 'vertical'
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
                Priorité *
              </label>
              <select
                name="priority"
                defaultValue={task?.priority || "medium"}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              >
                <option value="low">🟢 Faible</option>
                <option value="medium">🟡 Moyenne</option>
                <option value="high">🔴 Élevée</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
                Statut
              </label>
              <select
                name="status"
                defaultValue={task?.status || "pending"}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              >
                <option value="pending">⏳ En cours</option>
                <option value="completed">✅ Terminée</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
                📅 Date de début <span style={{ fontSize: '12px', color: '#6b7280' }}>(optionnel)</span>
              </label>
              <input
                name="startDate"
                type="date"
                defaultValue={task?.startDate ? new Date(task.startDate).toISOString().split('T')[0] : ""}
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
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
                ⏰ Date d'échéance <span style={{ fontSize: '12px', color: '#6b7280' }}>(optionnel)</span>
              </label>
              <input
                name="dueDate"
                type="date"
                defaultValue={task?.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : ""}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
              Assigné à *
            </label>
            <input
              name="assignedTo"
              type="text"
              defaultValue={task?.assignedTo || "admin"}
              placeholder="Nom de la personne assignée"
              required
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 16px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                backgroundColor: 'white',
                cursor: 'pointer'
              }}
            >
              Annuler
            </button>
            <button
              type="submit"
              style={{
                padding: '8px 16px',
                border: 'none',
                borderRadius: '6px',
                backgroundColor: '#3b82f6',
                color: 'white',
                cursor: 'pointer'
              }}
            >
              {task ? "Modifier" : "Créer"}
            </button>
          </div>
        </form>
      </div>
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
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ 
        backgroundColor: 'white', 
        border: '1px solid #e5e7eb', 
        borderRadius: '8px',
        padding: '24px', 
        marginBottom: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: '600', margin: '0', color: '#1f2937' }}>
            📋 Gestion des Tâches
          </h1>
          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              padding: '10px 20px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            ➕ Nouvelle Tâche
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

      {/* Liste des tâches */}
      <div style={{
        backgroundColor: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        {filteredTasks.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#6b7280' }}>
            <p>Aucune tâche trouvée</p>
          </div>
        ) : (
          filteredTasks.map((task, index) => (
            <div
              key={task.id}
              style={{
                padding: '16px 24px',
                borderBottom: index < filteredTasks.length - 1 ? '1px solid #e5e7eb' : 'none',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div style={{ flex: 1 }}>
                <h3 style={{
                  margin: '0 0 8px 0',
                  fontSize: '16px',
                  fontWeight: '500',
                  color: task.status === 'completed' ? '#6b7280' : '#1f2937',
                  textDecoration: task.status === 'completed' ? 'line-through' : 'none'
                }}>
                  {task.title}
                </h3>
                <div style={{ display: 'flex', gap: '16px', fontSize: '14px', color: '#6b7280' }}>
                  <span>
                    Priorité: {task.priority === 'high' ? '🔴 Élevée' : task.priority === 'medium' ? '🟡 Moyenne' : '🟢 Faible'}
                  </span>
                  <span>
                    Statut: {task.status === 'completed' ? '✅ Terminée' : '⏳ En cours'}
                  </span>
                  <span>Assigné à: {task.assignedTo}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => {
                    setSelectedTask(task);
                    setShowEditModal(true);
                  }}
                  style={{
                    padding: '6px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    backgroundColor: 'white',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  ✏️ Modifier
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal de création */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            <div style={{
              padding: '24px 24px 16px',
              borderBottom: '1px solid #e5e7eb'
            }}>
              <h2 style={{
                fontSize: '18px',
                fontWeight: '600',
                margin: '0'
              }}>
                Créer une nouvelle tâche
              </h2>
            </div>
            <TaskForm onClose={() => setShowCreateModal(false)} />
          </div>
        </div>
      )}

      {/* Modal d'édition */}
      {showEditModal && selectedTask && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            <div style={{
              padding: '24px 24px 16px',
              borderBottom: '1px solid #e5e7eb'
            }}>
              <h2 style={{
                fontSize: '18px',
                fontWeight: '600',
                margin: '0'
              }}>
                Modifier la tâche
              </h2>
            </div>
            <TaskForm
              task={selectedTask}
              onClose={() => {
                setShowEditModal(false);
                setSelectedTask(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}