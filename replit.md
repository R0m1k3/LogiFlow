# Enterprise Weather Management Platform

## Project Overview
Plateforme de gestion météorologique d'entreprise avec suivi logistique multi-tenant avancé et capacités complètes de gestion des commandes.

La plateforme fournit une gestion robuste des flux de travail de livraison avec des fonctionnalités de rapprochement améliorées, se concentrant sur l'efficacité opérationnelle grâce au suivi financier détaillé, aux contrôles d'accès granulaires et à la gestion sophistiquée des permissions.

## Tech Stack
- Frontend: React.js avec composants UI personnalisés (shadcn/ui)
- Backend: Node.js Express (ESM)
- API Météo: Visual Crossing
- Gestion d'état: React Query
- Base de données: PostgreSQL avec Drizzle ORM
- Authentification: Gestion d'accès sécurisée basée sur les rôles
- Validation: Schémas de validation Zod
- Styling: Tailwind CSS
- Déploiement: Docker
- Localisation: Support français amélioré

## Recent Changes

### 2025-08-12 - Nettoyage des fichiers inutiles
✅ **Suppression complète des fichiers inutiles** effectuée pour optimiser le projet :

**Fichiers supprimés :**
- Fichiers de sauvegarde/cassés : `*_broken.tsx`, `*_backup.tsx`, `*.backup.*`
- Dossier `attached_assets/` complet (captures d'écran et logs de débogage)
- Documentation de débogage : tous les fichiers `*.md` de correction temporaire
- Scripts de débogage : `debug-*.js`, `fix-*.sql`, `apply-production-fixes.js`
- Scripts de test temporaires : `test-*.js`, `reset-admin.js`
- Fichiers de production/debug : `production-*.txt`, `production-*.sh`, `production-*.patch`
- Fichiers de cookies de test : `cookies.txt`, `cookies_employee.txt`

**Fichiers conservés (essentiels) :**
- `client/` - Frontend React complet
- `server/` - Backend Express complet
- `shared/` - Schémas partagés
- `migrations/` - Migrations de base de données
- Configuration : `package.json`, `vite.config.ts`, `tailwind.config.ts`, etc.
- Déploiement : `Dockerfile`, `docker-compose.yml`

## Project Architecture

### Frontend Structure
```
client/src/
├── components/       # Composants UI réutilisables
├── pages/           # Pages principales de l'application
├── hooks/           # Hooks React personnalisés
├── lib/             # Utilitaires et clients
└── main.tsx         # Point d'entrée
```

### Backend Structure
```
server/
├── index.ts         # Serveur principal (développement)
├── index.production.ts  # Serveur production
├── routes.ts        # Routes API
├── storage.ts       # Couche d'accès aux données
├── localAuth.ts     # Authentification locale
└── services/        # Services métier
```

### Database
- PostgreSQL avec Drizzle ORM
- Migrations gérées dans `migrations/`
- Schémas définis dans `shared/schema.ts`

## User Preferences
- Langue préférée : Français
- Communication : Langue simple et accessible, éviter les détails techniques
- Nettoyage : Préfère un projet optimisé sans fichiers inutiles

## Development Guidelines
- Utiliser `npm run dev` pour lancer l'application
- Les migrations sont gérées avec `npm run db:push`
- Architecture full-stack JavaScript avec focus frontend
- Validation des données avec Zod
- UI avec shadcn/ui + Tailwind CSS

## Notes
- L'application utilise un système de stockage en mémoire pour le développement
- Support multi-tenant avec gestion des groupes et permissions
- Interface météorologique simplifiée intégrée
- Système d'authentification unifié pour développement et production