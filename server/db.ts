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

if (dbUrl && (isProduction || process.env.FORCE_POSTGRES === 'true')) {
  // Use PostgreSQL for production or when forced
  console.log('🐘 Using PostgreSQL database');
  const { Pool } = await import('pg');
  const { drizzle } = await import('drizzle-orm/node-postgres');
  
  pool = new Pool({ 
    connectionString: dbUrl,
    ssl: dbUrl.includes('localhost') ? false : { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
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
    // Continue anyway, will use MemStorage as fallback
    pool = null;
    db = null;
  }
} else {
  // Development fallback: use MemStorage
  console.log('🔧 DEV: Using MemStorage (development fallback)');
  pool = null;
  db = null;
}

export { db, pool };