# Plateforme de Gestion Logistique avec Météo Intégrée

Une plateforme d'entreprise moderne pour la gestion logistique, le suivi des livraisons et l'intégration météorologique, conçue pour optimiser les opérations commerciales avec des insights météorologiques en temps réel.

## 🌟 Fonctionnalités Principales

### 📦 Gestion des Commandes et Livraisons
- **Création et suivi des commandes** : Interface complète pour gérer les commandes clients
- **Gestion des livraisons** : Suivi détaillé des livraisons avec statuts en temps réel
- **Liaison commandes-livraisons** : Association automatique et manuelle des commandes aux livraisons
- **Historique complet** : Traçabilité complète de toutes les opérations

### 🌤️ Widget Météo Intelligent
- **Météo actuelle** : Affichage de la température et conditions météorologiques du jour
- **Comparaison annuelle** : Comparaison avec la même date de l'année précédente
- **Géolocalisation automatique** : Détection automatique de votre localisation
- **Interface bilingue** : Support complet du français
- **Mise à jour automatique** : Données rafraîchies toutes les 30 minutes

### 🛠️ Service Après-Vente (SAV)
- **Gestion des tickets** : Système complet de tickets de support
- **Historique des interventions** : Suivi détaillé de tous les échanges
- **Statuts personnalisés** : Gestion flexible des états de tickets
- **Notifications** : Alertes automatiques pour les mises à jour

### 📊 Réconciliation et Facturation
- **Réconciliation BL/Factures** : Rapprochement automatique des bons de livraison et factures
- **Vérification intelligente** : Cache optimisé pour les vérifications répétées
- **Gestion des conflits** : Résolution automatique des incohérences
- **Mise à jour en temps réel** : Interface réactive avec feedback immédiat

### 👥 Gestion Multi-Tenant
- **Groupes d'utilisateurs** : Organisation par entreprise ou département
- **Permissions granulaires** : Contrôle d'accès fin par fonctionnalité
- **Rôles personnalisés** : Admin, employé, client avec droits spécifiques
- **Isolation des données** : Séparation stricte entre les organisations

### 💾 Sauvegarde et Sécurité
- **Sauvegardes automatiques** : Backup quotidien programmé à 2h du matin
- **Sauvegardes manuelles** : Possibilité de créer des sauvegardes à la demande
- **Authentification sécurisée** : Sessions chiffrées et gestion des mots de passe
- **Logs détaillés** : Traçabilité complète des opérations

## 🚀 Installation et Configuration

