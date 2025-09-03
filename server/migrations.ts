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
    
    // Lire tous les fichiers de migration
    const migrationsDir = path.join(__dirname, '..', 'migrations');
    
    if (!fs.existsSync(migrationsDir)) {
      console.log('📁 Création du dossier migrations...');
      fs.mkdirSync(migrationsDir, { recursive: true });
    }
    
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Important : tri pour exécuter dans l'ordre
    
    if (migrationFiles.length === 0) {
      console.log('✅ Aucune migration à exécuter');
      return;
    }
    
    let executedCount = 0;
    
    for (const filename of migrationFiles) {
      if (appliedFilenames.has(filename)) {
        console.log(`⏭️  Migration déjà appliquée: ${filename}`);
        continue;
      }
      
      console.log(`🔄 Exécution migration: ${filename}`);
      
      const filePath = path.join(migrationsDir, filename);
      const migrationSql = fs.readFileSync(filePath, 'utf8');
      
      try {
        // Exécuter la migration dans une transaction
        await db.transaction(async (tx: any) => {
          // Exécuter le SQL de migration
          await tx.execute(sql.raw(migrationSql));
          
          // Marquer comme appliquée
          await tx.execute(sql`
            INSERT INTO migrations (filename) 
            VALUES (${filename})
          `);
        });
        
        console.log(`✅ Migration appliquée avec succès: ${filename}`);
        executedCount++;
        
      } catch (error) {
        console.error(`❌ Erreur lors de la migration ${filename}:`, error);
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