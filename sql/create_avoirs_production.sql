-- 🔧 CRÉATION COMPLÈTE PRODUCTION - Table avoirs
-- Script de création définitive pour serveur de production

-- 1. Vérifier d'abord les tables existantes nécessaires
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'suppliers') THEN
        RAISE EXCEPTION 'Table suppliers non trouvée. Créez-la d''abord.';
    END IF;
    
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'groups') THEN
        RAISE EXCEPTION 'Table groups non trouvée. Créez-la d''abord.';
    END IF;
    
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users') THEN
        RAISE EXCEPTION 'Table users non trouvée. Créez-la d''abord.';
    END IF;
    
    RAISE NOTICE 'Toutes les tables dépendantes sont présentes.';
END $$;

-- 2. Supprimer la table si elle existe (ATTENTION: supprime les données)
DROP TABLE IF EXISTS avoirs CASCADE;

-- 3. Créer la table avec la structure exacte
CREATE TABLE avoirs (
    id SERIAL PRIMARY KEY,
    supplier_id INTEGER NOT NULL,
    group_id INTEGER NOT NULL,
    invoice_reference VARCHAR(255),
    amount DECIMAL(10,2),
    comment TEXT,
    commercial_processed BOOLEAN DEFAULT FALSE,
    status VARCHAR(50) DEFAULT 'En attente de demande',
    webhook_sent BOOLEAN DEFAULT FALSE,
    nocodb_verified BOOLEAN DEFAULT FALSE,
    nocodb_verified_at TIMESTAMP WITH TIME ZONE,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Ajouter les contraintes seulement si les tables existent
ALTER TABLE avoirs 
ADD CONSTRAINT fk_avoirs_supplier_id 
FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE;

ALTER TABLE avoirs 
ADD CONSTRAINT fk_avoirs_group_id 
FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;

ALTER TABLE avoirs 
ADD CONSTRAINT fk_avoirs_created_by 
FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE;

-- 5. Ajouter la contrainte de statut
ALTER TABLE avoirs 
ADD CONSTRAINT chk_avoirs_status 
CHECK (status IN ('En attente de demande', 'Demandé', 'Reçu'));

-- 6. Créer les index pour les performances
CREATE INDEX idx_avoirs_supplier_id ON avoirs(supplier_id);
CREATE INDEX idx_avoirs_group_id ON avoirs(group_id);
CREATE INDEX idx_avoirs_created_by ON avoirs(created_by);
CREATE INDEX idx_avoirs_status ON avoirs(status);
CREATE INDEX idx_avoirs_created_at ON avoirs(created_at DESC);

-- 7. Créer le trigger pour updated_at
CREATE OR REPLACE FUNCTION update_avoirs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_avoirs_updated_at_trigger
    BEFORE UPDATE ON avoirs
    FOR EACH ROW
    EXECUTE FUNCTION update_avoirs_updated_at();

-- 8. Test final avec une insertion
INSERT INTO avoirs (
    supplier_id, 
    group_id, 
    invoice_reference, 
    amount, 
    comment, 
    commercial_processed, 
    created_by
) 
SELECT 
    (SELECT id FROM suppliers LIMIT 1),
    (SELECT id FROM groups LIMIT 1),
    'TEST-PRODUCTION',
    100.00,
    'Test de création table production',
    false,
    (SELECT id FROM users LIMIT 1)
WHERE EXISTS (SELECT 1 FROM suppliers) 
  AND EXISTS (SELECT 1 FROM groups) 
  AND EXISTS (SELECT 1 FROM users);

-- 9. Vérifier la création
SELECT 
    'SUCCESS: Table avoirs créée avec ' || COUNT(*) || ' enregistrement(s)' as result 
FROM avoirs;

-- 10. Nettoyer le test
DELETE FROM avoirs WHERE invoice_reference = 'TEST-PRODUCTION';

SELECT 'Table avoirs prête pour production!' as final_status;