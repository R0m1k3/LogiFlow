-- Commandes à exécuter DIRECTEMENT dans votre conteneur Docker
-- Copiez et collez ces commandes une par une dans votre terminal

-- 1. Entrer dans le conteneur
-- docker exec -it logiflow-logiflow-1 /bin/bash

-- 2. Une fois dans le conteneur, exécuter cette commande SQL :
-- psql $DATABASE_URL

-- 3. Coller ce SQL dans psql :

CREATE TABLE IF NOT EXISTS announcements (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  priority VARCHAR(20) NOT NULL DEFAULT 'normal',
  author_id VARCHAR(255) NOT NULL,
  group_id INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE announcements ADD CONSTRAINT announcements_priority_check 
CHECK (priority IN ('normal', 'important', 'urgent'));

ALTER TABLE announcements ADD CONSTRAINT announcements_author_id_fkey 
FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE announcements ADD CONSTRAINT announcements_group_id_fkey 
FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_announcements_priority ON announcements(priority);
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON announcements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_author_id ON announcements(author_id);
CREATE INDEX IF NOT EXISTS idx_announcements_group_id ON announcements(group_id);

-- Vérification
SELECT 'SUCCESS: Table announcements créée avec succès!' as result;
SELECT COUNT(*) as nb_colonnes FROM information_schema.columns WHERE table_name = 'announcements';

-- 4. Taper \q pour quitter psql
-- 5. Taper exit pour quitter le conteneur