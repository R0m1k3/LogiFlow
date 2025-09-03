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

-- Configuration par défaut webhook BAP
INSERT INTO webhook_bap_config (name, webhook_url, description, is_active)
VALUES (
  'Configuration BAP',
  'https://workflow.ffnancy.fr/webhook/a3d03176-b72f-412d-8fb9-f920b9fbab4d',
  'Configuration par défaut pour l''envoi des fichiers BAP vers n8n',
  true
) ON CONFLICT DO NOTHING;

-- Commentaire sur la table
COMMENT ON TABLE webhook_bap_config IS 'Configuration pour webhook BAP n8n';