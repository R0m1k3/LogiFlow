import { sql } from 'drizzle-orm';
import { db } from './db.js';

export async function ensureWebhookBapConfigTable() {
  console.log('🔧 [STARTUP] Vérification table webhook_bap_config...');
  
  try {
    // Vérifier si la table existe
    const tableExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema='public' AND table_name='webhook_bap_config'
      );
    `);
    
    const exists = tableExists.rows[0]?.exists;
    
    if (exists) {
      console.log('✅ [STARTUP] Table webhook_bap_config existe déjà');
      return;
    }
    
    console.log('🔧 [STARTUP] Création de la table webhook_bap_config...');
    
    // Créer la table
    await db.execute(sql`
      CREATE TABLE webhook_bap_config (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL DEFAULT 'Configuration BAP',
        webhook_url TEXT NOT NULL,
        description TEXT,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Insérer la configuration par défaut
    await db.execute(sql`
      INSERT INTO webhook_bap_config (name, webhook_url, description, is_active)
      VALUES (
        'Configuration BAP',
        'https://workflow.ffnancy.fr/webhook/a3d03176-b72f-412d-8fb9-f920b9fbab4d',
        'Configuration par défaut pour envoi des fichiers BAP vers n8n',
        true
      );
    `);
    
    // Ajouter un commentaire
    await db.execute(sql`
      COMMENT ON TABLE webhook_bap_config IS 'Configuration pour webhook BAP n8n';
    `);
    
    console.log('✅ [STARTUP] Table webhook_bap_config créée avec succès!');
    
  } catch (error) {
    console.error('❌ [STARTUP] Erreur lors de la création de la table webhook_bap_config:', error);
    // Ne pas arrêter l'application si la création échoue
  }
}