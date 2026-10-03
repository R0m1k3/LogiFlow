import express, { type Express, type Request, type Response, type NextFunction } from "express";
import compression from "compression";
import { createServer, type Server } from "http";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Database will be configured in storage.js
import { storage } from "./storage.js";
import { setupLocalAuth, requireAuth } from "./localAuth.production.js";
import { runProductionMigrations } from "./migrations.production.js";

// Get directory paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🐳 PRODUCTION: Starting LogiFlow application');

// Force production mode and PostgreSQL storage when deployed in Docker
process.env.NODE_ENV = 'production';
console.log('🐳 Environment:', {
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_URL: process.env.DATABASE_URL ? 'Present' : 'Missing',
  PORT: process.env.PORT
});

const app = express();

// Compression gzip des réponses (assets JS/CSS, index.html et JSON de l'API).
// En premier pour couvrir toutes les réponses.
app.use(compression());

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (req.path.startsWith("/api")) {
      console.log(`${req.method} ${req.path} ${res.statusCode} in ${duration}ms`);
    }
  });
  next();
});

// Import all routes for production
import { registerRoutes } from "./routes.js";

// Initialize backup service for automatic backups
import { backupService } from "./backupService.js";
console.log('💾 [PRODUCTION] Backup service initialized for automatic daily backups');

async function registerProductionRoutes(app: Express): Promise<void> {
  console.log('🔧 Registering all production routes...');
  
  // Run automatic migrations before registering routes
  console.log('🔄 Running automatic production migrations...');
  await runProductionMigrations();
  
  // Initialize weather system for production
  console.log('🌤️ [PRODUCTION] Initializing weather system...');
  const { initializeWeatherConfig } = await import('./weatherAutoConfig.js');
  await initializeWeatherConfig();
  console.log('✅ [PRODUCTION] Weather system initialized');
  
  // Register ALL API routes (same as development)
  await registerRoutes(app);
  console.log('✅ All routes registered successfully for production');
  
  // Additional health check endpoint for production monitoring
  app.get('/api/health', (req: Request, res: Response) => {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: 'production',
      database: 'connected',
      port: process.env.PORT || 3000,
      publicPath: join(__dirname, 'public')
    });
  });
  
  // Emergency admin reset endpoint (production only)
  // SÉCURITÉ : n'existe que si EMERGENCY_SECRET est défini dans l'environnement.
  // L'ancien secret par défaut était codé en dur dans ce fichier, donc lisible
  // par quiconque accède au dépôt — n'importe qui pouvait réinitialiser le
  // compte admin en production.
  app.post('/api/emergency-admin-reset', async (req: Request, res: Response) => {
    try {
      const emergencySecret = process.env.EMERGENCY_SECRET;
      if (!emergencySecret) {
        return res.status(404).json({ error: 'Not found' });
      }

      const { secret } = req.body;
      if (!secret || secret !== emergencySecret) {
        console.warn('🚨 Tentative de reset admin avec un secret invalide');
        return res.status(403).json({ error: 'Invalid emergency secret' });
      }
      
      console.log('🚨 EMERGENCY: Admin password reset requested');
      
      // Find and reset admin
      const existingAdmin = await storage.getUserByUsername('admin');
      if (existingAdmin) {
        // Use simple hash for admin reset
        const crypto = await import('crypto');
        const { promisify } = await import('util');
        const scryptAsync = promisify(crypto.scrypt);
        const salt = crypto.randomBytes(16).toString("hex");
        const buf = (await scryptAsync('admin', salt, 64)) as Buffer;
        const newPassword = `${buf.toString("hex")}.${salt}`;
        
        await storage.updateUser(existingAdmin.id, { 
          password: newPassword,
          passwordChanged: false 
        });
        
        console.log('✅ EMERGENCY: Admin password reset to admin/admin');
        return res.json({ 
          success: true, 
          message: 'Admin password reset to admin/admin',
          adminId: existingAdmin.id 
        });
      } else {
        return res.status(404).json({ error: 'Admin user not found' });
      }
    } catch (error) {
      console.error('❌ EMERGENCY: Admin reset failed:', error);
      return res.status(500).json({ error: 'Reset failed', details: (error as Error).message });
    }
  });
}

// Serve static files directly in production (no Vite)
// Déclarés AVANT les routes : les fichiers statiques et l'index.html ne passent
// ni par la session ni par passport (aucune requête SQL par fichier).
const publicPath = join(__dirname, 'public');
console.log('🐳 Serving static files from:', publicPath);

// Les fichiers de /assets ont un nom haché par Vite : cache navigateur d'un an
app.use('/assets', express.static(join(publicPath, 'assets'), {
  maxAge: '1y',
  immutable: true,
  index: false,
}));
// Autres fichiers publics (favicon, manifest...). L'index.html est toujours
// revalidé pour qu'un nouveau déploiement soit pris en compte immédiatement.
app.use(express.static(publicPath, {
  index: false,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  },
}));

// SPA fallback - serve index.html for all non-API routes (y compris "/")
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return next();
  }
  res.set('Cache-Control', 'no-cache');
  res.sendFile(join(publicPath, 'index.html'), (err) => {
    if (err) {
      console.error(`❌ SPA: Error serving index.html for ${req.path}:`, err);
      if (!res.headersSent) {
        res.status(500).send('Error loading application');
      }
    }
  });
});

await registerProductionRoutes(app);

// Tâches de maintenance périodiques (purge du cache factures expiré)
const { startMaintenanceJobs } = await import('./maintenance.js');
startMaintenanceJobs();

app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
  // Réponse déjà commencée : on laisse Express clore la connexion
  if (res.headersSent) {
    return next(err);
  }
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  console.error('Server error:', { status, message, error: err });
  res.status(status).json({ message });
});

const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
const server = createServer(app);
server.listen(port, "0.0.0.0", () => {
  console.log(`🐳 PRODUCTION: LogiFlow serving on port ${port}`);
});