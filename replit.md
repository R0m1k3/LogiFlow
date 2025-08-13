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

### 2025-08-13 - Système de Vérification de Factures NocoDB
✅ **Implémentation complète du système de vérification automatique des factures** :

**Fonctionnalités développées :**
- Service de vérification NocoDB (`server/services/nocodbVerification.ts`)
- API endpoints pour vérification factures et recherche par BL
- Interface utilisateur avec coches vertes de validation
- Auto-remplissage des champs facture/montant depuis NocoDB
- Support multi-magasin avec configurations NocoDB spécifiques

**Logique de fonctionnement :**
- Vérification références factures existantes avec validation fournisseur
- Recherche automatique par numéro BL pour lignes sans référence
- Auto-remplissage automatique des données trouvées
- Indicateurs visuels : coche verte (succès), cercle rouge (erreur)

**Configuration technique :**
- Intégration avec configurations NocoDB par magasin
- Mapping flexible des colonnes (facture, BL, montant, fournisseur)
- Gestion d'erreurs et notifications utilisateur
- Interface responsive et accessible

### 2025-08-13 - Uniformisation complète des interfaces utilisateur
✅ **Harmonisation du design des tableaux** terminée pour une expérience utilisateur cohérente

### 2025-08-12 - Nettoyage des fichiers inutiles
✅ **Suppression complète des fichiers inutiles** effectuée pour optimiser le projet

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