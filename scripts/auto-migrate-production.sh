#!/bin/bash
# Script de migration automatique - Crée UNIQUEMENT la table announcements
# Toutes les autres tables existent déjà en production

set -e

echo "🔄 [AUTO-MIGRATE] Vérification de la table announcements..."

# Vérifier si la base de données est accessible
if ! psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
    echo "❌ [AUTO-MIGRATE] Impossible de se connecter à la base de données"
    exit 1
fi

echo "✅ [AUTO-MIGRATE] Connexion à la base de données réussie"

# Vérifier si la table announcements existe
if psql "$DATABASE_URL" -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema='public' AND table_name='announcements');" | grep -q "f"; then
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

CREATE INDEX idx_announcements_priority ON announcements(priority);
CREATE INDEX idx_announcements_created_at ON announcements(created_at DESC);
CREATE INDEX idx_announcements_author_id ON announcements(author_id);
CREATE INDEX idx_announcements_group_id ON announcements(group_id);
EOF
    echo "✅ [AUTO-MIGRATE] Table announcements créée avec succès"
else
    echo "ℹ️ [AUTO-MIGRATE] Table announcements existe déjà - aucune action nécessaire"
fi

echo "✅ [AUTO-MIGRATE] Migration terminée!"