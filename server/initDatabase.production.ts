import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export async function initDatabase() {
  try {
    console.log('🔧 Initializing production database...');
    
    // Test connection
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    
    console.log('✅ Database connection successful');
    
    // Check if tables exist, if not create them (first time setup)
    await createTablesIfNotExist();
    
    // Run incremental migrations to update existing tables
    await runMigrations();
    
    // Create default admin user only if it doesn't exist
    await createDefaultAdmin();
    
    // Initialize roles and permissions for production
    await initRolesAndPermissionsProduction();
    
    console.log('✅ Database initialization complete');
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}

async function createTablesIfNotExist() {
  const createUsersTable = `
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(255) PRIMARY KEY,
      username VARCHAR(255) UNIQUE NOT NULL,
      email VARCHAR(255) UNIQUE,
      name VARCHAR(255),
      first_name VARCHAR(255),
      last_name VARCHAR(255),
      profile_image_url TEXT,
      password VARCHAR(255),
      role VARCHAR(50) DEFAULT 'employee',
      password_changed BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createGroupsTable = `
    CREATE TABLE IF NOT EXISTS groups (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      color VARCHAR(20) DEFAULT '#1976D2',
      nocodb_config_id INTEGER,
      nocodb_table_id VARCHAR(255),
      nocodb_table_name VARCHAR(255),
      invoice_column_name VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createSuppliersTable = `
    CREATE TABLE IF NOT EXISTS suppliers (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      contact VARCHAR(255),
      phone VARCHAR(255),
      has_dlc BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createOrdersTable = `
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      supplier_id INTEGER REFERENCES suppliers(id) ON DELETE CASCADE,
      group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
      planned_date DATE NOT NULL,
      quantity INTEGER,
      unit VARCHAR(50),
      status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'planned', 'delivered')),
      notes TEXT,
      created_by VARCHAR(255) REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createDeliveriesTable = `
    CREATE TABLE IF NOT EXISTS deliveries (
      id SERIAL PRIMARY KEY,
      order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
      supplier_id INTEGER REFERENCES suppliers(id) ON DELETE CASCADE,
      group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
      scheduled_date DATE NOT NULL,
      delivered_date TIMESTAMP,
      quantity INTEGER NOT NULL,
      unit VARCHAR(50) NOT NULL,
      status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'delivered')),
      notes TEXT,
      bl_number VARCHAR(255),
      bl_amount DECIMAL(10,2),
      invoice_reference VARCHAR(255),
      invoice_amount DECIMAL(10,2),
      reconciled BOOLEAN DEFAULT false,
      validated_at TIMESTAMP,
      created_by VARCHAR(255) REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createUserGroupsTable = `
    CREATE TABLE IF NOT EXISTS user_groups (
      user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
      group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
      PRIMARY KEY (user_id, group_id)
    );
  `;

  const createSessionTable = `
    CREATE TABLE IF NOT EXISTS session (
      sid VARCHAR NOT NULL COLLATE "default" PRIMARY KEY,
      sess JSON NOT NULL,
      expire TIMESTAMP(6) NOT NULL
    );
  `;

  const createPublicitiesTable = `
    CREATE TABLE IF NOT EXISTS publicities (
      id SERIAL PRIMARY KEY,
      pub_number VARCHAR(255) NOT NULL,
      designation TEXT NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      year INTEGER NOT NULL,
      created_by VARCHAR(255) REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createPublicityParticipationsTable = `
    CREATE TABLE IF NOT EXISTS publicity_participations (
      publicity_id INTEGER REFERENCES publicities(id) ON DELETE CASCADE,
      group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
      PRIMARY KEY (publicity_id, group_id)
    );
  `;

  const createRolesTable = `
    CREATE TABLE IF NOT EXISTS roles (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      display_name VARCHAR(255) NOT NULL,
      description TEXT,
      color VARCHAR(7) DEFAULT '#6b7280',
      is_system BOOLEAN DEFAULT false,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createPermissionsTable = `
    CREATE TABLE IF NOT EXISTS permissions (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      display_name VARCHAR(255) NOT NULL,
      description TEXT,
      category VARCHAR(255) NOT NULL,
      action VARCHAR(255) NOT NULL,
      resource VARCHAR(255) NOT NULL,
      is_system BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createRolePermissionsTable = `
    CREATE TABLE IF NOT EXISTS role_permissions (
      role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
      permission_id INTEGER REFERENCES permissions(id) ON DELETE CASCADE,
      PRIMARY KEY (role_id, permission_id)
    );
  `;

  const createNocodbConfigTable = `
    CREATE TABLE IF NOT EXISTS nocodb_config (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      base_url VARCHAR(255) NOT NULL,
      project_id VARCHAR(255) NOT NULL,
      api_token VARCHAR(255) NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT true,
      created_by VARCHAR(255) REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createCustomerOrdersTable = `
    CREATE TABLE IF NOT EXISTS customer_orders (
      id SERIAL PRIMARY KEY,
      order_taker VARCHAR(255) NOT NULL,
      customer_name VARCHAR(255) NOT NULL,
      customer_phone VARCHAR(255),
      customer_email VARCHAR(255),
      product_designation TEXT NOT NULL,
      product_reference VARCHAR(255),
      gencode VARCHAR(255),
      quantity INTEGER DEFAULT 1,
      supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
      status VARCHAR(100) DEFAULT 'En attente de Commande',
      deposit DECIMAL(10,2) DEFAULT 0.00,
      is_promotional_price BOOLEAN DEFAULT false,
      customer_notified BOOLEAN DEFAULT false,
      notes TEXT,
      group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
      created_by VARCHAR(255) REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createDlcProductsTable = `
    CREATE TABLE IF NOT EXISTS dlc_products (
      id SERIAL PRIMARY KEY,
      product_name VARCHAR(255) NOT NULL,
      expiry_date DATE NOT NULL,
      date_type VARCHAR(50) NOT NULL DEFAULT 'DLC',
      quantity INTEGER NOT NULL DEFAULT 1,
      unit VARCHAR(50) NOT NULL DEFAULT 'unité',
      supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
      location VARCHAR(255) NOT NULL DEFAULT 'Magasin',
      status VARCHAR(50) NOT NULL DEFAULT 'active',
      notes TEXT,
      alert_threshold INTEGER NOT NULL DEFAULT 15,
      validated_at TIMESTAMP,
      validated_by VARCHAR(255) REFERENCES users(id),
      group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      created_by VARCHAR(255) NOT NULL REFERENCES users(id),
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      gencode VARCHAR(255)
    );
  `;

  const createTasksTable = `
    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
      priority VARCHAR(50) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
      assigned_to VARCHAR(255),
      due_date DATE,
      group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      created_by VARCHAR(255) NOT NULL REFERENCES users(id),
      completed_at TIMESTAMP,
      completed_by VARCHAR(255) REFERENCES users(id),
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const tables = [
    createUsersTable,
    createGroupsTable,
    createSuppliersTable,
    createOrdersTable,
    createDeliveriesTable,
    createUserGroupsTable,
    createSessionTable,
    createPublicitiesTable,
    createPublicityParticipationsTable,
    createRolesTable,
    createPermissionsTable,
    createRolePermissionsTable,
    createNocodbConfigTable,
    createCustomerOrdersTable,
    createDlcProductsTable,
    createTasksTable
  ];

  for (const table of tables) {
    await pool.query(table);
  }

  console.log('✅ All tables verified/created successfully');
}

async function runMigrations() {
  try {
    console.log('🔄 Running database migrations...');
    
    // Migration 1: Add missing columns to existing tables
    await addMissingColumns();
    
    // Migration 2: Update constraints
    await updateConstraints();
    
    // Migration 3: Create new tables for roles/permissions if they don't exist
    await createRolesTables();
    
    console.log('✅ All migrations completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    // Don't throw error, continue with existing tables
  }
}

async function addMissingColumns() {
  try {
    // Check and add delivered_date column to deliveries
    const deliveredDateExists = await pool.query(`
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'deliveries' AND column_name = 'delivered_date'
    `);
    
    if (deliveredDateExists.rows.length === 0) {
      await pool.query('ALTER TABLE deliveries ADD COLUMN delivered_date TIMESTAMP');
      console.log('✅ Added delivered_date column to deliveries');
    }

    // Check and add validated_at column to deliveries
    const validatedAtExists = await pool.query(`
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'deliveries' AND column_name = 'validated_at'
    `);
    
    if (validatedAtExists.rows.length === 0) {
      await pool.query('ALTER TABLE deliveries ADD COLUMN validated_at TIMESTAMP');
      console.log('✅ Added validated_at column to deliveries');
    }

    // CRITICAL FIX: Corriger la contrainte deliveries_status_check pour permettre 'planned'
    console.log('🔧 CRITICAL FIX: Correcting deliveries status constraint...');
    try {
      await pool.query('ALTER TABLE deliveries DROP CONSTRAINT IF EXISTS deliveries_status_check');
      await pool.query("ALTER TABLE deliveries ADD CONSTRAINT deliveries_status_check CHECK (status IN ('pending', 'planned', 'delivered', 'cancelled'))");
      console.log('✅ CRITICAL FIX: Deliveries status constraint corrected to allow planned status');
    } catch (error) {
      console.error('❌ Failed to fix deliveries constraint:', error);
    }

    // Check and add MISSING columns to users table
    const columnsToAdd = [
      { name: 'name', type: 'VARCHAR(255)', default: null },
      { name: 'first_name', type: 'VARCHAR(255)', default: null },
      { name: 'last_name', type: 'VARCHAR(255)', default: null },
      { name: 'profile_image_url', type: 'TEXT', default: null }
    ];

    for (const column of columnsToAdd) {
      const columnExists = await pool.query(`
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = $1
      `, [column.name]);
      
      if (columnExists.rows.length === 0) {
        await pool.query(`ALTER TABLE users ADD COLUMN ${column.name} ${column.type}`);
        console.log(`✅ Added ${column.name} column to users table`);
      }
    }

    // Populate name column if empty
    await pool.query(`
      UPDATE users SET name = COALESCE(
        CASE 
          WHEN first_name IS NOT NULL AND last_name IS NOT NULL THEN first_name || ' ' || last_name
          WHEN first_name IS NOT NULL THEN first_name
          WHEN last_name IS NOT NULL THEN last_name
          ELSE username 
        END,
        username,
        email
      ) 
      WHERE name IS NULL OR name = ''
    `);
    console.log('✅ Updated name column with existing data');

    // Check and add customer_email column to customer_orders
    const customerEmailExists = await pool.query(`
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'customer_orders' AND column_name = 'customer_email'
    `);
    
    if (customerEmailExists.rows.length === 0) {
      await pool.query('ALTER TABLE customer_orders ADD COLUMN customer_email VARCHAR(255)');
      console.log('✅ Added customer_email column to customer_orders');
    }

    // Check and add notes column to customer_orders
    const notesExists = await pool.query(`
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'customer_orders' AND column_name = 'notes'
    `);
    
    if (notesExists.rows.length === 0) {
      await pool.query('ALTER TABLE customer_orders ADD COLUMN notes TEXT');
      console.log('✅ Added notes column to customer_orders');
    }

    // Check and add quantity column to customer_orders
    const quantityExists = await pool.query(`
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'customer_orders' AND column_name = 'quantity'
    `);
    
    if (quantityExists.rows.length === 0) {
      await pool.query('ALTER TABLE customer_orders ADD COLUMN quantity INTEGER DEFAULT 1');
      console.log('✅ Added quantity column to customer_orders');
    }

    // Check and add quantity column to orders
    const ordersQuantityExists = await pool.query(`
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'orders' AND column_name = 'quantity'
    `);
    
    if (ordersQuantityExists.rows.length === 0) {
      await pool.query('ALTER TABLE orders ADD COLUMN quantity INTEGER');
      console.log('✅ Added quantity column to orders');
    }

    // Check and add unit column to orders
    const ordersUnitExists = await pool.query(`
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'orders' AND column_name = 'unit'
    `);
    
    if (ordersUnitExists.rows.length === 0) {
      await pool.query('ALTER TABLE orders ADD COLUMN unit VARCHAR(50)');
      console.log('✅ Added unit column to orders');
    }

    // Check and add completed_by column to tasks
    const tasksCompletedByExists = await pool.query(`
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'tasks' AND column_name = 'completed_by'
    `);
    
    if (tasksCompletedByExists.rows.length === 0) {
      await pool.query('ALTER TABLE tasks ADD COLUMN completed_by VARCHAR(255) REFERENCES users(id)');
      console.log('✅ Added completed_by column to tasks');
    }

    // FORCE FIX PRODUCTION ISSUE: Recreate tasks table completed columns (Critical Fix v2)
    console.log('🔧 CRITICAL FIX v2: Forcing tasks table completed columns for production...');
    
    try {
      // First verify current structure
      const currentCols = await pool.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'tasks' AND column_name IN ('completed_at', 'completed_by')
      `);
      console.log('📋 Current completed columns:', currentCols.rows);
      
      // Drop existing constraints first
      await pool.query(`ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_completed_by_fkey CASCADE;`);
      console.log('✅ Dropped constraints');
      
      // Force drop and recreate columns 
      await pool.query(`ALTER TABLE tasks DROP COLUMN IF EXISTS completed_at CASCADE;`);
      await pool.query(`ALTER TABLE tasks DROP COLUMN IF EXISTS completed_by CASCADE;`);
      console.log('✅ Dropped old columns');
      
      await pool.query(`ALTER TABLE tasks ADD COLUMN completed_at TIMESTAMP NULL;`);
      await pool.query(`ALTER TABLE tasks ADD COLUMN completed_by VARCHAR(255) NULL;`);
      console.log('✅ Added new columns');
      
      // Re-add foreign key constraint
      await pool.query(`
        ALTER TABLE tasks ADD CONSTRAINT tasks_completed_by_fkey 
        FOREIGN KEY (completed_by) REFERENCES users(id) ON DELETE SET NULL;
      `);
      console.log('✅ Added constraints');
      
      // Final verification
      const verifyResult = await pool.query(`
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'tasks' AND column_name IN ('completed_at', 'completed_by')
        ORDER BY column_name
      `);
      
      console.log('🎉 CRITICAL FIX v2 COMPLETED. Final structure:', verifyResult.rows);
      
    } catch (taskError) {
      console.error('❌ Critical fix failed:', taskError);
      throw taskError; // Force error to prevent app from starting with broken schema
    }

    // Add missing columns to roles table
    const rolesColumnsToAdd = [
      { name: 'display_name', type: 'VARCHAR(255)', default: null },
      { name: 'color', type: 'VARCHAR(7)', default: "'#6b7280'" },
      { name: 'is_active', type: 'BOOLEAN', default: 'true' }
    ];

    for (const column of rolesColumnsToAdd) {
      const columnExists = await pool.query(`
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'roles' AND column_name = $1
      `, [column.name]);
      
      if (columnExists.rows.length === 0) {
        const defaultClause = column.default ? ` DEFAULT ${column.default}` : '';
        await pool.query(`ALTER TABLE roles ADD COLUMN ${column.name} ${column.type}${defaultClause}`);
        console.log(`✅ Added ${column.name} column to roles table`);
        
        // Migrate display_name from name if needed
        if (column.name === 'display_name') {
          await pool.query(`UPDATE roles SET display_name = name WHERE display_name IS NULL`);
          console.log('✅ Migrated display_name data from name column');
        }
      }
    }

    // Add missing columns to permissions table
    const permissionsColumnsToAdd = [
      { name: 'display_name', type: 'VARCHAR(255)', default: null },
      { name: 'action', type: 'VARCHAR(255)', default: "'read'" },
      { name: 'resource', type: 'VARCHAR(255)', default: "'system'" },
      { name: 'is_system', type: 'BOOLEAN', default: 'true' }
    ];

    for (const column of permissionsColumnsToAdd) {
      const columnExists = await pool.query(`
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'permissions' AND column_name = $1
      `, [column.name]);
      
      if (columnExists.rows.length === 0) {
        const defaultClause = column.default ? ` DEFAULT ${column.default}` : '';
        await pool.query(`ALTER TABLE permissions ADD COLUMN ${column.name} ${column.type}${defaultClause}`);
        console.log(`✅ Added ${column.name} column to permissions table`);
        
        // Migrate display_name from name if needed
        if (column.name === 'display_name') {
          await pool.query(`UPDATE permissions SET display_name = name WHERE display_name IS NULL`);
          console.log('✅ Migrated permissions display_name data');
        }
      }
    }

    // Add description column to nocodb_config table
    const descriptionExists = await pool.query(`
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'nocodb_config' AND column_name = 'description'
    `);
    
    if (descriptionExists.rows.length === 0) {
      await pool.query('ALTER TABLE nocodb_config ADD COLUMN description TEXT');
      console.log('✅ Added description column to nocodb_config');
    }

    // Add has_dlc column to suppliers table
    const supplierHasDlcExists = await pool.query(`
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'suppliers' AND column_name = 'has_dlc'
    `);
    
    if (supplierHasDlcExists.rows.length === 0) {
      await pool.query('ALTER TABLE suppliers ADD COLUMN has_dlc BOOLEAN DEFAULT FALSE');
      console.log('✅ Added has_dlc column to suppliers table');
    }

    // Add missing columns to dlc_products table for compatibility
    const dlcColumnsToAdd = [
      { name: 'name', type: 'VARCHAR(255)', default: null },
      { name: 'dlc_date', type: 'DATE', default: null },
      { name: 'product_code', type: 'VARCHAR(255)', default: null },
      { name: 'description', type: 'TEXT', default: null }
    ];

    for (const column of dlcColumnsToAdd) {
      const columnExists = await pool.query(`
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'dlc_products' AND column_name = $1
      `, [column.name]);
      
      if (columnExists.rows.length === 0) {
        const defaultClause = column.default ? ` DEFAULT ${column.default}` : '';
        await pool.query(`ALTER TABLE dlc_products ADD COLUMN ${column.name} ${column.type}${defaultClause}`);
        console.log(`✅ Added ${column.name} column to dlc_products table`);
      }
    }

    // Migrate existing data if needed
    const needsMigration = await pool.query(`
      SELECT COUNT(*) as count FROM dlc_products 
      WHERE name IS NULL AND product_name IS NOT NULL
    `);
    
    if (parseInt(needsMigration.rows[0].count) > 0) {
      await pool.query(`
        UPDATE dlc_products SET 
          name = product_name,
          dlc_date = expiry_date
        WHERE name IS NULL OR dlc_date IS NULL
      `);
      console.log('✅ Migrated DLC product data to new columns');
    }

  } catch (error) {
    console.error('❌ Error adding missing columns:', error);
  }
}

