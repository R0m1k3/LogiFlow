-- ============================================================================
-- LogiFlow - Complete Database Schema
-- Generated: November 4, 2025
-- Description: Complete database initialization script for LogiFlow platform
-- ============================================================================

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Sessions table (required for authentication)
CREATE TABLE IF NOT EXISTS "sessions" (
  "sid" varchar PRIMARY KEY NOT NULL,
  "sess" jsonb NOT NULL,
  "expire" timestamp NOT NULL
);

-- Users table (supports both Replit Auth and local auth)
CREATE TABLE IF NOT EXISTS "users" (
  "id" varchar PRIMARY KEY NOT NULL,
  "username" varchar UNIQUE NOT NULL,
  "email" varchar UNIQUE,
  "name" varchar,
  "first_name" varchar,
  "last_name" varchar,
  "profile_image_url" varchar,
  "password" varchar,
  "role" varchar NOT NULL DEFAULT 'employee',
  "password_changed" boolean DEFAULT false,
  "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP
);

-- Groups/Stores management
CREATE TABLE IF NOT EXISTS "groups" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" varchar NOT NULL,
  "color" varchar DEFAULT '#1976D2',
  "nocodb_config_id" integer,
  "nocodb_table_name" varchar,
  "nocodb_table_id" varchar,
  "invoice_column_name" varchar,
  "nocodb_bl_column_name" varchar,
  "nocodb_amount_column_name" varchar,
  "nocodb_invoice_amount_ttc_column_name" varchar,
  "nocodb_supplier_column_name" varchar,
  "nocodb_due_date_column_name" varchar,
  "webhook_url" varchar(500),
  "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP
);

-- User-Group assignments (many-to-many)
CREATE TABLE IF NOT EXISTS "user_groups" (
  "user_id" varchar NOT NULL,
  "group_id" integer NOT NULL,
  "created_at" timestamp DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- SUPPLIERS & LOGISTICS
-- ============================================================================

-- Suppliers
CREATE TABLE IF NOT EXISTS "suppliers" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" varchar NOT NULL,
  "contact" varchar,
  "phone" varchar,
  "has_dlc" boolean DEFAULT false,
  "payment_method" varchar,
  "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
  "automatic_reconciliation" boolean DEFAULT false,
  "requires_control" boolean DEFAULT false
);

-- Orders
CREATE TABLE IF NOT EXISTS "orders" (
  "id" serial PRIMARY KEY NOT NULL,
  "supplier_id" integer NOT NULL,
  "group_id" integer NOT NULL,
  "planned_date" date NOT NULL,
  "quantity" integer,
  "unit" varchar,
  "status" varchar NOT NULL DEFAULT 'pending',
  "notes" text,
  "created_by" varchar NOT NULL,
  "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "orders_status_check" CHECK (status IN ('pending', 'planned', 'delivered'))
);

-- Deliveries
CREATE TABLE IF NOT EXISTS "deliveries" (
  "id" serial PRIMARY KEY NOT NULL,
  "order_id" integer,
  "supplier_id" integer NOT NULL,
  "group_id" integer NOT NULL,
  "scheduled_date" date NOT NULL,
  "delivered_date" timestamp,
  "quantity" integer NOT NULL,
  "unit" varchar NOT NULL,
  "status" varchar NOT NULL DEFAULT 'planned',
  "notes" text,
  "bl_number" varchar,
  "bl_amount" numeric(10, 2),
  "invoice_reference" varchar,
  "invoice_amount" numeric(10, 2),
  "invoice_amount_ttc" numeric(10, 2),
  "due_date" timestamp,
  "reconciled" boolean DEFAULT false,
  "validated_at" timestamp,
  "control_validated" boolean DEFAULT false,
  "control_validated_by" varchar,
  "control_validated_at" timestamp,
  "created_by" varchar NOT NULL,
  "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "deliveries_status_check" CHECK (status IN ('planned', 'delivered'))
);

-- ============================================================================
-- PUBLICITIES
-- ============================================================================

