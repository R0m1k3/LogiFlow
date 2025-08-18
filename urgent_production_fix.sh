#!/bin/bash

# Script de correction urgente pour la production
# Applique la migration DLC immédiatement

set -e

echo "🚨 CORRECTION URGENTE - Migration DLC Production"
echo "================================================"

# Vérifier que Docker Compose est disponible
if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose non trouvé"
    exit 1
fi

# Vérifier que le conteneur PostgreSQL est en cours d'exécution
if ! docker-compose ps | grep -q logiflow-db; then
    echo "❌ Conteneur logiflow-db non trouvé"
    echo "Containers disponibles:"
    docker-compose ps
    exit 1
fi

echo "✅ Conteneur PostgreSQL trouvé"

# Appliquer la migration DLC
echo "🔄 Application de la migration DLC..."

docker-compose exec -T logiflow-db psql -U logiflow_admin -d logiflow_db << 'EOF'
-- Migration DLC Stock Épuisé
ALTER TABLE dlc_products 
ADD COLUMN IF NOT EXISTS stock_epuise boolean DEFAULT false NOT NULL,
ADD COLUMN IF NOT EXISTS stock_epuise_by varchar(255),
ADD COLUMN IF NOT EXISTS stock_epuise_at timestamp;

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_dlc_products_stock_epuise ON dlc_products(stock_epuise);

-- Vérification
SELECT 'Migration DLC appliquée avec succès' as status;

-- Afficher les colonnes ajoutées
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'dlc_products' 
AND column_name LIKE '%stock_epuise%'
ORDER BY column_name;
EOF

if [ $? -eq 0 ]; then
    echo "✅ Migration DLC appliquée avec succès"
else
    echo "❌ Erreur lors de la migration"
    exit 1
fi

# Redémarrer l'application
echo "🔄 Redémarrage de l'application..."
docker-compose restart logiflow

if [ $? -eq 0 ]; then
    echo "✅ Application redémarrée"
else
    echo "❌ Erreur lors du redémarrage"
    exit 1
fi

echo ""
echo "🎉 CORRECTION TERMINÉE"
echo "L'erreur 'column does not exist' devrait maintenant être résolue"
echo ""
echo "Vérifiez dans les logs que l'API /api/dlc-products fonctionne maintenant"