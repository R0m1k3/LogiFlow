-- Migration: Création table configuration webhook BAP
-- Created: 2025-09-03T14:10:00.000Z

-- Table pour configuration webhook BAP
CREATE TABLE IF NOT EXISTS webhook_bap_config (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL DEFAULT 'Configuration BAP',
  webhook_url TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Aucune adresse par défaut : à renseigner dans Paramètres > Configuration BAP

-- Commentaire sur la table
COMMENT ON TABLE webhook_bap_config IS 'Configuration pour webhook BAP n8n';