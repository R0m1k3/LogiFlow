#!/usr/bin/env node

/**
 * Production deployment script
 * Runs database migrations and starts the application
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function deployToProduction() {
  console.log('🚀 Starting production deployment...');
  
  try {
    // Check if we're in production environment
    if (process.env.NODE_ENV !== 'production') {
      console.log('⚠️  Warning: NODE_ENV is not set to production');
    }

    // Check if DATABASE_URL is available
    if (!process.env.DATABASE_URL) {
      console.error('❌ DATABASE_URL environment variable is required for production');
      process.exit(1);
    }

    console.log('✅ Environment variables verified');

    // Run database migrations
    console.log('🔄 Running database migrations...');
    
    const migrateScriptPath = path.join(__dirname, 'migrations', 'migrate.js');
    if (fs.existsSync(migrateScriptPath)) {
      execSync(`node ${migrateScriptPath}`, { stdio: 'inherit' });
      console.log('✅ Database migrations completed');
    } else {
      console.log('⚠️  No migration script found, skipping migrations');
    }

    // Start the application
    console.log('🚀 Starting application...');
    execSync('npm start', { stdio: 'inherit' });

  } catch (error) {
    console.error('❌ Deployment failed:', error.message);
    process.exit(1);
  }
}

// Execute if this script is run directly
if (require.main === module) {
  deployToProduction();
}

module.exports = { deployToProduction };