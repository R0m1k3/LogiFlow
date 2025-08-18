#!/bin/bash

# Script de correction pour Docker entrypoint
# Applique la migration directement via docker-compose exec

set -e

echo "🔧 [FIX] Correction du problème docker-entrypoint.sh"

# Vérifier que le conteneur fonctionne
if ! docker-compose ps | grep -q logiflow; then
    echo "❌ [FIX] Conteneur logiflow non trouvé, démarrage..."
    docker-compose up -d logiflow-db
    sleep 10
fi

echo "🔄 [FIX] Application de la migration DLC directement..."

# Appliquer la migration via exec
docker-compose exec -T logiflow-db psql -U logiflow_admin -d logiflow_db << 'EOF'
-- Migration DLC stock épuisé
ALTER TABLE dlc_products 
ADD COLUMN IF NOT EXISTS stock_epuise boolean DEFAULT false NOT NULL,
ADD COLUMN IF NOT EXISTS stock_epuise_by varchar(255),
ADD COLUMN IF NOT EXISTS stock_epuise_at timestamp;

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_dlc_products_stock_epuise ON dlc_products(stock_epuise);

-- Vérification
SELECT 'Migration DLC appliquée' as status;
EOF

echo "✅ [FIX] Migration DLC appliquée avec succès"

# Redémarrer le conteneur application
echo "🔄 [FIX] Redémarrage du conteneur application..."
docker-compose restart logiflow

echo "✅ [FIX] Correction terminée"