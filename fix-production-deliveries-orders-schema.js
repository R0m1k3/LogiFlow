#!/usr/bin/env node

/**
 * Script de correction d'urgence pour résoudre les erreurs de colonnes manquantes 
 * qui empêchent l'affichage des commandes et livraisons en production
 */

import pg from 'pg';

const { Pool } = pg;

// Configuration de la base de données de production
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function fixProductionSchema() {
  console.log('🚨 CORRECTION D\'URGENCE - Schéma de production pour commandes/livraisons');
  console.log('='.repeat(70));
  
  try {
    // 1. Vérifier et corriger la table suppliers
    console.log('\n1️⃣ Vérification de la table suppliers...');
    
    const suppliersColumns = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'suppliers' 
      AND table_schema = 'public'
    `);
    
    const existingSupplierColumns = suppliersColumns.rows.map(row => row.column_name);
    console.log('   Colonnes existantes:', existingSupplierColumns.join(', '));
    
    // Ajouter les colonnes manquantes pour suppliers
    if (!existingSupplierColumns.includes('email')) {
      console.log('   🔧 Ajout de la colonne email...');
      await pool.query('ALTER TABLE suppliers ADD COLUMN email VARCHAR');
      console.log('   ✅ Colonne email ajoutée');
    }
    
    if (!existingSupplierColumns.includes('automatic_reconciliation')) {
      console.log('   🔧 Ajout de la colonne automatic_reconciliation...');
      await pool.query('ALTER TABLE suppliers ADD COLUMN automatic_reconciliation BOOLEAN DEFAULT false');
      console.log('   ✅ Colonne automatic_reconciliation ajoutée');
    }
    
    // 2. Vérifier les relations et contraintes
    console.log('\n2️⃣ Vérification des relations de clés étrangères...');
    
    const foreignKeys = await pool.query(`
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
        AND (tc.table_name = 'orders' OR tc.table_name = 'deliveries')
      ORDER BY tc.table_name, kcu.column_name
    `);
    
    console.log('   Relations trouvées:');
    foreignKeys.rows.forEach(fk => {
      console.log(`   - ${fk.table_name}.${fk.column_name} → ${fk.foreign_table_name}.${fk.foreign_column_name}`);
    });
    
    // 3. Test des requêtes problématiques
    console.log('\n3️⃣ Test des requêtes de commandes et livraisons...');
    
    try {
      console.log('   🧪 Test requête orders avec relations...');
      const testOrders = await pool.query(`
        SELECT 
          o.id,
          o.planned_date,
          o.status,
          s.name as supplier_name,
          g.name as group_name
        FROM orders o
        LEFT JOIN suppliers s ON o.supplier_id = s.id
        LEFT JOIN groups g ON o.group_id = g.id
        LIMIT 1
      `);
      console.log(`   ✅ Test orders réussi (${testOrders.rows.length} résultat)`);
      
    } catch (error) {
      console.log(`   ❌ Erreur test orders: ${error.message}`);
    }
    
    try {
      console.log('   🧪 Test requête deliveries avec relations...');
      const testDeliveries = await pool.query(`
        SELECT 
          d.id,
          d.scheduled_date,
          d.status,
          s.name as supplier_name,
          g.name as group_name
        FROM deliveries d
        LEFT JOIN suppliers s ON d.supplier_id = s.id
        LEFT JOIN groups g ON d.group_id = g.id
        LIMIT 1
      `);
      console.log(`   ✅ Test deliveries réussi (${testDeliveries.rows.length} résultat)`);
      
    } catch (error) {
      console.log(`   ❌ Erreur test deliveries: ${error.message}`);
    }
    
    // 4. Statistiques finales
    console.log('\n4️⃣ Statistiques des tables...');
    
    const tablesStats = ['suppliers', 'orders', 'deliveries', 'groups'];
    for (const table of tablesStats) {
      try {
        const countResult = await pool.query(`SELECT COUNT(*) as total FROM ${table}`);
        console.log(`   📊 ${table}: ${countResult.rows[0].total} enregistrements`);
      } catch (error) {
        console.log(`   ❌ Erreur comptage ${table}: ${error.message}`);
      }
    }
    
    console.log('\n✅ CORRECTION TERMINÉE - Redémarrez votre application');
    
  } catch (error) {
    console.error('\n❌ ERREUR CRITIQUE:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Vérifier que nous sommes en production
if (process.env.NODE_ENV !== 'production') {
  console.error('❌ Ce script ne doit être exécuté qu\'en production');
  console.error('   NODE_ENV =', process.env.NODE_ENV);
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL manquante');
  process.exit(1);
}

// Exécuter la correction
fixProductionSchema()
  .then(() => {
    console.log('\n🎉 Script de correction exécuté avec succès');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Échec du script de correction:', error);
    process.exit(1);
  });