#!/bin/bash
# Script de migration automatique - Production
# Crée la table announcements et ajoute les champs DLC stock épuisé

set -e

echo "🔄 [AUTO-MIGRATE] Début des migrations automatiques..."

# Construire DATABASE_URL si nécessaire
if [ -z "$DATABASE_URL" ]; then
    if [ -n "$POSTGRES_USER" ] && [ -n "$POSTGRES_PASSWORD" ] && [ -n "$POSTGRES_DB" ]; then
        export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@logiflow-db:5432/${POSTGRES_DB}"
        echo "🔧 [AUTO-MIGRATE] URL de base de données construite"
    else
        echo "❌ [AUTO-MIGRATE] Variables de base de données manquantes"
        exit 1
    fi
fi

# Vérifier si la base de données est accessible
echo "🔗 [AUTO-MIGRATE] Test de connexion à la base de données..."
if ! psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
    echo "❌ [AUTO-MIGRATE] Impossible de se connecter à la base de données"
    exit 1
fi

echo "✅ [AUTO-MIGRATE] Connexion à la base de données réussie"

# Vérifier si la table announcements existe
if psql "$DATABASE_URL" -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema='public' AND table_name='announcements');" | grep -q "f"; then
    echo "🔧 [AUTO-MIGRATE] Création de la table announcements..."
    psql "$DATABASE_URL" << 'EOF'
CREATE TABLE announcements (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  priority VARCHAR(20) NOT NULL DEFAULT 'normal',
  author_id VARCHAR(255) NOT NULL,
  group_id INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT announcements_priority_check CHECK (priority IN ('normal', 'important', 'urgent')),
  CONSTRAINT announcements_author_id_fkey FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT announcements_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
);

CREATE INDEX idx_announcements_priority ON announcements(priority);
CREATE INDEX idx_announcements_created_at ON announcements(created_at DESC);
CREATE INDEX idx_announcements_author_id ON announcements(author_id);
CREATE INDEX idx_announcements_group_id ON announcements(group_id);
EOF
    echo "✅ [AUTO-MIGRATE] Table announcements créée avec succès"
else
    echo "ℹ️ [AUTO-MIGRATE] Table announcements existe déjà - aucune action nécessaire"
fi

# Vérifier et ajouter les colonnes DLC stock épuisé
echo "🔄 [AUTO-MIGRATE] Vérification des colonnes DLC stock épuisé..."

if psql "$DATABASE_URL" -tAc "SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name='dlc_products' AND column_name='stock_epuise');" | grep -q "f"; then
    echo "🔧 [AUTO-MIGRATE] Ajout des colonnes stock épuisé à dlc_products..."
    psql "$DATABASE_URL" << 'EOF'
-- Migration sécurisée pour ajouter les champs stock épuisé
ALTER TABLE dlc_products 
ADD COLUMN IF NOT EXISTS stock_epuise boolean DEFAULT false NOT NULL,
ADD COLUMN IF NOT EXISTS stock_epuise_by varchar(255),
ADD COLUMN IF NOT EXISTS stock_epuise_at timestamp;

-- Commentaires pour documenter les nouveaux champs
COMMENT ON COLUMN dlc_products.stock_epuise IS 'Indique si le produit est marqué comme stock épuisé (différent de périmé)';
COMMENT ON COLUMN dlc_products.stock_epuise_by IS 'ID de l''utilisateur qui a marqué le produit comme stock épuisé';
COMMENT ON COLUMN dlc_products.stock_epuise_at IS 'Date et heure de marquage du stock épuisé';

-- Index pour améliorer les performances sur les requêtes de stock épuisé
CREATE INDEX IF NOT EXISTS idx_dlc_products_stock_epuise ON dlc_products(stock_epuise);
EOF
    echo "✅ [AUTO-MIGRATE] Colonnes stock épuisé ajoutées avec succès"
else
    echo "ℹ️ [AUTO-MIGRATE] Colonnes stock épuisé existent déjà"
fi

echo "✅ [AUTO-MIGRATE] Migration terminée!"