import { sql } from 'drizzle-orm';
import { db } from './db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Table pour suivre les migrations appliquées
const createMigrationsTable = async () => {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) UNIQUE NOT NULL,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
};

interface MigrationFile {
  filename: string;
  sql: string;
}

export async function runMigrations() {
  console.log('🔄 Vérification des migrations...');
  
  try {
    // Créer la table des migrations si elle n'existe pas
    await createMigrationsTable();
    
    // Récupérer les migrations déjà appliquées
    const appliedMigrations = await db.execute(sql`SELECT filename FROM migrations`);
    const appliedFilenames = new Set(appliedMigrations.rows.map((row: any) => row.filename));
    
    // Ajouter les migrations hardcodées directement dans le code pour éviter les problèmes de chemins
    const hardcodedMigrations = [
      {
        filename: '20250903141000_create_webhook_bap_config.sql',
        content: `CREATE TABLE IF NOT EXISTS webhook_bap_config (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL DEFAULT 'Configuration BAP',
  webhook_url TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO webhook_bap_config (name, webhook_url, description, is_active)
SELECT 
  'Configuration BAP',
  'https://workflow.ffnancy.fr/webhook-test/a3d03176-b72f-412d-8fb9-f920b9fbab4d',
  'Configuration par défaut pour envoi des fichiers BAP vers n8n',
  true
WHERE NOT EXISTS (SELECT 1 FROM webhook_bap_config);`
      }
    ];
    
    // Ignorer les fichiers de migrations pour éviter les erreurs SQL
    // Utiliser uniquement les migrations hardcodées
    const allMigrations = hardcodedMigrations;
    
    if (allMigrations.length === 0) {
      console.log('✅ Aucune migration à exécuter');
      return;
    }
    
    let executedCount = 0;
    
    for (const migration of allMigrations) {
      if (appliedFilenames.has(migration.filename)) {
        console.log(`⏭️  Migration déjà appliquée: ${migration.filename}`);
        continue;
      }
      
      console.log(`🔄 Exécution migration: ${migration.filename}`);
      
      try {
        // Exécuter la migration dans une transaction
        await db.transaction(async (tx: any) => {
          // Exécuter le SQL de migration
          await tx.execute(sql.raw(migration.content));
          
          // Marquer comme appliquée
          await tx.execute(sql`
            INSERT INTO migrations (filename) 
            VALUES (${migration.filename})
          `);
        });
        
        console.log(`✅ Migration appliquée avec succès: ${migration.filename}`);
        executedCount++;
        
      } catch (error) {
        console.error(`❌ Erreur lors de la migration ${migration.filename}:`, error);
        throw error;
      }
    }
    
    if (executedCount > 0) {
      console.log(`✅ ${executedCount} migration(s) appliquée(s) avec succès`);
    } else {
      console.log('✅ Toutes les migrations sont déjà appliquées');
    }
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'exécution des migrations:', error);
    throw error;
  }
}

// Fonction pour créer une nouvelle migration
export function createMigration(name: string): string {
  const timestamp = new Date().toISOString().replace(/[^\d]/g, '').slice(0, 14);
  const filename = `${timestamp}_${name.toLowerCase().replace(/\s+/g, '_')}.sql`;
  const migrationsDir = path.join(__dirname, '..', 'migrations');
  
  if (!fs.existsSync(migrationsDir)) {
    fs.mkdirSync(migrationsDir, { recursive: true });
  }
  
  const filePath = path.join(migrationsDir, filename);
  const template = `-- Migration: ${name}
-- Created: ${new Date().toISOString()}

-- Add your SQL here
`;
  
  fs.writeFileSync(filePath, template);
  console.log(`📝 Migration créée: ${filePath}`);
  
  return filePath;
}