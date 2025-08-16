-- Script de correction production pour créer la table announcements
-- À exécuter dans votre conteneur Docker

BEGIN;

-- Création de la table announcements
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

-- Création des index
CREATE INDEX IF NOT EXISTS idx_announcements_priority ON announcements(priority);
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON announcements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_author_id ON announcements(author_id);
CREATE INDEX IF NOT EXISTS idx_announcements_group_id ON announcements(group_id);

-- Commentaires
COMMENT ON TABLE announcements IS 'Admin-managed announcements/information system';
COMMENT ON COLUMN announcements.priority IS 'Priority level: normal, important, urgent';
COMMENT ON COLUMN announcements.group_id IS 'NULL for global announcements, specific group_id for store-specific announcements';

-- Vérification
SELECT 
  'Table announcements créée avec succès!' as message,
  COUNT(*) as nb_colonnes
FROM information_schema.columns 
WHERE table_name = 'announcements';

COMMIT;