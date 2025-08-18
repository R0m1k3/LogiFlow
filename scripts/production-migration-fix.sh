#!/bin/bash

# Script de correction des migrations pour la production
# Solution complète pour appliquer automatiquement les migrations DLC

set -e

echo "🚨 [PRODUCTION FIX] Correction automatique des migrations"
echo "========================================================"

# Fonction de logging avec timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Vérification de Docker Compose
if ! command -v docker-compose &> /dev/null; then
    log "❌ docker-compose non trouvé"
    exit 1
fi

# Vérification que le conteneur PostgreSQL est actif
log "🔍 Vérification du conteneur PostgreSQL..."

if ! docker-compose ps | grep -q logiflow-db; then
    log "❌ Conteneur logiflow-db non actif"
    log "📋 Conteneurs disponibles:"
    docker-compose ps
    exit 1
fi

log "✅ Conteneur PostgreSQL actif"

# Application de toutes les migrations manquantes
log "🔄 Application des migrations manquantes..."

# Migration 1: Vérification et création de la structure de base
log "📂 Étape 1: Vérification de la structure de base..."

docker-compose exec -T logiflow-db psql -U logiflow_admin -d logiflow_db << 'EOF'
-- Vérifier que la table dlc_products existe
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'dlc_products') THEN
        RAISE NOTICE 'Table dlc_products manquante - création nécessaire';
        -- La table sera créée par la migration initiale si nécessaire
    ELSE
        RAISE NOTICE 'Table dlc_products trouvée';
    END IF;
END $$;
EOF

# Migration 2: Application de la migration DLC stock épuisé
log "📂 Étape 2: Application de la migration DLC stock épuisé..."

docker-compose exec -T logiflow-db psql -U logiflow_admin -d logiflow_db << 'EOF'
-- Migration DLC Stock Épuisé - Version de production sécurisée
DO $$
DECLARE
    column_count integer;
BEGIN
    -- Compter les colonnes existantes
    SELECT COUNT(*) INTO column_count
    FROM information_schema.columns 
    WHERE table_name = 'dlc_products' 
    AND column_name IN ('stock_epuise', 'stock_epuise_by', 'stock_epuise_at');
    
    RAISE NOTICE 'Colonnes DLC stock épuisé trouvées: %', column_count;
    
    -- Ajouter les colonnes manquantes
    IF column_count < 3 THEN
        RAISE NOTICE 'Application de la migration DLC...';
        
        -- Ajouter les colonnes avec protection IF NOT EXISTS
        ALTER TABLE dlc_products 
        ADD COLUMN IF NOT EXISTS stock_epuise boolean DEFAULT false NOT NULL,
        ADD COLUMN IF NOT EXISTS stock_epuise_by varchar(255),
        ADD COLUMN IF NOT EXISTS stock_epuise_at timestamp;
        
        -- Créer l'index
        CREATE INDEX IF NOT EXISTS idx_dlc_products_stock_epuise ON dlc_products(stock_epuise);
        
        -- Initialiser les valeurs existantes
        UPDATE dlc_products 
        SET stock_epuise = false 
        WHERE stock_epuise IS NULL;
        
        RAISE NOTICE 'Migration DLC appliquée avec succès';
    ELSE
        RAISE NOTICE 'Migration DLC déjà appliquée';
    END IF;
END $$;

-- Vérification finale
SELECT 
    'Migration DLC - Verification finale' as status,
    COUNT(*) as colonnes_dlc_trouvees
FROM information_schema.columns 
WHERE table_name = 'dlc_products' 
AND column_name IN ('stock_epuise', 'stock_epuise_by', 'stock_epuise_at');
EOF

if [ $? -eq 0 ]; then
    log "✅ Migration DLC appliquée avec succès"
else
    log "❌ Erreur lors de la migration DLC"
    exit 1
fi

# Redémarrage de l'application
log "🔄 Redémarrage de l'application..."
docker-compose restart logiflow

# Attendre que l'application redémarre
log "⏳ Attente du redémarrage (30 secondes)..."
sleep 30

# Vérification finale
log "🔍 Vérification finale de l'API DLC..."

# Test de l'API DLC
HEALTH_CHECK=$(docker-compose logs logiflow 2>&1 | tail -20 | grep -c "Error fetching DLC products" || echo "0")

if [ "$HEALTH_CHECK" -eq 0 ]; then
    log "✅ API DLC fonctionne correctement"
else
    log "⚠️ Des erreurs DLC persistent - vérification manuelle nécessaire"
fi

echo ""
echo "🎉 CORRECTION DE PRODUCTION TERMINÉE"
echo "=================================="
echo "✅ Migrations DLC appliquées"
echo "✅ Application redémarrée"
echo "✅ L'erreur 'column does not exist' devrait être résolue"
echo ""
echo "Vérifiez maintenant votre interface DLC pour confirmer que tout fonctionne."