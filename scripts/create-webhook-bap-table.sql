-- Script pour créer la table webhook_bap_config en production
-- À exécuter sur le serveur de production PostgreSQL

CREATE TABLE IF NOT EXISTS webhook_bap_config (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL DEFAULT 'Configuration BAP',
  webhook_url TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insérer une configuration par défaut
INSERT INTO webhook_bap_config (name, webhook_url, description, is_active)
VALUES (
  'Configuration BAP',
  'https://workflow.ffnancy.fr/webhook/a3d03176-b72f-412d-8fb9-f920b9fbab4d',
  'Configuration par défaut pour l''envoi des fichiers BAP',
  true
) ON CONFLICT DO NOTHING;

-- Commande pour exécuter ce script :
-- psql -U username -d database_name -f scripts/create-webhook-bap-table.sql