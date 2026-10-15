import type { ReadCase, WriteScenario } from "../types";

export const reads: ReadCase[] = [
  { module: "contacts", path: "/api/contacts" },
  { module: "contacts", path: "/api/contacts?groupId=1" },
  { module: "contacts", path: "/api/contacts?groupId=2" },
  { module: "suppliers", path: "/api/suppliers" },
  { module: "suppliers", path: "/api/suppliers?dlc=true" },
  { module: "groups", path: "/api/groups" },
  { module: "users", path: "/api/users" },
];

export const writes: WriteScenario[] = [
  {
    module: "contacts",
    name: "créer, modifier, supprimer un contact",
    steps: [
      { method: "POST", path: "/api/contacts", body: { groupId: 1, name: "Nouveau contact", company: "Société", phone: "06 99 99 99 99", email: "nouveau@banc.test", notes: "Note" } },
      { method: "PUT", path: "/api/contacts/{{0.id}}", body: { name: "Contact modifié", phone: "06 88 88 88 88" } },
      { method: "PUT", path: "/api/contacts/3", body: { name: "Autre magasin" } },
      { method: "DELETE", path: "/api/contacts/{{0.id}}" },
      { method: "DELETE", path: "/api/contacts/3" },
    ],
    tables: ["contacts"],
  },
  {
    module: "contacts",
    name: "créer un contact invalide",
    steps: [
      { method: "POST", path: "/api/contacts", body: { groupId: 1 } },
      { method: "POST", path: "/api/contacts", body: { groupId: 2, name: "Metz" } },
    ],
    tables: ["contacts"],
  },
  {
    module: "suppliers",
    name: "créer, modifier, supprimer un fournisseur",
    steps: [
      { method: "POST", path: "/api/suppliers", body: { name: "Nouveau fournisseur", contact: "M. Neuf", phone: "01 23 45 67 89", hasDlc: true, email: "neuf@banc.test", codefou: "F099" } },
      { method: "PUT", path: "/api/suppliers/{{0.id}}", body: { name: "Fournisseur renommé", automaticReconciliation: true } },
      { method: "DELETE", path: "/api/suppliers/{{0.id}}" },
      { method: "POST", path: "/api/suppliers", body: { contact: "sans nom" } },
    ],
    tables: ["suppliers"],
  },
];
