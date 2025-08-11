import { useState, useEffect } from 'react';

// Hook d'authentification spécifique pour la production
// Utilise fetch direct sans React Query pour éviter les problèmes de cache
export function useAuthProduction() {
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const checkAuth = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('🔄 Production auth check starting...');
      
      const response = await fetch('/api/user', {
        credentials: 'include',
        cache: 'no-cache',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      console.log('🔄 Production auth response:', response.status);
      
      if (response.ok) {
        const userData = await response.json();
        console.log('✅ Production auth success:', { username: userData?.username, id: userData?.id });
        setUser(userData);
        setError(null);
      } else if (response.status === 401) {
        console.log('❌ Production auth 401 - user not authenticated');
        setUser(null);
        setError(null);
      } else {
        throw new Error(`Auth failed: ${response.status}`);
      }
    } catch (err) {
      console.error('❌ Production auth error:', err);
      setError(err);
      setUser(null);
    } finally {
      setIsLoading(false);
      console.log('🔄 Production auth check completed');
    }
  };

  // Authentification au montage et lors des triggers
  useEffect(() => {
    checkAuth();
  }, [refreshTrigger]);

  // Fonction pour rafraîchir l'authentification
  const refreshAuth = () => {
    console.log('🔄 RefreshAuth called for production');
    setRefreshTrigger(prev => prev + 1);
  };

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    error,
    refreshAuth,
    environment: 'production'
  };
}