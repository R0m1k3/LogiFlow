-- Script SQL simple pour créer UNIQUEMENT la table announcements en production
-- À exécuter directement dans le conteneur Docker

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

-- Créer les index pour les performances
CREATE INDEX IF NOT EXISTS idx_announcements_priority ON announcements(priority);
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON announcements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_author_id ON announcements(author_id);
CREATE INDEX IF NOT EXISTS idx_announcements_group_id ON announcements(group_id);

-- Vérification
SELECT 'Table announcements créée avec succès' as resultat;
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'announcements' ORDER BY ordinal_position;