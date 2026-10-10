import type { LucideIcon } from "lucide-react";
import {
  House,
  ListTodo,
  CalendarClock,
  ShoppingCart,
  Wrench,
  Package,
  Truck,
  FileCheck,
  Receipt,
  CreditCard,
  CalendarDays,
  Megaphone,
  BookUser,
  ChartLine,
  UserCog,
  Store,
  Building2,
  Settings,
} from "lucide-react";

// Configuration unique du menu de navigation (docs/PLAN-OPTIMISATION-WEBUI.md, P1 § 2.1).
// Chaque icône n'apparaît qu'une fois ; les adresses sont inchangées.

export type Role = "admin" | "directeur" | "manager" | "employee";

const ALL_ROLES: Role[] = ["admin", "directeur", "manager", "employee"];

export interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];
}

export interface NavSection {
  // Pas de titre pour l'entrée Accueil, affichée en tête
  title?: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { path: "/", label: "Accueil", icon: House, roles: ALL_ROLES },
    ],
  },
  {
    title: "Au quotidien",
    items: [
      { path: "/tasks", label: "Tâches", icon: ListTodo, roles: ALL_ROLES },
      { path: "/dlc", label: "DLC", icon: CalendarClock, roles: ALL_ROLES },
      { path: "/customer-orders", label: "Commandes clients", icon: ShoppingCart, roles: ALL_ROLES },
      { path: "/sav", label: "SAV", icon: Wrench, roles: ALL_ROLES },
    ],
  },
  {
    title: "Fournisseurs",
    items: [
      { path: "/orders", label: "Commandes fournisseurs", icon: Package, roles: ["admin", "directeur", "manager"] },
      { path: "/deliveries", label: "Livraisons", icon: Truck, roles: ["admin", "directeur", "manager"] },
      { path: "/bl-reconciliation", label: "Rapprochement BL / factures", icon: FileCheck, roles: ["admin", "directeur"] },
      { path: "/avoirs", label: "Avoirs", icon: Receipt, roles: ["admin", "directeur", "manager"] },
      { path: "/payment-schedule", label: "Échéancier", icon: CreditCard, roles: ["admin", "directeur"] },
    ],
  },
  {
    title: "Planning et infos",
    items: [
      { path: "/calendar", label: "Calendrier", icon: CalendarDays, roles: ALL_ROLES },
      { path: "/publicities", label: "Publicités", icon: Megaphone, roles: ALL_ROLES },
      { path: "/contacts", label: "Contacts", icon: BookUser, roles: ALL_ROLES },
      { path: "/analytics", label: "Statistiques", icon: ChartLine, roles: ["admin", "directeur", "manager"] },
    ],
  },
  {
    title: "Administration",
    items: [
      { path: "/users", label: "Utilisateurs", icon: UserCog, roles: ["admin"] },
      { path: "/groups", label: "Magasins", icon: Store, roles: ["admin"] },
      { path: "/suppliers", label: "Fiches fournisseurs", icon: Building2, roles: ["admin"] },
      { path: "/utilities", label: "Paramètres", icon: Settings, roles: ["admin"] },
    ],
  },
];

// Sections visibles pour un rôle, sans les sections devenues vides
export function getNavSections(role?: string): NavSection[] {
  if (!role) return [];
  return NAV_SECTIONS
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => item.roles.includes(role as Role)),
    }))
    .filter((section) => section.items.length > 0);
}

// « / » et « /dashboard » activent tous deux Accueil ; les autres entrées
// restent actives sur leurs sous-adresses
export function isNavItemActive(itemPath: string, location: string): boolean {
  if (itemPath === "/") return location === "/" || location === "/dashboard";
  return location === itemPath || location.startsWith(`${itemPath}/`);
}

export function getNavItemForPath(location: string): NavItem | undefined {
  for (const section of NAV_SECTIONS) {
    const item = section.items.find((navItem) => isNavItemActive(navItem.path, location));
    if (item) return item;
  }
  return undefined;
}

export function getRoleLabel(role?: string): string {
  switch (role) {
    case "admin": return "Administrateur";
    case "directeur": return "Directeur";
    case "manager": return "Manager";
    default: return "Employé";
  }
}
