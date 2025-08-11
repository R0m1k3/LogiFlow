-- Script pour corriger la contrainte deliveries_status_check qui bloque la création de livraisons
-- Cette contrainte empêche l'utilisation du statut 'planned' en production

-- Supprimer la contrainte existante si elle existe
ALTER TABLE deliveries DROP CONSTRAINT IF EXISTS deliveries_status_check;

-- Recréer une contrainte permettant les statuts corrects
ALTER TABLE deliveries ADD CONSTRAINT deliveries_status_check 
CHECK (status IN ('pending', 'planned', 'delivered', 'cancelled'));

-- Vérifier les statuts existants dans la table
SELECT DISTINCT status FROM deliveries;

-- Afficher les contraintes de la table deliveries pour vérification
SELECT 
    tc.constraint_name, 
    tc.constraint_type, 
    cc.check_clause 
FROM information_schema.table_constraints tc 
LEFT JOIN information_schema.check_constraints cc ON tc.constraint_name = cc.constraint_name 
WHERE tc.table_name = 'deliveries' 
AND tc.table_schema = 'public'
AND tc.constraint_type = 'CHECK';