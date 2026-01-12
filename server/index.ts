import express, { type Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import { registerRoutes } from "./routes.js";
import { setupVite, serveStatic } from "./vite.js";
import {
  setupSecurityHeaders,
  setupRateLimiting,
  setupInputSanitization,
  setupCsrfProtection,
  setupCsrfTokenEndpoint
} from "./security.js";

// Forcer la création de la table webhook_bap_config au démarrage de l'application
if (process.env.NODE_ENV === 'production') {
  const { ensureWebhookBapConfigTable } = await import('./createWebhookTable.js');
  await ensureWebhookBapConfigTable();
}

// Initialize weather system
console.log('🌤️ [STARTUP] Initializing weather system...');
const { initializeWeatherConfig } = await import('./weatherAutoConfig.js');
await initializeWeatherConfig();
console.log('✅ [STARTUP] Weather system initialized');

const app = express();

// Parse cookies (required for CSRF)
app.use(cookieParser());

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Setup security middlewares
console.log('🔐 [STARTUP] Setting up security middlewares...');
setupSecurityHeaders(app);
setupRateLimiting(app);
setupInputSanitization(app);

// CSRF Protection (only in production to avoid dev friction)
if (process.env.NODE_ENV === 'production') {
  setupCsrfProtection(app);
  console.log('✅ [STARTUP] CSRF protection enabled');
}

// CSRF token endpoint (always available for frontend to fetch token)
setupCsrfTokenEndpoint(app);
console.log('✅ [STARTUP] Security middlewares configured');

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