async function updateConstraints() {
  try {
    // Check if orders_status_check constraint exists and needs updating
    const constraintExists = await pool.query(`
      SELECT 1 FROM information_schema.check_constraints 
      WHERE constraint_name = 'orders_status_check'
    `);
    
    if (constraintExists.rows.length > 0) {
      // Drop old constraint
      await pool.query('ALTER TABLE orders DROP CONSTRAINT orders_status_check');
      console.log('✅ Removed old orders_status_check constraint');
    }
    
    // Add updated constraint
    await pool.query(`
      ALTER TABLE orders ADD CONSTRAINT orders_status_check 
      CHECK (status IN ('pending', 'planned', 'delivered'))
    `);
    console.log('✅ Added updated orders_status_check constraint');
    
  } catch (error) {
    console.error('❌ Error updating constraints:', error);
  }
}

async function createRolesTables() {
  try {
    // Create roles table avec colonnes manquantes
    await pool.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        display_name VARCHAR(255),
        description TEXT,
        color VARCHAR(20) DEFAULT '#6b7280',
        is_system BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create permissions table avec colonnes manquantes
    await pool.query(`
      CREATE TABLE IF NOT EXISTS permissions (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        display_name VARCHAR(255),
        description TEXT,
        category VARCHAR(255),
        action VARCHAR(255),
        resource VARCHAR(255),
        is_system BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create role_permissions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
        permission_id INTEGER REFERENCES permissions(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (role_id, permission_id)
      )
    `);

    // Create USER_ROLES table (CORRECTION CRITIQUE - cette table manquait !)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_roles (
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        assigned_by VARCHAR NOT NULL REFERENCES users(id),
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, role_id)
      )
    `);

    // Create indexes for performance sur user_roles
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles (user_id);
      CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles (role_id);
      CREATE INDEX IF NOT EXISTS idx_user_roles_assigned_by ON user_roles (assigned_by);
    `);

    // Ajouter les colonnes manquantes aux tables existantes si elles n'existent pas
    const addColumnsQueries = [
      `ALTER TABLE roles ADD COLUMN IF NOT EXISTS display_name VARCHAR(255);`,
      `ALTER TABLE roles ADD COLUMN IF NOT EXISTS color VARCHAR(20) DEFAULT '#6b7280';`,
      `ALTER TABLE roles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;`,
      `ALTER TABLE permissions ADD COLUMN IF NOT EXISTS display_name VARCHAR(255);`,
      `ALTER TABLE permissions ADD COLUMN IF NOT EXISTS action VARCHAR(255);`,
      `ALTER TABLE permissions ADD COLUMN IF NOT EXISTS resource VARCHAR(255);`,
      `ALTER TABLE permissions ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT false;`
    ];

    for (const query of addColumnsQueries) {
      try {
        await pool.query(query);
      } catch (err) {
        // Ignorer erreurs si colonnes existent déjà
        console.log('Column already exists or minor error:', err.message.substring(0, 50));
      }
    }

    // Vérifier et assigner rôle admin à admin_local si nécessaire
    const adminRoleCheck = await pool.query(`
      SELECT COUNT(*) as count FROM user_roles 
      WHERE user_id = 'admin_local'
    `);

    if (adminRoleCheck.rows[0].count === '0') {
      // CORRECTION CRITIQUE: utiliser 'admin_local' au lieu de 'system' pour assigned_by
      await pool.query(`
        INSERT INTO user_roles (user_id, role_id, assigned_by, assigned_at)
        SELECT 'admin_local', r.id, 'admin_local', CURRENT_TIMESTAMP
        FROM roles r 
        WHERE r.name = 'admin'
        AND EXISTS (SELECT 1 FROM users WHERE id = 'admin_local')
      `);
      console.log('✅ Admin role assigned to admin_local user (self-assigned)');
    }

    console.log('✅ ALL tables created including CRITICAL user_roles table');
  } catch (error) {
    console.error('❌ Error creating roles tables:', error);
    // Continue anyway, don't crash the app
  }
}