-- Publicities
CREATE TABLE IF NOT EXISTS "publicities" (
  "id" serial PRIMARY KEY NOT NULL,
  "pub_number" varchar NOT NULL UNIQUE,
  "designation" text NOT NULL,
  "start_date" date NOT NULL,
  "end_date" date NOT NULL,
  "year" integer NOT NULL,
  "created_by" varchar NOT NULL,
  "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP
);

-- Publicity Participations (many-to-many)
CREATE TABLE IF NOT EXISTS "publicity_participations" (
  "publicity_id" integer NOT NULL,
  "group_id" integer NOT NULL,
  "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "publicity_participations_pkey" PRIMARY KEY ("publicity_id", "group_id")
);

-- ============================================================================
-- NOCODB INTEGRATION
-- ============================================================================

-- NocoDB Configuration
CREATE TABLE IF NOT EXISTS "nocodb_config" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" varchar NOT NULL,
  "base_url" varchar NOT NULL,
  "project_id" varchar NOT NULL,
  "api_token" varchar NOT NULL,
  "description" text,
  "is_active" boolean DEFAULT true,
  "created_by" varchar,
  "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP
);

-- Invoice Verification Cache
CREATE TABLE IF NOT EXISTS "invoice_verification_cache" (
  "id" serial PRIMARY KEY NOT NULL,
  "cache_key" varchar(255) UNIQUE NOT NULL,
  "group_id" integer NOT NULL,
  "invoice_reference" varchar(255) NOT NULL,
  "supplier_name" varchar(255),
  "invoice_amount" numeric(10, 2),
  "invoice_amount_ttc" numeric(10, 2),
  "due_date" timestamp,
  "exists" boolean NOT NULL,
  "match_type" varchar(50) NOT NULL,
  "error_message" text,
  "cache_hit" boolean DEFAULT false,
  "api_call_time" integer,
  "is_reconciled" boolean DEFAULT false,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP
);

-- Reconciliation Comments
CREATE TABLE IF NOT EXISTS "reconciliation_comments" (
  "id" serial PRIMARY KEY NOT NULL,
  "delivery_id" integer NOT NULL,
  "group_id" integer NOT NULL,
  "content" text NOT NULL,
  "type" varchar NOT NULL DEFAULT 'info',
  "author_id" varchar NOT NULL,
  "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reconciliation_comments_type_check" CHECK (type IN ('info', 'warning', 'error', 'success'))
);

-- ============================================================================
-- CUSTOMER ORDERS & DLC
-- ============================================================================

-- Customer Orders
CREATE TABLE IF NOT EXISTS "customer_orders" (
  "id" serial PRIMARY KEY NOT NULL,
  "order_taker" varchar NOT NULL,
  "customer_name" varchar NOT NULL,
  "customer_phone" varchar NOT NULL,
  "customer_email" varchar,
  "product_designation" text NOT NULL,
  "product_reference" varchar,
  "gencode" varchar NOT NULL,
  "quantity" integer NOT NULL DEFAULT 1,
  "supplier_id" integer NOT NULL,
  "status" varchar NOT NULL DEFAULT 'En attente de Commande',
  "deposit" numeric(10, 2) DEFAULT 0.00,
  "is_promotional_price" boolean DEFAULT false,
  "customer_notified" boolean DEFAULT false,
  "notes" text,
  "group_id" integer NOT NULL,
  "created_by" varchar NOT NULL,
  "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP
);

-- DLC Products
CREATE TABLE IF NOT EXISTS "dlc_products" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" varchar NOT NULL,
  "product_name" varchar,
  "gencode" varchar,
  "supplier_id" integer NOT NULL,
  "group_id" integer NOT NULL,
  "expiry_date" date NOT NULL,
  "date_type" varchar NOT NULL DEFAULT 'dlc',
  "quantity" integer NOT NULL DEFAULT 1,
  "unit" varchar NOT NULL DEFAULT 'unité',
  "location" varchar NOT NULL DEFAULT 'Magasin',
  "alert_threshold" integer NOT NULL DEFAULT 15,
  "status" varchar NOT NULL DEFAULT 'en_cours',
  "stock_epuise" boolean DEFAULT false,
  "stock_epuise_by" varchar,
  "stock_epuise_at" timestamp,
  "processed_at" timestamp,
  "processed_by" varchar,
  "processed_until_expiry" boolean DEFAULT false,
  "notes" text,
  "created_by" varchar NOT NULL,
  "validated_by" varchar,
  "validated_at" timestamp,
  "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "dlc_products_date_type_check" CHECK (date_type IN ('dlc', 'ddm', 'dluo')),
  CONSTRAINT "dlc_products_status_check" CHECK (status IN ('en_cours', 'expires_soon', 'expires', 'valides'))
);

