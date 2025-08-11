# LogiFlow - Plateforme de Gestion Logistique

LogiFlow est une application web complète de gestion logistique conçue spécialement pour les magasins de la chaîne La Foir'Fouille. Elle centralise la gestion des commandes, livraisons, stocks, utilisateurs et bien plus à travers une interface moderne et intuitive.

## 🎯 Fonctionnalités Principales

### 📦 Gestion des Commandes et Livraisons
- **Commandes Fournisseurs** : Création, suivi et gestion des commandes avec planification des dates de livraison
- **Livraisons** : Suivi des livraisons avec statuts (en attente, planifiée, livrée) et gestion des bons de livraison
- **Réconciliation BL** : Rapprochement automatique entre bons de livraison et factures
- **Tableau de Bord** : Vue d'ensemble avec statistiques en temps réel

### 🏪 Gestion Multi-Magasins
- **Sélection de Magasin** : Interface permettant de filtrer les données par magasin
- **Magasins Personnalisés** : Support des magasins "Frouard" et "Houdemont"
- **Permissions par Magasin** : Contrôle d'accès granulaire selon les magasins assignés

### 📅 Gestion DLC (Dates Limites de Consommation)
- **Suivi des Produits** : Gestion des produits avec dates d'expiration (DLC, DDM, DLUO)
- **Alertes Automatiques** : Notifications pour produits expirant sous 15 jours
- **Filtres Avancés** : Tri par statut (validés, expire bientôt, expirés)
- **Génération de Codes** : Support des codes EAN13 pour les produits
- **Impression** : Rapports PDF des produits expirant bientôt ou expirés

### 👥 Gestion des Utilisateurs et Rôles
- **Système de Rôles** : 4 rôles (Admin, Manager, Employé, Directeur) avec 54 permissions
- **Permissions Granulaires** : Contrôle d'accès précis pour chaque fonctionnalité
- **Interface de Gestion** : Assignation et modification des permissions en temps réel
- **Traçabilité** : Suivi des actions utilisateurs

### 📋 Gestion des Tâches
- **Planification** : Création et assignation de tâches avec dates d'échéance
- **Calendrier Intégré** : Vue calendrier pour la planification des tâches
- **Suivi de Progression** : Statuts et validation des tâches terminées
- **Filtres** : Tri par priorité, statut et dates

### 🛒 Commandes Clients
- **Point de Vente** : Gestion des commandes clients avec génération de codes-barres
- **Suivi Livraison** : Statuts de préparation et livraison
- **Historique** : Archive complète des commandes clients

### 📢 Gestion des Publicités
- **Campagnes Marketing** : Planification et suivi des campagnes publicitaires
- **Participation Magasins** : Gestion de la participation par magasin
- **Calendrier** : Vue hebdomadaire et mensuelle des campagnes

## 🛠️ Technologies Utilisées

### Frontend
- **React 18** avec TypeScript pour une interface moderne et typée
- **Vite** pour un développement rapide et des builds optimisés
- **Shadcn/ui** composants UI modernes basés sur Radix UI
- **Tailwind CSS** pour un design responsive et cohérent
- **TanStack Query** pour la gestion d'état serveur
- **Wouter** pour le routage léger
- **React Hook Form + Zod** pour la validation des formulaires

### Backend
- **Express.js** avec TypeScript pour l'API REST
- **PostgreSQL** base de données relationnelle robuste
- **Drizzle ORM** pour les requêtes typées et sécurisées
- **Passport.js** pour l'authentification locale et production
- **Express Sessions** avec stockage PostgreSQL

### Infrastructure
- **Docker** pour le déploiement en production
- **Replit** pour le développement collaboratif
- **Environment adaptatif** : détection automatique développement/production

## 🚀 Installation et Démarrage

### Prérequis
- Node.js 18+ 
- PostgreSQL
- npm ou yarn

### Installation
```bash
# Cloner le projet
git clone [url-du-projet]
cd logiflow

# Installer les dépendances
npm install

# Configurer la base de données
cp .env.example .env
# Modifier DATABASE_URL dans .env

# Démarrer l'application
npm run dev
```

