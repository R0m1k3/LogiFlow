import { Client } from 'pg';

async function logProductionSchema() {
  // URL de connexion à votre base de production
  const productionDbUrl = process.env.DATABASE_URL_PRODUCTION || process.env.DATABASE_URL;
  
  if (!productionDbUrl) {
    console.error('❌ DATABASE_URL_PRODUCTION ou DATABASE_URL non définie');
    return;
  }

  const client = new Client({
    connectionString: productionDbUrl,
    ssl: productionDbUrl.includes('neon.tech') ? { rejectUnauthorized: false } : false
  });

  try {
    await client.connect();
    console.log('✅ Connecté à la base de production');

    // Récupérer tous les noms de tables
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `;
    
    const tablesResult = await client.query(tablesQuery);
    console.log('\n📋 TABLES DE LA BASE DE PRODUCTION:');
    console.log('=====================================');
    
    for (const row of tablesResult.rows) {
      const tableName = row.table_name;
      console.log(`\n🔸 Table: ${tableName}`);
      
      // Récupérer les colonnes de chaque table
      const columnsQuery = `
        SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = $1
        ORDER BY ordinal_position;
      `;
      
      const columnsResult = await client.query(columnsQuery, [tableName]);
      
      if (columnsResult.rows.length > 0) {
        console.log('   Colonnes:');
        columnsResult.rows.forEach(col => {
          const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
          const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
          console.log(`   - ${col.column_name}: ${col.data_type} ${nullable}${defaultVal}`);
        });
      }
    }

    console.log('\n📊 RÉSUMÉ:');
    console.log(`Total des tables: ${tablesResult.rows.length}`);
    
  } catch (error) {
    console.error('❌ Erreur lors de la connexion:', error.message);
  } finally {
    await client.end();
  }
}

// Exécuter le script
logProductionSchema().catch(console.error);