-- ============================================================================
-- TASKS & ANNOUNCEMENTS
-- ============================================================================

-- Tasks
CREATE TABLE IF NOT EXISTS "tasks" (
  "id" serial PRIMARY KEY NOT NULL,
  "title" varchar NOT NULL,
  "description" text,
  "start_date" timestamp,
  "due_date" date,
  "priority" varchar NOT NULL DEFAULT 'medium',
  "status" varchar NOT NULL DEFAULT 'pending',
  "assigned_to" text NOT NULL,
  "created_by" varchar NOT NULL,
  "group_id" integer NOT NULL,
  "completed_at" timestamp,
  "completed_by" varchar,
  "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tasks_priority_check" CHECK (priority IN ('low', 'medium', 'high')),
  CONSTRAINT "tasks_status_check" CHECK (status IN ('pending', 'completed'))
);

-- Dashboard Messages (Announcements)
CREATE TABLE IF NOT EXISTS "dashboard_messages" (
  "id" serial PRIMARY KEY NOT NULL,
  "title" varchar(255) NOT NULL,
  "content" text NOT NULL,
  "type" varchar(50) NOT NULL DEFAULT 'info',
  "store_id" integer,
  "created_by" varchar(255) NOT NULL,
  "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "dashboard_messages_type_check" CHECK (type IN ('info', 'warning', 'error', 'success'))
);

-- ============================================================================
-- AVOIRS (CREDIT NOTES)
-- ============================================================================

-- Avoirs
CREATE TABLE IF NOT EXISTS "avoirs" (
  "id" serial PRIMARY KEY NOT NULL,
  "supplier_id" integer NOT NULL,
  "group_id" integer NOT NULL,
  "invoice_reference" varchar(255),
  "amount" numeric(10, 2),
  "comment" text,
  "commercial_processed" boolean DEFAULT false,
  "status" varchar(50) NOT NULL DEFAULT 'En attente de demande',
  "webhook_sent" boolean DEFAULT false,
  "nocodb_verified" boolean DEFAULT false,
  "nocodb_verified_at" timestamp,
  "processed_at" timestamp,
  "created_by" varchar NOT NULL,
  "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "avoirs_status_check" CHECK (status IN ('En attente de demande', 'Demandé', 'Reçu'))
);

-- ============================================================================
-- SAV (SERVICE APRÈS-VENTE)
-- ============================================================================

-- SAV Tickets
CREATE TABLE IF NOT EXISTS "sav_tickets" (
  "id" serial PRIMARY KEY NOT NULL,
  "ticket_number" varchar(50) NOT NULL,
  "supplier_id" integer NOT NULL,
  "group_id" integer NOT NULL,
  "product_gencode" varchar(255) NOT NULL,
  "product_reference" varchar(255),
  "product_designation" varchar(500) NOT NULL,
  "problem_type" varchar(100) NOT NULL,
  "problem_description" text NOT NULL,
  "resolution_description" text,
  "status" varchar(50) NOT NULL DEFAULT 'nouveau',
  "priority" varchar(50) NOT NULL DEFAULT 'normale',
  "client_name" varchar(255),
  "client_phone" varchar(255),
  "created_by" varchar(255) NOT NULL,
  "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
  "resolved_at" timestamp,
  "closed_at" timestamp,
  CONSTRAINT "sav_tickets_status_check" CHECK (status IN ('nouveau', 'en_cours', 'attente_pieces', 'attente_echange', 'resolu', 'ferme')),
  CONSTRAINT "sav_tickets_priority_check" CHECK (priority IN ('faible', 'normale', 'haute', 'critique')),
  CONSTRAINT "sav_tickets_problem_type_check" CHECK (problem_type IN ('defectueux', 'pieces_manquantes', 'non_conforme', 'autre'))
);

