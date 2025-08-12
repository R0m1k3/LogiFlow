#!/usr/bin/env node

/**
 * Script de debug pour vérifier le schéma de la table suppliers en production
 * et corriger les colonnes manquantes si nécessaire
 */

import pg from 'pg';
import fs from 'fs';

const { Pool } = pg;

// Configuration de la base de données de production
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function checkSuppliersSchema() {
  console.log('🔍 Vérification du schéma de la table suppliers en production...');
  
  try {
    // Vérifier les colonnes existantes
    const result = await pool.query(`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_name = 'suppliers' 
      AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    
    console.log('\n📊 Colonnes actuelles dans la table suppliers:');
    console.log('='.repeat(60));
    
    const columns = result.rows;
    columns.forEach((col, index) => {
      const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
      console.log(`${index + 1:2}. ${col.column_name.padEnd(25)} : ${col.data_type} ${nullable}${defaultVal}`);
    });
    
    // Vérifier les colonnes requises
    const requiredColumns = ['email', 'automatic_reconciliation'];
    const existingColumns = columns.map(col => col.column_name);
    const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));
    
    if (missingColumns.length > 0) {
      console.log(`\n❌ Colonnes manquantes: ${missingColumns.join(', ')}`);
      console.log('\n📝 Script SQL généré pour corriger le problème:');
      console.log('='.repeat(60));
      
      let sqlScript = 'BEGIN;\n\n';
      
      if (missingColumns.includes('email')) {
        sqlScript += 'ALTER TABLE suppliers ADD COLUMN email VARCHAR;\n';
        sqlScript += 'COMMENT ON COLUMN suppliers.email IS \'Email du fournisseur\';\n\n';
      }
      
      if (missingColumns.includes('automatic_reconciliation')) {
        sqlScript += 'ALTER TABLE suppliers ADD COLUMN automatic_reconciliation BOOLEAN DEFAULT false;\n';
        sqlScript += 'COMMENT ON COLUMN suppliers.automatic_reconciliation IS \'Mode rapprochement automatique BL/Factures\';\n\n';
      }
      
      sqlScript += 'COMMIT;';
      
      console.log(sqlScript);
      
      // Sauvegarder le script
      fs.writeFileSync('fix-suppliers-missing-columns.sql', sqlScript);
      console.log('\n💾 Script sauvegardé dans: fix-suppliers-missing-columns.sql');
      
    } else {
      console.log('\n✅ Toutes les colonnes requises sont présentes');
    }
    
    // Compter les enregistrements
    const countResult = await pool.query('SELECT COUNT(*) as total FROM suppliers');
    console.log(`\n📈 Nombre de fournisseurs: ${countResult.rows[0].total}`);
    
  } catch (error) {
    console.error('❌ Erreur lors de la vérification:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Exécuter le script
checkSuppliersSchema()
  .then(() => {
    console.log('\n✅ Vérification terminée');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erreur:', error);
    process.exit(1);
  });