-- Migration: Ajout email fournisseurs + table contacts par magasin
-- Created: 2026-05-15

-- Ajout du champ email sur les fournisseurs
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- Table des contacts libres, rattachés à un magasin
CREATE TABLE IF NOT EXISTS contacts (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(255),
  phone VARCHAR(50),
  email VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index pour recherche rapide par magasin
CREATE INDEX IF NOT EXISTS idx_contacts_group_id ON contacts(group_id);