-- ============================================================================
-- WEATHER & UTILITIES
-- ============================================================================

-- Weather Data
CREATE TABLE IF NOT EXISTS "weather_data" (
  "id" serial PRIMARY KEY NOT NULL,
  "date" date NOT NULL,
  "location" text NOT NULL,
  "temp_max" text NOT NULL,
  "temp_min" text NOT NULL,
  "icon" text NOT NULL,
  "conditions" text NOT NULL,
  "is_current_year" boolean NOT NULL DEFAULT true,
  "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP
);

-- Weather Settings
CREATE TABLE IF NOT EXISTS "weather_settings" (
  "id" serial PRIMARY KEY NOT NULL,
  "api_key" text NOT NULL,
  "location" text NOT NULL DEFAULT 'Paris, France',
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP
);

-- Database Backups
CREATE TABLE IF NOT EXISTS "database_backups" (
  "id" varchar(255) PRIMARY KEY NOT NULL,
  "filename" varchar(255) NOT NULL,
  "description" text,
  "size" bigint DEFAULT 0,
  "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
  "created_by" varchar(255) NOT NULL,
  "tables_count" integer DEFAULT 0,
  "status" varchar(50) DEFAULT 'creating',
  "backup_type" varchar(10) DEFAULT 'manual'
);

-- Utilities Configuration
CREATE TABLE IF NOT EXISTS "utilities" (
  "id" serial PRIMARY KEY NOT NULL,
  "sales_analysis_url" varchar(500),
  "automatic_backups_enabled" boolean DEFAULT true,
  "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP
);

-- Webhook BAP Configuration
CREATE TABLE IF NOT EXISTS "webhook_bap_config" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" varchar(100) NOT NULL DEFAULT 'Configuration BAP',
  "webhook_url" text NOT NULL,
  "description" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================================================

-- Deliveries foreign keys
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_supplier_id_fkey" 
  FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_group_id_fkey" 
  FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_order_id_fkey" 
  FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Orders foreign keys
ALTER TABLE "orders" ADD CONSTRAINT "orders_supplier_id_fkey" 
  FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "orders" ADD CONSTRAINT "orders_group_id_fkey" 
  FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Publicity Participations foreign keys
ALTER TABLE "publicity_participations" ADD CONSTRAINT "publicity_participations_publicity_id_fkey" 
  FOREIGN KEY ("publicity_id") REFERENCES "publicities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "publicity_participations" ADD CONSTRAINT "publicity_participations_group_id_fkey" 
  FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- DLC Products foreign keys
ALTER TABLE "dlc_products" ADD CONSTRAINT "dlc_products_supplier_id_fkey" 
  FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "dlc_products" ADD CONSTRAINT "dlc_products_group_id_fkey" 
  FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Tasks foreign keys
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_group_id_fkey" 
  FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Customer Orders foreign keys
ALTER TABLE "customer_orders" ADD CONSTRAINT "customer_orders_supplier_id_fkey" 
  FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "customer_orders" ADD CONSTRAINT "customer_orders_group_id_fkey" 
  FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Avoirs foreign keys
ALTER TABLE "avoirs" ADD CONSTRAINT "avoirs_supplier_id_fkey" 
  FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "avoirs" ADD CONSTRAINT "avoirs_group_id_fkey" 
  FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Dashboard Messages foreign keys
