// Environment setup for production deployment
process.env.STORAGE_MODE = 'production'; // Force production mode for debugging
// Keep NODE_ENV as development to avoid static file serving issues
// process.env.NODE_ENV = 'production'; // Force production environment for debugging

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupSecurityHeaders, setupRateLimiting, setupInputSanitization } from "./security";
import { setupCompression } from "./cache";
import { monitor, setupMonitoringEndpoints } from "./monitoring";
import { initRolesAndPermissions } from "./initRolesAndPermissions";
import { initDatabase } from "./initDatabase.production";

const app = express();

// Sécurité et optimisation
setupSecurityHeaders(app);
setupRateLimiting(app);
setupInputSanitization(app);
setupCompression(app);

// Monitoring des performances
app.use(monitor.middleware());
setupMonitoringEndpoints(app);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Logging optimisé (sans détails de réponse sensibles)
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      // Logging sécurisé sans données sensibles
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      
      // Ne pas logger les données sensibles
      if (path.includes('/login') || path.includes('/password')) {
        logLine += ' :: [SENSITIVE DATA HIDDEN]';
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Initialize roles and permissions on startup
  try {
    await initRolesAndPermissions();
  } catch (error) {
    console.error("Failed to initialize roles and permissions:", error);
    // Continue startup even if role initialization fails
  }

  // Initialize production database and permissions when using production storage
  if (process.env.STORAGE_MODE === 'production') {
    try {
      await initDatabase();
    } catch (error) {
      console.error("Failed to initialize production database:", error);
      // Continue startup even if production initialization fails
    }
  }

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
