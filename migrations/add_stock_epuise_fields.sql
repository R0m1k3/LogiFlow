-- Migration pour ajouter les champs stock épuisé aux produits DLC
-- À exécuter sur une base de données existante en production

-- Ajout des nouveaux champs pour la gestion du stock épuisé
ALTER TABLE dlc_products 
ADD COLUMN IF NOT EXISTS stock_epuise boolean DEFAULT false NOT NULL,
ADD COLUMN IF NOT EXISTS stock_epuise_by varchar(255),
ADD COLUMN IF NOT EXISTS stock_epuise_at timestamp;

-- Commentaires pour documenter les nouveaux champs
COMMENT ON COLUMN dlc_products.stock_epuise IS 'Indique si le produit est marqué comme stock épuisé';
COMMENT ON COLUMN dlc_products.stock_epuise_by IS 'ID de l''utilisateur qui a marqué le produit comme stock épuisé';
COMMENT ON COLUMN dlc_products.stock_epuise_at IS 'Date et heure de marquage du stock épuisé';

-- Vérification des changements
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'dlc_products' 
AND column_name IN ('stock_epuise', 'stock_epuise_by', 'stock_epuise_at')
ORDER BY column_name;