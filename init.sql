-- Script d'initialisation complète de la base de données LogiFlow

-- Suppression des tables existantes (dans l'ordre des dépendances)
DROP TABLE IF EXISTS user_roles CASCADE;
DROP TABLE IF EXISTS role_permissions CASCADE;
DROP TABLE IF EXISTS user_groups CASCADE;
DROP TABLE IF EXISTS publicity_participations CASCADE;
DROP TABLE IF EXISTS customer_orders CASCADE;
DROP TABLE IF EXISTS deliveries CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS publicities CASCADE;
DROP TABLE IF EXISTS dlc_products CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS groups CASCADE;
DROP TABLE IF EXISTS permissions CASCADE;
DROP TABLE IF EXISTS roles CASCADE;
DROP TABLE IF EXISTS nocodb_config CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;

-- Création de la table sessions (obligatoire pour l'authentification)
CREATE TABLE sessions (
  sid VARCHAR PRIMARY KEY,
  sess JSONB NOT NULL,
  expire TIMESTAMP NOT NULL
);

CREATE INDEX IDX_session_expire ON sessions(expire);

-- Création de la table users
CREATE TABLE users (
  id VARCHAR PRIMARY KEY NOT NULL,
  username VARCHAR UNIQUE,
  email VARCHAR UNIQUE,
  name VARCHAR,
  first_name VARCHAR,
  last_name VARCHAR,
  profile_image_url VARCHAR,
  password VARCHAR,
  role VARCHAR NOT NULL DEFAULT 'employee',
  password_changed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Création de la table groups (magasins)
CREATE TABLE groups (
  id SERIAL PRIMARY KEY,
  name VARCHAR NOT NULL,
  color VARCHAR DEFAULT '#3b82f6',
  address TEXT,
  phone VARCHAR,
  email VARCHAR,
  nocodb_config_id INTEGER,
  nocodb_table_id VARCHAR,
  nocodb_table_name VARCHAR,
  invoice_column_name VARCHAR DEFAULT 'Ref Facture',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Création de la table nocodb_config
CREATE TABLE nocodb_config (
  id SERIAL PRIMARY KEY,
  name VARCHAR NOT NULL,
  base_url VARCHAR NOT NULL,
  project_id VARCHAR NOT NULL,
  api_token VARCHAR NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_by VARCHAR NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Création de la table suppliers
CREATE TABLE suppliers (
  id SERIAL PRIMARY KEY,
  name VARCHAR NOT NULL,
  contact VARCHAR,
  phone VARCHAR,
  has_dlc BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Création de la table orders
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  supplier_id INTEGER NOT NULL,
  group_id INTEGER NOT NULL,
  planned_date DATE NOT NULL,
  quantity INTEGER,
  unit VARCHAR,
  status VARCHAR NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_by VARCHAR NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Création de la table deliveries
CREATE TABLE deliveries (
  id SERIAL PRIMARY KEY,
  order_id INTEGER,
  supplier_id INTEGER NOT NULL,
  group_id INTEGER NOT NULL,
  scheduled_date DATE NOT NULL,
  delivered_date TIMESTAMP,
  quantity INTEGER NOT NULL,
  unit VARCHAR NOT NULL,
  status VARCHAR NOT NULL DEFAULT 'planned',
  notes TEXT,
  bl_number VARCHAR,
  bl_amount DECIMAL(10,2),
  invoice_reference VARCHAR,
  invoice_amount DECIMAL(10,2),
  reconciled BOOLEAN DEFAULT FALSE,
  validated_at TIMESTAMP,
  created_by VARCHAR NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Création de la table publicities
CREATE TABLE publicities (
  id SERIAL PRIMARY KEY,
  pub_number VARCHAR NOT NULL UNIQUE,
  designation TEXT NOT NULL,
  title VARCHAR,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  year INTEGER NOT NULL,
  created_by VARCHAR NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Création de la table customer_orders
CREATE TABLE customer_orders (
  id SERIAL PRIMARY KEY,
  order_taker VARCHAR NOT NULL,
  customer_name VARCHAR NOT NULL,
  customer_phone VARCHAR NOT NULL,
  customer_email VARCHAR,
  product_designation TEXT NOT NULL,
  product_reference VARCHAR,
  gencode VARCHAR NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  supplier_id INTEGER NOT NULL,
  status VARCHAR NOT NULL DEFAULT 'En attente de Commande',
  deposit DECIMAL(10,2) DEFAULT 0.00,
  is_promotional_price BOOLEAN DEFAULT FALSE,
  customer_notified BOOLEAN DEFAULT FALSE,
  notes TEXT,
  group_id INTEGER NOT NULL,
  created_by VARCHAR NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Création de la table dlc_products
CREATE TABLE dlc_products (
  id SERIAL PRIMARY KEY,
  name VARCHAR NOT NULL,
  gencode VARCHAR,
  dlc_date DATE,
  quantity INTEGER,
  store_id INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Création de la table tasks
CREATE TABLE tasks (
  id SERIAL PRIMARY KEY,
  title VARCHAR NOT NULL,
  description TEXT,
  assigned_to VARCHAR,
  due_date DATE,
  priority VARCHAR DEFAULT 'medium',
  status VARCHAR DEFAULT 'todo',
  completed_by INTEGER,
  completed_at TIMESTAMP,
  store_id INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Création de la table roles
CREATE TABLE roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR NOT NULL UNIQUE,
  display_name VARCHAR NOT NULL,
  description TEXT,
  color VARCHAR DEFAULT '#6b7280',
  is_system BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Création de la table permissions
CREATE TABLE permissions (
  id SERIAL PRIMARY KEY,
  name VARCHAR NOT NULL UNIQUE,
  display_name VARCHAR NOT NULL,
  description TEXT,
  category VARCHAR NOT NULL,
  action VARCHAR NOT NULL,
  resource VARCHAR NOT NULL,
  is_system BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tables de liaison (many-to-many)
CREATE TABLE user_groups (
  user_id VARCHAR NOT NULL,
  group_id INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, group_id)
);

CREATE TABLE user_roles (
  user_id VARCHAR NOT NULL,
  role_id INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE role_permissions (
  role_id INTEGER NOT NULL,
  permission_id INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE publicity_participations (
  publicity_id INTEGER NOT NULL,
  group_id INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (publicity_id, group_id)
);

-- Insertion des données de base
INSERT INTO users (id, username, password, email, first_name, last_name, name, role) VALUES 
('1', 'admin', 'ffcaa5ca840c66a9d52c9c9c0b7c28aeb2b16d7174c8b3b4a6f49c1f7e61b1c3:1000:32:0d2b7b5e6e4c2b3b3e6d2a9b7c5e8f1a0c3d6f9b2e5c8a1d4f7b0a3e6c9f2e5b8', 'admin@logiflow.com', 'Admin', 'System', 'Admin System', 'admin');

-- Les magasins sont créés par les utilisateurs via l'interface
-- Pas de magasins par défaut insérés automatiquement

INSERT INTO suppliers (name, contact, phone) VALUES 
('Fournisseur Test 1', 'Jean Dupont', '01 23 45 67 89'),
('Fournisseur Test 2', 'Marie Martin', '01 98 76 54 32');

-- Insertion des rôles de base
INSERT INTO roles (name, display_name, description) VALUES 
('admin', 'Administrateur', 'Accès complet au système'),
('manager', 'Manager', 'Gestion des opérations'),
('employee', 'Employé', 'Accès de base'),
('directeur', 'Directeur', 'Direction générale');

-- Insertion des permissions de base
INSERT INTO permissions (name, display_name, category, action, resource) VALUES 
('dashboard_read', 'Voir le tableau de bord', 'dashboard', 'read', 'dashboard'),
('orders_read', 'Voir les commandes', 'orders', 'read', 'orders'),
('orders_create', 'Créer des commandes', 'orders', 'create', 'orders'),
('orders_update', 'Modifier les commandes', 'orders', 'update', 'orders'),
('orders_delete', 'Supprimer les commandes', 'orders', 'delete', 'orders'),
('deliveries_read', 'Voir les livraisons', 'deliveries', 'read', 'deliveries'),
('deliveries_create', 'Créer des livraisons', 'deliveries', 'create', 'deliveries'),
('deliveries_update', 'Modifier les livraisons', 'deliveries', 'update', 'deliveries'),
('deliveries_delete', 'Supprimer les livraisons', 'deliveries', 'delete', 'deliveries'),
('suppliers_read', 'Voir les fournisseurs', 'suppliers', 'read', 'suppliers'),
('suppliers_create', 'Créer des fournisseurs', 'suppliers', 'create', 'suppliers'),
('suppliers_update', 'Modifier les fournisseurs', 'suppliers', 'update', 'suppliers'),
('suppliers_delete', 'Supprimer les fournisseurs', 'suppliers', 'delete', 'suppliers'),
('users_read', 'Voir les utilisateurs', 'users', 'read', 'users'),
('users_create', 'Créer des utilisateurs', 'users', 'create', 'users'),
('users_update', 'Modifier les utilisateurs', 'users', 'update', 'users'),
('users_delete', 'Supprimer les utilisateurs', 'users', 'delete', 'users'),
('groups_read', 'Voir les magasins', 'groups', 'read', 'groups'),
('groups_create', 'Créer des magasins', 'groups', 'create', 'groups'),
('groups_update', 'Modifier les magasins', 'groups', 'update', 'groups'),
('groups_delete', 'Supprimer les magasins', 'groups', 'delete', 'groups'),
('publicities_read', 'Voir les publicités', 'publicities', 'read', 'publicities'),
('publicities_create', 'Créer des publicités', 'publicities', 'create', 'publicities');

-- Attribution de toutes les permissions au rôle admin
INSERT INTO role_permissions (role_id, permission_id) 
SELECT r.id, p.id 
FROM roles r, permissions p 
WHERE r.name = 'admin';

-- Attribution du rôle admin à l'utilisateur admin
INSERT INTO user_roles (user_id, role_id) 
SELECT u.id, r.id 
FROM users u, roles r 
WHERE u.username = 'admin' AND r.name = 'admin';

-- Les assignations aux magasins se font via l'interface utilisateur
-- Pas d'attribution automatique à un magasin par défaut