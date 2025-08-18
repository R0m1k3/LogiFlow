-- MIGRATION URGENTE PRODUCTION - DLC Stock Épuisé
-- Date: 2025-08-18
-- À exécuter sur votre serveur de production privé

-- Vérification que la table dlc_products existe
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'dlc_products') THEN
        RAISE EXCEPTION 'ERREUR: La table dlc_products n''existe pas';
    END IF;
    RAISE NOTICE 'OK: Table dlc_products trouvée';
END
$$;

-- Vérification des colonnes existantes avant migration
SELECT 'AVANT MIGRATION - Colonnes actuelles:' as status;
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'dlc_products' 
AND column_name IN ('stock_epuise', 'stock_epuise_by', 'stock_epuise_at')
ORDER BY column_name;

-- Migration sécurisée - Ajout des colonnes DLC stock épuisé
ALTER TABLE dlc_products 
ADD COLUMN IF NOT EXISTS stock_epuise boolean DEFAULT false NOT NULL,
ADD COLUMN IF NOT EXISTS stock_epuise_by varchar(255),
ADD COLUMN IF NOT EXISTS stock_epuise_at timestamp;

-- Commentaires pour documenter les nouveaux champs
COMMENT ON COLUMN dlc_products.stock_epuise IS 'Indique si le produit est marqué comme stock épuisé (différent de périmé)';
COMMENT ON COLUMN dlc_products.stock_epuise_by IS 'ID de l''utilisateur qui a marqué le produit comme stock épuisé';
COMMENT ON COLUMN dlc_products.stock_epuise_at IS 'Date et heure de marquage du stock épuisé';

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_dlc_products_stock_epuise ON dlc_products(stock_epuise);

-- Initialiser tous les produits existants comme stock disponible
UPDATE dlc_products 
SET stock_epuise = false 
WHERE stock_epuise IS NULL;

-- Vérification finale
SELECT 'APRÈS MIGRATION - Vérification:' as status;
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'dlc_products' 
AND column_name IN ('stock_epuise', 'stock_epuise_by', 'stock_epuise_at')
ORDER BY column_name;

-- Statistiques après migration
SELECT 
    COUNT(*) as total_produits,
    COUNT(CASE WHEN stock_epuise = true THEN 1 END) as stock_epuise,
    COUNT(CASE WHEN stock_epuise = false THEN 1 END) as stock_disponible
FROM dlc_products;

SELECT 'MIGRATION TERMINÉE AVEC SUCCÈS' as status;