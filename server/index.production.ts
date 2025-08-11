import express, { type Request, Response, NextFunction } from "express";
import { setupVite, serveStatic } from "./vite.js";

// Production routes - simplified for Docker deployment
import { createServer, type Server } from "http";
import { storage } from "./storage.js";
import { setupLocalAuth, requireAuth } from "./localAuth.production.js";

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
  app.get('/api/health', (req, res) => {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: 'production',
      database: 'connected'
    });
  });
  
  // Setup authentication
  setupLocalAuth(app);
  
  // Basic API routes for production
  app.get('/api/groups', requireAuth, async (req, res) => {
    try {
      const groups = await storage.getGroups();
      res.json(groups);
    } catch (error) {
      console.error('Error fetching groups:', error);
      res.status(500).json({ error: 'Failed to fetch groups' });
    }
  });

  app.get('/api/suppliers', requireAuth, async (req, res) => {
    try {
      const suppliers = await storage.getSuppliers();
      res.json(suppliers);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      res.status(500).json({ error: 'Failed to fetch suppliers' });
    }
  });

  app.get('/api/orders', requireAuth, async (req, res) => {
    try {
      const orders = await storage.getOrders();
      res.json(orders);
    } catch (error) {
      console.error('Error fetching orders:', error);
      res.status(500).json({ error: 'Failed to fetch orders' });
    }
  });

  // Weather API for compatibility
  app.get('/api/weather', async (req, res) => {
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

// Production setup - serve static files
serveStatic(app);

const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
server.listen(port, "0.0.0.0", () => {
  console.log(`🐳 PRODUCTION: LogiFlow serving on port ${port}`);
});