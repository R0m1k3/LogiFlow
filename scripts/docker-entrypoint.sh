#!/bin/bash

# Script d'entrée Docker - Applique automatiquement les migrations au démarrage
# Auteur: Système de gestion automatisé
# Date: 2025-08-18

set -e

echo "🚀 [ENTRYPOINT] Démarrage du conteneur de production"
echo "=================================================="

# Fonction de logging avec timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log "🔧 Initialisation des variables d'environnement..."

# Construire DATABASE_URL si nécessaire
if [ -z "$DATABASE_URL" ]; then
    if [ -n "$POSTGRES_USER" ] && [ -n "$POSTGRES_PASSWORD" ] && [ -n "$POSTGRES_DB" ]; then
        export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@logiflow-db:5432/${POSTGRES_DB}"
        log "✅ URL de base de données construite automatiquement"
    else
        log "⚠️ Variables PostgreSQL manquantes, utilisation de DATABASE_URL existant"
    fi
fi

# Attendre que PostgreSQL soit prêt
log "⏳ Attente de PostgreSQL..."
max_attempts=30
attempt=1

while [ $attempt -le $max_attempts ]; do
    if psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
        log "✅ PostgreSQL est prêt"
        break
    fi
    
    if [ $attempt -eq $max_attempts ]; then
        log "❌ PostgreSQL non accessible après $max_attempts tentatives"
        log "🔍 Variables DB: USER=${POSTGRES_USER:-'non défini'} DB=${POSTGRES_DB:-'non défini'}"
        exit 1
    fi
    
    log "⏳ Tentative $attempt/$max_attempts - attente 2 secondes..."
    sleep 2
    ((attempt++))
done

# Exécuter les migrations automatiques
log "🔄 Exécution des migrations automatiques..."
if [ -f "/app/scripts/auto-migrate-production.sh" ]; then
    log "📂 Script de migration trouvé, exécution..."
    chmod +x /app/scripts/auto-migrate-production.sh
    
    if /app/scripts/auto-migrate-production.sh; then
        log "✅ Migrations exécutées avec succès"
    else
        log "❌ Erreur lors des migrations"
        exit 1
    fi
else
    log "⚠️ Script de migration non trouvé à /app/scripts/auto-migrate-production.sh"
    log "🔍 Contenu du répertoire scripts:"
    ls -la /app/scripts/ || echo "Répertoire scripts non trouvé"
fi

# Vérification post-migration
log "🔍 Vérification des colonnes DLC..."
if psql "$DATABASE_URL" -tAc "SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name='dlc_products' AND column_name='stock_epuise');" | grep -q "t"; then
    log "✅ Colonnes DLC stock épuisé présentes"
else
    log "❌ Colonnes DLC stock épuisé manquantes"
    log "🛠️ Tentative de migration directe..."
    
    psql "$DATABASE_URL" << 'EOF'
ALTER TABLE dlc_products 
ADD COLUMN IF NOT EXISTS stock_epuise boolean DEFAULT false NOT NULL,
ADD COLUMN IF NOT EXISTS stock_epuise_by varchar(255),
ADD COLUMN IF NOT EXISTS stock_epuise_at timestamp;

CREATE INDEX IF NOT EXISTS idx_dlc_products_stock_epuise ON dlc_products(stock_epuise);
EOF
    
    if [ $? -eq 0 ]; then
        log "✅ Migration directe réussie"
    else
        log "❌ Migration directe échouée"
        exit 1
    fi
fi

# Démarrage de l'application
log "🚀 Démarrage de l'application..."
log "=================================================="

# Exécuter la commande passée en paramètre (normalement "node dist/index.js")
exec "$@"