### Prérequis
- Node.js 18+ 
- PostgreSQL 13+
- Clé API Visual Crossing (gratuite sur [visualcrossing.com](https://www.visualcrossing.com/))

### Installation
```bash
# Cloner le projet
git clone [URL_DU_PROJET]
cd weather-management-platform

# Installer les dépendances
npm install

# Configurer la base de données
cp .env.example .env
# Éditer .env avec vos paramètres de base de données

# Initialiser la base de données
npm run db:push

# Démarrer l'application
npm run dev
```

### Configuration de l'API Météo
1. Créez un compte gratuit sur [Visual Crossing](https://www.visualcrossing.com/)
2. Obtenez votre clé API
3. Connectez-vous avec `admin`/`admin`
4. Allez dans **Utilitaires** → **Paramètres Météo**
5. Entrez votre clé API et votre localisation
6. Testez la connexion et sauvegardez

## 📱 Utilisation

### Première Connexion
- **Identifiants par défaut** : `admin` / `admin`
- **Changement obligatoire** : Modifiez le mot de passe lors de la première connexion
- **Configuration météo** : Configurez l'API météo dans les utilitaires

### Navigation Principale
- **Tableau de bord** : Vue d'ensemble avec météo et statistiques
- **Commandes** : Gestion complète des commandes clients
- **Livraisons** : Suivi et gestion des livraisons
- **SAV** : Service après-vente et tickets de support
- **Réconciliation** : Rapprochement BL/Factures
- **Utilitaires** : Configuration et outils administrateur

### Fonctionnalités Courantes

#### Créer une Commande
1. Allez dans **Commandes** → **Nouvelle Commande**
2. Remplissez les informations client
3. Ajoutez les articles et quantités
4. Validez et sauvegardez

#### Suivre une Livraison
1. Accédez à **Livraisons**
2. Recherchez par numéro ou client
3. Consultez le statut et l'historique
4. Mettez à jour si nécessaire

#### Gérer un Ticket SAV
1. Ouvrez **SAV** → **Nouveau Ticket**
2. Décrivez le problème
3. Assignez la priorité
4. Suivez les échanges dans l'historique

## 🛠️ Technologies Utilisées

### Frontend
- **React 18** : Interface utilisateur moderne
- **TypeScript** : Typage statique pour la robustesse
- **Tailwind CSS** : Design system cohérent
- **Shadcn/UI** : Composants UI professionnels
- **React Query** : Gestion d'état et cache intelligent
- **Wouter** : Routage léger et performant

### Backend
- **Node.js** : Runtime JavaScript haute performance
- **Express** : Framework web minimaliste
- **TypeScript** : Développement sécurisé côté serveur
- **Drizzle ORM** : ORM moderne et type-safe
- **Zod** : Validation de schémas robuste

### Base de Données
- **PostgreSQL** : Base de données relationnelle performante
- **Migrations automatiques** : Évolution de schéma sécurisée
- **Backup intégré** : Système de sauvegarde automatique

### APIs Externes
- **Visual Crossing Weather API** : Données météorologiques fiables
- **OpenStreetMap Nominatim** : Géocodage inverse pour la géolocalisation

## 📁 Structure du Projet

```
├── client/                 # Frontend React
│   ├── src/
│   │   ├── components/     # Composants réutilisables
│   │   ├── pages/         # Pages de l'application
│   │   ├── lib/           # Utilitaires et configuration
│   │   └── hooks/         # Hooks React personnalisés
├── server/                # Backend Express
│   ├── routes.ts          # Définition des routes API
│   ├── storage.ts         # Interface de stockage
│   ├── weatherService.ts  # Service météorologique
│   └── index.ts          # Point d'entrée du serveur
├── shared/                # Code partagé
│   └── schema.ts         # Schémas de base de données
├── migrations/           # Migrations de base de données
└── backups/             # Dossier des sauvegardes
```

## 🔧 Configuration Avancée

### Variables d'Environnement
```env
# Base de données
DATABASE_URL=postgresql://user:password@localhost:5432/dbname

# Météo
VISUAL_CROSSING_API_KEY=votre_clé_api_ici

# Application
NODE_ENV=production
PORT=3000
```

### Personnalisation
- **Thèmes** : Mode sombre/clair automatique
- **Localisation** : Interface entièrement en français
- **Permissions** : Système de rôles configurable
- **Notifications** : Alertes personnalisables

## 📈 Monitoring et Maintenance

### Logs
- **Développement** : Logs détaillés en console
- **Production** : Logs optimisés pour les performances
- **Erreurs** : Gestion gracieuse avec fallbacks

### Performance
- **Cache intelligent** : Mise en cache des données météo
- **Lazy loading** : Chargement optimisé des composants
- **Optimisation bundle** : Build production optimisé

### Sauvegardes
- **Automatiques** : Tous les jours à 2h du matin
- **Manuelles** : Via l'interface d'administration
- **Restauration** : Processus guidé de restauration

## 🆘 Support et Dépannage

### Problèmes Courants

**L'API météo ne fonctionne pas**
- Vérifiez votre clé API Visual Crossing
- Testez la connexion dans les paramètres
- Vérifiez votre quota API

**Données manquantes**
- Vérifiez la connexion à la base de données
- Consultez les logs serveur
- Vérifiez les permissions utilisateur

**Interface lente**
- Videz le cache navigateur
- Vérifiez votre connexion internet
- Redémarrez l'application

### Contact
Pour toute question technique ou fonctionnelle, consultez les logs de l'application ou contactez l'équipe de développement.

## 📄 Licence

Ce projet est développé pour un usage d'entreprise. Tous droits réservés.

---

**Version actuelle** : 2.27.9  
**Dernière mise à jour** : Août 2025  
**Compatibilité** : Node.js 18+, PostgreSQL 13+, Navigateurs modernes