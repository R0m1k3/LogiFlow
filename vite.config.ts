import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
  // En production, les console.log/debug de debug sont retirés du bundle par
  // le minifieur (console.warn et console.error sont conservés). En dev, tout
  // reste visible.
  esbuild: {
    pure: process.env.NODE_ENV === "production" ? ["console.log", "console.debug"] : [],
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Sépare les grosses dépendances stables du code applicatif :
        // elles ne changent qu'aux montées de version et restent donc en
        // cache navigateur entre deux déploiements, au lieu de faire
        // retélécharger 1,7 Mo à chaque mise en production.
        // recharts n'est volontairement pas listé ici : un chunk manuel
        // embarque aussi les dépendances partagées (clsx...) importées par
        // l'application, ce qui le faisait précharger dès l'écran de
        // connexion. Sans entrée, il n'est téléchargé qu'avec la page
        // Statistiques (chargée à la demande).
        manualChunks: {
          "vendor-react": ["react", "react-dom", "wouter"],
          "vendor-query": ["@tanstack/react-query"],
          "vendor-icons": ["lucide-react"],
        },
      },
    },
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
