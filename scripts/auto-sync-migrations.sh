#!/bin/bash

# Script de synchronisation automatique des migrations
# Applique toutes les migrations SQL manquantes et synchronise le schéma

set -e

echo "🔄 [SYNC] Synchronisation automatique des migrations"
echo "=================================================="

# Fonction de logging
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Vérification de la connexion base de données
if [ -z "$DATABASE_URL" ]; then
    log "❌ DATABASE_URL non défini"
    exit 1
fi

log "🔍 Connexion à la base de données..."

# Test de connexion
if ! psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
    log "❌ Impossible de se connecter à la base de données"
    exit 1
fi

log "✅ Connexion base de données réussie"

# Vérifier si la table dlc_products existe
log "🔍 Vérification de la table dlc_products..."

if ! psql "$DATABASE_URL" -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name='dlc_products');" | grep -q "t"; then
    log "❌ Table dlc_products non trouvée - exécution de la migration initiale nécessaire"
    
    # Appliquer la migration initiale depuis 0000_flashy_blur.sql
    if [ -f "migrations/0000_flashy_blur.sql" ]; then
        log "🔄 Application de la migration initiale..."
        psql "$DATABASE_URL" -f "migrations/0000_flashy_blur.sql"
        log "✅ Migration initiale appliquée"
    else
        log "❌ Fichier de migration initiale non trouvé"
        exit 1
    fi
fi

# Vérifier si les colonnes stock_epuise existent
log "🔍 Vérification des colonnes DLC stock épuisé..."

COLUMNS_EXIST=$(psql "$DATABASE_URL" -tAc "
    SELECT COUNT(*) 
    FROM information_schema.columns 
    WHERE table_name='dlc_products' 
    AND column_name IN ('stock_epuise', 'stock_epuise_by', 'stock_epuise_at');
")

if [ "$COLUMNS_EXIST" != "3" ]; then
    log "🔄 Application de la migration DLC stock épuisé ($COLUMNS_EXIST/3 colonnes trouvées)..."
    
    # Appliquer la migration DLC
    psql "$DATABASE_URL" -f "migrations/002_add_dlc_stock_epuise.sql"
    
    if [ $? -eq 0 ]; then
        log "✅ Migration DLC stock épuisé appliquée"
    else
        log "❌ Erreur lors de la migration DLC"
        exit 1
    fi
else
    log "✅ Colonnes DLC stock épuisé déjà présentes"
fi

# Vérification finale
log "🔍 Vérification finale des colonnes..."

FINAL_CHECK=$(psql "$DATABASE_URL" -tAc "
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name='dlc_products' 
    AND column_name IN ('stock_epuise', 'stock_epuise_by', 'stock_epuise_at')
    ORDER BY column_name;
")

if [ $(echo "$FINAL_CHECK" | wc -l) -eq 3 ]; then
    log "✅ Toutes les colonnes DLC sont présentes:"
    echo "$FINAL_CHECK" | sed 's/^/   - /'
else
    log "❌ Colonnes manquantes détectées"
    exit 1
fi

log "🎉 Synchronisation des migrations terminée avec succès"