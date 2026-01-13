import * as schema from "@shared/schema";

// Simple environment detection
const isProduction = process.env.NODE_ENV === 'production';
const dbUrl = process.env.DATABASE_URL;

console.log('🔗 Database initialization:', {
  NODE_ENV: process.env.NODE_ENV,
  isProduction,
  hasDbUrl: !!dbUrl,
  dbHost: dbUrl ? new URL(dbUrl).hostname : 'none'
});

let db: any;
let pool: any;

if (isProduction && dbUrl && (dbUrl.includes('logiflow-db') || dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1'))) {
  // Standard PostgreSQL for production Docker
  console.log('🐳 PRODUCTION: Using standard PostgreSQL');
  const { Pool } = await import('pg');
  const { drizzle } = await import('drizzle-orm/node-postgres');

  pool = new Pool({
    connectionString: dbUrl,
    ssl: false,
    max: 25, // Increased from 10 to handle concurrent verifications
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000, // Increased from 5000 to 15000
  });

  db = drizzle({ client: pool, schema });

  // Test connection
  try {
    await pool.connect().then((client: any) => {
      console.log('✅ PostgreSQL connection test successful');
      client.release();
    });
  } catch (error) {
    console.error('❌ PostgreSQL connection test failed:', error);
  }
} else {
  // Fallback: use Neon for development (but will be overridden by MemStorage)
  console.log('🔧 DEV: Using Neon (fallback, will use MemStorage)');
  const { Pool, neonConfig } = await import('@neondatabase/serverless');
  const { drizzle } = await import('drizzle-orm/neon-serverless');
  const ws = await import('ws');

  neonConfig.webSocketConstructor = ws.default;

  if (dbUrl) {
    pool = new Pool({ connectionString: dbUrl });
    db = drizzle({ client: pool, schema });
  } else {
    // Create dummy instances for development
    pool = null;
    db = null;
    console.log('🔧 DEV: No DATABASE_URL, using MemStorage');
  }
}

export { db, pool };