-- Performance indexes
--
-- Contexte : aucune table (hors sessions) ne portait d'index en dehors des clés
-- primaires et contraintes UNIQUE. PostgreSQL n'indexe pas automatiquement les
-- clés étrangères, donc tous les filtres et jointures sur group_id, supplier_id,
-- order_id et les colonnes de date faisaient un scan séquentiel complet.
--
-- Ce fichier est exécuté par migrations/migrate.js, qui l'enveloppe dans une
-- transaction : CREATE INDEX CONCURRENTLY y est interdit. Les index sont donc
-- créés en mode bloquant (verrou en écriture sur la table, le temps de la
-- construction). Pour appliquer sans interruption sur une base en production
-- chargée, utiliser scripts/create-indexes-concurrently.js AVANT le déploiement :
-- les index existeront déjà et les IF NOT EXISTS ci-dessous seront sans effet.

-- === user_groups ===
-- Lu à chaque requête authentifiée via getUserWithGroups().
CREATE INDEX IF NOT EXISTS idx_user_groups_user_id ON user_groups (user_id);
CREATE INDEX IF NOT EXISTS idx_user_groups_group_id ON user_groups (group_id);

-- === orders ===
CREATE INDEX IF NOT EXISTS idx_orders_group_id ON orders (group_id);
CREATE INDEX IF NOT EXISTS idx_orders_supplier_id ON orders (supplier_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_by ON orders (created_by);
CREATE INDEX IF NOT EXISTS idx_orders_planned_date ON orders (planned_date);
-- Requête du calendrier : filtre par magasin + plage de dates.
CREATE INDEX IF NOT EXISTS idx_orders_group_planned_date ON orders (group_id, planned_date);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders (created_at DESC);

-- === deliveries ===
-- order_id est la clé de jointure du N+1 de getOrders() : le plus rentable.
CREATE INDEX IF NOT EXISTS idx_deliveries_order_id ON deliveries (order_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_group_id ON deliveries (group_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_supplier_id ON deliveries (supplier_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_created_by ON deliveries (created_by);
CREATE INDEX IF NOT EXISTS idx_deliveries_scheduled_date ON deliveries (scheduled_date);
CREATE INDEX IF NOT EXISTS idx_deliveries_group_scheduled_date ON deliveries (group_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_deliveries_created_at ON deliveries (created_at DESC);
-- Rapprochement BL / factures.
CREATE INDEX IF NOT EXISTS idx_deliveries_invoice_reference ON deliveries (invoice_reference)
  WHERE invoice_reference IS NOT NULL;

-- === reconciliation_comments ===
CREATE INDEX IF NOT EXISTS idx_reconciliation_comments_delivery_id ON reconciliation_comments (delivery_id);
CREATE INDEX IF NOT EXISTS idx_reconciliation_comments_group_id ON reconciliation_comments (group_id);

-- === contacts ===
CREATE INDEX IF NOT EXISTS idx_contacts_group_id ON contacts (group_id);

-- === customer_orders ===
CREATE INDEX IF NOT EXISTS idx_customer_orders_group_id ON customer_orders (group_id);
CREATE INDEX IF NOT EXISTS idx_customer_orders_supplier_id ON customer_orders (supplier_id);
CREATE INDEX IF NOT EXISTS idx_customer_orders_created_at ON customer_orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_orders_group_status ON customer_orders (group_id, status);

-- === dlc_products ===
CREATE INDEX IF NOT EXISTS idx_dlc_products_group_id ON dlc_products (group_id);
CREATE INDEX IF NOT EXISTS idx_dlc_products_supplier_id ON dlc_products (supplier_id);
CREATE INDEX IF NOT EXISTS idx_dlc_products_expiry_date ON dlc_products (expiry_date);
CREATE INDEX IF NOT EXISTS idx_dlc_products_group_status ON dlc_products (group_id, status);

-- === tasks ===
CREATE INDEX IF NOT EXISTS idx_tasks_group_id ON tasks (group_id);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks (created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks (due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_group_status ON tasks (group_id, status);

-- === avoirs ===
CREATE INDEX IF NOT EXISTS idx_avoirs_group_id ON avoirs (group_id);
CREATE INDEX IF NOT EXISTS idx_avoirs_supplier_id ON avoirs (supplier_id);
CREATE INDEX IF NOT EXISTS idx_avoirs_created_at ON avoirs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_avoirs_group_status ON avoirs (group_id, status);

-- === sav_tickets ===
CREATE INDEX IF NOT EXISTS idx_sav_tickets_group_id ON sav_tickets (group_id);
CREATE INDEX IF NOT EXISTS idx_sav_tickets_supplier_id ON sav_tickets (supplier_id);
CREATE INDEX IF NOT EXISTS idx_sav_tickets_created_at ON sav_tickets (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sav_tickets_group_status ON sav_tickets (group_id, status);

-- === invoice_verification_cache ===
-- expires_at sert la purge périodique (cleanExpiredCache).
CREATE INDEX IF NOT EXISTS idx_invoice_cache_expires_at ON invoice_verification_cache (expires_at);
CREATE INDEX IF NOT EXISTS idx_invoice_cache_group_id ON invoice_verification_cache (group_id);

-- === publicity_participations ===
-- La clé primaire (publicity_id, group_id) ne couvre pas les recherches par group_id seul.
CREATE INDEX IF NOT EXISTS idx_publicity_participations_group_id ON publicity_participations (group_id);

-- === publicities ===
CREATE INDEX IF NOT EXISTS idx_publicities_year ON publicities (year);

-- === dashboard_messages ===
CREATE INDEX IF NOT EXISTS idx_dashboard_messages_store_id ON dashboard_messages (store_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_messages_created_at ON dashboard_messages (created_at DESC);

-- === weather_data ===
CREATE INDEX IF NOT EXISTS idx_weather_data_date_location ON weather_data (date, location);

-- Rafraîchit les statistiques du planificateur pour qu'il utilise réellement
-- les nouveaux index sans attendre le prochain passage d'autovacuum.
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
