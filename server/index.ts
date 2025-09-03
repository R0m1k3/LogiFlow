import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes.js";
import { setupVite, serveStatic } from "./vite.js";

// Run database migrations first - FORCER EN PRODUCTION
console.log('🔄 [STARTUP] Running database migrations...');
console.log('🔍 [STARTUP] Environment:', process.env.NODE_ENV);
console.log('🔍 [STARTUP] Has DATABASE_URL:', !!process.env.DATABASE_URL);

try {
  const { runMigrations } = await import('./migrations.js');
  await runMigrations();
  console.log('✅ [STARTUP] Database migrations completed');
} catch (error) {
  console.error('❌ [STARTUP] Database migrations failed:', error);
  console.error('❌ [STARTUP] Error details:', JSON.stringify(error, null, 2));
  // NE PAS arrêter l'app pour éviter les boucles de redémarrage
  console.warn('⚠️ [STARTUP] Continuing without migrations to avoid restart loop');
}

// Initialize weather system
console.log('🌤️ [STARTUP] Initializing weather system...');
const { initializeWeatherConfig } = await import('./weatherAutoConfig.js');
await initializeWeatherConfig();
console.log('✅ [STARTUP] Weather system initialized');

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

const server = await registerRoutes(app);

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  res.status(status).json({ message });
  throw err;
});

// Setup Vite in development
if (app.get("env") === "development") {
  await setupVite(app, server);
} else {
  serveStatic(app);
}

const port = 5000;
server.listen(port, "0.0.0.0", () => {
  console.log(`serving on port ${port}`);
});
