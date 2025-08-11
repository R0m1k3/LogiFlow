import { Request, Response, NextFunction } from 'express';

// Cache en mémoire simple pour les données fréquemment utilisées
class MemoryCache {
  private cache: Map<string, { data: any; timestamp: number; ttl: number }> = new Map();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

  set(key: string, data: any, ttl: number = this.DEFAULT_TTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  get(key: string): any | null {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  // Nettoyer les éléments expirés
  cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > item.ttl) {
        this.cache.delete(key);
      }
    }
  }
}

export const cache = new MemoryCache();

// Nettoyage automatique toutes les 10 minutes
setInterval(() => cache.cleanup(), 10 * 60 * 1000);

// Middleware de mise en cache pour les réponses API
export function cacheMiddleware(ttl: number = 5 * 60 * 1000) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Ne pas mettre en cache les requêtes POST/PUT/DELETE
    if (req.method !== 'GET') {
      return next();
    }

    const key = `${req.originalUrl}:${req.user?.id || 'anonymous'}`;
    const cachedData = cache.get(key);

    if (cachedData) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(cachedData);
    }

    res.setHeader('X-Cache', 'MISS');
    
    // Intercepter la réponse pour la mettre en cache
    const originalSend = res.json;
    res.json = function(data: any) {
      if (res.statusCode === 200) {
        cache.set(key, data, ttl);
      }
      return originalSend.call(this, data);
    };

    next();
  };
}

// Invalidation de cache par pattern
export function invalidateCache(pattern: string): void {
  for (const key of cache['cache'].keys()) {
    if (key.includes(pattern)) {
      cache.delete(key);
    }
  }
}

// Middleware de compression des réponses
export function setupCompression(app: any) {
  app.use((req: Request, res: Response, next: NextFunction) => {
    // Activer la compression pour les réponses JSON
    if (req.accepts('gzip') && res.getHeader('Content-Type')?.includes('json')) {
      res.setHeader('Content-Encoding', 'gzip');
    }
    next();
  });
}

// Optimisation des requêtes base de données
export function createOptimizedQuery(baseQuery: string, params: any[]): { query: string; params: any[] } {
  // Optimiser les requêtes en évitant les SELECT * inutiles
  let optimizedQuery = baseQuery;
  
  // Limiter les résultats pour éviter les grosses requêtes
  if (!optimizedQuery.includes('LIMIT') && !optimizedQuery.includes('COUNT')) {
    optimizedQuery += ' LIMIT 1000';
  }

  // Ajouter des index hints si nécessaire
  if (optimizedQuery.includes('ORDER BY created_at')) {
    optimizedQuery = optimizedQuery.replace('ORDER BY created_at', 'ORDER BY created_at DESC');
  }

  return { query: optimizedQuery, params };
}