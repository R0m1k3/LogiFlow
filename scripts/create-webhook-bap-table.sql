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

-- Aucune adresse par défaut : à renseigner dans Paramètres > Configuration BAP

-- Commande pour exécuter ce script :
-- psql -U username -d database_name -f scripts/create-webhook-bap-table.sql