import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { createServer, type Server } from "http";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Database will be configured in storage.js
import { storage } from "./storage.js";
import { setupLocalAuth, requireAuth } from "./localAuth.production.js";

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

// Simple production routes
async function registerProductionRoutes(app: Express): Promise<Server> {
  // Health check endpoint
  app.get('/api/health', (req: Request, res: Response) => {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: 'production',
      database: 'connected'
    });
  });
  
  // Emergency admin reset endpoint (production only)
  app.post('/api/emergency-admin-reset', async (req: Request, res: Response) => {
    try {
      const { secret } = req.body;
      
      // Require emergency secret (can be set via environment variable)
      const emergencySecret = process.env.EMERGENCY_SECRET || 'logiflow-admin-reset-2025';
      if (secret !== emergencySecret) {
        return res.status(403).json({ error: 'Invalid emergency secret' });
      }
      
      console.log('🚨 EMERGENCY: Admin password reset requested');
      
      // Find existing admin
      const existingAdmin = await storage.getUserByUsername('admin');
      if (existingAdmin) {
        // Generate new password hash
        const crypto = await import('crypto');
        const scrypt = await import('util').then(util => util.promisify(crypto.scrypt));
        const salt = crypto.randomBytes(16).toString("hex");
        const buf = (await scrypt('admin', salt, 64)) as Buffer;
        const newPassword = `${buf.toString("hex")}.${salt}`;
        
        // Update admin password
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
  
  // Setup authentication
  setupLocalAuth(app);
  
  // Basic API routes for production
  app.get('/api/groups', requireAuth, async (req: Request, res: Response) => {
    try {
      const groups = await storage.getGroups();
      res.json(groups);
    } catch (error) {
      console.error('Error fetching groups:', error);
      res.status(500).json({ error: 'Failed to fetch groups' });
    }
  });

  app.get('/api/suppliers', requireAuth, async (req: Request, res: Response) => {
    try {
      const suppliers = await storage.getSuppliers();
      res.json(suppliers);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      res.status(500).json({ error: 'Failed to fetch suppliers' });
    }
  });

  app.get('/api/orders', requireAuth, async (req: Request, res: Response) => {
    try {
      const orders = await storage.getOrders();
      res.json(orders);
    } catch (error) {
      console.error('Error fetching orders:', error);
      res.status(500).json({ error: 'Failed to fetch orders' });
    }
  });

  // Weather API for compatibility
  app.get('/api/weather', async (req: Request, res: Response) => {
    try {
      const weatherData = {
        today: {
          date: '2025-08-11',
          location: 'Nancy, France',
          tempMax: '30.9',
          tempMin: '13.9',
          icon: 'clear-day',
          conditions: 'Clear',
          isCurrentYear: true
        },
        previousYear: {
          date: '2024-08-11', 
          location: 'Nancy, France',
          tempMax: '30.9',
          tempMin: '15.8',
          icon: 'clear-day',
          conditions: 'Clear',
          isCurrentYear: false
        },
        lastFetch: new Date().toISOString()
      };
      
      res.json(weatherData);
    } catch (error: any) {
      console.error('Weather API error:', error);
      res.status(500).json({ error: 'Failed to fetch weather data' });
    }
  });

  const server = createServer(app);
  return server;
}

const server = await registerProductionRoutes(app);

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  console.error('Server error:', { status, message, error: err });
  res.status(status).json({ message });
  throw err;
});

// Serve static files directly in production (no Vite)
const publicPath = join(__dirname, 'public');
console.log('🐳 Serving static files from:', publicPath);

app.use('/assets', express.static(join(publicPath, 'assets')));
app.use('/', express.static(publicPath));

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return next();
  }
  res.sendFile(join(publicPath, 'index.html'));
});

const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
server.listen(port, "0.0.0.0", () => {
  console.log(`🐳 PRODUCTION: LogiFlow serving on port ${port}`);
});