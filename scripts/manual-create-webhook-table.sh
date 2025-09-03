#!/bin/bash
# Script de secours pour créer la table webhook_bap_config manuellement

set -e

echo "🔧 [MANUAL-FIX] Création manuelle de la table webhook_bap_config..."

# Vérifier la connection
if ! psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
    echo "❌ [MANUAL-FIX] Impossible de se connecter à la base de données"
    echo "🔍 [MANUAL-FIX] DATABASE_URL: ${DATABASE_URL:0:50}..."
    exit 1
fi

echo "✅ [MANUAL-FIX] Connexion à la base de données réussie"

# Créer la table
echo "🔧 [MANUAL-FIX] Création de la table webhook_bap_config..."
psql "$DATABASE_URL" << 'EOF'
-- Création sécurisée de la table
CREATE TABLE IF NOT EXISTS webhook_bap_config (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL DEFAULT 'Configuration BAP',
  webhook_url TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insérer la configuration par défaut si pas présente
INSERT INTO webhook_bap_config (name, webhook_url, description, is_active)
SELECT 
  'Configuration BAP',
  'https://workflow.ffnancy.fr/webhook/a3d03176-b72f-412d-8fb9-f920b9fbab4d',
  'Configuration par défaut pour envoi des fichiers BAP vers n8n',
  true
WHERE NOT EXISTS (SELECT 1 FROM webhook_bap_config);

-- Commentaire
COMMENT ON TABLE webhook_bap_config IS 'Configuration pour webhook BAP n8n';
EOF

if [ $? -eq 0 ]; then
    echo "✅ [MANUAL-FIX] Table webhook_bap_config créée avec succès!"
    
    # Vérification
    echo "🔍 [MANUAL-FIX] Vérification finale..."
    psql "$DATABASE_URL" -c "SELECT COUNT(*) as nb_configs FROM webhook_bap_config;"
    psql "$DATABASE_URL" -c "SELECT * FROM webhook_bap_config;"
else
    echo "❌ [MANUAL-FIX] Échec de la création de la table"
    exit 1
fi

echo "🎉 [MANUAL-FIX] Terminé avec succès!"