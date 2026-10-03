import { useCallback } from 'react';
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AUTH_QUERY_KEY, fetchCurrentUser } from "@/lib/queryClient";

// Conservé dans le retour du hook pour compatibilité (utilisé pour le débogage)
const environment = import.meta.env.DEV ? 'development' : 'production';

// Hook d'authentification unique (développement et production) : l'utilisateur
// connecté est lu une seule fois via GET /api/user puis partagé par toute
// l'application à travers le cache React Query (clé ['/api/user']).
// Un 401 donne user = null (non connecté), sans redirection.
export function useAuthUnified() {
  const queryClient = useQueryClient();

  const authQuery = useQuery<any>({
    queryKey: AUTH_QUERY_KEY,
    queryFn: fetchCurrentUser,
    staleTime: Infinity,
    retry: false,
    // Après une erreur serveur, ne pas relancer la requête à chaque montage d'un
    // composant (AuthPage) : sinon boucle chargement / page de connexion
    retryOnMount: false,
  });

  // Rafraîchissement en arrière-plan : tous les composants abonnés reçoivent
  // le nouvel utilisateur quand la réponse arrive
  const refreshAuth = useCallback(() => {
    return queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
  }, [queryClient]);

  // Rechargement immédiat (après connexion) : attend la réponse du serveur,
  // met à jour le cache partagé et renvoie l'utilisateur (ou null)
  const forceAuthRefresh = useCallback(async () => {
    try {
      return await queryClient.fetchQuery({
        queryKey: AUTH_QUERY_KEY,
        queryFn: fetchCurrentUser,
        staleTime: 0,
      });
    } catch (error) {
      console.error("Erreur lors du rafraîchissement de l'authentification:", error);
      return null;
    }
  }, [queryClient]);

  const user = authQuery.data ?? null;

  return {
    user,
    isLoading: authQuery.isLoading,
    isAuthenticated: !!user,
    error: authQuery.error,
    refreshAuth,
    forceAuthRefresh,
    environment
  };
}
