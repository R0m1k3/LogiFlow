-- Script pour créer la table webhook_bap_config en production
-- À exécuter directement sur votre base PostgreSQL

-- Créer la table
CREATE TABLE IF NOT EXISTS webhook_bap_config (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL DEFAULT 'Configuration BAP',
  webhook_url TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insérer la configuration par défaut
INSERT INTO webhook_bap_config (name, webhook_url, description, is_active)
VALUES (
  'Configuration BAP',
  'https://workflow.ffnancy.fr/webhook-test/a3d03176-b72f-412d-8fb9-f920b9fbab4d',
  'Configuration par défaut pour l''envoi des fichiers BAP vers n8n',
  true
) ON CONFLICT DO NOTHING;

-- Créer la table de suivi des migrations
CREATE TABLE IF NOT EXISTS migrations (
  id SERIAL PRIMARY KEY,
  filename VARCHAR(255) UNIQUE NOT NULL,
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Marquer la migration comme appliquée
INSERT INTO migrations (filename) 
VALUES ('20250903141000_create_webhook_bap_config.sql')
ON CONFLICT DO NOTHING;