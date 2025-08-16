# 🚨 CORRECTION URGENTE - ERREUR DOCKER ENTRYPOINT

## Problème actuel
Le conteneur Docker ne peut pas démarrer à cause de l'erreur :
```
exec /app/docker-entrypoint.sh: no such file or directory
```

## 🔧 Solution immédiate (1 commande)

**Créer directement la table announcements :**
```bash
docker exec logiflow-logiflow-1 psql $DATABASE_URL -c "CREATE TABLE IF NOT EXISTS announcements (id SERIAL PRIMARY KEY, title VARCHAR(255) NOT NULL, content TEXT NOT NULL, priority VARCHAR(20) NOT NULL DEFAULT 'normal', author_id VARCHAR(255) NOT NULL, group_id INTEGER, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), CONSTRAINT announcements_priority_check CHECK (priority IN ('normal', 'important', 'urgent')), CONSTRAINT announcements_author_id_fkey FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE, CONSTRAINT announcements_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE);"
```

## 🛠️ Correction du Docker (pour arrêter les erreurs)

**Reconstruire le conteneur avec le Dockerfile corrigé :**
```bash
# Arrêter le conteneur actuel
docker-compose down

# Reconstruire sans entrypoint
docker-compose up --build -d
```

## ✅ Résultat
- Table announcements créée
- Conteneur Docker fonctionnel
- Plus d'erreurs d'entrypoint
- Système d'annonces opérationnel

## 📋 Vérification
```bash
# Vérifier que la table existe
docker exec logiflow-logiflow-1 psql $DATABASE_URL -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name='announcements');"
```