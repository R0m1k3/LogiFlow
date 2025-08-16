# 🚀 Instructions de Déploiement avec Migration Automatique

## Vue d'ensemble
Le système est maintenant configuré pour exécuter automatiquement les migrations de base de données lors de chaque mise à jour Docker, garantissant que toutes les tables nécessaires sont créées.

## 🔧 Configuration Automatique

### Scripts créés
1. **`scripts/auto-migrate-production.sh`** - Migration automatique au démarrage
2. **`scripts/docker-entrypoint.sh`** - Point d'entrée avec migration
3. **`scripts/manual-migrate.sh`** - Migration manuelle si nécessaire

### Dockerfile modifié
- Copie automatique des scripts de migration
- Point d'entrée personnalisé avec migration
- Permissions configurées automatiquement

## 🚀 Déploiement

### Option 1: Reconstruction complète (Recommandée)
```bash
# Arrêter le conteneur actuel
docker-compose down

# Reconstruire avec les nouveaux scripts
docker-compose up --build -d

# Vérifier les logs de migration
docker-compose logs -f
```

### Option 2: Mise à jour sans reconstruction
```bash
# Copier les scripts dans le conteneur existant
docker cp scripts/ logiflow-logiflow-1:/app/

# Exécuter la migration manuellement
docker exec logiflow-logiflow-1 chmod +x /app/scripts/auto-migrate-production.sh
docker exec logiflow-logiflow-1 /app/scripts/auto-migrate-production.sh

# Redémarrer l'application
docker-compose restart
```

## 🔍 Vérification

### Logs de migration
```bash
# Voir les logs de migration au démarrage
docker-compose logs | grep "AUTO-MIGRATE"
```

### État des tables
```bash
# Vérifier que toutes les tables existent
docker exec logiflow-logiflow-1 psql $DATABASE_URL -c "
SELECT tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;
"
```

### Test du système d'annonces
```bash
# Vérifier la table announcements spécifiquement
docker exec logiflow-logiflow-1 psql $DATABASE_URL -c "
SELECT 'announcements' as table_name, count(*) as columns 
FROM information_schema.columns 
WHERE table_name = 'announcements';
"
```

## 🛠️ Dépannage

### Migration manuelle forcée
```bash
# Si la migration automatique échoue
docker exec logiflow-logiflow-1 /app/scripts/manual-migrate.sh
```

### Vérification des permissions
```bash
# Vérifier que les scripts sont exécutables
docker exec logiflow-logiflow-1 ls -la /app/scripts/
```

### Logs détaillés
```bash
# Activer le debug des migrations
docker-compose up -d --env DEBUG_MIGRATIONS=true
```

## 📋 Tables créées automatiquement

✅ **announcements** - Système d'informations (prioritaire)

Le script vérifie et crée uniquement les tables manquantes nécessaires au fonctionnement de l'application.

## 🔄 Futures mises à jour

Désormais, chaque fois que vous mettez à jour votre application Docker :
1. Le conteneur démarre
2. La migration automatique s'exécute
3. Toutes les nouvelles tables sont créées
4. L'application démarre normalement

**Plus besoin d'intervention manuelle !**