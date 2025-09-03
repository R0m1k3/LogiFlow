-- Script SQL DEFINITIF à exécuter manuellement sur votre base PostgreSQL de production
-- Usage: psql -U postgres -d votre_base -f fix-webhook-bap-FINAL.sql

-- Vérifier si la table existe déjà
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema='public' AND table_name='webhook_bap_config') THEN
        RAISE NOTICE 'Création de la table webhook_bap_config...';
        
        CREATE TABLE webhook_bap_config (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL DEFAULT 'Configuration BAP',
          webhook_url TEXT NOT NULL,
          description TEXT,
          is_active BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Insérer la configuration par défaut
        INSERT INTO webhook_bap_config (name, webhook_url, description, is_active)
        VALUES (
          'Configuration BAP',
          'https://workflow.ffnancy.fr/webhook/a3d03176-b72f-412d-8fb9-f920b9fbab4d',
          'Configuration par défaut pour envoi des fichiers BAP vers n8n',
          true
        );

        -- Commentaire sur la table
        COMMENT ON TABLE webhook_bap_config IS 'Configuration pour webhook BAP n8n';
        
        RAISE NOTICE 'Table webhook_bap_config créée avec succès!';
    ELSE
        RAISE NOTICE 'Table webhook_bap_config existe déjà.';
    END IF;
END $$;

-- Vérification finale
SELECT 'Vérification: Table webhook_bap_config' AS check_table;
SELECT COUNT(*) AS nb_configs FROM webhook_bap_config;
SELECT * FROM webhook_bap_config;