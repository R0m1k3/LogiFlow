import { useState, useEffect } from 'react';

// Hook d'authentification simplifié qui fonctionne dans tous les environnements
export function useAuthSimple() {
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const [refreshCounter, setRefreshCounter] = useState(0);

  // Fonction pour vérifier l'authentification
  const checkAuth = async () => {
    try {
      setIsLoading(true);
      
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
        console.log('✅ Auth check successful:', { username: userData?.username, id: userData?.id });
        setUser(userData);
        setError(null);
      } else if (response.status === 401) {
        console.log('❌ Auth check 401 - user not authenticated');
        setUser(null);
        setError(null);
      } else {
        throw new Error(`Auth failed: ${response.status}`);
      }
    } catch (err) {
      console.error('Auth check error:', err);
      setError(err);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Fonction pour forcer un refresh de l'authentification
  const refreshAuth = () => {
    console.log('🔄 Refreshing authentication...');
    setRefreshCounter(prev => prev + 1);
  };

  // Vérifier l'authentification au montage et lors des refresh
  useEffect(() => {
    checkAuth();
  }, [refreshCounter]);

  return {
    user,
    isLoading,
    error,
    isAuthenticated: !!user,
    refreshAuth
  };
}