// Utilitaire pour harmoniser les couleurs des rôles dans toute l'application

export const ROLE_COLORS = {
  admin: '#64748b',        // Slate moderne (Administrateur)
  manager: '#0f766e',      // Teal professionnel (Manager) 
  employee: '#374151',     // Gray-700 élégant (Employé)
  directeur: '#7c3aed',    // Violet sophistiqué (Directeur)
} as const;

export const ROLE_DISPLAY_NAMES = {
  admin: 'Administrateur',
  manager: 'Manager',
  employee: 'Employé',
  directeur: 'Directeur',
} as const;

export type RoleType = keyof typeof ROLE_COLORS;

export function getRoleColor(roleName: string): string {
  const roleKey = roleName.toLowerCase() as RoleType;
  return ROLE_COLORS[roleKey] || '#666666';
}

export function getRoleDisplayName(roleName: string): string {
  const roleKey = roleName.toLowerCase() as RoleType;
  return ROLE_DISPLAY_NAMES[roleKey] || roleName;
}

// Utilitaire pour les classes Tailwind (pour Users.tsx) - couleurs modernes et subtiles
export function getRoleTailwindClasses(roleName: string) {
  switch (roleName.toLowerCase()) {
    case 'admin':
      return {
        badgeClass: 'bg-slate-50 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600',
        iconClass: 'text-slate-500 dark:text-slate-400'
      };
    case 'manager':
      return {
        badgeClass: 'bg-teal-50 text-teal-700 border border-teal-200 dark:bg-teal-900/20 dark:text-teal-300 dark:border-teal-700',
        iconClass: 'text-teal-600 dark:text-teal-400'
      };
    case 'employee':
      return {
        badgeClass: 'bg-gray-50 text-gray-700 border border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600',
        iconClass: 'text-gray-600 dark:text-gray-400'
      };
    case 'directeur':
      return {
        badgeClass: 'bg-violet-50 text-violet-700 border border-violet-200 dark:bg-violet-900/20 dark:text-violet-300 dark:border-violet-700',
        iconClass: 'text-violet-600 dark:text-violet-400'
      };
    default:
      return {
        badgeClass: 'bg-neutral-50 text-neutral-600 border border-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-600',
        iconClass: 'text-neutral-500 dark:text-neutral-400'
      };
  }
}