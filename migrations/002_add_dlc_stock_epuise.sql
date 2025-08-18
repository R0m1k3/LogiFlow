-- Migration 002: Ajout des champs stock épuisé aux produits DLC
-- Date: 2025-08-18
-- Description: Ajoute la fonctionnalité de gestion du stock épuisé pour distinguer 
--              les produits périmés des produits en rupture de stock

-- Vérification que la table dlc_products existe
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'dlc_products') THEN
        RAISE EXCEPTION 'La table dlc_products n''existe pas. Cette migration nécessite que la table soit déjà créée.';
    END IF;
END
$$;

-- Ajout des nouveaux champs pour la gestion du stock épuisé
ALTER TABLE dlc_products 
ADD COLUMN IF NOT EXISTS stock_epuise boolean DEFAULT false NOT NULL,
ADD COLUMN IF NOT EXISTS stock_epuise_by varchar(255),
ADD COLUMN IF NOT EXISTS stock_epuise_at timestamp;

-- Commentaires pour documenter les nouveaux champs
COMMENT ON COLUMN dlc_products.stock_epuise IS 'Indique si le produit est marqué comme stock épuisé (différent de périmé)';
COMMENT ON COLUMN dlc_products.stock_epuise_by IS 'ID de l''utilisateur qui a marqué le produit comme stock épuisé';
COMMENT ON COLUMN dlc_products.stock_epuise_at IS 'Date et heure de marquage du stock épuisé';

-- Index pour améliorer les performances sur les requêtes de stock épuisé
CREATE INDEX IF NOT EXISTS idx_dlc_products_stock_epuise ON dlc_products(stock_epuise);

-- Initialiser les produits existants avec stock disponible (pas épuisé)
-- Cette ligne est sécurisée car DEFAULT false est déjà appliqué
UPDATE dlc_products 
SET stock_epuise = false 
WHERE stock_epuise IS NULL;

-- Vérification finale
DO $$
DECLARE
    column_count integer;
BEGIN
    SELECT COUNT(*) INTO column_count
    FROM information_schema.columns 
    WHERE table_name = 'dlc_products' 
    AND column_name IN ('stock_epuise', 'stock_epuise_by', 'stock_epuise_at');
    
    IF column_count = 3 THEN
        RAISE NOTICE 'Migration 002 réussie: % colonnes ajoutées à dlc_products', column_count;
    ELSE
        RAISE EXCEPTION 'Migration 002 échouée: seulement % colonnes trouvées sur 3 attendues', column_count;
    END IF;
END
$$;