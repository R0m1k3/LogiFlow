import { Request, Response, NextFunction } from 'express';

// Interface pour les métriques
interface Metrics {
  requestCount: number;
  errorCount: number;
  responseTime: number[];
  memoryUsage: NodeJS.MemoryUsage;
  activeConnections: number;
  lastReset: Date;
}

class PerformanceMonitor {
  private metrics: Metrics = {
    requestCount: 0,
    errorCount: 0,
    responseTime: [],
    memoryUsage: process.memoryUsage(),
    activeConnections: 0,
    lastReset: new Date()
  };

  private slowQueries: Array<{ query: string; duration: number; timestamp: Date }> = [];
  private MAX_RESPONSE_TIMES = 1000; // Garder les 1000 derniers temps de réponse

  // Middleware pour mesurer les performances
  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      this.metrics.requestCount++;
      this.metrics.activeConnections++;

      // Capturer le temps de réponse
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        this.metrics.responseTime.push(duration);
        
        // Garder seulement les N derniers temps de réponse
        if (this.metrics.responseTime.length > this.MAX_RESPONSE_TIMES) {
          this.metrics.responseTime.shift();
        }

        // Détecter les requêtes lentes
        if (duration > 1000) {
          this.logSlowQuery(req.originalUrl, duration);
        }

        // Compter les erreurs
        if (res.statusCode >= 400) {
          this.metrics.errorCount++;
        }

        this.metrics.activeConnections--;
        this.metrics.memoryUsage = process.memoryUsage();
      });

      next();
    };
  }

  // Enregistrer une requête lente
  private logSlowQuery(query: string, duration: number) {
    this.slowQueries.push({
      query,
      duration,
      timestamp: new Date()
    });

    // Garder seulement les 100 dernières requêtes lentes
    if (this.slowQueries.length > 100) {
      this.slowQueries.shift();
    }

    console.warn(`⚠️  Slow query detected: ${query} (${duration}ms)`);
  }

  // Obtenir les statistiques
  getStats() {
    const responseTimes = this.metrics.responseTime;
    const avgResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
      : 0;

    const p95ResponseTime = responseTimes.length > 0 
      ? responseTimes.sort((a, b) => a - b)[Math.floor(responseTimes.length * 0.95)]
      : 0;

    return {
      uptime: process.uptime(),
      requestCount: this.metrics.requestCount,
      errorCount: this.metrics.errorCount,
      errorRate: this.metrics.requestCount > 0 ? (this.metrics.errorCount / this.metrics.requestCount) * 100 : 0,
      avgResponseTime: Math.round(avgResponseTime),
      p95ResponseTime: Math.round(p95ResponseTime),
      activeConnections: this.metrics.activeConnections,
      memoryUsage: {
        rss: `${Math.round(this.metrics.memoryUsage.rss / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(this.metrics.memoryUsage.heapTotal / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(this.metrics.memoryUsage.heapUsed / 1024 / 1024)}MB`,
        external: `${Math.round(this.metrics.memoryUsage.external / 1024 / 1024)}MB`
      },
      slowQueries: this.slowQueries.slice(-10), // 10 dernières requêtes lentes
      lastReset: this.metrics.lastReset
    };
  }

  // Réinitialiser les métriques
  reset() {
    this.metrics = {
      requestCount: 0,
      errorCount: 0,
      responseTime: [],
      memoryUsage: process.memoryUsage(),
      activeConnections: 0,
      lastReset: new Date()
    };
    this.slowQueries = [];
  }

  // Alerte si l'utilisation mémoire est trop élevée
  checkMemoryUsage() {
    const memUsage = process.memoryUsage();
    const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
    
    if (heapUsedMB > 500) { // Plus de 500MB
      console.warn(`⚠️  High memory usage: ${Math.round(heapUsedMB)}MB`);
      return true;
    }
    return false;
  }
}

// Instance globale
export const monitor = new PerformanceMonitor();

// Vérification périodique de la mémoire
setInterval(() => {
  monitor.checkMemoryUsage();
}, 5 * 60 * 1000); // Toutes les 5 minutes

// Endpoint pour les métriques
export function setupMonitoringEndpoints(app: any) {
  app.get('/api/metrics', (req: Request, res: Response) => {
    res.json(monitor.getStats());
  });

  app.post('/api/metrics/reset', (req: Request, res: Response) => {
    monitor.reset();
    res.json({ message: 'Metrics reset successfully' });
  });
}