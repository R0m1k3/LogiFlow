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

# Vérifier si la table webhook_bap_config existe
echo "🔄 [AUTO-MIGRATE] Vérification de la table webhook_bap_config..."
if psql "$DATABASE_URL" -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema='public' AND table_name='webhook_bap_config');" | grep -q "f"; then
    echo "🔧 [AUTO-MIGRATE] Création de la table webhook_bap_config..."
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

-- Configuration par défaut webhook BAP
INSERT INTO webhook_bap_config (name, webhook_url, description, is_active)
VALUES (
  'Configuration BAP',
  'https://workflow.ffnancy.fr/webhook/a3d03176-b72f-412d-8fb9-f920b9fbab4d',
  'Configuration par défaut pour envoi des fichiers BAP vers n8n',
  true
);

-- Commentaire sur la table
COMMENT ON TABLE webhook_bap_config IS 'Configuration pour webhook BAP n8n';
EOF
    echo "✅ [AUTO-MIGRATE] Table webhook_bap_config créée avec succès"
else
    echo "ℹ️ [AUTO-MIGRATE] Table webhook_bap_config existe déjà - aucune action nécessaire"
fi

# Index de performance
# Aucune table ne portait d'index en dehors des clés primaires et contraintes
# UNIQUE. PostgreSQL n'indexe pas les clés étrangères automatiquement : tous les
# filtres sur group_id / supplier_id / order_id et les colonnes de date
# faisaient un scan séquentiel complet, d'où la dégradation progressive à mesure
# que les tables grossissent.
#
# CREATE INDEX CONCURRENTLY ne verrouille pas la table en écriture, mais ne peut
# pas s'exécuter dans une transaction : d'où l'appel psql direct sans BEGIN.
echo "🔄 [AUTO-MIGRATE] Vérification des index de performance..."

if psql "$DATABASE_URL" -tAc "SELECT EXISTS (SELECT FROM pg_indexes WHERE schemaname='public' AND indexname='idx_deliveries_order_id');" | grep -q "f"; then
    echo "🔧 [AUTO-MIGRATE] Création des index de performance (sans interruption de service)..."

    # Une création CONCURRENTLY interrompue laisse un index invalide, que
    # CREATE INDEX IF NOT EXISTS considère ensuite comme déjà présent. On purge
    # ces reliquats avant de (re)créer.
    psql "$DATABASE_URL" << 'EOF'
DO $$
DECLARE idx RECORD;
BEGIN
  FOR idx IN
    SELECT c.relname
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indexrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE NOT i.indisvalid AND n.nspname = 'public' AND c.relname LIKE 'idx_%'
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS public.%I', idx.relname);
    RAISE NOTICE 'Index invalide supprimé: %', idx.relname;
  END LOOP;
END $$;
EOF

    psql "$DATABASE_URL" << 'EOF'
-- user_groups : lu à chaque requête authentifiée via getUserWithGroups()
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_groups_user_id ON user_groups (user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_groups_group_id ON user_groups (group_id);

-- orders
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_group_id ON orders (group_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_supplier_id ON orders (supplier_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_created_by ON orders (created_by);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_planned_date ON orders (planned_date);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_group_planned_date ON orders (group_id, planned_date);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_created_at ON orders (created_at DESC);

-- deliveries : order_id est la clé de jointure la plus sollicitée
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_deliveries_order_id ON deliveries (order_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_deliveries_group_id ON deliveries (group_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_deliveries_supplier_id ON deliveries (supplier_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_deliveries_created_by ON deliveries (created_by);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_deliveries_scheduled_date ON deliveries (scheduled_date);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_deliveries_group_scheduled_date ON deliveries (group_id, scheduled_date);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_deliveries_created_at ON deliveries (created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_deliveries_invoice_reference ON deliveries (invoice_reference) WHERE invoice_reference IS NOT NULL;

-- reconciliation_comments
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reconciliation_comments_delivery_id ON reconciliation_comments (delivery_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reconciliation_comments_group_id ON reconciliation_comments (group_id);

-- contacts
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_group_id ON contacts (group_id);

-- customer_orders
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customer_orders_group_id ON customer_orders (group_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customer_orders_supplier_id ON customer_orders (supplier_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customer_orders_created_at ON customer_orders (created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customer_orders_group_status ON customer_orders (group_id, status);

-- dlc_products
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dlc_products_group_id ON dlc_products (group_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dlc_products_supplier_id ON dlc_products (supplier_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dlc_products_expiry_date ON dlc_products (expiry_date);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dlc_products_group_status ON dlc_products (group_id, status);

-- tasks
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_group_id ON tasks (group_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_created_by ON tasks (created_by);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_due_date ON tasks (due_date);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_group_status ON tasks (group_id, status);

-- avoirs
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_avoirs_group_id ON avoirs (group_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_avoirs_supplier_id ON avoirs (supplier_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_avoirs_created_at ON avoirs (created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_avoirs_group_status ON avoirs (group_id, status);

-- sav_tickets
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sav_tickets_group_id ON sav_tickets (group_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sav_tickets_supplier_id ON sav_tickets (supplier_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sav_tickets_created_at ON sav_tickets (created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sav_tickets_group_status ON sav_tickets (group_id, status);

-- invoice_verification_cache : expires_at sert la purge périodique
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoice_cache_expires_at ON invoice_verification_cache (expires_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoice_cache_group_id ON invoice_verification_cache (group_id);

-- publicity_participations : la PK (publicity_id, group_id) ne couvre pas group_id seul
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_publicity_participations_group_id ON publicity_participations (group_id);

-- publicities
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_publicities_year ON publicities (year);

-- dashboard_messages
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dashboard_messages_store_id ON dashboard_messages (store_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dashboard_messages_created_at ON dashboard_messages (created_at DESC);

-- weather_data
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_weather_data_date_location ON weather_data (date, location);
EOF

    # Rafraîchit les statistiques du planificateur pour qu'il utilise réellement
    # les nouveaux index sans attendre le prochain autovacuum.
    psql "$DATABASE_URL" << 'EOF'
ANALYZE user_groups;
ANALYZE orders;
ANALYZE deliveries;
ANALYZE reconciliation_comments;
ANALYZE customer_orders;
ANALYZE dlc_products;
ANALYZE tasks;
ANALYZE avoirs;
ANALYZE sav_tickets;
ANALYZE invoice_verification_cache;
EOF
    echo "✅ [AUTO-MIGRATE] Index de performance créés avec succès"
else
    echo "ℹ️ [AUTO-MIGRATE] Index de performance déjà présents - aucune action nécessaire"
fi

echo "✅ [AUTO-MIGRATE] Migration terminée avec succès - index de performance inclus!"