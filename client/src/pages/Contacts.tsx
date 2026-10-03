import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuthUnified } from "@/hooks/useAuthUnified";
import { useStore } from "@/contexts/StoreContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Plus,
  Search,
  Building,
  Phone,
  Mail,
  User,
  Edit,
  Trash2,
  BookUser,
  StickyNote,
} from "lucide-react";
import type { Supplier, Contact, Group } from "@shared/schema";

const CAN_EDIT_ROLES = ["admin", "directeur", "manager"];
const CAN_EDIT_SUPPLIER = ["admin", "directeur"];

export default function Contacts() {
  const { user } = useAuthUnified();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { stores, selectedStoreId } = useStore();

  const canEdit = user?.role && CAN_EDIT_ROLES.includes(user.role);
  const canEditSupplier = user?.role && CAN_EDIT_SUPPLIER.includes(user.role);
  const isAdmin = user?.role === "admin";

  // Pour les admins, permettre de choisir un magasin
  const [adminGroupId, setAdminGroupId] = useState<number | null>(null);
  const effectiveGroupId = isAdmin ? adminGroupId : selectedStoreId;

  const [supplierSearch, setSupplierSearch] = useState("");
  const [contactSearch, setContactSearch] = useState("");

  // Modal contacts libres
  const [showModal, setShowModal] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [formData, setFormData] = useState({
    groupId: effectiveGroupId ?? 0,
    name: "",
    company: "",
    role: "",
    phone: "",
    email: "",
    notes: "",
  });

  // Modal coordonnées fournisseur
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [supplierFormData, setSupplierFormData] = useState({
    contact: "",
    phone: "",
    email: "",
  });

  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
  });

  // Clé structurée : l'invalidation par préfixe ["/api/contacts"] des mutations
  // ci-dessous rafraîchit aussi la liste filtrée par magasin
  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ["/api/contacts", effectiveGroupId ?? null],
    queryFn: () =>
      apiRequest(effectiveGroupId ? `/api/contacts?groupId=${effectiveGroupId}` : "/api/contacts", "GET"),
    // Sans magasin, un non-admin ne voit pas la liste : pas de requête
    enabled: !!user && (isAdmin || !!effectiveGroupId),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/contacts", "POST", data),
    onSuccess: () => {
      toast({ title: "Succès", description: "Contact créé avec succès" });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      closeModal();
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de créer le contact", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest(`/api/contacts/${selectedContact?.id}`, "PUT", data),
    onSuccess: () => {
      toast({ title: "Succès", description: "Contact modifié avec succès" });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      closeModal();
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de modifier le contact", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/contacts/${id}`, "DELETE"),
    onSuccess: () => {
      toast({ title: "Succès", description: "Contact supprimé" });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de supprimer le contact", variant: "destructive" });
    },
  });

  const updateSupplierMutation = useMutation({
    mutationFn: (data: any) => apiRequest(`/api/suppliers/${selectedSupplier?.id}`, "PUT", data),
    onSuccess: () => {
      toast({ title: "Succès", description: "Coordonnées fournisseur mises à jour" });
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      setShowSupplierModal(false);
      setSelectedSupplier(null);
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de modifier le fournisseur", variant: "destructive" });
    },
  });

  const openCreate = () => {
    setSelectedContact(null);
    setFormData({
      groupId: effectiveGroupId ?? 0,
      name: "",
      company: "",
      role: "",
      phone: "",
      email: "",
      notes: "",
    });
    setShowModal(true);
  };

  const openEdit = (contact: Contact) => {
    setSelectedContact(contact);
    setFormData({
      groupId: contact.groupId,
      name: contact.name,
      company: (contact as any).company || "",
      role: contact.role || "",
      phone: contact.phone || "",
      email: contact.email || "",
      notes: contact.notes || "",
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedContact(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...formData, groupId: effectiveGroupId ?? formData.groupId };
    if (selectedContact) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleDelete = (contact: Contact) => {
    if (confirm(`Supprimer le contact "${contact.name}" ?`)) {
      deleteMutation.mutate(contact.id);
    }
  };

  const openEditSupplier = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setSupplierFormData({
      contact: supplier.contact || "",
      phone: supplier.phone || "",
      email: (supplier as any).email || "",
    });
    setShowSupplierModal(true);
  };

  const filteredSuppliers = suppliers.filter((s) =>
    s.name.toLowerCase().includes(supplierSearch.toLowerCase()) ||
    (s.contact || "").toLowerCase().includes(supplierSearch.toLowerCase())
  );

  const filteredContacts = contacts.filter((c) =>
    c.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
    (c.role || "").toLowerCase().includes(contactSearch.toLowerCase())
  );

  const groupName = (groupId: number) =>
    stores.find((s) => s.id === groupId)?.name ?? `Magasin #${groupId}`;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 flex items-center">
            <BookUser className="w-6 h-6 mr-3 text-blue-600" />
            Contacts
          </h2>
          <p className="text-gray-600 mt-1">
            Fournisseurs et contacts par magasin
          </p>
        </div>

        {canEdit && effectiveGroupId && (
          <Button onClick={openCreate} className="bg-primary hover:bg-blue-700 text-white">
            <Plus className="w-4 h-4 mr-2" />
            Nouveau contact
          </Button>
        )}
      </div>

      {/* Sélecteur de magasin (admin uniquement) */}
      {isAdmin && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <Label className="text-sm font-medium text-blue-800 mb-2 block">
            Magasin affiché (admin)
          </Label>
          <Select
            value={adminGroupId ? String(adminGroupId) : "all"}
            onValueChange={(v) => setAdminGroupId(v === "all" ? null : parseInt(v))}
          >
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Tous les magasins" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les magasins</SelectItem>
              {stores.map((g) => (
                <SelectItem key={g.id} value={String(g.id)}>
                  {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Deux colonnes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Colonne Fournisseurs */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Building className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">
              Fournisseurs ({filteredSuppliers.length})
            </h3>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Rechercher un fournisseur..."
              value={supplierSearch}
              onChange={(e) => setSupplierSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="space-y-3">
            {filteredSuppliers.length === 0 ? (
              <div className="text-center py-10 text-gray-500 border border-dashed rounded-lg">
                <Building className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                Aucun fournisseur trouvé
              </div>
            ) : (
              filteredSuppliers.map((supplier) => (
                <div
                  key={supplier.id}
                  className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                        <Building className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{supplier.name}</p>
                        {supplier.contact && (
                          <p className="text-sm text-gray-500 flex items-center mt-0.5">
                            <User className="w-3 h-3 mr-1" />
                            {supplier.contact}
                          </p>
                        )}
                      </div>
                    </div>
                    {canEditSupplier && (
                      <Button variant="ghost" size="sm" onClick={() => openEditSupplier(supplier)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <div className="mt-3 space-y-1 pl-12">
                    {supplier.phone && (
                      <a
                        href={`tel:${supplier.phone}`}
                        className="flex items-center text-sm text-blue-700 hover:underline"
                      >
                        <Phone className="w-3.5 h-3.5 mr-2 flex-shrink-0" />
                        {supplier.phone}
                      </a>
                    )}
                    {(supplier as any).email && (
                      <a
                        href={`mailto:${(supplier as any).email}`}
                        className="flex items-center text-sm text-blue-700 hover:underline"
                      >
                        <Mail className="w-3.5 h-3.5 mr-2 flex-shrink-0" />
                        {(supplier as any).email}
                      </a>
                    )}
                    {!supplier.phone && !(supplier as any).email && (
                      <p className="text-xs text-gray-400 italic">Aucune coordonnée renseignée</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Colonne Autres contacts */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <User className="w-5 h-5 text-green-600" />
            <h3 className="text-lg font-semibold text-gray-900">
              Autres contacts ({filteredContacts.length})
            </h3>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Rechercher un contact..."
              value={contactSearch}
              onChange={(e) => setContactSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {!effectiveGroupId && !isAdmin && (
            <div className="text-center py-10 text-gray-500 border border-dashed rounded-lg">
              <BookUser className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              Sélectionnez un magasin pour voir les contacts
            </div>
          )}

          {(effectiveGroupId || isAdmin) && (
            <div className="space-y-3">
              {filteredContacts.length === 0 ? (
                <div className="text-center py-10 text-gray-500 border border-dashed rounded-lg">
                  <User className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                  Aucun contact
                  {canEdit && effectiveGroupId && (
                    <div className="mt-3">
                      <Button onClick={openCreate} size="sm" variant="outline">
                        <Plus className="w-4 h-4 mr-1" />
                        Ajouter un contact
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                filteredContacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-9 h-9 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0">
                          <User className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{contact.name}</p>
                          {(contact as any).company && (
                            <p className="text-sm font-medium text-gray-700">{(contact as any).company}</p>
                          )}
                          {contact.role && (
                            <p className="text-sm text-gray-500">{contact.role}</p>
                          )}
                          {isAdmin && (
                            <p className="text-xs text-blue-500">{groupName(contact.groupId)}</p>
                          )}
                        </div>
                      </div>
                      {canEdit && (
                        <div className="flex items-center space-x-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(contact)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(contact)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="mt-3 space-y-1 pl-12">
                      {contact.phone && (
                        <a
                          href={`tel:${contact.phone}`}
                          className="flex items-center text-sm text-green-700 hover:underline"
                        >
                          <Phone className="w-3.5 h-3.5 mr-2 flex-shrink-0" />
                          {contact.phone}
                        </a>
                      )}
                      {contact.email && (
                        <a
                          href={`mailto:${contact.email}`}
                          className="flex items-center text-sm text-green-700 hover:underline"
                        >
                          <Mail className="w-3.5 h-3.5 mr-2 flex-shrink-0" />
                          {contact.email}
                        </a>
                      )}
                      {contact.notes && (
                        <p className="flex items-start text-sm text-gray-500">
                          <StickyNote className="w-3.5 h-3.5 mr-2 flex-shrink-0 mt-0.5" />
                          {contact.notes}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal créer / modifier contact */}
      <Dialog open={showModal} onOpenChange={closeModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedContact ? "Modifier le contact" : "Nouveau contact"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isAdmin && !selectedContact && (
              <div>
                <Label>Magasin *</Label>
                <Select
                  value={String(formData.groupId || "")}
                  onValueChange={(v) => setFormData((p) => ({ ...p, groupId: parseInt(v) }))}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un magasin" />
                  </SelectTrigger>
                  <SelectContent>
                    {stores.map((g) => (
                      <SelectItem key={g.id} value={String(g.id)}>
                        {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label htmlFor="c-name">Nom *</Label>
              <Input
                id="c-name"
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                placeholder="Nom du contact"
                required
              />
            </div>

            <div>
              <Label htmlFor="c-company">Entreprise</Label>
              <Input
                id="c-company"
                value={formData.company}
                onChange={(e) => setFormData((p) => ({ ...p, company: e.target.value }))}
                placeholder="Nom de l'entreprise"
              />
            </div>

            <div>
              <Label htmlFor="c-role">Fonction / Rôle</Label>
              <Input
                id="c-role"
                value={formData.role}
                onChange={(e) => setFormData((p) => ({ ...p, role: e.target.value }))}
                placeholder="Ex: Directeur régional, Commercial..."
              />
            </div>

            <div>
              <Label htmlFor="c-phone">Téléphone</Label>
              <Input
                id="c-phone"
                value={formData.phone}
                onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
                placeholder="Numéro de téléphone"
              />
            </div>

            <div>
              <Label htmlFor="c-email">Email</Label>
              <Input
                id="c-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                placeholder="Adresse email"
              />
            </div>

            <div>
              <Label htmlFor="c-notes">Notes</Label>
              <Input
                id="c-notes"
                value={formData.notes}
                onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Notes libres..."
              />
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <Button type="button" variant="outline" onClick={closeModal}>
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="bg-primary hover:bg-blue-700"
              >
                {createMutation.isPending || updateMutation.isPending
                  ? "Enregistrement..."
                  : selectedContact
                  ? "Modifier"
                  : "Créer"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal coordonnées fournisseur */}
      <Dialog open={showSupplierModal} onOpenChange={() => { setShowSupplierModal(false); setSelectedSupplier(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Coordonnées — {selectedSupplier?.name}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => { e.preventDefault(); updateSupplierMutation.mutate(supplierFormData); }}
            className="space-y-4"
          >
            <div>
              <Label htmlFor="s-contact">Nom du contact</Label>
              <Input
                id="s-contact"
                value={supplierFormData.contact}
                onChange={(e) => setSupplierFormData((p) => ({ ...p, contact: e.target.value }))}
                placeholder="Nom du contact chez le fournisseur"
              />
            </div>
            <div>
              <Label htmlFor="s-phone">Téléphone</Label>
              <Input
                id="s-phone"
                value={supplierFormData.phone}
                onChange={(e) => setSupplierFormData((p) => ({ ...p, phone: e.target.value }))}
                placeholder="Numéro de téléphone"
              />
            </div>
            <div>
              <Label htmlFor="s-email">Email</Label>
              <Input
                id="s-email"
                type="email"
                value={supplierFormData.email}
                onChange={(e) => setSupplierFormData((p) => ({ ...p, email: e.target.value }))}
                placeholder="Adresse email"
              />
            </div>
            <div className="flex items-center space-x-3 pt-2">
              <Button type="button" variant="outline" onClick={() => { setShowSupplierModal(false); setSelectedSupplier(null); }}>
                Annuler
              </Button>
              <Button type="submit" disabled={updateSupplierMutation.isPending} className="bg-primary hover:bg-blue-700">
                {updateSupplierMutation.isPending ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
