import { useState, useEffect } from 'react';
import { useQuery } from "@tanstack/react-query";

// Hook d'authentification unifié qui s'adapte automatiquement
// En production utilise fetch direct, en développement utilise React Query
export function useAuthUnified() {
  // Détection d'environnement plus robuste
  const isDevelopment = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || 
     window.location.hostname.includes('replit.dev')) &&
     import.meta.env.DEV === true;

  // Debug logging pour comprendre l'environnement
  console.log('🔍 Auth Environment Debug:', {
    hostname: typeof window !== 'undefined' ? window.location.hostname : 'N/A',
    isDev: import.meta.env.DEV,
    environment: isDevelopment ? 'development' : 'production'
  });

  // État pour la version production (fetch direct)
  const [productionUser, setProductionUser] = useState<any>(null);
  const [productionLoading, setProductionLoading] = useState(true);
  const [productionError, setProductionError] = useState<any>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Hook React Query pour le développement
  const developmentQuery = useQuery({
    queryKey: ["/api/user"],
    retry: (failureCount, error: any) => {
      if (error?.message?.includes('401') || error?.message?.includes('Unauthorized')) {
        return false;
      }
      return failureCount < 2;
    },
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchOnReconnect: false,
    staleTime: 10 * 60 * 1000, // 10 minutes de cache pour l'auth
    gcTime: 15 * 60 * 1000, // 15 minutes
    enabled: isDevelopment, // Seulement en développement
  });

  // Fonction pour rafraîchir l'authentification
  const refreshAuth = () => {
    console.log('🔄 RefreshAuth called, isDevelopment:', isDevelopment);
    if (!isDevelopment) {
      console.log('🔄 Triggering production auth refresh');
      setRefreshTrigger(prev => {
        const newValue = prev + 1;
        console.log('🔄 Production refresh trigger updated:', prev, '->', newValue);
        return newValue;
      });
    } else {
      console.log('🔄 Development mode - using React Query refresh');
      developmentQuery.refetch();
    }
  };

  // Fonction pour rafraîchir de manière synchrone (pour après login)
  const forceAuthRefresh = async () => {
    console.log('🔄 ForceAuthRefresh called, isDevelopment:', isDevelopment);
    
    if (!isDevelopment) {
      // En production, faire un fetch immédiat et forcer un re-render
      try {
        console.log('🔄 Production force refresh - fetching user data');
        setProductionLoading(true);
        
        const response = await fetch('/api/user', {
          credentials: 'include',
          cache: 'no-cache',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          const userData = await response.json();
          console.log('✅ Production force refresh success:', { username: userData?.username, id: userData?.id });
          setProductionUser(userData);
          setProductionError(null);
          setProductionLoading(false);
          
          // Forcer un trigger de refresh pour déclencher les re-renders
          setRefreshTrigger(prev => prev + 1);
          
          return userData;
        } else {
          console.log('❌ Production force refresh failed:', response.status);
          setProductionUser(null);
          setProductionError(null);
          setProductionLoading(false);
          return null;
        }
      } catch (error) {
        console.error('❌ Production force refresh error:', error);
        setProductionError(error);
        setProductionUser(null);
        setProductionLoading(false);
        return null;
      }
    } else {
      // En développement, forcer un refetch avec invalidation du cache
      console.log('🔄 Development mode - invalidating cache and refetching');
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      
      // Attendre un court délai pour la propagation
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const result = await developmentQuery.refetch();
      console.log('🔄 Development refetch result:', { 
        success: result.isSuccess, 
        hasData: !!result.data,
        userId: result.data?.id 
      });
      return result.data;
    }
  };

  // Authentification production (fetch direct)
  useEffect(() => {
    if (isDevelopment) return; // Ne pas exécuter en développement

    let isMounted = true;
    
    const checkAuth = async () => {
      try {
        console.log('🔄 Production auth check starting, refreshTrigger:', refreshTrigger);
        setProductionLoading(true);
        
        const response = await fetch('/api/user', {
          credentials: 'include',
          cache: 'no-cache',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });
        
        console.log('🔄 Production auth response:', response.status);
        
        if (!isMounted) return;
        
        if (response.ok) {
          const userData = await response.json();
          console.log('✅ Production auth success:', { username: userData?.username, id: userData?.id });
          if (isMounted) {
            setProductionUser(userData);
            setProductionError(null);
          }
        } else if (response.status === 401) {
          console.log('❌ Production auth 401 - user not authenticated');
          if (isMounted) {
            setProductionUser(null);
            setProductionError(null);
          }
        } else {
          throw new Error(`Auth failed: ${response.status}`);
        }
      } catch (err) {
        console.error('Production auth error:', err);
        if (isMounted) {
          setProductionError(err);
          setProductionUser(null);
        }
      } finally {
        if (isMounted) {
          console.log('🔄 Production auth check complete, loading set to false');
          setProductionLoading(false);
        }
      }
    };
    
    checkAuth();
    
    return () => {
      isMounted = false;
    };
  }, [isDevelopment, refreshTrigger]); // Ajout du refreshTrigger

  // Retourner les bonnes données selon l'environnement
  if (isDevelopment) {
    return {
      user: developmentQuery.data || null,
      isLoading: developmentQuery.isLoading,
      isAuthenticated: !!developmentQuery.data,
      error: developmentQuery.error,
      refreshAuth: refreshAuth,
      forceAuthRefresh: forceAuthRefresh,
      environment: 'development'
    };
  } else {
    return {
      user: productionUser,
      isLoading: productionLoading,
      isAuthenticated: !!productionUser,
      error: productionError,
      refreshAuth: refreshAuth,
      forceAuthRefresh: forceAuthRefresh,
      environment: 'production'
    };
  }
}