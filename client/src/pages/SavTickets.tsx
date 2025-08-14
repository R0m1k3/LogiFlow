import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuthUnified } from "@/hooks/useAuthUnified";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Plus, 
  Search, 
  Filter, 
  Wrench,
  Calendar,
  Eye,
  Edit,
  Trash2,
  Building,
  User,
  MessageCircle,
  AlertTriangle,
  CheckCircle,
  Clock,
  Ban
} from "lucide-react";
import { safeFormat } from "@/lib/dateUtils";
import type { SavTicketWithRelations, Supplier, Group, InsertSavTicket } from "@shared/schema";

const statusConfig = {
  nouveau: { label: "Nouveau", color: "bg-blue-100 text-blue-800", icon: AlertTriangle },
  en_cours: { label: "En cours", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  attente_pieces: { label: "Attente pièces", color: "bg-orange-100 text-orange-800", icon: Clock },
  attente_echange: { label: "Attente échange", color: "bg-purple-100 text-purple-800", icon: Clock },
  resolu: { label: "Résolu", color: "bg-green-100 text-green-800", icon: CheckCircle },
  ferme: { label: "Fermé", color: "bg-gray-100 text-gray-800", icon: Ban }
};

const priorityConfig = {
  faible: { label: "Faible", color: "bg-gray-100 text-gray-800" },
  normale: { label: "Normale", color: "bg-blue-100 text-blue-800" },
  haute: { label: "Haute", color: "bg-orange-100 text-orange-800" },
  critique: { label: "Critique", color: "bg-red-100 text-red-800" }
};

export default function SavTickets() {
  const { user } = useAuthUnified();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<SavTicketWithRelations | null>(null);
  const [newComment, setNewComment] = useState("");
  const [tempPriority, setTempPriority] = useState("");
  const [tempStatus, setTempStatus] = useState("");
  const [formData, setFormData] = useState({
    supplierId: "",
    groupId: "",
    productGencode: "",
    productReference: "",
    productDesignation: "",
    problemType: "defectueux",
    problemDescription: "",
    priority: "normale",
    clientName: "",
    clientPhone: ""
  });

  // Build query parameters
  const queryParams = new URLSearchParams();
  if (statusFilter !== 'all') queryParams.append('status', statusFilter);
  if (priorityFilter !== 'all') queryParams.append('priority', priorityFilter);
  if (supplierFilter !== 'all') queryParams.append('supplierId', supplierFilter);
  
  const ticketsUrl = `/api/sav/tickets${queryParams.toString() ? '?' + queryParams.toString() : ''}`;

  const { data: ticketsData = [], isLoading } = useQuery<SavTicketWithRelations[]>({
    queryKey: [ticketsUrl],
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const { data: suppliersData = [] } = useQuery<Supplier[]>({
    queryKey: ['/api/suppliers'],
    staleTime: 1000 * 60 * 10, // 10 minutes
  });

  const { data: groupsData = [] } = useQuery<Group[]>({
    queryKey: ['/api/groups'],
    staleTime: 1000 * 60 * 10, // 10 minutes
  });

  const { data: statsData } = useQuery<{
    totalTickets: number;
    newTickets: number;
    inProgressTickets: number;
    resolvedTickets: number;
    criticalTickets: number;
  }>({
    queryKey: ['/api/sav/stats'],
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  // Create ticket mutation
  const createTicketMutation = useMutation({
    mutationFn: async (data: InsertSavTicket) => {
      const response = await fetch('/api/sav/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erreur lors de la création du ticket');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sav/tickets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sav/stats'] });
      setShowCreateModal(false);
      setFormData({
        supplierId: "",
        groupId: "",
        productGencode: "",
        productReference: "",
        productDesignation: "",
        problemType: "defectueux",
        problemDescription: "",
        priority: "normale",
        clientName: "",
        clientPhone: ""
      });
      toast({
        title: "Ticket créé",
        description: "Le ticket SAV a été créé avec succès.",
      });
    },
    onError: (error: any) => {
      console.error('Error creating ticket:', error);
      toast({
        title: "Erreur",
        description: error?.message || "Impossible de créer le ticket.",
        variant: "destructive",
      });
    },
  });

  // Add comment mutation
  const addCommentMutation = useMutation({
    mutationFn: async (data: { ticketId: number; comment: string }) => {
      const response = await apiRequest(`/api/sav/tickets/${data.ticketId}/history`, "POST", {
        description: data.comment  // ✅ Utilise 'description' selon le schéma API
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sav/tickets'] });
      // ✅ Invalider aussi les détails du ticket pour rafraîchir l'historique
      if (selectedTicket) {
        queryClient.invalidateQueries({ queryKey: [`/api/sav/tickets/${selectedTicket.id}`] });
      }
      setNewComment("");
      toast({
        title: "Commentaire ajouté",
        description: "Le commentaire a été ajouté avec succès.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error?.message || "Impossible d'ajouter le commentaire.",
        variant: "destructive",
      });
    },
  });

  // Delete ticket mutation
  const deleteTicketMutation = useMutation({
    mutationFn: async (ticketId: number) => {
      const response = await apiRequest(`/api/sav/tickets/${ticketId}`, "DELETE");
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sav/tickets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sav/stats'] });
      setShowDeleteModal(false);
      toast({
        title: "Ticket supprimé",
        description: "Le ticket a été supprimé avec succès.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error?.message || "Impossible de supprimer le ticket.",
        variant: "destructive",
      });
    },
  });

  // Check permissions AFTER all hooks are called
  const canView = ['admin', 'directeur', 'manager', 'employee'].includes(user?.role || '');
  const canModify = ['admin', 'directeur', 'manager'].includes(user?.role || '');
  const canDelete = ['admin', 'directeur'].includes(user?.role || '');

  // Get user's available groups for auto-assignment
  const getUserGroups = () => {
    if (!user || user.role === 'admin') {
      return groupsData; // Admin can access all groups
    }
    
    // For other users, get their assigned groups
    const userGroups = (user as any).userGroups || [];
    return groupsData.filter(group => 
      userGroups.some((ug: any) => ug.groupId === group.id)
    );
  };

  const availableGroups = getUserGroups();

  // Handle form submission
  const handleCreateTicket = () => {
    if (!formData.supplierId || !formData.productGencode || !formData.productDesignation || !formData.problemDescription) {
      toast({
        title: "Erreur de validation",
        description: "Veuillez remplir tous les champs obligatoires.",
        variant: "destructive",
      });
      return;
    }

    // Auto-assign group if user has only one group or if admin didn't select one
    let selectedGroupId = formData.groupId ? parseInt(formData.groupId) : null;
    
    if (!selectedGroupId && availableGroups.length > 0) {
      // Auto-assign first available group
      selectedGroupId = availableGroups[0].id;
    }

    const ticketData: InsertSavTicket = {
      supplierId: parseInt(formData.supplierId),
      groupId: selectedGroupId || undefined,
      productGencode: formData.productGencode,
      productReference: formData.productReference || undefined,
      productDesignation: formData.productDesignation,
      problemType: formData.problemType as "defectueux" | "pieces_manquantes" | "non_conforme" | "autre",
      problemDescription: formData.problemDescription,
      priority: formData.priority as "faible" | "normale" | "haute" | "critique",
      clientName: formData.clientName || undefined,
      clientPhone: formData.clientPhone || undefined,
    };

    console.log('Creating ticket with data:', ticketData);
    createTicketMutation.mutate(ticketData);
  };

  // Handle viewing ticket details
  const handleViewTicket = (ticket: SavTicketWithRelations) => {
    setSelectedTicket(ticket);
    setShowDetailModal(true);
  };

  // Query pour récupérer les détails complets du ticket avec historique
  const { data: ticketDetails } = useQuery({
    queryKey: [`/api/sav/tickets/${selectedTicket?.id}`],
    enabled: !!selectedTicket && showDetailModal,
    staleTime: 0, // Toujours récupérer les derniers commentaires
  });

  // Handle editing ticket
  const handleEditTicket = (ticket: SavTicketWithRelations) => {
    setSelectedTicket(ticket);
    // Pre-fill form with ticket data
    setFormData({
      supplierId: ticket.supplierId.toString(),
      groupId: ticket.groupId.toString(),
      productGencode: ticket.productGencode,
      productReference: ticket.productReference || "",
      productDesignation: ticket.productDesignation,
      problemType: ticket.problemType,
      problemDescription: ticket.problemDescription,
      priority: ticket.priority,
      clientName: ticket.clientName || "",
      clientPhone: ticket.clientPhone || ""
    });
    setShowEditModal(true);
  };



  // Handle deleting ticket
  const handleDeleteTicket = (ticket: SavTicketWithRelations) => {
    setSelectedTicket(ticket);
    setShowDeleteModal(true);
  };

  // Handle permission check without early return
  if (!canView) {
    return (
      <div className="p-4 sm:p-6">
        <div className="bg-orange-50 border-l-4 border-orange-400 p-4 rounded-r-lg">
          <div className="flex">
            <div className="flex-shrink-0">
              <Wrench className="h-5 w-5 text-orange-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-orange-700">
                <strong>Accès restreint</strong><br />
                Vous n'avez pas les permissions nécessaires pour accéder au module SAV.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Filter tickets by search term
  const filteredTickets = ticketsData.filter(ticket => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      ticket.ticketNumber.toLowerCase().includes(searchLower) ||
      ticket.clientName?.toLowerCase().includes(searchLower) ||
      ticket.problemDescription?.toLowerCase().includes(searchLower) ||
      ticket.productDesignation?.toLowerCase().includes(searchLower) ||
      ticket.supplier?.name.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Service Après-Vente</h1>
          <p className="text-gray-600 mt-1">Gestion des tickets SAV et suivi des réparations</p>
        </div>
        {canModify && (
          <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                Nouveau Ticket
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Créer un nouveau ticket SAV</DialogTitle>
                <DialogDescription>
                  Remplissez les informations pour créer un nouveau ticket de service après-vente.
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Informations produit */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Informations produit</h3>
                  
                  <div className="space-y-2">
                    <Label htmlFor="productGencode">Code-barres produit *</Label>
                    <Input
                      id="productGencode"
                      value={formData.productGencode}
                      onChange={(e) => setFormData({...formData, productGencode: e.target.value})}
                      placeholder="Code-barres du produit"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="productReference">Référence produit</Label>
                    <Input
                      id="productReference"
                      value={formData.productReference}
                      onChange={(e) => setFormData({...formData, productReference: e.target.value})}
                      placeholder="Référence du produit"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="productDesignation">Désignation produit *</Label>
                    <Input
                      id="productDesignation"
                      value={formData.productDesignation}
                      onChange={(e) => setFormData({...formData, productDesignation: e.target.value})}
                      placeholder="Nom/désignation du produit"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="supplierId">Fournisseur *</Label>
                    <Select value={formData.supplierId} onValueChange={(value) => setFormData({...formData, supplierId: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un fournisseur" />
                      </SelectTrigger>
                      <SelectContent>
                        {suppliersData.map((supplier) => (
                          <SelectItem key={supplier.id} value={supplier.id.toString()}>
                            {supplier.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {availableGroups.length > 1 && (
                    <div className="space-y-2">
                      <Label htmlFor="groupId">Magasin</Label>
                      <Select value={formData.groupId} onValueChange={(value) => setFormData({...formData, groupId: value})}>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner un magasin" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableGroups.map((group) => (
                            <SelectItem key={group.id} value={group.id.toString()}>
                              {group.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  
                  {availableGroups.length === 1 && (
                    <div className="space-y-2">
                      <Label>Magasin assigné</Label>
                      <div className="flex items-center space-x-2 p-2 bg-gray-50 rounded">
                        <Building className="h-4 w-4 text-gray-500" />
                        <span className="text-sm text-gray-700">{availableGroups[0].name}</span>
                      </div>
                    </div>
                  )}
                  
                  {availableGroups.length === 0 && (
                    <div className="space-y-2">
                      <Label>Magasin</Label>
                      <div className="p-2 bg-orange-50 border border-orange-200 rounded text-sm text-orange-700">
                        Aucun magasin assigné. Contactez un administrateur.
                      </div>
                    </div>
                  )}
                </div>

                {/* Informations problème et client */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Problème et client</h3>
                  
                  <div className="space-y-2">
                    <Label htmlFor="problemType">Type de problème</Label>
                    <Select value={formData.problemType} onValueChange={(value) => setFormData({...formData, problemType: value})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="defectueux">Défectueux</SelectItem>
                        <SelectItem value="pieces_manquantes">Pièces manquantes</SelectItem>
                        <SelectItem value="non_conforme">Non conforme</SelectItem>
                        <SelectItem value="autre">Autre</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="priority">Priorité</Label>
                    <Select value={formData.priority} onValueChange={(value) => setFormData({...formData, priority: value})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="faible">Faible</SelectItem>
                        <SelectItem value="normale">Normale</SelectItem>
                        <SelectItem value="haute">Haute</SelectItem>
                        <SelectItem value="critique">Critique</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="problemDescription">Description du problème *</Label>
                    <Textarea
                      id="problemDescription"
                      value={formData.problemDescription}
                      onChange={(e) => setFormData({...formData, problemDescription: e.target.value})}
                      placeholder="Décrivez le problème en détail..."
                      rows={4}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="clientName">Nom du client</Label>
                    <Input
                      id="clientName"
                      value={formData.clientName}
                      onChange={(e) => setFormData({...formData, clientName: e.target.value})}
                      placeholder="Nom du client"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="clientPhone">Téléphone client</Label>
                    <Input
                      id="clientPhone"
                      value={formData.clientPhone}
                      onChange={(e) => setFormData({...formData, clientPhone: e.target.value})}
                      placeholder="Numéro de téléphone"
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end space-x-2 mt-6">
                <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                  Annuler
                </Button>
                <Button 
                  onClick={handleCreateTicket}
                  disabled={createTicketMutation.isPending || availableGroups.length === 0}
                >
                  {createTicketMutation.isPending ? "Création..." : "Créer le ticket"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Stats Cards */}
      {statsData && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total</CardTitle>
              <Wrench className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statsData.totalTickets}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Nouveaux</CardTitle>
              <AlertTriangle className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{statsData.newTickets}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">En cours</CardTitle>
              <Clock className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{statsData.inProgressTickets}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Résolus</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{statsData.resolvedTickets}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Critiques</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{statsData.criticalTickets}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                type="text"
                placeholder="Rechercher..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                {Object.entries(statusConfig).map(([key, config]) => (
                  <SelectItem key={key} value={key}>{config.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Priorité" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes priorités</SelectItem>
                {Object.entries(priorityConfig).map(([key, config]) => (
                  <SelectItem key={key} value={key}>{config.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={supplierFilter} onValueChange={setSupplierFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Fournisseur" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous fournisseurs</SelectItem>
                {suppliersData.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id.toString()}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button 
              variant="outline"
              onClick={() => {
                setSearchTerm("");
                setStatusFilter("all");
                setPriorityFilter("all");
                setSupplierFilter("all");
              }}
            >
              <Filter className="h-4 w-4 mr-2" />
              Réinitialiser
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tickets List */}
      <Card>
        <CardHeader>
          <CardTitle>Tickets SAV ({filteredTickets.length})</CardTitle>
          <CardDescription>
            Liste des tickets de service après-vente
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-gray-500">Chargement des tickets...</p>
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="p-8 text-center">
              <Wrench className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Aucun ticket trouvé</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ticket
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Client
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Produit
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Problème
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Statut
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Priorité
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fournisseur
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredTickets.map((ticket) => {
                    const StatusIcon = statusConfig[ticket.status as keyof typeof statusConfig]?.icon || Clock;
                    return (
                      <tr key={ticket.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <Wrench className="h-4 w-4 text-gray-400 mr-2" />
                            <span className="text-sm font-medium text-gray-900">
                              {ticket.ticketNumber}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {ticket.clientName || 'N/A'}
                            </div>
                            {ticket.clientPhone && (
                              <div className="text-sm text-gray-500">
                                {ticket.clientPhone}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            {ticket.productDesignation && (
                              <div className="text-sm font-medium text-gray-900">
                                {ticket.productDesignation}
                              </div>
                            )}
                            {ticket.productGencode && (
                              <div className="text-sm text-gray-500">
                                {ticket.productGencode}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900 max-w-xs truncate">
                            {ticket.problemDescription}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <StatusIcon className="h-4 w-4 mr-2" />
                            <Badge className={statusConfig[ticket.status as keyof typeof statusConfig]?.color}>
                              {statusConfig[ticket.status as keyof typeof statusConfig]?.label}
                            </Badge>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge className={priorityConfig[ticket.priority as keyof typeof priorityConfig]?.color}>
                            {priorityConfig[ticket.priority as keyof typeof priorityConfig]?.label}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <Building className="h-4 w-4 text-gray-400 mr-2" />
                            <span className="text-sm text-gray-900">
                              {ticket.supplier?.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex items-center">
                            <Calendar className="h-4 w-4 mr-1" />
                            {safeFormat(ticket.createdAt, 'dd/MM/yyyy')}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end space-x-2">
                            <Button variant="ghost" size="sm" onClick={() => handleViewTicket(ticket)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            {canModify && (
                              <Button variant="ghost" size="sm" onClick={() => handleEditTicket(ticket)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
                            {canDelete && (
                              <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-900" onClick={() => handleDeleteTicket(ticket)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Modal */}
      {selectedTicket && (
        <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle>Détails du ticket {selectedTicket.ticketNumber}</DialogTitle>
              <DialogDescription>
                Informations complètes du ticket SAV et suivi
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-hidden">
              {/* Colonne de gauche - Détails et Actions */}
              <div className="space-y-6 overflow-y-auto max-h-[70vh] pr-2">
                {/* Product Info */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Informations produit</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Code-barres:</span>
                      <p>{selectedTicket.productGencode}</p>
                    </div>
                    <div>
                      <span className="font-medium">Référence:</span>
                      <p>{selectedTicket.productReference || "Non renseignée"}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="font-medium">Désignation:</span>
                      <p>{selectedTicket.productDesignation}</p>
                    </div>
                  </div>
                </div>

                {/* Problem Info */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Problème</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Type:</span>
                    <p>{selectedTicket.problemType}</p>
                  </div>
                  <div>
                    <span className="font-medium">Priorité:</span>
                    <Badge className={priorityConfig[selectedTicket.priority as keyof typeof priorityConfig]?.color}>
                      {priorityConfig[selectedTicket.priority as keyof typeof priorityConfig]?.label}
                    </Badge>
                  </div>
                    <div className="col-span-2">
                      <span className="font-medium">Description:</span>
                      <p className="mt-1 p-2 bg-gray-50 rounded">{selectedTicket.problemDescription}</p>
                    </div>
                  </div>
                </div>

                {/* Client Info */}
                {(selectedTicket.clientName || selectedTicket.clientPhone) && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Client</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Nom:</span>
                        <p>{selectedTicket.clientName || "Non renseigné"}</p>
                      </div>
                      <div>
                        <span className="font-medium">Téléphone:</span>
                        <p>{selectedTicket.clientPhone || "Non renseigné"}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Ticket Info */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Informations ticket</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Statut:</span>
                    <Badge className={statusConfig[selectedTicket.status as keyof typeof statusConfig]?.color}>
                      {statusConfig[selectedTicket.status as keyof typeof statusConfig]?.label}
                    </Badge>
                  </div>
                  <div>
                    <span className="font-medium">Fournisseur:</span>
                    <p>{selectedTicket.supplier?.name}</p>
                  </div>
                  <div>
                    <span className="font-medium">Magasin:</span>
                    <p>{selectedTicket.group?.name}</p>
                  </div>
                  <div>
                    <span className="font-medium">Créé le:</span>
                    <p>{safeFormat(selectedTicket.createdAt, 'dd/MM/yyyy HH:mm')}</p>
                  </div>
                </div>

                {/* Actions rapides */}
                {canModify && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Actions rapides</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="quick-priority">Priorité</Label>
                        <Select value={selectedTicket.priority} onValueChange={(value) => {
                          // TODO: Implement priority update
                          toast({
                            title: "Fonction en développement",
                            description: "La modification de priorité sera bientôt disponible.",
                          });
                        }}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="faible">Faible</SelectItem>
                            <SelectItem value="normale">Normale</SelectItem>
                            <SelectItem value="haute">Haute</SelectItem>
                            <SelectItem value="critique">Critique</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="quick-status">Statut</Label>
                        <Select value={selectedTicket.status} onValueChange={(value) => {
                          // TODO: Implement status update
                          toast({
                            title: "Fonction en développement",
                            description: "La modification de statut sera bientôt disponible.",
                          });
                        }}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="nouveau">Nouveau</SelectItem>
                            <SelectItem value="en_cours">En cours</SelectItem>
                            <SelectItem value="attente_pieces">Attente pièces</SelectItem>
                            <SelectItem value="attente_echange">Attente échange</SelectItem>
                            <SelectItem value="resolu">Résolu</SelectItem>
                            <SelectItem value="ferme">Fermé</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Colonne de droite - Commentaires et Suivi */}
              <div className="space-y-4 overflow-y-auto max-h-[70vh] pl-2 border-l">
                <h3 className="text-lg font-medium">Historique et commentaires</h3>
                
                {/* Affichage de l'historique existant */}
                {ticketDetails?.history && ticketDetails.history.length > 0 ? (
                  <div className="space-y-3 flex-1 overflow-y-auto">
                    {ticketDetails.history.map((entry: any, index: number) => (
                      <div key={index} className="bg-gray-50 rounded-lg p-3 text-sm">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-medium text-gray-900">
                            {entry.action === 'comment' ? 'Commentaire' : entry.action}
                          </span>
                          <span className="text-gray-500 text-xs">
                            {safeFormat(entry.createdAt, 'dd/MM/yyyy HH:mm')}
                          </span>
                        </div>
                        <p className="text-gray-700">{entry.description}</p>
                        {entry.creator && (
                          <p className="text-gray-500 text-xs mt-1">Par: {entry.creator.username}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-gray-500 text-sm text-center py-8">
                    Aucun commentaire pour le moment
                  </div>
                )}
                
                {/* Champ d'ajout de commentaire */}
                {canModify && (
                  <div className="border-t pt-4 space-y-3">
                    <Label htmlFor="new-comment">Ajouter un commentaire</Label>
                    <Textarea
                      id="new-comment"
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Entrez votre commentaire..."
                      rows={3}
                      className="resize-none"
                    />
                    <div className="flex justify-end">
                      <Button 
                        size="sm"
                        onClick={() => {
                          if (!newComment.trim()) {
                            toast({
                              title: "Erreur",
                              description: "Le commentaire ne peut pas être vide.",
                              variant: "destructive",
                            });
                            return;
                          }
                          addCommentMutation.mutate({ ticketId: selectedTicket.id, comment: newComment.trim() });
                        }}
                        disabled={addCommentMutation.isPending}
                      >
                        {addCommentMutation.isPending ? "Ajout..." : "Ajouter commentaire"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Colonne de droite - Commentaires et Suivi */}
              <div className="space-y-4 overflow-y-auto max-h-[70vh] pl-2 border-l">
                <h3 className="text-lg font-medium">Historique et commentaires</h3>
                
                {/* Affichage de l'historique existant */}
                {ticketDetails?.history && ticketDetails.history.length > 0 ? (
                  <div className="space-y-3 flex-1 overflow-y-auto">
                    {ticketDetails.history.map((entry: any, index: number) => (
                      <div key={index} className="bg-gray-50 rounded-lg p-3 text-sm">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-medium text-gray-900">
                            {entry.action === 'comment' ? 'Commentaire' : entry.action}
                          </span>
                          <span className="text-gray-500 text-xs">
                            {safeFormat(entry.createdAt, 'dd/MM/yyyy HH:mm')}
                          </span>
                        </div>
                        <p className="text-gray-700">{entry.description}</p>
                        {entry.creator && (
                          <p className="text-gray-500 text-xs mt-1">Par: {entry.creator.username}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-gray-500 text-sm text-center py-8">
                    Aucun commentaire pour le moment
                  </div>
                )}
                
                {/* Champ d'ajout de commentaire */}
                {canModify && (
                  <div className="border-t pt-4 space-y-3">
                    <Label htmlFor="new-comment">Ajouter un commentaire</Label>
                    <Textarea
                      id="new-comment"
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Entrez votre commentaire..."
                      rows={3}
                      className="resize-none"
                    />
                    <div className="flex justify-end">
                      <Button 
                        size="sm"
                        onClick={() => {
                          if (!newComment.trim()) {
                            toast({
                              title: "Erreur",
                              description: "Le commentaire ne peut pas être vide.",
                              variant: "destructive",
                            });
                            return;
                          }
                          addCommentMutation.mutate({ ticketId: selectedTicket.id, comment: newComment.trim() });
                        }}
                        disabled={addCommentMutation.isPending}
                      >
                        {addCommentMutation.isPending ? "Ajout..." : "Ajouter commentaire"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Modal */}
      {selectedTicket && (
        <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Modifier le ticket {selectedTicket.ticketNumber}</DialogTitle>
              <DialogDescription>
                Modifier les informations du ticket SAV
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              {/* Same form structure as create modal but for editing */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Product Info */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Informations produit</h3>
                  
                  <div className="space-y-2">
                    <Label htmlFor="edit-productGencode">Code-barres produit *</Label>
                    <Input
                      id="edit-productGencode"
                      value={formData.productGencode}
                      onChange={(e) => setFormData({...formData, productGencode: e.target.value})}
                      placeholder="Code-barres du produit"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="edit-productReference">Référence produit</Label>
                    <Input
                      id="edit-productReference"
                      value={formData.productReference}
                      onChange={(e) => setFormData({...formData, productReference: e.target.value})}
                      placeholder="Référence du produit"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="edit-productDesignation">Désignation produit *</Label>
                    <Input
                      id="edit-productDesignation"
                      value={formData.productDesignation}
                      onChange={(e) => setFormData({...formData, productDesignation: e.target.value})}
                      placeholder="Nom/désignation du produit"
                    />
                  </div>
                </div>

                {/* Problem and Client Info */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Problème et client</h3>
                  
                  <div className="space-y-2">
                    <Label htmlFor="edit-problemType">Type de problème</Label>
                    <Select value={formData.problemType} onValueChange={(value) => setFormData({...formData, problemType: value})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="defectueux">Défectueux</SelectItem>
                        <SelectItem value="pieces_manquantes">Pièces manquantes</SelectItem>
                        <SelectItem value="non_conforme">Non conforme</SelectItem>
                        <SelectItem value="autre">Autre</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="edit-priority">Priorité</Label>
                    <Select value={formData.priority} onValueChange={(value) => setFormData({...formData, priority: value})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="faible">Faible</SelectItem>
                        <SelectItem value="normale">Normale</SelectItem>
                        <SelectItem value="haute">Haute</SelectItem>
                        <SelectItem value="critique">Critique</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="edit-clientName">Nom du client</Label>
                    <Input
                      id="edit-clientName"
                      value={formData.clientName}
                      onChange={(e) => setFormData({...formData, clientName: e.target.value})}
                      placeholder="Nom du client"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="edit-clientPhone">Téléphone client</Label>
                    <Input
                      id="edit-clientPhone"
                      value={formData.clientPhone}
                      onChange={(e) => setFormData({...formData, clientPhone: e.target.value})}
                      placeholder="Numéro de téléphone"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-problemDescription">Description du problème *</Label>
                <Textarea
                  id="edit-problemDescription"
                  value={formData.problemDescription}
                  onChange={(e) => setFormData({...formData, problemDescription: e.target.value})}
                  placeholder="Décrivez le problème en détail..."
                  rows={4}
                />
              </div>

              <div className="flex justify-end space-x-2 mt-6">
                <Button variant="outline" onClick={() => setShowEditModal(false)}>
                  Annuler
                </Button>
                <Button 
                  onClick={() => {
                    // TODO: Implement update ticket functionality
                    toast({
                      title: "Fonction en développement",
                      description: "La modification de tickets sera bientôt disponible.",
                    });
                  }}
                >
                  Sauvegarder
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}



      {/* Delete Confirmation Modal */}
      {selectedTicket && (
        <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Confirmer la suppression</DialogTitle>
              <DialogDescription>
                Êtes-vous sûr de vouloir supprimer le ticket {selectedTicket.ticketNumber} ? Cette action est irréversible.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex">
                  <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5 mr-3" />
                  <div>
                    <h4 className="text-sm font-medium text-red-800">Attention</h4>
                    <p className="mt-1 text-sm text-red-700">
                      Toutes les données du ticket seront définitivement supprimées.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
                  Annuler
                </Button>
                <Button 
                  variant="destructive"
                  onClick={() => deleteTicketMutation.mutate(selectedTicket.id)}
                  disabled={deleteTicketMutation.isPending}
                >
                  {deleteTicketMutation.isPending ? "Suppression..." : "Supprimer"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}