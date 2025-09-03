import { Link, useLocation } from "wouter";
import { useAuthSimple } from "@/hooks/useAuthSimple";
import { Button } from "@/components/ui/button";
import { useStore } from "./Layout";
import { useIsMobile } from "@/hooks/use-mobile";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Store, 
  Calendar, 
  BarChart3, 
  Package, 
  Truck, 
  Building, 
  Users, 
  UserCog, 
  LogOut,
  FileText,
  Megaphone,
  Database,
  ShoppingCart,
  Clock,
  ListTodo,
  ChevronLeft,
  ChevronRight,
  X,
  Settings,
  Wrench,
  FileUp,
  Send
} from "lucide-react";

export default function Sidebar() {
  const { user, isLoading, error } = useAuthSimple();
  const [location] = useLocation();
  const { sidebarCollapsed, setSidebarCollapsed, mobileMenuOpen, setMobileMenuOpen } = useStore();
  const isMobile = useIsMobile();
  const [showBapModal, setShowBapModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedRecipient, setSelectedRecipient] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [showWaitingModal, setShowWaitingModal] = useState(false);
  const [processingSeconds, setProcessingSeconds] = useState(0);
  const [processingTimeout, setProcessingTimeout] = useState<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
    } else {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner un fichier PDF",
        variant: "destructive",
      });
    }
  };

  const startProcessingTimer = () => {
    setProcessingSeconds(0);
    const interval = setInterval(() => {
      setProcessingSeconds(prev => {
        if (prev >= 60) {
          clearInterval(interval);
          return 60;
        }
        return prev + 1;
      });
    }, 1000);
    setProcessingTimeout(interval);
  };

  const handleCloseWaitingModal = () => {
    setShowWaitingModal(false);
    setProcessingSeconds(0);
    if (processingTimeout) {
      clearTimeout(processingTimeout);
      setProcessingTimeout(null);
    }
  };

  const handleSendBap = async () => {
    if (!selectedFile || !selectedRecipient) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner un fichier PDF et un destinataire",
        variant: "destructive",
      });
      return;
    }

    // Récupérer l'URL webhook configurée
    let webhookUrl = '';
    try {
      const configResponse = await fetch('/api/webhook-bap-config', {
        credentials: 'include'
      });
      
      if (configResponse.ok) {
        const config = await configResponse.json();
        webhookUrl = config?.webhookUrl;
      }
    } catch (error) {
      console.warn('Impossible de récupérer la config webhook, utilisation URL par défaut');
    }

    // Utiliser une URL par défaut si pas de configuration
    if (!webhookUrl) {
      webhookUrl = "https://workflow.ffnancy.fr/webhook/a3d03176-b72f-412d-8fb9-f920b9fbab4d";
    }

    // Fermer le modal de sélection et ouvrir le modal d'attente
    setShowBapModal(false);
    setShowWaitingModal(true);
    setIsUploading(true);
    startProcessingTimer();

    try {
      // Utiliser FormData comme le système de rapprochement qui fonctionne
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('recipient', selectedRecipient);
      formData.append('type', 'BAP');
      formData.append('fileName', selectedFile.name);

      // Créer un AbortController pour gérer le timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 secondes

      // Envoyer directement au webhook (comme le rapprochement)
      const response = await fetch(webhookUrl, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Erreur ${response.status}: ${response.statusText}`);
      }
      
      handleCloseWaitingModal();
      
      toast({
        title: "Succès",
        description: "Fichier BAP envoyé avec succès",
      });

      // Reset des données
      setSelectedFile(null);
      setSelectedRecipient('');
      
    } catch (error: any) {
      handleCloseWaitingModal();
      
      let errorMessage = "Impossible d'envoyer le fichier BAP";
      if (error.name === 'AbortError') {
        errorMessage = "Le traitement a pris trop de temps (timeout de 60 secondes)";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive",
      });
      
      // Réouvrir le modal de sélection en cas d'erreur
      setShowBapModal(true);
    } finally {
      setIsUploading(false);
    }
  };

  // Debug logging pour production
  console.log('Sidebar - User:', user);
  console.log('Sidebar - isLoading:', isLoading);
  console.log('Sidebar - error:', error);

  const handleLogout = async () => {
    try {
      // Force logout via fetch to ensure session is destroyed
      await fetch('/api/logout', { 
        method: 'POST',
        credentials: 'include'
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Force redirect to auth page regardless of API response
      window.location.href = "/auth";
    }
  };

  const toggleSidebar = () => {
    const newCollapsed = !sidebarCollapsed;
    console.log('🔧 Sidebar - Toggling sidebar:', { from: sidebarCollapsed, to: newCollapsed });
    setSidebarCollapsed(newCollapsed);
    try {
      localStorage.setItem('sidebarCollapsed', JSON.stringify(newCollapsed));
      console.log('💾 Sidebar state saved to localStorage:', newCollapsed);
    } catch (error) {
      console.error('Error saving sidebar state:', error);
    }
  };

  const getInitials = (firstName?: string, lastName?: string) => {
    if (!firstName && !lastName) return "U";
    return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();
  };

  const isActive = (path: string) => {
    if (path === "/" && location === "/") return true;
    if (path !== "/" && location.startsWith(path)) return true;
    return false;
  };

  const menuItems = [
    { 
      path: "/dashboard", 
      label: "Tableau de bord", 
      icon: BarChart3, 
      roles: ["admin", "directeur", "manager", "employee"] 
    },
    { 
      path: "/calendar", 
      label: "Calendrier", 
      icon: Calendar, 
      roles: ["admin", "directeur", "manager", "employee"] 
    },
    { 
      path: "/orders", 
      label: "Commandes", 
      icon: Package, 
      roles: ["admin", "directeur", "manager"] 
    },
    { 
      path: "/deliveries", 
      label: "Livraisons", 
      icon: Truck, 
      roles: ["admin", "directeur", "manager"] 
    },
    { 
      path: "/bl-reconciliation", 
      label: "Rapprochement", 
      icon: FileText, 
      roles: ["admin", "directeur"] 
    },
    { 
      path: "/publicities", 
      label: "Publicités", 
      icon: Megaphone, 
      roles: ["admin", "directeur", "manager", "employee"] 
    },
    { 
      path: "/customer-orders", 
      label: "Commandes Client", 
      icon: ShoppingCart, 
      roles: ["admin", "directeur", "manager", "employee"] 
    },
    { 
      path: "/dlc", 
      label: "Gestion DLC", 
      icon: Clock, 
      roles: ["admin", "directeur", "manager", "employee"] 
    },
    { 
      path: "/tasks", 
      label: "Tâches", 
      icon: ListTodo, 
      roles: ["admin", "directeur", "manager", "employee"] 
    },
    { 
      path: "/sav", 
      label: "SAV", 
      icon: Wrench, 
      roles: ["admin", "directeur", "manager", "employee"] 
    },
  ];

  const adminItems = [
    { 
      path: "/users", 
      label: "Utilisateurs", 
      icon: UserCog, 
      roles: ["admin"] 
    },
    { 
      path: "/suppliers", 
      label: "Fournisseurs", 
      icon: Building, 
      roles: ["admin"] 
    },
    { 
      path: "/groups", 
      label: "Magasins", 
      icon: Users, 
      roles: ["admin"] 
    },
    { 
      path: "/utilities", 
      label: "Utilitaires", 
      icon: Settings, 
      roles: ["admin"] 
    },
    { 
      path: "#bap", 
      label: "BAP", 
      icon: FileUp, 
      roles: ["admin"],
      isButton: true
    },
  ];

  const hasPermission = (roles: string[]) => {
    const hasRole = user?.role && roles.includes(user.role);
    // Debug uniquement en développement pour éviter spam console
    if (import.meta.env.MODE === 'development') {
      console.log('hasPermission check:', { userRole: user?.role, roles, hasRole });
    }
    return hasRole;
  };



  // Classes responsives pour la sidebar avec classes CSS forcées pour cohérence
  const sidebarClasses = isMobile 
    ? `fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 shadow-lg transform transition-transform duration-300 ease-in-out ${
        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      }`
    : `${sidebarCollapsed ? 'sidebar-collapsed' : 'sidebar-expanded'} bg-white border-r border-gray-200 flex flex-col shadow-lg transition-all duration-300 ease-in-out`;
  
  // Debug log pour vérifier l'état de la sidebar
  console.log('🔧 Sidebar Debug:', { 
    isMobile, 
    sidebarCollapsed, 
    mobileMenuOpen, 
    width: sidebarCollapsed ? 'collapsed (64px)' : 'expanded (256px)',
    classes: sidebarClasses
  });

  // Si l'utilisateur n'est pas encore chargé, afficher un état de chargement
  if (isLoading) {
    return (
      <aside className={sidebarClasses}>
        <div className="h-16 flex items-center justify-between border-b border-gray-200 bg-white px-3">
          {/* Mobile close button */}
          {isMobile ? (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center space-x-3">
                <Store className="h-6 w-6 text-blue-600" />
                <span className="text-lg font-semibold text-gray-900">LogiFlow</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMobileMenuOpen(false)}
                className="h-8 w-8 p-0 hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <>
              {!sidebarCollapsed && (
                <div className="flex items-center space-x-3">
                  <Store className="h-6 w-6 text-blue-600" />
                  <span className="text-lg font-semibold text-gray-900">LogiFlow</span>
                </div>
              )}
              {sidebarCollapsed && (
                <div className="flex items-center justify-center w-full">
                  <Store className="h-6 w-6 text-blue-600" />
                </div>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleSidebar}
                className="h-8 w-8 p-0 hover:bg-gray-100"
              >
                {sidebarCollapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )}
              </Button>
            </>
          )}
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </aside>
    );
  }

  // Si l'utilisateur n'est pas authentifié, afficher seulement le logo
  if (!user) {
    return (
      <aside className={sidebarClasses}>
        <div className="h-16 flex items-center justify-between border-b border-gray-200 bg-white px-3">
          {/* Mobile close button */}
          {isMobile ? (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center space-x-3">
                <Store className="h-6 w-6 text-blue-600" />
                <span className="text-lg font-semibold text-gray-900">LogiFlow</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMobileMenuOpen(false)}
                className="h-8 w-8 p-0 hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <>
              {!sidebarCollapsed && (
                <div className="flex items-center space-x-3">
                  <Store className="h-6 w-6 text-blue-600" />
                  <span className="text-lg font-semibold text-gray-900">LogiFlow</span>
                </div>
              )}
              {sidebarCollapsed && (
                <div className="flex items-center justify-center w-full">
                  <Store className="h-6 w-6 text-blue-600" />
                </div>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleSidebar}
                className="h-8 w-8 p-0 hover:bg-gray-100"
              >
                {sidebarCollapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )}
              </Button>
            </>
          )}
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-500">
            {!sidebarCollapsed && <p>Authentification requise</p>}
          </div>
        </div>
      </aside>
    );
  }

  const handleMenuClick = () => {
    if (isMobile) {
      setMobileMenuOpen(false);
    }
  };

  return (
    <aside className={sidebarClasses}>
      {/* Logo et bouton de collapse */}
      <div className="h-16 flex items-center justify-between border-b border-gray-200 bg-white px-3">
        {/* Mobile close button */}
        {isMobile ? (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center space-x-3">
              <Store className="h-6 w-6 text-blue-600" />
              <span className="text-lg font-semibold text-gray-900">LogiFlow</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileMenuOpen(false)}
              className="h-8 w-8 p-0 hover:bg-gray-100"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <>
            {!sidebarCollapsed && (
              <div className="flex items-center space-x-3">
                <Store className="h-6 w-6 text-blue-600" />
                <span className="text-lg font-semibold text-gray-900">LogiFlow</span>
              </div>
            )}
            {sidebarCollapsed && (
              <div className="flex items-center justify-center w-full">
                <Store className="h-6 w-6 text-blue-600" />
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSidebar}
              className="h-8 w-8 p-0 hover:bg-gray-100"
            >
              {sidebarCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
          </>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3">
        <div className="space-y-1">
          {menuItems.map((item) => {
            const hasRolePermission = hasPermission(item.roles);
            // console.log(`🔍 Menu item ${item.path} (${item.label}):`, { 
            //   roles: item.roles, 
            //   hasPermission: hasRolePermission,
            //   userRole: user?.role 
            // });
            
            if (!hasRolePermission) return null;
            
            const Icon = item.icon;
            const active = isActive(item.path);
            
            return (
              <Link key={item.path} href={item.path}>
                <div
                  className={`flex items-center ${sidebarCollapsed && !isMobile ? 'px-3 py-3 justify-center' : 'px-3 py-2'} text-sm font-medium transition-colors hover:bg-gray-100 ${
                    active
                      ? 'bg-gray-100 text-gray-900 border-r-2 border-gray-700'
                      : 'text-gray-700'
                  }`}
                  title={sidebarCollapsed && !isMobile ? item.label : undefined}
                  onClick={handleMenuClick}
                >
                  <Icon className={`h-4 w-4 ${sidebarCollapsed && !isMobile ? '' : 'mr-3'}`} />
                  {(!sidebarCollapsed || isMobile) && item.label}
                </div>
              </Link>
            );
          })}
        </div>


      </nav>

      {/* Administration Section */}
      {adminItems.some(item => hasPermission(item.roles)) && (
        <div className="border-t border-gray-200 py-4 px-3">
          {!sidebarCollapsed && (
            <div className="mb-2">
              <h3 className="px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                Administration
              </h3>
            </div>
          )}
          <div className="space-y-1">
            {adminItems.map((item) => {
              if (!hasPermission(item.roles)) return null;
              
              const Icon = item.icon;
              const active = isActive(item.path);
              
              if (item.isButton && item.path === '#bap') {
                return (
                  <div key={item.path}>
                    <div
                      className={`flex items-center cursor-pointer ${sidebarCollapsed ? 'px-3 py-3 justify-center' : 'px-3 py-2'} text-sm font-medium transition-colors hover:bg-gray-100 text-gray-700`}
                      title={sidebarCollapsed ? item.label : undefined}
                      onClick={() => {
                        setShowBapModal(true);
                        if (isMobile) setMobileMenuOpen(false);
                      }}
                    >
                      <Icon className={`h-4 w-4 ${sidebarCollapsed ? '' : 'mr-3'}`} />
                      {!sidebarCollapsed && item.label}
                    </div>
                  </div>
                );
              }
              
              return (
                <Link key={item.path} href={item.path}>
                  <div
                    className={`flex items-center ${sidebarCollapsed ? 'px-3 py-3 justify-center' : 'px-3 py-2'} text-sm font-medium transition-colors hover:bg-gray-100 ${
                      active
                        ? 'bg-gray-100 text-gray-900 border-r-2 border-gray-700'
                        : 'text-gray-700'
                    }`}
                    title={sidebarCollapsed ? item.label : undefined}
                    onClick={() => console.log(`Navigating to admin: ${item.path}`)}
                  >
                    <Icon className={`h-4 w-4 ${sidebarCollapsed ? '' : 'mr-3'}`} />
                    {!sidebarCollapsed && item.label}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal BAP */}
      <Dialog open={showBapModal} onOpenChange={setShowBapModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileUp className="h-5 w-5" />
              Envoi BAP
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="pdf-upload">Fichier PDF</Label>
              <Input
                id="pdf-upload"
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="recipient">Envoyer à</Label>
              <Select value={selectedRecipient} onValueChange={setSelectedRecipient}>
                <SelectTrigger id="recipient" className="mt-1">
                  <SelectValue placeholder="Sélectionner un destinataire" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Prissela">Prissela</SelectItem>
                  <SelectItem value="Célia">Célia</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowBapModal(false)}>
                Annuler
              </Button>
              <Button 
                onClick={handleSendBap}
                disabled={!selectedFile || !selectedRecipient || isUploading}
                className="flex items-center gap-2"
              >
                <Send className="h-4 w-4" />
                {isUploading ? 'Envoi...' : 'Envoyer'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal d'attente */}
      <Dialog open={showWaitingModal} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Traitement en cours...
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-center">
            <div className="flex flex-col items-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <div className="text-sm text-gray-600">
                Envoi du fichier vers le workflow...
              </div>
              <div className="text-xs text-gray-500">
                {processingSeconds < 60 
                  ? `${processingSeconds}s écoulées`
                  : '60s+ écoulées'
                }
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* User Profile & Logout */}
      <div className="border-t border-gray-200 p-4">
        {!sidebarCollapsed ? (
          <>
            <div className="flex items-center space-x-3 mb-3">
              <div className="h-8 w-8 bg-gray-100 flex items-center justify-center">
                <span className="text-xs font-medium text-gray-700">
                  {getInitials(user?.firstName, user?.lastName)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user?.firstName || user?.lastName ? `${user?.firstName || ''} ${user?.lastName || ''}`.trim() : user?.username}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {user?.role === 'admin' ? 'Administrateur' : 
                   user?.role === 'manager' ? 'Manager' : 
                   user?.role === 'directeur' ? 'Directeur' : 'Employé'}
                </p>
              </div>
            </div>
            <Button 
              onClick={handleLogout}
              variant="ghost"
              size="sm"
              className="w-full justify-start text-gray-700 hover:text-gray-900 hover:bg-gray-100"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Déconnexion
            </Button>
          </>
        ) : (
          <div className="flex flex-col items-center space-y-3">
            <div className="h-8 w-8 bg-gray-100 flex items-center justify-center">
              <span className="text-xs font-medium text-gray-700">
                {getInitials(user?.firstName, user?.lastName)}
              </span>
            </div>
            <Button 
              onClick={handleLogout}
              variant="ghost"
              size="sm"
              className="w-8 h-8 p-0 text-gray-700 hover:text-gray-900 hover:bg-gray-100"
              title="Déconnexion"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </aside>
  );
}
