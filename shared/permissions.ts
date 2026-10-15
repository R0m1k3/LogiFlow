// Système de permissions hardcodé par module
// Remplace l'ancien système flexible basé sur la base de données
import PERMISSIONS_DATA from "./permissions.json";

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
  | 'avoir';

// Matrice rôle × module dans permissions.json, lue aussi par le serveur Rust
// (server-rs/src/access.rs). Résumé :
// - dashboard : tous les rôles voient
// - calendar : admin/directeur tout, manager tout sauf supprimer, employé voit
// - orders : admin/directeur tout, manager tout sauf supprimer, employé aucun accès
// - deliveries : admin/directeur tout + valider, manager tout sauf supprimer + valider, employé aucun accès
// - reconciliation : admin tout, directeur tout sauf supprimer, manager/employé rien
// - publicity : admin tout, autres voient
// - customer-orders : admin/directeur tout, manager tout sauf supprimer, employé voit + crée
// - dlc : admin/directeur tout, manager tout sauf supprimer, employé voit + crée
// - tasks : admin/directeur tout, manager voit + crée + modifie + valide, employé voit
// - avoir : admin/directeur tout, manager crée + voit, employé aucun accès
const PERMISSIONS = PERMISSIONS_DATA as Record<Module, Record<Role, Permission[]>>;

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