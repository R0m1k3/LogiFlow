// VERSION ULTRA SIMPLE - HTML pur sans dépendances UI
export default function TaskFormUltraSimple({ task, onClose }: any) {
  
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


    const submitBtn = e.currentTarget.querySelector('button[type="submit"]') as HTMLButtonElement;
    submitBtn.disabled = true;
    submitBtn.textContent = "...";

    try {
      const taskData = {
        title: title.trim(),
        description: description?.trim() || "",
        priority: priority || "medium",
        status: status || "pending",
        assignedTo: assignedTo?.trim() || "Non assigné",
        startDate: startDate || null,
        dueDate: dueDate || null,
      };

      const url = task ? `/api/tasks/${task.id}` : '/api/tasks';
      const method = task ? 'PATCH' : 'POST';

      if (!task) {
        (taskData as any).groupId = 1;
        (taskData as any).createdBy = 'admin';
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData),
      });

      if (!response.ok) throw new Error(`Erreur ${response.status}`);

      alert(task ? "Tâche modifiée avec succès" : "Tâche créée avec succès");
      window.location.reload();
      
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
            Assigné à <span style={{ fontSize: '12px', color: '#6b7280' }}>(optionnel)</span>
          </label>
          <input
            name="assignedTo"
            type="text"
            defaultValue={task?.assignedTo || "admin"}
            placeholder="Nom de la personne assignée"
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
}