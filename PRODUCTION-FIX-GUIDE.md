# Guide de Correction Production - LogiFlow

## Problèmes Résolus ✅

### 1. Changement de Mot de Passe Administrateur
**Problème** : ERR_MODULE_NOT_FOUND pour localAuth.production.js
**Solution** : Implémentation d'une fonction `hashPasswordSimple` intégrée dans routes.ts qui fonctionne dans tous les environnements.

### 2. Attribution des Groupes aux Utilisateurs  
**Problème** : Colonne "created_at" manquante dans la table user_groups en production
**Solution** : Gestion d'erreur dans `assignUserToGroup` avec fallback automatique.

## Solutions Disponibles

### Solution A : Correction Automatique (Recommandée) ✅
Le code a été modifié pour détecter automatiquement si la colonne `created_at` existe :
- Essaie d'insérer avec le schéma complet
- En cas d'erreur, insère sans la colonne `created_at`
- Aucune intervention manuelle requise

### Solution B : Mise à Jour de Base de Données (Optionnelle)
Si vous souhaitez synchroniser complètement votre base de données production avec le schéma :

```sql
-- Exécuter sur votre serveur de production
ALTER TABLE user_groups 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
```

## Test des Corrections

1. **Changement de Mot de Passe** : Testez via l'interface utilisateur
2. **Attribution de Groupes** : Testez l'assignment d'utilisateurs aux groupes

## Débogage Production

### Problème "Aucun utilisateur trouvé"
Si l'interface affiche "Aucun utilisateur trouvé" :

1. **Vérification Base de Données** : Utilisez `production-users-debug.sql`
   ```bash
   psql $DATABASE_URL -f production-users-debug.sql
   ```

2. **Vérification API** : Testez l'endpoint directement
   ```bash
   curl -H "Cookie: [votre-cookie-session]" https://votre-domaine.com/api/users
   ```

### Script de Diagnostic SQL
- `debug-usergroups-production.sql` : Problèmes d'association utilisateur-groupe
- `production-users-debug.sql` : Problème de récupération des utilisateurs

### Problème Création d'Utilisateur
Si la création d'utilisateur échoue :

1. **Test Manuel** : Utilisez `test-create-user-production.js`
   ```bash
   PRODUCTION_HOST=votre-domaine.com SESSION_COOKIE="connect.sid=..." node test-create-user-production.js
   ```

2. **Vérification Logs** : Cherchez ces messages d'erreur :
   - `❌ Password hashing failed`
   - `❌ Storage createUser error`
   - Database connection errors

### Logs de Débogage Disponibles
**Récupération Utilisateurs :**
- `🔍 GET /api/users - Fetching users with simplified approach`
- `📊 Found X base users`
- `❌ Error getting groups for user [username]:`
- `🔐 API /api/users - Returning: {length: X, totalGroups: Y}`

**Création Utilisateur :**
- `🔍 POST /api/users - Creating new user`
- `📥 Request body: [données]`
- `🔒 Hashing password...`
- `🔍 Storage createUser called with: [username]`
- `✅ Storage createUser successful: [username]`

## Déploiement

1. Redéployez votre application avec les dernières modifications
2. Testez les fonctionnalités utilisateur en production
3. Les logs montreront si le mode fallback est utilisé pour les groupes

## Logs de Débogage

En production, vous verrez :
- `⚠️ Production mode: user_groups table missing created_at column, inserting without it` si la colonne n'existe pas
- Aucun message si la table a été mise à jour avec la colonne manquante

Ces corrections garantissent la compatibilité dans tous les environnements sans casser la fonctionnalité.