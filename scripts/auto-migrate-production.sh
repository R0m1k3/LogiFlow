#!/bin/bash
# Script de migration automatique pour les mises à jour Docker
# Ce script s'exécute automatiquement lors du démarrage du conteneur

set -e

echo "🔄 [AUTO-MIGRATE] Début de la migration automatique..."

# Vérifier si la base de données est accessible
if ! psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
    echo "❌ [AUTO-MIGRATE] Impossible de se connecter à la base de données"
    exit 1
fi

echo "✅ [AUTO-MIGRATE] Connexion à la base de données réussie"

# Fonction pour vérifier si une table existe
table_exists() {
    local table_name=$1
    psql "$DATABASE_URL" -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema='public' AND table_name='$table_name');"
}

# Fonction pour vérifier si une colonne existe
column_exists() {
    local table_name=$1
    local column_name=$2
    psql "$DATABASE_URL" -tAc "SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_schema='public' AND table_name='$table_name' AND column_name='$column_name');"
}

# Migration 1: Créer la table announcements si elle n'existe pas
if [ "$(table_exists 'announcements')" = "f" ]; then
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

CREATE INDEX IF NOT EXISTS idx_announcements_priority ON announcements(priority);
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON announcements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_author_id ON announcements(author_id);
CREATE INDEX IF NOT EXISTS idx_announcements_group_id ON announcements(group_id);

COMMENT ON TABLE announcements IS 'Admin-managed announcements/information system';
EOF
    echo "✅ [AUTO-MIGRATE] Table announcements créée avec succès"
else
    echo "ℹ️ [AUTO-MIGRATE] Table announcements existe déjà"
fi

# Migration 2: Créer les tables SAV si elles n'existent pas
if [ "$(table_exists 'sav_tickets')" = "f" ]; then
    echo "🔧 [AUTO-MIGRATE] Création des tables SAV..."
    psql "$DATABASE_URL" << 'EOF'
CREATE TABLE IF NOT EXISTS sav_tickets (
  id SERIAL PRIMARY KEY,
  ticket_number VARCHAR(50) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'nouveau',
  priority VARCHAR(20) NOT NULL DEFAULT 'normale',
  supplier_id INTEGER NOT NULL,
  group_id INTEGER NOT NULL,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT sav_tickets_status_check CHECK (status IN ('nouveau', 'en_cours', 'en_attente', 'resolu', 'ferme')),
  CONSTRAINT sav_tickets_priority_check CHECK (priority IN ('faible', 'normale', 'elevee', 'critique')),
  CONSTRAINT sav_tickets_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
  CONSTRAINT sav_tickets_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id),
  CONSTRAINT sav_tickets_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS sav_ticket_history (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER NOT NULL,
  action VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT sav_ticket_history_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES sav_tickets(id) ON DELETE CASCADE,
  CONSTRAINT sav_ticket_history_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_sav_tickets_status ON sav_tickets(status);
CREATE INDEX IF NOT EXISTS idx_sav_tickets_priority ON sav_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_sav_tickets_group_id ON sav_tickets(group_id);
CREATE INDEX IF NOT EXISTS idx_sav_ticket_history_ticket_id ON sav_ticket_history(ticket_id);
EOF
    echo "✅ [AUTO-MIGRATE] Tables SAV créées avec succès"
else
    echo "ℹ️ [AUTO-MIGRATE] Tables SAV existent déjà"
fi

# Migration 3: Créer les tables météo si elles n'existent pas
if [ "$(table_exists 'weather_settings')" = "f" ]; then
    echo "🔧 [AUTO-MIGRATE] Création des tables météo..."
    psql "$DATABASE_URL" << 'EOF'
CREATE TABLE IF NOT EXISTS weather_settings (
  id SERIAL PRIMARY KEY,
  api_key VARCHAR(255) NOT NULL,
  location VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS weather_data (
  id SERIAL PRIMARY KEY,
  date VARCHAR(10) NOT NULL,
  is_current_year BOOLEAN NOT NULL,
  temp_max VARCHAR(10),
  temp_min VARCHAR(10),
  conditions VARCHAR(255),
  icon VARCHAR(50),
  description TEXT,
  location VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(date, is_current_year)
);

CREATE INDEX IF NOT EXISTS idx_weather_data_date_year ON weather_data(date, is_current_year);
EOF
    echo "✅ [AUTO-MIGRATE] Tables météo créées avec succès"
else
    echo "ℹ️ [AUTO-MIGRATE] Tables météo existent déjà"
fi

# Migration 4: Créer les tables utilitaires si elles n'existent pas
if [ "$(table_exists 'database_backups')" = "f" ]; then
    echo "🔧 [AUTO-MIGRATE] Création des tables utilitaires..."
    psql "$DATABASE_URL" << 'EOF'
CREATE TABLE IF NOT EXISTS database_backups (
  id SERIAL PRIMARY KEY,
  filename VARCHAR(255) NOT NULL,
  file_size BIGINT NOT NULL,
  backup_type VARCHAR(50) NOT NULL,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(20) DEFAULT 'completed'
);

CREATE TABLE IF NOT EXISTS invoice_verification_cache (
  id SERIAL PRIMARY KEY,
  invoice_reference VARCHAR(255) NOT NULL,
  nocodb_config_id INTEGER NOT NULL,
  verification_result TEXT NOT NULL,
  is_found BOOLEAN NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  UNIQUE(invoice_reference, nocodb_config_id)
);

CREATE INDEX IF NOT EXISTS idx_invoice_verification_expires ON invoice_verification_cache(expires_at);
EOF
    echo "✅ [AUTO-MIGRATE] Tables utilitaires créées avec succès"
else
    echo "ℹ️ [AUTO-MIGRATE] Tables utilitaires existent déjà"
fi

# Nettoyage des anciennes données de cache
echo "🧹 [AUTO-MIGRATE] Nettoyage du cache expiré..."
psql "$DATABASE_URL" -c "DELETE FROM invoice_verification_cache WHERE expires_at < NOW();" 2>/dev/null || true
psql "$DATABASE_URL" -c "DELETE FROM weather_data WHERE created_at < NOW() - INTERVAL '30 days';" 2>/dev/null || true

# Affichage du statut final
echo "📊 [AUTO-MIGRATE] État des tables après migration:"
psql "$DATABASE_URL" -c "
SELECT 
  schemaname as schema,
  tablename as table_name,
  CASE 
    WHEN tablename IN ('announcements', 'sav_tickets', 'weather_settings', 'database_backups') THEN '🆕 Nouvelles'
    ELSE '📦 Existantes'
  END as status
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;
"

echo "✅ [AUTO-MIGRATE] Migration automatique terminée avec succès!"