-- 🔧 RECREATION COMPLETE - Table avoirs 
-- Si la table existe déjà avec des problèmes, utilisez ce script pour la recréer

-- 1. Supprimer la table existante (ATTENTION: supprime les données!)
DROP TABLE IF EXISTS avoirs CASCADE;

-- 2. Recréer la table avec la bonne structure
CREATE TABLE avoirs (
  id SERIAL PRIMARY KEY,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  invoice_reference VARCHAR(255),
  amount DECIMAL(10,2),
  comment TEXT,
  commercial_processed BOOLEAN DEFAULT FALSE,
  status VARCHAR(50) DEFAULT 'En attente de demande' CHECK (status IN ('En attente de demande', 'Demandé', 'Reçu')),
  webhook_sent BOOLEAN DEFAULT FALSE,
  nocodb_verified BOOLEAN DEFAULT FALSE,
  nocodb_verified_at TIMESTAMP,
  processed_at TIMESTAMP,
  created_by VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Créer les index
CREATE INDEX idx_avoirs_supplier_id ON avoirs(supplier_id);
CREATE INDEX idx_avoirs_group_id ON avoirs(group_id);
CREATE INDEX idx_avoirs_created_by ON avoirs(created_by);
CREATE INDEX idx_avoirs_status ON avoirs(status);
CREATE INDEX idx_avoirs_created_at ON avoirs(created_at DESC);

-- 4. Créer le trigger pour updated_at
CREATE OR REPLACE FUNCTION update_avoirs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_avoirs_updated_at_trigger
  BEFORE UPDATE ON avoirs
  FOR EACH ROW
  EXECUTE FUNCTION update_avoirs_updated_at();

-- 5. Tester une insertion
INSERT INTO avoirs (
    supplier_id, 
    group_id, 
    invoice_reference, 
    amount, 
    comment, 
    commercial_processed, 
    created_by
) VALUES (
    1,  -- Changez selon vos données
    1,  -- Changez selon vos données
    'TEST-CREATION',
    75.50,
    'Test après recréation',
    false,
    'admin'  -- Changez selon vos données
) RETURNING id, created_at;

-- 6. Si le test réussit, supprimer l'enregistrement de test
DELETE FROM avoirs WHERE invoice_reference = 'TEST-CREATION';