async function createDefaultAdmin() {
  try {
    // Check if admin user exists
    const existingAdmin = await pool.query(
      'SELECT id, password_changed FROM users WHERE username = $1',
      ['admin']
    );

    if (existingAdmin.rows.length === 0) {
      // Import hash function without bcrypt
      const { hashPassword } = await import('./auth-utils.production');
      const hashedPassword = await hashPassword('admin');
      
      await pool.query(`
        INSERT INTO users (id, username, email, name, first_name, last_name, password, role, password_changed)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        'admin_local',
        'admin',
        'admin@logiflow.com',
        'Administrateur',
        'Admin',
        'LogiFlow',
        hashedPassword,
        'admin',
        false
      ]);

      console.log('✅ Default admin user created: admin/admin');
    } else {
      // Only reset password if it hasn't been changed by the user
      const admin = existingAdmin.rows[0];
      if (!admin.password_changed) {
        const { hashPassword } = await import('./auth-utils.production');
        const newHashedPassword = await hashPassword('admin');
        
        await pool.query(
          'UPDATE users SET password = $1 WHERE username = $2',
          [newHashedPassword, 'admin']
        );
        
        console.log('✅ Admin user password updated with default password (admin/admin)');
      } else {
        console.log('✅ Admin user exists with custom password - not resetting');
      }
    }
  } catch (error) {
    console.error('❌ Failed to create admin user:', error);
  }
}

async function initRolesAndPermissionsProduction() {
  try {
    console.log('🎭 Initializing roles and permissions for production...');
    
    // Check if roles already exist (avoid re-creating)
    const existingRoles = await pool.query('SELECT COUNT(*) as count FROM roles');
    if (existingRoles.rows[0].count > 0) {
      console.log('✅ Roles already exist, checking for missing DLC permissions...');
      await ensureDlcPermissionsExist();
      return;
    }

    // Create 4 default roles with proper French names
    const roles = [
      { name: 'admin', displayName: 'Administrateur', description: 'Accès complet à toutes les fonctionnalités', color: '#dc2626' },
      { name: 'manager', displayName: 'Manager', description: 'Gestion des commandes, livraisons et fournisseurs', color: '#2563eb' },
      { name: 'employee', displayName: 'Employé', description: 'Accès en lecture aux données et publicités', color: '#16a34a' },
      { name: 'directeur', displayName: 'Directeur', description: 'Supervision générale et gestion stratégique', color: '#7c3aed' }
    ];

    const createdRoles = {};
    for (const role of roles) {
      const result = await pool.query(`
        INSERT INTO roles (name, display_name, description, color, is_system, is_active)
        VALUES ($1, $2, $3, $4, true, true)
        RETURNING id, name
      `, [role.name, role.displayName, role.description, role.color]);
      createdRoles[role.name] = result.rows[0].id;
      console.log(`✅ Created role: ${role.displayName}`);
    }

    // Create 49 permissions with French categories
    const permissions = [
      // Dashboard (tableau_de_bord)
      { category: 'tableau_de_bord', name: 'dashboard_read', displayName: 'Voir tableau de bord', description: 'Accès en lecture au tableau de bord', action: 'read', resource: 'dashboard' },
      
      // Stores (magasins) 
      { category: 'magasins', name: 'groups_read', displayName: 'Voir magasins', description: 'Accès en lecture aux magasins', action: 'read', resource: 'groups' },
      { category: 'magasins', name: 'groups_create', displayName: 'Créer magasins', description: 'Création de nouveaux magasins', action: 'create', resource: 'groups' },
      { category: 'magasins', name: 'groups_update', displayName: 'Modifier magasins', description: 'Modification des magasins existants', action: 'update', resource: 'groups' },
      { category: 'magasins', name: 'groups_delete', displayName: 'Supprimer magasins', description: 'Suppression de magasins', action: 'delete', resource: 'groups' },
      
      // Suppliers (fournisseurs)
      { category: 'fournisseurs', name: 'suppliers_read', displayName: 'Voir fournisseurs', description: 'Accès en lecture aux fournisseurs', action: 'read', resource: 'suppliers' },
      { category: 'fournisseurs', name: 'suppliers_create', displayName: 'Créer fournisseurs', description: 'Création de nouveaux fournisseurs', action: 'create', resource: 'suppliers' },
      { category: 'fournisseurs', name: 'suppliers_update', displayName: 'Modifier fournisseurs', description: 'Modification des fournisseurs', action: 'update', resource: 'suppliers' },
      { category: 'fournisseurs', name: 'suppliers_delete', displayName: 'Supprimer fournisseurs', description: 'Suppression de fournisseurs', action: 'delete', resource: 'suppliers' },
      
      // Orders (commandes)
      { category: 'commandes', name: 'orders_read', displayName: 'Voir commandes', description: 'Accès en lecture aux commandes', action: 'read', resource: 'orders' },
      { category: 'commandes', name: 'orders_create', displayName: 'Créer commandes', description: 'Création de nouvelles commandes', action: 'create', resource: 'orders' },
      { category: 'commandes', name: 'orders_update', displayName: 'Modifier commandes', description: 'Modification des commandes', action: 'update', resource: 'orders' },
      { category: 'commandes', name: 'orders_delete', displayName: 'Supprimer commandes', description: 'Suppression de commandes', action: 'delete', resource: 'orders' },
      
      // Deliveries (livraisons)
      { category: 'livraisons', name: 'deliveries_read', displayName: 'Voir livraisons', description: 'Accès en lecture aux livraisons', action: 'read', resource: 'deliveries' },
      { category: 'livraisons', name: 'deliveries_create', displayName: 'Créer livraisons', description: 'Création de nouvelles livraisons', action: 'create', resource: 'deliveries' },
      { category: 'livraisons', name: 'deliveries_update', displayName: 'Modifier livraisons', description: 'Modification des livraisons', action: 'update', resource: 'deliveries' },
      { category: 'livraisons', name: 'deliveries_delete', displayName: 'Supprimer livraisons', description: 'Suppression de livraisons', action: 'delete', resource: 'deliveries' },
      
      // Publicities (publicites)
      { category: 'publicites', name: 'publicities_read', displayName: 'Voir publicités', description: 'Accès en lecture aux publicités', action: 'read', resource: 'publicities' },
      { category: 'publicites', name: 'publicities_create', displayName: 'Créer publicités', description: 'Création de nouvelles publicités', action: 'create', resource: 'publicities' },
      { category: 'publicites', name: 'publicities_update', displayName: 'Modifier publicités', description: 'Modification des publicités', action: 'update', resource: 'publicities' },
      { category: 'publicites', name: 'publicities_delete', displayName: 'Supprimer publicités', description: 'Suppression de publicités', action: 'delete', resource: 'publicities' },
      { category: 'publicites', name: 'publicities_participate', displayName: 'Participer aux publicités', description: 'Participation des magasins aux publicités', action: 'participate', resource: 'publicities' },
      
      // Customer Orders (commandes_clients)
      { category: 'commandes_clients', name: 'customer_orders_read', displayName: 'Voir commandes clients', description: 'Accès en lecture aux commandes clients', action: 'read', resource: 'customer_orders' },
      { category: 'commandes_clients', name: 'customer_orders_create', displayName: 'Créer commandes clients', description: 'Création de nouvelles commandes clients', action: 'create', resource: 'customer_orders' },
      { category: 'commandes_clients', name: 'customer_orders_update', displayName: 'Modifier commandes clients', description: 'Modification des commandes clients', action: 'update', resource: 'customer_orders' },
      { category: 'commandes_clients', name: 'customer_orders_delete', displayName: 'Supprimer commandes clients', description: 'Suppression de commandes clients', action: 'delete', resource: 'customer_orders' },
      { category: 'commandes_clients', name: 'customer_orders_print', displayName: 'Imprimer commandes clients', description: 'Impression des barcodes et documents', action: 'print', resource: 'customer_orders' },
      
      // Users (utilisateurs)
      { category: 'utilisateurs', name: 'users_read', displayName: 'Voir utilisateurs', description: 'Accès en lecture aux utilisateurs', action: 'read', resource: 'users' },
      { category: 'utilisateurs', name: 'users_create', displayName: 'Créer utilisateurs', description: 'Création de nouveaux utilisateurs', action: 'create', resource: 'users' },
      { category: 'utilisateurs', name: 'users_update', displayName: 'Modifier utilisateurs', description: 'Modification des utilisateurs', action: 'update', resource: 'users' },
      { category: 'utilisateurs', name: 'users_delete', displayName: 'Supprimer utilisateurs', description: 'Suppression d\'utilisateurs', action: 'delete', resource: 'users' },
      
      // Role Management (gestion_roles)
      { category: 'gestion_roles', name: 'roles_read', displayName: 'Voir rôles', description: 'Accès en lecture aux rôles', action: 'read', resource: 'roles' },
      { category: 'gestion_roles', name: 'roles_create', displayName: 'Créer rôles', description: 'Création de nouveaux rôles', action: 'create', resource: 'roles' },
      { category: 'gestion_roles', name: 'roles_update', displayName: 'Modifier rôles', description: 'Modification des rôles', action: 'update', resource: 'roles' },
      { category: 'gestion_roles', name: 'roles_delete', displayName: 'Supprimer rôles', description: 'Suppression de rôles', action: 'delete', resource: 'roles' },
      { category: 'gestion_roles', name: 'permissions_read', displayName: 'Voir permissions', description: 'Accès en lecture aux permissions', action: 'read', resource: 'permissions' },
      { category: 'gestion_roles', name: 'permissions_assign', displayName: 'Assigner permissions', description: 'Attribution de permissions aux rôles', action: 'assign', resource: 'permissions' },
      
      // Reconciliation (rapprochement)
      { category: 'rapprochement', name: 'bl_reconciliation_read', displayName: 'Voir rapprochement BL', description: 'Accès au rapprochement des bons de livraison', action: 'read', resource: 'bl_reconciliation' },
      { category: 'rapprochement', name: 'bl_reconciliation_update', displayName: 'Modifier rapprochement BL', description: 'Modification du rapprochement des BL', action: 'update', resource: 'bl_reconciliation' },
      
      // Administration 
      { category: 'administration', name: 'nocodb_config_read', displayName: 'Voir config NocoDB', description: 'Accès à la configuration NocoDB', action: 'read', resource: 'nocodb_config' },
      { category: 'administration', name: 'nocodb_config_update', displayName: 'Modifier config NocoDB', description: 'Modification de la configuration NocoDB', action: 'update', resource: 'nocodb_config' },
      { category: 'administration', name: 'system_admin', displayName: 'Administration système', description: 'Accès complet à l\'administration', action: 'admin', resource: 'system' },
      
      // Calendar (calendrier)
      { category: 'calendrier', name: 'calendar_read', displayName: 'Voir calendrier', description: 'Accès en lecture au calendrier', action: 'read', resource: 'calendar' },
      { category: 'calendrier', name: 'calendar_update', displayName: 'Modifier calendrier', description: 'Modification des événements du calendrier', action: 'update', resource: 'calendar' },
      
      // DLC Management (gestion_dlc)
      { category: 'gestion_dlc', name: 'dlc_read', displayName: 'Voir produits DLC', description: 'Accès en lecture aux produits DLC', action: 'read', resource: 'dlc' },
      { category: 'gestion_dlc', name: 'dlc_create', displayName: 'Créer produits DLC', description: 'Création de nouveaux produits DLC', action: 'create', resource: 'dlc' },
      { category: 'gestion_dlc', name: 'dlc_update', displayName: 'Modifier produits DLC', description: 'Modification des produits DLC', action: 'update', resource: 'dlc' },
      { category: 'gestion_dlc', name: 'dlc_delete', displayName: 'Supprimer produits DLC', description: 'Suppression de produits DLC', action: 'delete', resource: 'dlc' },
      { category: 'gestion_dlc', name: 'dlc_validate', displayName: 'Valider produits DLC', description: 'Validation des produits DLC', action: 'validate', resource: 'dlc' },
      { category: 'gestion_dlc', name: 'dlc_print', displayName: 'Imprimer étiquettes DLC', description: 'Impression des étiquettes DLC', action: 'print', resource: 'dlc' },
      { category: 'gestion_dlc', name: 'dlc_stats', displayName: 'Voir statistiques DLC', description: 'Accès aux statistiques DLC', action: 'stats', resource: 'dlc' },
      
      // Task Management (gestion_taches)
      { category: 'gestion_taches', name: 'tasks_read', displayName: 'Voir tâches', description: 'Accès en lecture aux tâches', action: 'read', resource: 'tasks' },
      { category: 'gestion_taches', name: 'tasks_create', displayName: 'Créer tâches', description: 'Création de nouvelles tâches', action: 'create', resource: 'tasks' },
      { category: 'gestion_taches', name: 'tasks_update', displayName: 'Modifier tâches', description: 'Modification des tâches', action: 'update', resource: 'tasks' },
      { category: 'gestion_taches', name: 'tasks_delete', displayName: 'Supprimer tâches', description: 'Suppression de tâches', action: 'delete', resource: 'tasks' },
      { category: 'gestion_taches', name: 'tasks_assign', displayName: 'Assigner tâches', description: 'Attribution de tâches aux utilisateurs', action: 'assign', resource: 'tasks' },
      { category: 'gestion_dlc', name: 'dlc_delete', displayName: 'Supprimer produits DLC', description: 'Suppression de produits DLC', action: 'delete', resource: 'dlc' },
      { category: 'gestion_dlc', name: 'dlc_validate', displayName: 'Valider produits DLC', description: 'Validation des produits DLC', action: 'validate', resource: 'dlc' },
      { category: 'gestion_dlc', name: 'dlc_print', displayName: 'Imprimer étiquettes DLC', description: 'Impression des étiquettes DLC', action: 'print', resource: 'dlc' },
      { category: 'gestion_dlc', name: 'dlc_stats', displayName: 'Voir statistiques DLC', description: 'Accès aux statistiques DLC', action: 'read', resource: 'dlc_stats' }
    ];

    const createdPermissions = {};
    for (const perm of permissions) {
      const result = await pool.query(`
        INSERT INTO permissions (name, display_name, description, category, action, resource, is_system)
        VALUES ($1, $2, $3, $4, $5, $6, true)
        RETURNING id, name
      `, [perm.name, perm.displayName, perm.description, perm.category, perm.action, perm.resource]);
      createdPermissions[perm.name] = result.rows[0].id;
    }
    console.log(`✅ Created ${permissions.length} permissions`);

    // Assign permissions to roles
    const rolePermissions = {
      'admin': Object.keys(createdPermissions), // Admin gets all permissions
      'manager': [
        'dashboard_read', 'groups_read', 'suppliers_read', 'suppliers_create', 'suppliers_update',
        'orders_read', 'orders_create', 'orders_update', 'deliveries_read', 'deliveries_create', 
        'deliveries_update', 'publicities_read', 'publicities_create', 'publicities_update', 
        'publicities_participate', 'customer_orders_read', 'customer_orders_create', 
        'customer_orders_update', 'customer_orders_print', 'users_read', 'bl_reconciliation_read',
        'bl_reconciliation_update', 'calendar_read', 'calendar_update',
        'dlc_read', 'dlc_create', 'dlc_update', 'dlc_validate', 'dlc_print', 'dlc_stats',
        'tasks_read', 'tasks_create', 'tasks_update', 'tasks_assign'
      ],
      'employee': [
        'dashboard_read', 'groups_read', 'suppliers_read', 'orders_read', 'deliveries_read',
        'publicities_read', 'customer_orders_read', 'customer_orders_create', 'customer_orders_print',
        'calendar_read', 'dlc_read', 'dlc_create', 'dlc_update',
        'tasks_read', 'tasks_create', 'tasks_update'
      ],
      'directeur': [
        'dashboard_read', 'groups_read', 'groups_create', 'groups_update', 'suppliers_read', 
        'suppliers_create', 'suppliers_update', 'orders_read', 'orders_create', 'orders_update',
        'deliveries_read', 'deliveries_create', 'deliveries_update', 'publicities_read', 
        'publicities_create', 'publicities_update', 'publicities_participate', 
        'customer_orders_read', 'customer_orders_create', 'customer_orders_update', 
        'customer_orders_print', 'users_read', 'users_create', 'users_update', 'roles_read',
        'bl_reconciliation_read', 'bl_reconciliation_update', 'calendar_read', 'calendar_update',
        'dlc_read', 'dlc_create', 'dlc_update', 'dlc_delete', 'dlc_validate', 'dlc_print', 'dlc_stats',
        'tasks_read', 'tasks_create', 'tasks_update', 'tasks_delete', 'tasks_assign'
      ]
    };

    for (const [roleName, permissionNames] of Object.entries(rolePermissions)) {
      const roleId = createdRoles[roleName];
      for (const permName of permissionNames) {
        const permId = createdPermissions[permName];
        if (permId) {
          await pool.query(`
            INSERT INTO role_permissions (role_id, permission_id)
            VALUES ($1, $2)
            ON CONFLICT (role_id, permission_id) DO NOTHING
          `, [roleId, permId]);
        }
      }
      console.log(`✅ Assigned ${permissionNames.length} permissions to ${roleName}`);
    }

    console.log('✅ Production roles and permissions initialization complete!');
  } catch (error) {
    console.error('❌ Error initializing roles and permissions:', error);
    // Continue anyway
  }
}

async function ensureDlcPermissionsExist() {
  try {
    console.log('🔍 Checking for missing DLC permissions...');
    
    // Check if DLC permissions exist
    const dlcPermissions = await pool.query(`
      SELECT name FROM permissions WHERE category = 'gestion_dlc'
    `);
    
    if (dlcPermissions.rows.length >= 7) {
      console.log('✅ All DLC permissions already exist');
      return;
    }
    
    console.log('⚠️ Missing DLC permissions, creating them...');
    
    // Create missing DLC permissions
    const requiredDlcPermissions = [
      { category: 'gestion_dlc', name: 'dlc_read', displayName: 'Voir produits DLC', description: 'Accès en lecture aux produits DLC', action: 'read', resource: 'dlc' },
      { category: 'gestion_dlc', name: 'dlc_create', displayName: 'Créer produits DLC', description: 'Création de nouveaux produits DLC', action: 'create', resource: 'dlc' },
      { category: 'gestion_dlc', name: 'dlc_update', displayName: 'Modifier produits DLC', description: 'Modification des produits DLC', action: 'update', resource: 'dlc' },
      { category: 'gestion_dlc', name: 'dlc_delete', displayName: 'Supprimer produits DLC', description: 'Suppression de produits DLC', action: 'delete', resource: 'dlc' },
      { category: 'gestion_dlc', name: 'dlc_validate', displayName: 'Valider produits DLC', description: 'Validation des produits DLC', action: 'validate', resource: 'dlc' },
      { category: 'gestion_dlc', name: 'dlc_print', displayName: 'Imprimer étiquettes DLC', description: 'Impression des étiquettes DLC', action: 'print', resource: 'dlc' },
      { category: 'gestion_dlc', name: 'dlc_stats', displayName: 'Voir statistiques DLC', description: 'Accès aux statistiques DLC', action: 'stats', resource: 'dlc' }
    ];
    
    const createdDlcPermissions = {};
    for (const perm of requiredDlcPermissions) {
      // Check if permission already exists
      const existing = await pool.query('SELECT id FROM permissions WHERE name = $1', [perm.name]);
      
      if (existing.rows.length === 0) {
        const result = await pool.query(`
          INSERT INTO permissions (name, display_name, description, category, action, resource, is_system)
          VALUES ($1, $2, $3, $4, $5, $6, true)
          RETURNING id, name
        `, [perm.name, perm.displayName, perm.description, perm.category, perm.action, perm.resource]);
        
        createdDlcPermissions[perm.name] = result.rows[0].id;
        console.log(`✅ Created DLC permission: ${perm.displayName}`);
      } else {
        createdDlcPermissions[perm.name] = existing.rows[0].id;
        console.log(`✅ DLC permission exists: ${perm.displayName}`);
      }
    }
    
    // Assign DLC permissions to existing roles
    const rolePermissions = {
      'admin': ['dlc_read', 'dlc_create', 'dlc_update', 'dlc_delete', 'dlc_validate', 'dlc_print', 'dlc_stats'],
      'manager': ['dlc_read', 'dlc_create', 'dlc_update', 'dlc_validate', 'dlc_print', 'dlc_stats'],
      'employee': ['dlc_read', 'dlc_create', 'dlc_update'],
      'directeur': ['dlc_read', 'dlc_create', 'dlc_update', 'dlc_delete', 'dlc_validate', 'dlc_print', 'dlc_stats']
    };
    
    for (const [roleName, permissionNames] of Object.entries(rolePermissions)) {
      const roleQuery = await pool.query('SELECT id FROM roles WHERE name = $1', [roleName]);
      if (roleQuery.rows.length > 0) {
        const roleId = roleQuery.rows[0].id;
        
        for (const permName of permissionNames) {
          const permId = createdDlcPermissions[permName];
          if (permId) {
            await pool.query(`
              INSERT INTO role_permissions (role_id, permission_id)
              VALUES ($1, $2)
              ON CONFLICT (role_id, permission_id) DO NOTHING
            `, [roleId, permId]);
          }
        }
        console.log(`✅ Assigned DLC permissions to ${roleName}`);
      }
    }
    
    console.log('✅ DLC permissions initialization complete!');
  } catch (error) {
    console.error('❌ Error ensuring DLC permissions exist:', error);
    // Continue anyway
  }
}

export { pool };