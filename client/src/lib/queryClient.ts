import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  url: string,
  method: string = 'GET',
  body?: unknown,
  headers: Record<string, string> = {}
): Promise<any> {
  // Logging désactivé en production pour éviter la latence
  if (import.meta.env.DEV) {
    console.log("🌐 API Request:", { url, method });
  }
  
  const res = await fetch(url, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });

  // Logging des erreurs uniquement en production
  if (!res.ok || import.meta.env.DEV) {
    console.log("🌐 API Response:", { status: res.status, ok: res.ok, url });
  }
  
  await throwIfResNotOk(res);
  
  // Return JSON response
  if (res.headers.get('content-type')?.includes('application/json')) {
    return await res.json();
  }
  
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      // Redirection automatique vers la page d'authentification si 401
      if (typeof window !== 'undefined' && window.location.pathname !== '/auth') {
        console.log('🔄 API 401 - Redirecting to auth page');
        window.location.href = '/auth';
      }
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

// Clé de cache de l'utilisateur connecté, partagée par toute l'application
export const AUTH_QUERY_KEY = ["/api/user"] as const;

// Lecture de l'utilisateur connecté. Un 401 signifie simplement « non connecté » :
// on renvoie null sans rediriger (sinon boucle sur la page de connexion).
export async function fetchCurrentUser(): Promise<any> {
  const res = await fetch("/api/user", {
    credentials: "include",
    cache: "no-cache",
    headers: { Accept: "application/json" },
  });

  if (res.status === 401) {
    return null;
  }

  await throwIfResNotOk(res);
  return await res.json();
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "returnNull" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      refetchOnMount: true,
      refetchOnReconnect: false,
      staleTime: 30 * 1000, // 30 secondes de cache pour de meilleures performances
      gcTime: 10 * 60 * 1000, // 10 minutes  
      retry: (failureCount, error: any) => {
        const message: string = error?.message ?? '';
        // Ne pas retry les erreurs d'authentification et rediriger
        if (message.includes('401') || message.includes('Unauthorized')) {
          if (typeof window !== 'undefined' && window.location.pathname !== '/auth') {
            console.log('🔄 Query 401 - Redirecting to auth page');
            window.location.href = '/auth';
          }
          return false;
        }
        // Erreur côté client (403 droit refusé, 404...) : un nouvel essai
        // donnerait le même résultat et retarderait l'affichage de l'erreur
        if (/^4\d\d\b/.test(message)) {
          return false;
        }
        // Erreur serveur ou réseau : un seul nouvel essai
        return failureCount < 1;
      },
    },
    mutations: {
      retry: false,
    },
  },
});

// Données de référence qui changent rarement (les mutations fournisseurs et
// magasins invalident déjà ces clés) : pas de rechargement à chaque ouverture
// de page ou de modale.
queryClient.setQueryDefaults(["/api/suppliers"], { staleTime: 5 * 60 * 1000 });
queryClient.setQueryDefaults(["/api/groups"], { staleTime: 5 * 60 * 1000 });

// Utilisateur connecté : chargé une seule fois pour toute l'application, puis
// rafraîchi explicitement (connexion, refreshAuth). Pas de nouvel essai, ni au
// montage d'un composant : un échec équivaut à « non connecté ».
queryClient.setQueryDefaults(AUTH_QUERY_KEY, {
  queryFn: fetchCurrentUser,
  staleTime: Infinity,
  retry: false,
  retryOnMount: false,
});
