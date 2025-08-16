#!/bin/bash
# Script de migration automatique pour les mises à jour Docker
# Crée uniquement les tables manquantes nécessaires au fonctionnement

set -e

echo "🔄 [AUTO-MIGRATE] Vérification des tables manquantes..."

# Vérifier si la base de données est accessible
if ! psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
    echo "❌ [AUTO-MIGRATE] Impossible de se connecter à la base de données"
    exit 1
fi

echo "✅ [AUTO-MIGRATE] Connexion à la base de données réussie"

# Fonction pour vérifier si une table existe
table_exists() {
    local table_name=$1
    psql "$DATABASE_URL" -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema='public' AND table_name='$table_name');"
}

# Migration prioritaire: Table announcements (système d'informations)
if [ "$(table_exists 'announcements')" = "f" ]; then
    echo "🔧 [AUTO-MIGRATE] Création de la table announcements..."
    psql "$DATABASE_URL" << 'EOF'
CREATE TABLE announcements (
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

COMMENT ON TABLE announcements IS 'Système d informations - annonces administrateur';
EOF
    echo "✅ [AUTO-MIGRATE] Table announcements créée avec succès"
else
    echo "ℹ️ [AUTO-MIGRATE] Table announcements existe déjà"
fi

# Vérification finale
echo "📊 [AUTO-MIGRATE] Vérification des tables essentielles:"
psql "$DATABASE_URL" -c "
SELECT 
  CASE 
    WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'announcements') THEN '✅ announcements'
    ELSE '❌ announcements manquante'
  END as status_announcements,
  CASE 
    WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users') THEN '✅ users'
    ELSE '❌ users manquante'
  END as status_users,
  CASE 
    WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'groups') THEN '✅ groups'
    ELSE '❌ groups manquante'
  END as status_groups;
"

echo "✅ [AUTO-MIGRATE] Vérification terminée!"