import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { useAuthUnified } from "@/hooks/useAuthUnified";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { getRoleTailwindClasses, getRoleDisplayName } from "@/lib/roleUtils";
import { isUnauthorizedError } from "@/lib/authUtils";
import { 
  Search, 
  UserCog, 
  Plus,
  Users,
  Edit,
  Trash2,
  Shield
} from "lucide-react";
import type { UserWithGroups, Group } from "@shared/schema";

export default function UsersPage() {
  const { user } = useAuthUnified();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [showEditModal, setShowEditModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithGroups | null>(null);
  const [userGroups, setUserGroups] = useState<number[]>([]);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedUserForRole, setSelectedUserForRole] = useState<UserWithGroups | null>(null);
  const [showRoleConfirmModal, setShowRoleConfirmModal] = useState(false);
  const [pendingRoleChange, setPendingRoleChange] = useState<{userId: string, newRoleName: string, newRoleDisplay: string} | null>(null);
  
  // Edit form state
  const [editForm, setEditForm] = useState({
    username: "",
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    role: "employee",
  });
  
  // Form states for creating user
  const [newUser, setNewUser] = useState({
    email: "",
    firstName: "",
    lastName: "",
    username: "",
    password: "",
    role: "employee",
  });

  const USE_LOCAL_AUTH = import.meta.env.VITE_USE_LOCAL_AUTH === 'true' || import.meta.env.MODE === 'development';

  // Force update of form fields when modal opens and selectedUser changes
  useEffect(() => {
    if (showEditModal && selectedUser) {
      console.log('📝 useEffect triggered - selectedUser data:', {
        username: selectedUser.username,
        firstName: selectedUser.firstName,
        lastName: selectedUser.lastName, 
        name: selectedUser.name,
        email: selectedUser.email,
        role: selectedUser.role
      });
      
      // Use the same logic as handleEditUser to extract firstName/lastName
      let firstName = selectedUser.firstName && selectedUser.firstName.trim() ? selectedUser.firstName : '';
      let lastName = selectedUser.lastName && selectedUser.lastName.trim() ? selectedUser.lastName : '';
      
      // Si pas de firstName/lastName mais qu'il y a un champ name, le diviser
      if (!firstName && !lastName && selectedUser.name && selectedUser.name.trim()) {
        console.log('📝 useEffect using fallback: splitting name field:', selectedUser.name);
        const [firstPart = '', ...lastNameParts] = selectedUser.name.trim().split(' ');
        firstName = firstPart;
        lastName = lastNameParts.join(' ');
      }
      
      console.log('📝 useEffect final values:', { firstName, lastName });
      
      setEditForm(prev => ({
        ...prev,
        username: selectedUser.username || "",
        firstName: firstName,
        lastName: lastName,
        email: selectedUser.email || "",
        role: selectedUser.role || "employee",
      }));
    }
  }, [showEditModal, selectedUser]);

  // Additional production fix: Force field update after render
  useEffect(() => {
    if (showEditModal && selectedUser && editForm.firstName === '' && editForm.lastName === '') {
      // Delay to ensure DOM is ready
      const timer = setTimeout(() => {
        console.log('🔧 Production fix: Forcing field update after render');
        // Extract data using same logic as above
        let firstName = selectedUser.firstName && selectedUser.firstName.trim() ? selectedUser.firstName : '';
        let lastName = selectedUser.lastName && selectedUser.lastName.trim() ? selectedUser.lastName : '';
        
        if (!firstName && !lastName && selectedUser.name && selectedUser.name.trim()) {
          const [firstPart = '', ...lastNameParts] = selectedUser.name.trim().split(' ');
          firstName = firstPart;
          lastName = lastNameParts.join(' ');
        }
        
        if (firstName || lastName) {
          setEditForm(prev => ({
            ...prev,
            firstName: firstName,
            lastName: lastName,
          }));
        }
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [showEditModal, selectedUser, editForm.firstName, editForm.lastName]);

  const { data: users = [], isLoading: usersLoading, refetch: refetchUsers } = useQuery<UserWithGroups[]>({
    queryKey: ['/api/users'],
    enabled: user?.role === 'admin',
    staleTime: 30000, // Cache for 30 seconds
    refetchOnWindowFocus: false,
  });

  const { data: groups = [] } = useQuery<Group[]>({
    queryKey: ['/api/groups'],
    enabled: user?.role === 'admin',
    staleTime: 60000, // Cache for 1 minute
    refetchOnWindowFocus: false,
  });

  const { data: roles = [] } = useQuery({
    queryKey: ['/api/roles'],
    enabled: user?.role === 'admin',
    staleTime: 60000, // Cache for 1 minute  
    refetchOnWindowFocus: false,
  });

  // Debug logging only when needed
  if (process.env.NODE_ENV === 'development' && usersLoading) {
    console.log('👥 Loading users data...');
  }
  
  // Protection: s'assurer que users, groups et roles sont des arrays
  const safeUsers = Array.isArray(users) ? users : [];
  const safeGroups = Array.isArray(groups) ? groups : [];
  const safeRoles = Array.isArray(roles) ? roles : [];

  const updateUserRoleMutation = useMutation({
    mutationFn: async (data: { userId: string; roleId: number }) => {
      await apiRequest(`/api/users/${data.userId}/roles`, "POST", { roleIds: [data.roleId] });
    },
    onSuccess: () => {
      toast({
        title: "Succès",
        description: "Rôle utilisateur mis à jour avec succès",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/roles'] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Non autorisé",
          description: "Vous êtes déconnecté. Reconnexion...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le rôle",
        variant: "destructive",
      });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async (data: { id: string; updates: any }) => {
      console.log('🔄 Frontend updateUser mutation:', data);
      
      // Nettoyer les données côté frontend avant envoi
      const cleanedUpdates = {};
      for (const [key, value] of Object.entries(data.updates)) {
        if (value !== undefined && value !== null && value !== '') {
          cleanedUpdates[key] = value;
        }
      }
      
      console.log('📤 Sending cleaned data:', cleanedUpdates);
      
      const response = await apiRequest(`/api/users/${data.id}`, "PUT", cleanedUpdates);
      return response;
    },
    onSuccess: async (updatedUser) => {
      toast({
        title: "Succès",
        description: "Utilisateur mis à jour avec succès",
      });
      
      // Update the form with the response data before closing
      if (updatedUser) {
        setEditForm({
          firstName: updatedUser.firstName || '',
          lastName: updatedUser.lastName || '',
          username: updatedUser.username || '',
          email: updatedUser.email || '',
          role: updatedUser.role || 'employee',
          password: ''
        });
        
        // Update selected user as well
        setSelectedUser(prev => prev ? {...prev, ...updatedUser} : null);
      }
      
      // Force immediate cache invalidation and refetch
      await queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      await refetchUsers();
      console.log('✅ Cache invalidated and users refetched after update');
      
      // Delay modal close to show the updated data
      setTimeout(() => {
        setShowEditModal(false);
        setSelectedUser(null);
      }, 1000);
    },
    onError: (error: any) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Non autorisé",
          description: "Vous êtes déconnecté. Reconnexion...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      
      // Show specific error message from API if available
      const errorMessage = error?.response?.data?.message || "Impossible de mettre à jour l'utilisateur";
      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (userData: typeof newUser) => {
      const payload = {
        ...userData,
        id: userData.email.split('@')[0] + '_' + Date.now(), // Simple ID generation
      };
      
      // Only include password for local auth
      if (USE_LOCAL_AUTH && userData.password) {
        payload.password = userData.password;
      }
      
      const response = await apiRequest("/api/users", "POST", payload);
      return response;
    },
    onSuccess: async () => {
      // Invalidation complète du cache et refetch immédiat
      await queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/roles'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/groups'] });
      
      // Force un refetch immédiat pour s'assurer que la liste se met à jour
      await refetchUsers();
      
      console.log('✅ User created successfully - cache invalidated and refetched');
      
      toast({
        title: "Succès",
        description: "Utilisateur créé avec succès",
      });
    },
    onError: (error: any) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Non autorisé",
          description: "Vous êtes déconnecté. Reconnexion...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      
      // Show specific error message from API if available
      const errorMessage = error?.response?.data?.message || "Impossible de créer l'utilisateur";
      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const assignGroupMutation = useMutation({
    mutationFn: async (data: { userId: string; groupId: number }) => {
      console.log('📤 Assigning group:', data);
      const response = await apiRequest(
        `/api/users/${data.userId}/groups`, 
        "POST",
        { groupId: data.groupId }
      );
      console.log('✅ Group assignment response:', response);
      return response;
    },
    onSuccess: () => {
      console.log('✅ Group assigned successfully');
      toast({
        title: "Succès",
        description: "Utilisateur assigné au groupe avec succès",
      });
      // Invalidation complète du cache
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/roles'] });
      queryClient.invalidateQueries({ queryKey: ['/api/groups'] });
    },
    onError: (error: any) => {
      console.error('❌ Error assigning group:', error);
      if (isUnauthorizedError(error)) {
        toast({
          title: "Non autorisé",
          description: "Vous êtes déconnecté. Reconnexion...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      
      // Show specific error message from API if available
      const errorMessage = error?.response?.data?.message || "Impossible d'assigner l'utilisateur au groupe";
      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const removeGroupMutation = useMutation({
    mutationFn: async (data: { userId: string; groupId: number }) => {
      console.log('🗑️ Removing group:', data);
      const response = await apiRequest(
        `/api/users/${data.userId}/groups/${data.groupId}`, 
        "DELETE"
      );
      console.log('✅ Group removal response:', response);
      return response;
    },
    onSuccess: () => {
      console.log('✅ Group removed successfully');
      toast({
        title: "Succès",
        description: "Utilisateur retiré du groupe avec succès",
      });
      // Invalidation complète du cache
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/roles'] });
      queryClient.invalidateQueries({ queryKey: ['/api/groups'] });
    },
    onError: (error: any) => {
      console.error('❌ Error removing group:', error);
      if (isUnauthorizedError(error)) {
        toast({
          title: "Non autorisé",
          description: "Vous êtes déconnecté. Reconnexion...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      
      // Show specific error message from API if available
      const errorMessage = error?.response?.data?.message || "Impossible de retirer l'utilisateur du groupe";
      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      await apiRequest(`/api/users/${userId}`, "DELETE");
    },
    onSuccess: () => {
      toast({
        title: "Succès",
        description: "Utilisateur supprimé avec succès",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Non autorisé",
          description: "Vous êtes déconnecté. Reconnexion...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Erreur",
        description: "Impossible de supprimer l'utilisateur",
        variant: "destructive",
      });
    },
  });

  // Optimize re-renders by memoizing filtered users
  const filteredUsers = useMemo(() => {
    if (!Array.isArray(safeUsers)) return [];
    
    return safeUsers.filter((u) => {
      const matchesSearch = !searchTerm ||
                           u.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           u.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           u.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           u.email?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesRole = roleFilter === "all" || u.role === roleFilter;
      
      return matchesSearch && matchesRole;
    });
  }, [safeUsers, searchTerm, roleFilter]);

  const getRoleIcon = (role: string) => {
    const { iconClass } = getRoleTailwindClasses(role);
    
    switch (role) {
      case 'admin':
        return <Crown className={`w-4 h-4 ${iconClass}`} />;
      case 'manager':
      case 'directeur':
        return <Shield className={`w-4 h-4 ${iconClass}`} />;
      case 'employee':
        return <UserIconMain className={`w-4 h-4 ${iconClass}`} />;
      default:
        return <UserIconMain className={`w-4 h-4 ${iconClass}`} />;
    }
  };

  const getRoleBadge = (role: string) => {
    const { badgeClass } = getRoleTailwindClasses(role);
    const displayName = getRoleDisplayName(role);
    
    return <Badge className={badgeClass}>{displayName}</Badge>;
  };

  const handleCreateUser = () => {
    // Ouvrir directement la modal sans refetch pour éviter de vider la liste
    setShowCreateModal(true);
    setNewUser({ email: "", firstName: "", lastName: "", username: "", password: "", role: "admin" });
    setUserGroups([]);
  };

  const handleSubmitCreateUser = async () => {
    if (!newUser.username || !newUser.username.trim()) {
      toast({
        title: "Erreur",
        description: "L'identifiant est obligatoire",
        variant: "destructive",
      });
      return;
    }

    if (!newUser.password) {
      toast({
        title: "Erreur",
        description: "Le mot de passe est obligatoire",
        variant: "destructive",
      });
      return;
    }

    // First create the user
    try {
      const createdUser = await createUserMutation.mutateAsync(newUser);
      
      // Then assign groups if any selected
      if (userGroups.length > 0) {
        await Promise.all(
          userGroups.map(groupId =>
            assignGroupMutation.mutateAsync({ userId: createdUser.id, groupId })
          )
        );
      }
      
      setShowCreateModal(false);
      setNewUser({ email: "", firstName: "", lastName: "", username: "", password: "", role: "admin" });
      setUserGroups([]);
    } catch (error) {
      // Error handling is already done in the mutations
    }
  };

  const handleEditUser = (userData: UserWithGroups) => {
    // Utiliser directement les champs firstName et lastName s'ils existent ET ne sont pas null/undefined
    let firstName = userData.firstName && userData.firstName.trim() ? userData.firstName : '';
    let lastName = userData.lastName && userData.lastName.trim() ? userData.lastName : '';
    
    // Si pas de firstName/lastName mais qu'il y a un champ name, le diviser
    if (!firstName && !lastName && userData.name && userData.name.trim()) {
      const [firstPart = '', ...lastNameParts] = userData.name.trim().split(' ');
      firstName = firstPart;
      lastName = lastNameParts.join(' ');
    }
    
    // Si toujours pas de données, essayer d'extraire depuis username si c'est un nom complet
    if (!firstName && !lastName && userData.username && userData.username.includes(' ')) {
      const [firstPart = '', ...lastNameParts] = userData.username.trim().split(' ');
      firstName = firstPart;
      lastName = lastNameParts.join(' ');
    }
    
    const userWithNames = {
      ...userData,
      firstName,
      lastName
    };
    
    setSelectedUser(userWithNames);
    setEditForm({
      username: userData.username || "",
      firstName: firstName,
      lastName: lastName,
      email: userData.email || "",
      password: "",
      role: userData.role,
    });
    setShowEditModal(true);
  };

  const handleGroupManager = (userData: UserWithGroups) => {
    setSelectedUser(userData);
    setUserGroups(userData.userGroups.map(ug => ug.groupId));
    setShowGroupModal(true);
  };

  const handleSubmitEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    // Validation minimale : seul l'identifiant est obligatoire
    if (!editForm.username.trim()) {
      toast({
        title: "Erreur",
        description: "L'identifiant est obligatoire",
        variant: "destructive",
      });
      return;
    }

    const updates: any = {};
    
    // Toujours inclure l'identifiant (obligatoire)
    updates.username = editForm.username.trim();
    
    // Inclure les champs optionnels seulement s'ils sont remplis
    if (editForm.firstName && editForm.firstName.trim()) {
      updates.firstName = editForm.firstName.trim();
    }
    if (editForm.lastName && editForm.lastName.trim()) {
      updates.lastName = editForm.lastName.trim();
    }
    if (editForm.email && editForm.email.trim()) {
      updates.email = editForm.email.trim();
    }
    
    // Only include password if it's not empty
    if (editForm.password && editForm.password.trim()) {
      updates.password = editForm.password;
    }

    updateUserMutation.mutate({
      id: selectedUser.id,
      updates
    });
  };

  const handleRoleChange = (userId: string, newRoleName: string) => {
    if (userId === user?.id) {
      toast({
        title: "Erreur",
        description: "Vous ne pouvez pas modifier votre propre rôle",
        variant: "destructive",
      });
      return;
    }

    // Trouver l'ID du rôle basé sur le nom
    const role = safeRoles.find(r => r.name === newRoleName);
    if (!role) {
      toast({
        title: "Erreur",
        description: "Rôle non trouvé",
        variant: "destructive",
      });
      return;
    }

    // Préparer la confirmation et ouvrir le modal
    setPendingRoleChange({
      userId,
      newRoleName,
      newRoleDisplay: role.displayName || role.name
    });
    setShowRoleConfirmModal(true);
  }

  const confirmRoleChange = () => {
    if (!pendingRoleChange) return;
    
    const role = safeRoles.find(r => r.name === pendingRoleChange.newRoleName);
    if (role) {
      updateUserRoleMutation.mutate({ userId: pendingRoleChange.userId, roleId: role.id });
    }
    
    setShowRoleConfirmModal(false);
    setPendingRoleChange(null);
  }

  const cancelRoleChange = () => {
    setShowRoleConfirmModal(false);
    setPendingRoleChange(null);
  }

  // Gestion des rôles centralisée dans Administration > Gestion des Rôles

  const handleToggleGroup = (userId: string, groupId: number, isAssigned: boolean) => {
    if (isAssigned) {
      removeGroupMutation.mutate({ userId, groupId });
    } else {
      assignGroupMutation.mutate({ userId, groupId });
    }
  };

  const handleDeleteUser = (userToDelete: UserWithGroups) => {
    if (userToDelete.id === user?.id) {
      toast({
        title: "Erreur",
        description: "Vous ne pouvez pas supprimer votre propre compte",
        variant: "destructive",
      });
      return;
    }

    if (window.confirm(`Êtes-vous sûr de vouloir supprimer l'utilisateur ${userToDelete.username || userToDelete.firstName + ' ' + userToDelete.lastName} ? Cette action est irréversible.`)) {
      deleteUserMutation.mutate(userToDelete.id);
    }
  };

  const getInitials = (firstName?: string, lastName?: string, username?: string) => {
    // Priorité au username pour éviter initiales incorrectes
    if (username && username.trim().length >= 2) {
      return username.substring(0, 2).toUpperCase();
    }
    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase();
    }
    if (firstName) return firstName[0].toUpperCase();
    if (lastName) return lastName[0].toUpperCase();
    if (username) return username[0].toUpperCase();
    return "U";
  };

  // 🔧 FIX ADMIN - Toujours autoriser pour admin (contourner problème hasPermission)
  const isAdmin = user && (user as any).role === 'admin';
  const canManage = isAdmin; // Forcer true pour admin
  
  if (!canManage) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="text-center">
          <UserCog className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Accès restreint
          </h2>
          <p className="text-gray-600">
            Seuls les administrateurs peuvent accéder à la gestion des utilisateurs.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 flex items-center">
              <UserCog className="w-6 h-6 mr-3 text-blue-600" />
              Gestion des Utilisateurs
            </h2>
            <p className="text-gray-600 mt-1">
              {Array.isArray(filteredUsers) ? filteredUsers.length : 0} utilisateur{Array.isArray(filteredUsers) && filteredUsers.length !== 1 ? 's' : ''}
            </p>
          </div>
          
          <Button
            onClick={handleCreateUser}
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-md"
          >
            <Plus className="w-4 h-4 mr-2" />
            Créer un utilisateur
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-gray-50 border-b border-gray-200 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-64">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Rechercher un utilisateur..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 border border-gray-300 shadow-sm"
              />
            </div>
          </div>
          
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-48 border border-gray-300 shadow-sm">
              <SelectValue placeholder="Filtrer par rôle" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les rôles</SelectItem>
              <SelectItem value="admin">Administrateur</SelectItem>
              <SelectItem value="manager">Manager</SelectItem>
              <SelectItem value="employee">Employé</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Users List */}
      <div className="flex-1 overflow-auto">
        {usersLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : (!Array.isArray(filteredUsers) || filteredUsers.length === 0) ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <Users className="w-16 h-16 mb-4 text-gray-300" />
            <h3 className="text-lg font-medium mb-2">Aucun utilisateur trouvé</h3>
            <p className="text-center max-w-md">
              {searchTerm || roleFilter !== "all" 
                ? "Aucun utilisateur ne correspond à vos critères de recherche."
                : "Aucun utilisateur n'est encore enregistré dans le système."}
            </p>
          </div>
        ) : (
          <div className="p-6">
            <div className="bg-white border border-gray-200 shadow-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Utilisateur
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Rôle
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Groupes
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {Array.isArray(filteredUsers) && filteredUsers.map((userData) => (
                      <tr key={userData.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center mr-3">
                              {userData.profileImageUrl ? (
                                <img 
                                  src={userData.profileImageUrl} 
                                  alt="Profile" 
                                  className="w-full h-full rounded-full object-cover"
                                />
                              ) : (
                                <span className="text-white font-medium">
                                  {getInitials(userData.firstName, userData.lastName, userData.username)}
                                </span>
                              )}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900 flex items-center">
{(() => {
                                  // Priorité : username pour éviter "Employee Frouard" 
                                  if (userData.username && userData.username.trim()) {
                                    return userData.username;
                                  }
                                  if (userData.firstName && userData.lastName) {
                                    return `${userData.firstName} ${userData.lastName}`;
                                  }
                                  if (userData.firstName && userData.firstName.trim()) {
                                    return userData.firstName;
                                  }
                                  if (userData.lastName && userData.lastName.trim()) {
                                    return userData.lastName;
                                  }
                                  if (userData.name && userData.name.trim()) {
                                    return userData.name;
                                  }
                                  return userData.username || 'Utilisateur';
                                })()}
                                {userData.id === user?.id && (
                                  <Badge variant="outline" className="ml-2 text-xs">Vous</Badge>
                                )}
                              </div>
                              <div className="text-sm text-gray-500">
                                ID: {userData.id}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {userData.email || 'Non renseigné'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {/* 🎨 SYSTÈME DE RÔLES AVEC COULEURS CLAIRES */}
                            {Array.isArray(userData.userRoles) && userData.userRoles.length > 0 ? (
                              userData.userRoles.map((userRole, index) => {
                                const classes = getRoleTailwindClasses(userRole.role?.name || 'user');
                                const displayName = getRoleDisplayName(userRole.role?.name || 'user');
                                
                                return (
                                  <div key={userRole.roleId || index} className="flex items-center mr-2">
                                    <div className={`flex items-center px-2 py-1 rounded-md ${classes.badgeClass}`}>
                                      <span className="text-xs font-medium">{displayName}</span>
                                    </div>
                                  </div>
                                );
                              })
                            ) : Array.isArray(userData.roles) && userData.roles.length > 0 ? (
                              userData.roles.map((role, index) => {
                                const classes = getRoleTailwindClasses(role.name || 'user');
                                const displayName = getRoleDisplayName(role.name || 'user');
                                
                                return (
                                  <div key={role.id || index} className="flex items-center mr-2">
                                    <div className={`flex items-center px-2 py-1 rounded-md ${classes.badgeClass}`}>
                                      <span className="text-xs font-medium">{displayName}</span>
                                    </div>
                                  </div>
                                );
                              })
                            ) : (
                              // Fallback final si aucune donnée de rôle n'est disponible
                              (() => {
                                const classes = getRoleTailwindClasses(userData.role);
                                const displayName = getRoleDisplayName(userData.role);
                                
                                return (
                                  <div className="flex items-center">
                                    <div className={`flex items-center px-2 py-1 rounded-md ${classes.badgeClass}`}>
                                      <span className="text-xs font-medium">{displayName}</span>
                                    </div>
                                  </div>
                                );
                              })()
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-wrap gap-1">
                            {!Array.isArray(userData.userGroups) || userData.userGroups.length === 0 ? (
                              <span className="text-sm text-gray-500">Aucun groupe</span>
                            ) : (
                              userData.userGroups.map((userGroup) => (
                                <Badge 
                                  key={userGroup.groupId} 
                                  variant="outline" 
                                  className="text-xs"
                                >
                                  <div className="flex items-center">
                                    <div 
                                      className="w-2 h-2 rounded-full mr-1"
                                      style={{ backgroundColor: userGroup.group.color }}
                                    />
                                    {userGroup.group.name}
                                  </div>
                                </Badge>
                              ))
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end space-x-2">
                            {/* Sélecteur de rôle rapide */}
                            {userData.id !== user?.id && (
                              <Select
                                value={userData.userRoles?.[0]?.role?.name || userData.role || ''}
                                onValueChange={(newRole) => handleRoleChange(userData.id, newRole)}
                                disabled={updateUserRoleMutation.isPending}
                              >
                                <SelectTrigger className="w-28 h-8 text-xs border-purple-200 hover:border-purple-300">
                                  <SelectValue placeholder="Rôle" />
                                </SelectTrigger>
                                <SelectContent>
                                  {safeRoles.map((role) => (
                                    <SelectItem key={role.id} value={role.name}>
                                      <div className="flex items-center">
                                        <div 
                                          className="w-2 h-2 rounded-full mr-2"
                                          style={{ backgroundColor: role.color }}
                                        />
                                        {role.displayName || role.name}
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditUser(userData)}
                              title="Modifier l'utilisateur"
                              className="text-blue-600 hover:text-blue-700 border-blue-200 hover:border-blue-300 hover:bg-blue-50"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleGroupManager(userData)}
                              title="Gérer les magasins/groupes"
                              className="text-green-600 hover:text-green-700 border-green-200 hover:border-green-300 hover:bg-green-50"
                            >
                              <UserCog className="w-4 h-4 mr-1" />
                              <span className="text-xs">Groupes</span>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteUser(userData)}
                              disabled={userData.id === user?.id || deleteUserMutation.isPending}
                              className="text-red-600 hover:text-red-700 border-red-200 hover:border-red-300 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Edit User Modal */}
      {showEditModal && selectedUser && (
        <Dialog open={showEditModal} onOpenChange={() => {
          setShowEditModal(false);
          setSelectedUser(null);
        }}>
          <DialogContent className="sm:max-w-lg" aria-describedby="edit-user-modal-description">
            <DialogHeader>
              <DialogTitle className="text-xl font-medium">
                Modifier l'utilisateur
              </DialogTitle>
              <p id="edit-user-modal-description" className="text-sm text-gray-600 mt-1">
                Modifier les informations de l'utilisateur {selectedUser.username || selectedUser.name || selectedUser.firstName + ' ' + selectedUser.lastName}
              </p>
            </DialogHeader>
            
            <form onSubmit={handleSubmitEdit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-firstName">Prénom</Label>
                  <Input
                    key={`firstName-${selectedUser?.id}-${editForm.firstName}`}
                    id="edit-firstName"
                    value={editForm.firstName || ''}
                    onChange={(e) => setEditForm({...editForm, firstName: e.target.value})}
                    placeholder="Prénom"
                    onFocus={() => console.log('📝 firstName field focus - current value:', editForm.firstName)}
                  />
                  <p className="text-xs text-gray-500 mt-1">Debug: "{editForm.firstName}"</p>
                </div>
                <div>
                  <Label htmlFor="edit-lastName">Nom</Label>
                  <Input
                    key={`lastName-${selectedUser?.id}-${editForm.lastName}`}
                    id="edit-lastName"
                    value={editForm.lastName || ''}
                    onChange={(e) => setEditForm({...editForm, lastName: e.target.value})}
                    placeholder="Nom"
                    onFocus={() => console.log('📝 lastName field focus - current value:', editForm.lastName)}
                  />
                  <p className="text-xs text-gray-500 mt-1">Debug: "{editForm.lastName}"</p>
                </div>
              </div>

              <div>
                <Label htmlFor="edit-username">Identifiant *</Label>
                <Input
                  id="edit-username"
                  value={editForm.username}
                  onChange={(e) => setEditForm({...editForm, username: e.target.value})}
                  placeholder="Identifiant de connexion"
                  required
                />
              </div>

              <div>
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                  placeholder="email@exemple.com"
                />
              </div>

              <div>
                <Label htmlFor="edit-password">Nouveau mot de passe (optionnel)</Label>
                <Input
                  id="edit-password"
                  type="password"
                  value={editForm.password}
                  onChange={(e) => setEditForm({...editForm, password: e.target.value})}
                  placeholder="Laisser vide pour ne pas changer"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Minimum 4 caractères. Laissez vide pour conserver le mot de passe actuel.
                </p>
              </div>

              {/* Gestion des rôles déplacée dans Administration > Gestion des Rôles */}
              <div>
                <Label>Rôle actuel</Label>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium">{selectedUser?.role || 'N/A'}</span>
                  <p className="text-xs text-gray-500 mt-1">
                    Pour modifier le rôle, utilisez Administration → Gestion des Rôles
                  </p>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button 
                  type="button"
                  variant="outline" 
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedUser(null);
                  }}
                >
                  Annuler
                </Button>
                <Button 
                  type="submit"
                  disabled={updateUserMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {updateUserMutation.isPending ? "Mise à jour..." : "Mettre à jour"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Group Management Modal */}
      {showGroupModal && selectedUser && (
        <Dialog open={showGroupModal} onOpenChange={() => {
          setShowGroupModal(false);
          setSelectedUser(null);
          setUserGroups([]);
        }}>
          <DialogContent className="sm:max-w-lg" aria-describedby="group-modal-description">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold">
                Gérer les Magasins/Groupes - {selectedUser.username || selectedUser.name || `${selectedUser.firstName} ${selectedUser.lastName}`}
              </DialogTitle>
              <p id="group-modal-description" className="text-sm text-gray-600 mt-1">
                Assigner ou retirer cet utilisateur des magasins/groupes
              </p>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label>Groupes disponibles</Label>
                <div className="space-y-2 mt-2">
                  {groups.map((group) => {
                    const isAssigned = selectedUser.userGroups.some(ug => ug.groupId === group.id);
                    return (
                      <div key={group.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div 
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: group.color }}
                          />
                          <span className="text-sm font-medium">{group.name}</span>
                        </div>
                        <Button
                          variant={isAssigned ? "destructive" : "outline"}
                          size="sm"
                          onClick={() => handleToggleGroup(selectedUser.id, group.id, isAssigned)}
                          disabled={assignGroupMutation.isPending || removeGroupMutation.isPending}
                        >
                          {isAssigned ? 'Retirer' : 'Assigner'}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center space-x-3 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowGroupModal(false);
                    setSelectedUser(null);
                    setUserGroups([]);
                  }}
                >
                  Fermer
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Create User Modal */}
      {showCreateModal && (
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent className="max-w-md" aria-describedby="create-user-modal-description">
            <DialogHeader>
              <DialogTitle className="flex items-center">
                <Plus className="w-5 h-5 mr-2" />
                Créer un nouvel utilisateur
              </DialogTitle>
              <p id="create-user-modal-description" className="text-sm text-gray-600 mt-1">
                Créer un nouveau compte utilisateur avec ses permissions
              </p>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="identifier">Identifiant *</Label>
                <Input
                  id="identifier"
                  value={newUser.username || ''}
                  onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                  placeholder="Identifiant unique (ex: ff0292)"
                  required
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Identifiant unique pour se connecter à l'application
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">Prénom</Label>
                  <Input
                    id="firstName"
                    value={newUser.firstName || ''}
                    onChange={(e) => setNewUser({...newUser, firstName: e.target.value})}
                    placeholder="Prénom (optionnel)"
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Nom</Label>
                  <Input
                    id="lastName"
                    value={newUser.lastName || ''}
                    onChange={(e) => setNewUser({...newUser, lastName: e.target.value})}
                    placeholder="Nom (optionnel)"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={newUser.email || ''}
                  onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                  placeholder="email@exemple.com (optionnel)"
                />
              </div>

              <div>
                <Label htmlFor="password">Mot de passe *</Label>
                <Input
                  id="password"
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                  placeholder="••••••••"
                  required
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Mot de passe pour se connecter à l'application
                </p>
              </div>

              <div>
                <Label htmlFor="role">Rôle</Label>
                <Select 
                  value={newUser.role} 
                  onValueChange={(value) => 
                    setNewUser({...newUser, role: value})
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {safeRoles.map((role) => (
                      <SelectItem key={role.id} value={role.name}>
                        <div className="flex items-center">
                          <div 
                            className="w-2 h-2 rounded-full mr-2"
                            style={{ backgroundColor: role.color }}
                          />
                          {role.displayName || role.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Magasins assignés</Label>
                <div className="space-y-2 mt-2 max-h-40 overflow-y-auto">
                  {groups.map((group) => (
                    <div key={group.id} className="flex items-center space-x-3">
                      <Checkbox
                        id={`group-${group.id}`}
                        checked={userGroups.includes(group.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setUserGroups([...userGroups, group.id]);
                          } else {
                            setUserGroups(userGroups.filter(id => id !== group.id));
                          }
                        }}
                      />
                      <div className="flex items-center space-x-2">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: group.color }}
                        />
                        <Label htmlFor={`group-${group.id}`} className="text-sm">
                          {group.name}
                        </Label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center space-x-3 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewUser({ email: "", firstName: "", lastName: "", username: "", password: "", role: "admin" });
                    setUserGroups([]);
                  }}
                >
                  Annuler
                </Button>
                <Button 
                  onClick={handleSubmitCreateUser}
                  disabled={createUserMutation.isPending}
                  className="flex-1"
                >
                  {createUserMutation.isPending ? "Création..." : "Créer l'utilisateur"}
                </Button>
              </div>

            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Role Change Confirmation Modal */}
      {showRoleConfirmModal && pendingRoleChange && (
        <Dialog open={showRoleConfirmModal} onOpenChange={cancelRoleChange}>
          <DialogContent className="sm:max-w-md" aria-describedby="role-change-modal-description">
            <DialogHeader>
              <DialogTitle className="text-xl font-medium flex items-center">
                <Shield className="w-5 h-5 mr-2 text-orange-500" />
                Confirmer le changement de rôle
              </DialogTitle>
              <p id="role-change-modal-description" className="text-sm text-gray-600 mt-2">
                Cette action modifiera les permissions de l'utilisateur dans l'application.
              </p>
            </DialogHeader>
            
            <div className="py-4">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
                <div className="flex items-center mb-2">
                  <Shield className="w-4 h-4 mr-2 text-orange-600" />
                  <span className="text-sm font-medium text-orange-800">Attention</span>
                </div>
                <p className="text-sm text-orange-700">
                  Vous êtes sur le point de changer le rôle de cet utilisateur vers{" "}
                  <span className="font-semibold">{pendingRoleChange.newRoleDisplay}</span>.
                  Cette action prendra effet immédiatement.
                </p>
              </div>
              
              <p className="text-sm text-gray-600 mb-4">
                Êtes-vous sûr de vouloir continuer ?
              </p>
            </div>

            <div className="flex items-center justify-end space-x-3">
              <Button
                variant="outline"
                onClick={cancelRoleChange}
                disabled={updateUserRoleMutation.isPending}
              >
                Annuler
              </Button>
              <Button
                onClick={confirmRoleChange}
                disabled={updateUserRoleMutation.isPending}
                className="bg-orange-600 hover:bg-orange-700 text-white"
              >
                {updateUserRoleMutation.isPending ? "Modification..." : "Confirmer"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
