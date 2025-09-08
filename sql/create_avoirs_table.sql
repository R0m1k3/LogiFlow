-- Script de création de la table avoirs pour la production
-- Exécuter ce script sur votre serveur PostgreSQL privé

CREATE TABLE IF NOT EXISTS avoirs (
  id SERIAL PRIMARY KEY,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  invoice_reference VARCHAR(255) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
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

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_avoirs_supplier_id ON avoirs(supplier_id);
CREATE INDEX IF NOT EXISTS idx_avoirs_group_id ON avoirs(group_id);
CREATE INDEX IF NOT EXISTS idx_avoirs_created_by ON avoirs(created_by);
CREATE INDEX IF NOT EXISTS idx_avoirs_status ON avoirs(status);
CREATE INDEX IF NOT EXISTS idx_avoirs_created_at ON avoirs(created_at DESC);

-- Trigger pour mettre à jour automatically updated_at
CREATE OR REPLACE FUNCTION update_avoirs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_avoirs_updated_at_trigger ON avoirs;
CREATE TRIGGER update_avoirs_updated_at_trigger
  BEFORE UPDATE ON avoirs
  FOR EACH ROW
  EXECUTE FUNCTION update_avoirs_updated_at();

-- Commentaires pour documenter la table
COMMENT ON TABLE avoirs IS 'Table pour gérer les avoirs (credit notes/refunds) avec webhook et vérification NocoDB';
COMMENT ON COLUMN avoirs.invoice_reference IS 'Référence de la facture pour laquelle l''avoir est demandé';
COMMENT ON COLUMN avoirs.amount IS 'Montant de l''avoir en euros';
COMMENT ON COLUMN avoirs.commercial_processed IS 'Indique si l''avoir a été traité par le commercial';
COMMENT ON COLUMN avoirs.webhook_sent IS 'Indique si le webhook a été envoyé avec succès';
COMMENT ON COLUMN avoirs.nocodb_verified IS 'Indique si l''avoir a été vérifié dans NocoDB';