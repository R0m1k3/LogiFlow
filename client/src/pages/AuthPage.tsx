import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuthUnified } from "@/hooks/useAuthUnified";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Store, LogIn, User, Info } from "lucide-react";
import { useLocation } from "wouter";

// Fonction pour détecter l'environnement
const getEnvironment = () => {
  const hostname = window.location.hostname;
  const isDev = hostname.includes('replit.dev') || hostname === 'localhost';
  return isDev ? 'development' : 'production';
};

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const { user, isLoading, refreshAuth, forceAuthRefresh, isAuthenticated } = useAuthUnified();
  const { toast } = useToast();
  const [showDefaultCredentials, setShowDefaultCredentials] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [loginData, setLoginData] = useState({
    username: "",
    password: "",
  });
  
  const currentEnvironment = getEnvironment();

  // Check if admin user still has default password
  const { data: defaultCredentialsCheck } = useQuery({
    queryKey: ['/api/default-credentials-check'],
    queryFn: async () => {
      try {
        const response = await apiRequest("/api/default-credentials-check", "GET");
        return response;
      } catch (error) {
        // If the endpoint doesn't exist or fails, assume we should show credentials
        return { showDefault: true };
      }
    },
  });

  // Fonction de login simple pour production
  const handleProductionLogin = async (data: typeof loginData) => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(data),
      });

      if (response.ok) {
        toast({
          title: "Connexion réussie",
          description: "Redirection en cours...",
        });
        
        // En production, recharger la page pour éviter les problèmes de synchronisation
        setTimeout(() => {
          window.location.href = "/";
        }, 500);
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast({
          title: "Erreur de connexion",
          description: errorData.message || "Identifiant ou mot de passe incorrect",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Erreur de connexion",
        description: error.message || "Une erreur est survenue",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Mutation complexe pour développement
  const loginMutation = useMutation({
    mutationFn: async (data: typeof loginData) => {
      const response = await apiRequest("/api/login", "POST", data);
      return response;
    },
    onSuccess: async (loginResult) => {
      console.log('✅ Login successful, refreshing auth state...');
      
      toast({
        title: "Connexion réussie",
        description: "Bienvenue dans LogiFlow",
      });
      
      // Force invalidation of auth queries and refresh auth state
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      queryClient.invalidateQueries({ queryKey: ['/api/default-credentials-check'] });
      
      // Force immediate authentication state refresh
      const refreshedUserData = await forceAuthRefresh();
      console.log('🔄 Force auth refresh result:', refreshedUserData);
      
      if (refreshedUserData && refreshedUserData.id) {
        console.log('🔄 User data confirmed, forcing redirect...');
        setLocation("/");
      } else {
        setTimeout(() => {
          forceAuthRefresh().then((retryUserData) => {
            if (retryUserData && retryUserData.id) {
              setLocation("/");
            }
          });
        }, 500);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Erreur de connexion",
        description: error.message || "Identifiant ou mot de passe incorrect",
        variant: "destructive",
      });
    },
  });

  // Debug logging for authentication state
  console.log('🔍 AuthPage Debug:', {
    isAuthenticated,
    isLoading,
    userId: user?.id,
    username: user?.username
  });

  useEffect(() => {
    if (defaultCredentialsCheck) {
      setShowDefaultCredentials(defaultCredentialsCheck.showDefault);
    }
  }, [defaultCredentialsCheck]);

  // Redirect if already authenticated
  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      console.log('🔄 User authenticated, redirecting to dashboard...', { user: user.username, authenticated: isAuthenticated });
      // Force immediate redirect to home page
      setLocation("/");
    }
  }, [isLoading, isAuthenticated, user, setLocation]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (currentEnvironment === 'production') {
      // Utiliser la méthode simple pour production
      handleProductionLogin(loginData);
    } else {
      // Utiliser React Query pour développement
      loginMutation.mutate(loginData);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Left side - Auth forms */}
      <div className="flex-1 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-primary rounded-lg flex items-center justify-center">
                <Store className="w-8 h-8 text-white" />
              </div>
            </div>
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
              LogiFlow
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Gestion des commandes et livraisons
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LogIn className="w-5 h-5" />
                Connexion
              </CardTitle>
              <CardDescription>
                Connectez-vous à votre compte LogiFlow
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <Label htmlFor="login-username">Identifiant</Label>
                  <Input
                    id="login-username"
                    type="text"
                    value={loginData.username}
                    onChange={(e) => setLoginData({...loginData, username: e.target.value})}
                    required
                    placeholder="Votre identifiant"
                  />
                </div>
                <div>
                  <Label htmlFor="login-password">Mot de passe</Label>
                  <Input
                    id="login-password"
                    type="password"
                    value={loginData.password}
                    onChange={(e) => setLoginData({...loginData, password: e.target.value})}
                    required
                    placeholder="••••••••"
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={currentEnvironment === 'production' ? isSubmitting : loginMutation.isPending}
                >
                  {(currentEnvironment === 'production' ? isSubmitting : loginMutation.isPending) ? "Connexion..." : "Se connecter"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Default credentials info - only show if admin password hasn't been changed */}
          {showDefaultCredentials && (
            <Card className="mt-4 bg-blue-50 border-blue-200">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-blue-800 text-sm">
                  <Info className="w-4 h-4" />
                  Première connexion
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-sm text-blue-700 space-y-1">
                  <p><strong>Identifiant :</strong> admin</p>
                  <p><strong>Mot de passe :</strong> admin</p>
                  <p className="text-xs text-blue-600 mt-2">
                    Changez le mot de passe après votre première connexion
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Right side - Hero section */}
      <div className="hidden lg:block relative w-0 flex-1">
        <div className="absolute inset-0 bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
          <div className="text-center text-white max-w-md">
            <Store className="w-20 h-20 mx-auto mb-6 opacity-90" />
            <h1 className="text-4xl font-bold mb-4">
              Gérez vos commandes efficacement
            </h1>
            <p className="text-xl opacity-90 mb-8">
              LogiFlow centralise la gestion de vos commandes et livraisons across tous vos magasins
            </p>
            <div className="space-y-4 text-left">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-white rounded-full"></div>
                <span>Calendrier centralisé</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-white rounded-full"></div>
                <span>Gestion multi-magasins</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-white rounded-full"></div>
                <span>Suivi en temps réel</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}