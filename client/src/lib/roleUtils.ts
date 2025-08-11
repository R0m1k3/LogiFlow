// Utilitaire pour harmoniser les couleurs des rôles dans toute l'application

export const ROLE_COLORS = {
  admin: '#f87171',        // Rouge clair (Administrateur)
  manager: '#60a5fa',      // Bleu clair (Manager)
  employee: '#4ade80',     // Vert clair (Employé)
  directeur: '#a78bfa',    // Violet clair (Directeur)
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

// Utilitaire pour les classes Tailwind (pour Users.tsx) - couleurs claires et douces
export function getRoleTailwindClasses(roleName: string) {
  switch (roleName.toLowerCase()) {
    case 'admin':
      return {
        badgeClass: 'bg-red-50 text-red-600 border border-red-200',
        iconClass: 'text-red-400'
      };
    case 'manager':
      return {
        badgeClass: 'bg-blue-50 text-blue-600 border border-blue-200',
        iconClass: 'text-blue-400'
      };
    case 'employee':
      return {
        badgeClass: 'bg-green-50 text-green-600 border border-green-200',
        iconClass: 'text-green-400'
      };
    case 'directeur':
      return {
        badgeClass: 'bg-purple-50 text-purple-600 border border-purple-200',
        iconClass: 'text-purple-400'
      };
    default:
      return {
        badgeClass: 'bg-gray-50 text-gray-600 border border-gray-200',
        iconClass: 'text-gray-400'
      };
  }
}