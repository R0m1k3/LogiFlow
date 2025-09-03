#!/usr/bin/env node

// Script utilitaire pour créer une nouvelle migration
// Usage: node scripts/create-migration.js "nom de la migration"

import { createMigration } from '../server/migrations.js';

const migrationName = process.argv[2];

if (!migrationName) {
  console.error('❌ Usage: node scripts/create-migration.js "nom de la migration"');
  console.error('   Exemple: node scripts/create-migration.js "add user roles table"');
  process.exit(1);
}

try {
  const filePath = createMigration(migrationName);
  console.log(`✅ Migration créée avec succès: ${filePath}`);
  console.log('   Éditez ce fichier pour ajouter votre SQL');
} catch (error) {
  console.error('❌ Erreur lors de la création de la migration:', error);
  process.exit(1);
}