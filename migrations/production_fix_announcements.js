// Script de migration production pour créer la table announcements
// Usage: node migrations/production_fix_announcements.js

import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const { Pool } = pg;

async function createAnnouncementsTable() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const db = drizzle(pool);

  try {
    console.log('🔄 Création de la table announcements...');

    // SQL pour créer la table announcements
    const sql = `
      -- Création de la table announcements
      CREATE TABLE IF NOT EXISTS announcements (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        priority VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'important', 'urgent')),
        author_id VARCHAR(255) NOT NULL,
        group_id INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        CONSTRAINT announcements_author_id_fkey FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT announcements_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
      );

      -- Création des index
      CREATE INDEX IF NOT EXISTS idx_announcements_priority ON announcements(priority);
      CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON announcements(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_announcements_author_id ON announcements(author_id);
      CREATE INDEX IF NOT EXISTS idx_announcements_group_id ON announcements(group_id);

      -- Commentaires
      COMMENT ON TABLE announcements IS 'Admin-managed announcements/information system';
      COMMENT ON COLUMN announcements.priority IS 'Priority level: normal, important, urgent';
      COMMENT ON COLUMN announcements.group_id IS 'NULL for global announcements, specific group_id for store-specific announcements';
    `;

    await pool.query(sql);
    
    console.log('✅ Table announcements créée avec succès!');
    
    // Vérification que la table existe
    const checkResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'announcements'
      );
    `);
    
    if (checkResult.rows[0].exists) {
      console.log('✅ Vérification: La table announcements existe bien');
      
      // Afficher la structure de la table
      const structure = await pool.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'announcements' 
        ORDER BY ordinal_position;
      `);
      
      console.log('📋 Structure de la table:');
      structure.rows.forEach(row => {
        console.log(`   ${row.column_name}: ${row.data_type}${row.is_nullable === 'NO' ? ' NOT NULL' : ''}`);
      });
    } else {
      console.log('❌ Erreur: La table announcements n\'a pas été créée');
    }

  } catch (error) {
    console.error('❌ Erreur lors de la création de la table:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Exécution
if (import.meta.url === `file://${process.argv[1]}`) {
  createAnnouncementsTable()
    .then(() => {
      console.log('🎉 Migration terminée avec succès');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Échec de la migration:', error);
      process.exit(1);
    });
}

export { createAnnouncementsTable };