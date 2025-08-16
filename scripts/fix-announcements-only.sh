#!/bin/bash
# Script minimal pour créer uniquement la table announcements
# Usage: docker exec logiflow-logiflow-1 /app/scripts/fix-announcements-only.sh

echo "🔧 [FIX] Création de la table announcements uniquement..."

# Créer la table announcements
psql "$DATABASE_URL" << 'EOF'
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
EOF

echo "✅ [FIX] Table announcements créée. Vérification..."

# Vérifier que la table existe
if psql "$DATABASE_URL" -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name='announcements');" | grep -q "t"; then
    echo "✅ [FIX] Succès: La table announcements existe maintenant"
    
    # Afficher la structure
    echo "📋 [FIX] Structure de la table:"
    psql "$DATABASE_URL" -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'announcements' ORDER BY ordinal_position;"
else
    echo "❌ [FIX] Erreur: La table announcements n'a pas été créée"
    exit 1
fi