ALTER TABLE "dashboard_messages" ADD CONSTRAINT "dashboard_messages_store_id_fkey" 
  FOREIGN KEY ("store_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- Reconciliation Comments foreign keys
ALTER TABLE "reconciliation_comments" ADD CONSTRAINT "reconciliation_comments_delivery_id_fkey" 
  FOREIGN KEY ("delivery_id") REFERENCES "deliveries"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "reconciliation_comments" ADD CONSTRAINT "reconciliation_comments_group_id_fkey" 
  FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- SAV Tickets foreign keys
ALTER TABLE "sav_tickets" ADD CONSTRAINT "sav_tickets_supplier_id_fkey" 
  FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "sav_tickets" ADD CONSTRAINT "sav_tickets_group_id_fkey" 
  FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- ============================================================================
-- INDEXES FOR PERFORMANCE OPTIMIZATION
-- ============================================================================

-- Session indexes
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "sessions" ("expire");

-- Deliveries indexes
CREATE INDEX IF NOT EXISTS "idx_deliveries_group_id" ON "deliveries" ("group_id");
CREATE INDEX IF NOT EXISTS "idx_deliveries_status" ON "deliveries" ("status");
CREATE INDEX IF NOT EXISTS "idx_deliveries_bl_number" ON "deliveries" ("bl_number");
CREATE INDEX IF NOT EXISTS "idx_deliveries_invoice_ref" ON "deliveries" ("invoice_reference");
CREATE INDEX IF NOT EXISTS "idx_deliveries_due_date" ON "deliveries" ("due_date");

-- Orders indexes
CREATE INDEX IF NOT EXISTS "idx_orders_group_id" ON "orders" ("group_id");
CREATE INDEX IF NOT EXISTS "idx_orders_status" ON "orders" ("status");

-- Publicities indexes
CREATE INDEX IF NOT EXISTS "idx_publicities_start_date" ON "publicities" ("start_date");
CREATE INDEX IF NOT EXISTS "idx_publicities_year" ON "publicities" ("year");

-- DLC Products indexes
CREATE INDEX IF NOT EXISTS "idx_dlc_products_expiry_date" ON "dlc_products" ("expiry_date");
CREATE INDEX IF NOT EXISTS "idx_dlc_products_group_id" ON "dlc_products" ("group_id");
CREATE INDEX IF NOT EXISTS "idx_dlc_products_status" ON "dlc_products" ("status");
CREATE INDEX IF NOT EXISTS "idx_dlc_products_supplier_id" ON "dlc_products" ("supplier_id");

-- Dashboard Messages indexes
CREATE INDEX IF NOT EXISTS "idx_dashboard_messages_created_at" ON "dashboard_messages" ("created_at");
CREATE INDEX IF NOT EXISTS "idx_dashboard_messages_store_id" ON "dashboard_messages" ("store_id");

-- SAV Tickets indexes
CREATE INDEX IF NOT EXISTS "idx_sav_tickets_status" ON "sav_tickets" ("status");
CREATE INDEX IF NOT EXISTS "idx_sav_tickets_priority" ON "sav_tickets" ("priority");
CREATE INDEX IF NOT EXISTS "idx_sav_tickets_group_id" ON "sav_tickets" ("group_id");
CREATE INDEX IF NOT EXISTS "idx_sav_tickets_created_at" ON "sav_tickets" ("created_at");

-- Weather Data indexes
CREATE INDEX IF NOT EXISTS "idx_weather_data_date_year" ON "weather_data" ("date", "is_current_year");

-- Invoice Verification Cache indexes
CREATE INDEX IF NOT EXISTS "idx_invoice_verification_expires" ON "invoice_verification_cache" ("expires_at");
CREATE INDEX IF NOT EXISTS "idx_invoice_verification_group" ON "invoice_verification_cache" ("group_id");

-- ============================================================================
-- TABLE COMMENTS
-- ============================================================================

COMMENT ON TABLE "dashboard_messages" IS 'System-wide announcements and information messages';
COMMENT ON TABLE "invoice_verification_cache" IS 'Cache for NocoDB invoice verification results';
COMMENT ON TABLE "webhook_bap_config" IS 'Configuration pour webhook BAP n8n';
COMMENT ON TABLE "weather_data" IS 'Cache for weather API data';
COMMENT ON TABLE "reconciliation_comments" IS 'Comments for delivery reconciliation module';
COMMENT ON TABLE "sav_tickets" IS 'Service après-vente (SAV) tickets management';
COMMENT ON TABLE "utilities" IS 'General application configuration and utilities';

-- ============================================================================
-- DEFAULT DATA
-- ============================================================================

-- Insert default webhook BAP configuration
INSERT INTO "webhook_bap_config" ("name", "webhook_url", "description", "is_active")
VALUES (
  'Configuration BAP',
  'https://workflow.ffnancy.fr/webhook/a3d03176-b72f-412d-8fb9-f920b9fbab4d',
  'Configuration par défaut pour l''envoi des fichiers BAP vers n8n',
  true
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
