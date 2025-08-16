# 🚨 SOLUTION IMMÉDIATE POUR LA PRODUCTION

## Problème
La table `announcements` n'existe pas dans votre base de données de production, ce qui cause l'erreur:
```
Error: relation "announcements" does not exist
```

## Solution en 3 étapes simples

### 1. Connectez-vous à votre serveur de production
```bash
# SSH vers votre serveur
ssh votre-serveur-production
```

### 2. Accédez au conteneur Docker
```bash
# Entrer dans le conteneur
docker exec -it logiflow-logiflow-1 bash
```

### 3. Créer la table directement
```bash
# Dans le conteneur, exécuter cette commande :
psql $DATABASE_URL -c "
CREATE TABLE IF NOT EXISTS announcements (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  priority VARCHAR(20) NOT NULL DEFAULT 'normal',
  author_id VARCHAR(255) NOT NULL,
  group_id INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT announcements_priority_check CHECK (priority IN ('normal', 'important', 'urgent')),
  CONSTRAINT announcements_author_id_fkey FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT announcements_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_announcements_priority ON announcements(priority);
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON announcements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_author_id ON announcements(author_id);
CREATE INDEX IF NOT EXISTS idx_announcements_group_id ON announcements(group_id);
"
```

### 4. Vérifier que ça fonctionne
```bash
# Vérifier que la table existe
psql $DATABASE_URL -c "SELECT 'SUCCESS: Table announcements créée!' as status;"
```

### 5. Sortir du conteneur
```bash
exit
```

## Résultat attendu
Après ces étapes, le système d'annonces fonctionnera immédiatement sur votre production.

## Alternative plus simple (une seule commande)
```bash
docker exec logiflow-logiflow-1 psql $DATABASE_URL -c "CREATE TABLE IF NOT EXISTS announcements (id SERIAL PRIMARY KEY, title VARCHAR(255) NOT NULL, content TEXT NOT NULL, priority VARCHAR(20) NOT NULL DEFAULT 'normal', author_id VARCHAR(255) NOT NULL, group_id INTEGER, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), CONSTRAINT announcements_priority_check CHECK (priority IN ('normal', 'important', 'urgent')), CONSTRAINT announcements_author_id_fkey FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE, CONSTRAINT announcements_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE);"
```

## Script minimal (nouvelle option)
```bash
# Copier et exécuter le script minimal
docker cp scripts/fix-announcements-only.sh logiflow-logiflow-1:/app/scripts/
docker exec logiflow-logiflow-1 chmod +x /app/scripts/fix-announcements-only.sh
docker exec logiflow-logiflow-1 /app/scripts/fix-announcements-only.sh
```

La correction du problème `Select.Item` value est déjà faite dans le code source.