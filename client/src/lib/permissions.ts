// Système de permissions hardcodé par module
// Remplace l'ancien système flexible basé sur la base de données

export type Permission = 'view' | 'create' | 'edit' | 'delete' | 'validate';
export type Role = 'admin' | 'directeur' | 'manager' | 'employee';
export type Module = 
  | 'dashboard' 
  | 'calendar' 
  | 'orders' 
  | 'deliveries' 
  | 'reconciliation' 
  | 'publicity' 
  | 'customer-orders' 
  | 'dlc' 
  | 'tasks'
  | 'admin'
  | 'backups';

// Définition des permissions par module et par rôle
const PERMISSIONS: Record<Module, Record<Role, Permission[]>> = {
  // Tableau de bord - tous les rôles peuvent le voir
  dashboard: {
    admin: ['view'],
    directeur: ['view'],
    manager: ['view'],
    employee: ['view']
  },

  // Calendrier - Admin/Directeur tout, Manager tout sauf delete, Employé view
  calendar: {
    admin: ['view', 'create', 'edit', 'delete'],
    directeur: ['view', 'create', 'edit', 'delete'],
    manager: ['view', 'create', 'edit'],
    employee: ['view']
  },

  // Commandes - Admin/Directeur tout, Manager tout sauf delete, Employé view
  orders: {
    admin: ['view', 'create', 'edit', 'delete'],
    directeur: ['view', 'create', 'edit', 'delete'],
    manager: ['view', 'create', 'edit'],
    employee: ['view']
  },

  // Livraisons - Admin/Directeur tout, Manager tout sauf delete, Employé view
  deliveries: {
    admin: ['view', 'create', 'edit', 'delete'],
    directeur: ['view', 'create', 'edit', 'delete'],
    manager: ['view', 'create', 'edit'],
    employee: ['view']
  },

  // Rapprochement - Admin tout, Directeur tout sauf delete, Manager/Employé rien
  reconciliation: {
    admin: ['view', 'create', 'edit', 'delete'],
    directeur: ['view', 'create', 'edit'],
    manager: [],
    employee: []
  },

  // Publicité - Admin tout, autres view seulement
  publicity: {
    admin: ['view', 'create', 'edit', 'delete'],
    directeur: ['view'],
    manager: ['view'],
    employee: ['view']
  },

  // Commandes client - Admin/Directeur tout, Manager tout sauf delete, Employé view + create
  'customer-orders': {
    admin: ['view', 'create', 'edit', 'delete'],
    directeur: ['view', 'create', 'edit', 'delete'],
    manager: ['view', 'create', 'edit'],
    employee: ['view', 'create']
  },

  // DLC - Admin/Directeur tout, Manager tout sauf delete, Employé create + view
  dlc: {
    admin: ['view', 'create', 'edit', 'delete'],
    directeur: ['view', 'create', 'edit', 'delete'],
    manager: ['view', 'create', 'edit'],
    employee: ['view', 'create']
  },

  // Tâches - Admin/Directeur tout, Manager view + validate, Employé view
  tasks: {
    admin: ['view', 'create', 'edit', 'delete', 'validate'],
    directeur: ['view', 'create', 'edit', 'delete', 'validate'],
    manager: ['view', 'validate'],
    employee: ['view']
  },

  // Administration générale - Admin seulement
  admin: {
    admin: ['view', 'create', 'edit', 'delete', 'manage'],
    directeur: [],
    manager: [],
    employee: []
  },

  // Sauvegardes - Admin seulement  
  backups: {
    admin: ['view', 'create', 'edit', 'delete', 'manage'],
    directeur: [],
    manager: [],
    employee: []
  }
};

// Hook pour vérifier les permissions
export function usePermissions(userRole?: string) {
  const role = userRole?.toLowerCase() as Role;

  // Vérifie si l'utilisateur peut accéder à un module
  const canAccessModule = (module: Module): boolean => {
    if (!role || !PERMISSIONS[module]) return false;
    const permissions = PERMISSIONS[module][role] || [];
    return permissions.length > 0;
  };

  // Vérifie si l'utilisateur peut effectuer une action sur un module
  const canPerformAction = (module: Module, action: Permission): boolean => {
    if (!role || !PERMISSIONS[module]) return false;
    const permissions = PERMISSIONS[module][role] || [];
    return permissions.includes(action);
  };

  // Retourne toutes les permissions pour un module
  const getModulePermissions = (module: Module): Permission[] => {
    if (!role || !PERMISSIONS[module]) return [];
    return PERMISSIONS[module][role] || [];
  };

  // Vérifie si l'utilisateur peut voir le module (a au moins une permission)
  const canView = (module: Module): boolean => canPerformAction(module, 'view');
  const canCreate = (module: Module): boolean => canPerformAction(module, 'create');
  const canEdit = (module: Module): boolean => canPerformAction(module, 'edit');
  const canDelete = (module: Module): boolean => canPerformAction(module, 'delete');
  const canValidate = (module: Module): boolean => canPerformAction(module, 'validate');

  return {
    canAccessModule,
    canPerformAction,
    getModulePermissions,
    canView,
    canCreate,
    canEdit,
    canDelete,
    canValidate
  };
}

// Fonction utilitaire pour les middlewares serveur
export function hasPermission(userRole: string, module: Module, action: Permission): boolean {
  const role = userRole?.toLowerCase() as Role;
  if (!role || !PERMISSIONS[module]) return false;
  const permissions = PERMISSIONS[module][role] || [];
  return permissions.includes(action);
}

// Fonction utilitaire pour vérifier l'accès à un module
export function hasModuleAccess(userRole: string, module: Module): boolean {
  const role = userRole?.toLowerCase() as Role;
  if (!role || !PERMISSIONS[module]) return false;
  const permissions = PERMISSIONS[module][role] || [];
  return permissions.length > 0;
}