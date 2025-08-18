-- MIGRATION URGENTE PRODUCTION DLC
-- Exécutez cette commande directement sur votre serveur

-- Ajout des colonnes DLC stock épuisé
ALTER TABLE dlc_products 
ADD COLUMN IF NOT EXISTS stock_epuise boolean DEFAULT false NOT NULL,
ADD COLUMN IF NOT EXISTS stock_epuise_by varchar(255),
ADD COLUMN IF NOT EXISTS stock_epuise_at timestamp;

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_dlc_products_stock_epuise ON dlc_products(stock_epuise);

-- Initialisation des valeurs
UPDATE dlc_products 
SET stock_epuise = false 
WHERE stock_epuise IS NULL;

-- Vérification
SELECT 
    'Migration DLC terminée' as status,
    COUNT(*) as colonnes_ajoutees
FROM information_schema.columns 
WHERE table_name = 'dlc_products' 
AND column_name IN ('stock_epuise', 'stock_epuise_by', 'stock_epuise_at');