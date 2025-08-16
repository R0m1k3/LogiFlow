-- Script d'initialisation PostgreSQL pour les annonces
CREATE TABLE IF NOT EXISTS announcements (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('normal', 'important', 'urgent')),
    author_id VARCHAR(255) NOT NULL,
    group_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_announcements_priority ON announcements(priority);
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON announcements(created_at);
CREATE INDEX IF NOT EXISTS idx_announcements_group_id ON announcements(group_id);

-- Insertion de données de test
INSERT INTO announcements (title, content, priority, author_id, group_id) VALUES
('Bienvenue dans le système d''informations', 'Ce nouveau système remplace l''ancienne carte des commandes clients. Vous pouvez maintenant créer et gérer des annonces importantes.', 'important', 'admin', 1),
('Maintenance programmée', 'Une maintenance système aura lieu dimanche prochain de 2h à 4h du matin.', 'normal', 'admin', NULL)
ON CONFLICT DO NOTHING;

-- Afficher le résultat
SELECT COUNT(*) as total_announcements FROM announcements;