L'application sera accessible sur `http://localhost:5000`

### Comptes par Défaut
- **Administrateur** : admin / admin
- **Base de données** : Initialisation automatique avec données de test

## 🔐 Système de Permissions

L'application dispose d'un système de permissions granulaire avec 54 permissions réparties en 12 catégories :

### Catégories de Permissions
- **Tableau de Bord** : Accès aux statistiques et vues d'ensemble
- **Magasins** : Gestion des magasins et groupes
- **Fournisseurs** : Gestion des contacts fournisseurs
- **Commandes** : Création et suivi des commandes
- **Livraisons** : Gestion des livraisons et réceptions
- **Publicités** : Campagnes marketing et communication
- **Commandes Clients** : Point de vente et suivi client
- **Gestion DLC** : Suivi des dates d'expiration
- **Gestion des Tâches** : Planification et suivi des tâches
- **Utilisateurs** : Gestion des comptes utilisateurs
- **Gestion des Rôles** : Administration des permissions
- **Administration** : Configuration système et maintenance

### Rôles Prédéfinis
- **Admin** : Accès complet à toutes les fonctionnalités
- **Directeur** : Accès étendu avec supervision multi-magasins
- **Manager** : Gestion opérationnelle d'un magasin
- **Employé** : Accès aux opérations quotidiennes

## 📊 Fonctionnalités Avancées

### Pagination Intelligente
- **Pagination adaptative** : 10 éléments pour les vues détaillées, 20 pour les vues de synthèse
- **Filtres intégrés** : Recherche et tri sans perte de pagination
- **Performance optimisée** : Pagination côté client pour la réactivité

### Système de Logs
- **Traçabilité complète** : Logs détaillés pour toutes les opérations critiques
- **Debug en production** : Outils de diagnostic intégrés
- **Monitoring** : Suivi des performances et erreurs

### Sécurité
- **Authentification robuste** : Support développement (Replit Auth) et production (local)
- **Hachage sécurisé** : PBKDF2 pour les mots de passe
- **Sessions sécurisées** : Stockage PostgreSQL avec rotation automatique
- **Validation stricte** : Zod pour la validation côté client et serveur

## 🗂️ Structure du Projet

```
logiflow/
├── client/                 # Frontend React
│   ├── src/
│   │   ├── components/     # Composants réutilisables
│   │   ├── pages/         # Pages de l'application
│   │   ├── hooks/         # Hooks personnalisés
│   │   └── lib/           # Utilitaires et configuration
├── server/                # Backend Express
│   ├── routes.ts          # Routes API principales
│   ├── storage.ts         # Interface de stockage
│   └── auth/              # Système d'authentification
├── shared/                # Code partagé frontend/backend
│   └── schema.ts          # Schémas de données Drizzle
└── migrations/            # Migrations de base de données
```

## 🔧 Configuration

### Variables d'Environnement
```env
DATABASE_URL=postgresql://user:password@localhost:5432/logiflow
SESSION_SECRET=your-session-secret-key
NODE_ENV=development|production
```

### Déploiement Production
```bash
# Build de production
npm run build

# Démarrage production
npm run start
```

## 📈 Métriques et Performance

- **Base de données** : PostgreSQL avec contraintes et index optimisés
- **Cache intelligent** : TanStack Query avec invalidation automatique
- **Responsive design** : Interface adaptée mobile et desktop
- **Accessibilité** : Composants Radix UI conformes WCAG

## 🤝 Contribution

L'application est conçue pour évoluer facilement :
- **Architecture modulaire** : Ajout simple de nouvelles fonctionnalités
- **Types TypeScript** : Sécurité et auto-complétion complètes
- **Tests intégrés** : Validation automatique des modifications
- **Documentation** : Code auto-documenté avec TypeScript

## 📝 Licence

Application propriétaire développée pour Frodis.

---

**LogiFlow** - Optimisation logistique pour un commerce moderne
