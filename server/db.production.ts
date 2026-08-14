import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";
import { runProductionMigrations } from './migrations.production.js';

console.log('🐳 PRODUCTION: Configuring standard PostgreSQL database');

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set for production");
}

// Log connection details (without password)
const dbUrl = new URL(process.env.DATABASE_URL);
console.log('🐳 Database connection:', {
  host: dbUrl.hostname,
  port: dbUrl.port,
  database: dbUrl.pathname.slice(1),
  user: dbUrl.username
});

export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: false, // No SSL for local Docker
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

export const db = drizzle({ client: pool, schema });

// Test connection
pool.on('connect', () => {
  console.log('✅ PostgreSQL connection established');
});

pool.on('error', (err) => {
  console.error('❌ PostgreSQL connection error:', err);
});

// Run migrations automatically when database is configured
(async () => {
  try {
    console.log('🔄 DB: Running automatic database migrations...');
    await runProductionMigrations();
    console.log('✅ DB: Database migrations completed successfully');
  } catch (error) {
    console.error('❌ DB: Database migrations failed with error:', error);
    console.error('❌ DB: Migration failure details:', {
      name: (error as any)?.name,
      message: (error as any)?.message,
      code: (error as any)?.code
    });
    // Don't fail the application startup for migration errors
  }
})();

console.log('✅ Production PostgreSQL database configured');