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
    
    # Forcer l'affichage des logs du script de migration
    log "🔄 Démarrage des migrations avec logs détaillés..."
    if /app/scripts/auto-migrate-production.sh 2>&1; then
        log "✅ Migrations exécutées avec succès"
    else
        log "❌ Erreur lors des migrations, mais continuation..."
        # Ne pas exit pour éviter de bloquer le démarrage
    fi
else
    log "⚠️ Script de migration non trouvé à /app/scripts/auto-migrate-production.sh"
    log "🔍 Contenu du répertoire scripts:"
    ls -la /app/scripts/ || echo "Répertoire scripts non trouvé"
    
    # Créer la table webhook_bap_config directement si le script manque
    log "🛠️ Tentative de création directe de la table webhook_bap_config..."
    if [ -n "$DATABASE_URL" ]; then
        psql "$DATABASE_URL" << 'EOF'
CREATE TABLE IF NOT EXISTS webhook_bap_config (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL DEFAULT 'Configuration BAP',
  webhook_url TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO webhook_bap_config (name, webhook_url, description, is_active)
SELECT 
  'Configuration BAP',
  'https://workflow.ffnancy.fr/webhook/a3d03176-b72f-412d-8fb9-f920b9fbab4d',
  'Configuration par défaut pour envoi des fichiers BAP vers n8n',
  true
WHERE NOT EXISTS (SELECT 1 FROM webhook_bap_config);

COMMENT ON TABLE webhook_bap_config IS 'Configuration pour webhook BAP n8n';
EOF
        log "✅ Table webhook_bap_config créée directement"
    else
        log "❌ DATABASE_URL manquante pour création directe"
    fi
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

    log "✅ Migration directe DLC terminée"
fi

# Vérification de la table webhook_bap_config
log "🔍 Vérification de la table webhook_bap_config..."
if psql "$DATABASE_URL" -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema='public' AND table_name='webhook_bap_config');" | grep -q "t"; then
    log "✅ Table webhook_bap_config présente"
else
    log "❌ Table webhook_bap_config manquante"
    log "🛠️ Création directe de la table webhook_bap_config..."
    
    psql "$DATABASE_URL" << 'EOF'
CREATE TABLE webhook_bap_config (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL DEFAULT 'Configuration BAP',
  webhook_url TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO webhook_bap_config (name, webhook_url, description, is_active)
VALUES (
  'Configuration BAP',
  'https://workflow.ffnancy.fr/webhook/a3d03176-b72f-412d-8fb9-f920b9fbab4d',
  'Configuration par défaut pour envoi des fichiers BAP vers n8n',
  true
);

COMMENT ON TABLE webhook_bap_config IS 'Configuration pour webhook BAP n8n';
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