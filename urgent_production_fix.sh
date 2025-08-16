#!/bin/bash
# Script de correction urgente pour la production
# Exécuter depuis votre serveur de production

echo "🔧 Correction urgente pour la table announcements..."

# Création de la table via commande SQL directe
docker exec logiflow-logiflow-1 psql "$DATABASE_URL" -c "
CREATE TABLE IF NOT EXISTS announcements (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  priority VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'important', 'urgent')),
  author_id VARCHAR(255) NOT NULL,
  group_id INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT announcements_author_id_fkey FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT announcements_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_announcements_priority ON announcements(priority);
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON announcements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_author_id ON announcements(author_id);
CREATE INDEX IF NOT EXISTS idx_announcements_group_id ON announcements(group_id);

COMMENT ON TABLE announcements IS 'Admin-managed announcements/information system';
"

# Vérification de la création
echo "🔍 Vérification de la table..."
docker exec logiflow-logiflow-1 psql "$DATABASE_URL" -c "
SELECT 'SUCCESS: Table announcements créée!' as status 
FROM information_schema.tables 
WHERE table_name = 'announcements';
"

echo "✅ Script terminé!"