#!/bin/bash

# Script de vérification de la migration DLC stock épuisé
# Auteur: Système de gestion automatisé
# Date: 2025-08-18

set -e

echo "🔍 [VERIFY] Vérification de la migration DLC stock épuisé..."

# Charger la configuration de la base de données
if [ -f ".env.production" ]; then
    source .env.production
    echo "✅ [VERIFY] Configuration production chargée"
else
    echo "⚠️ [VERIFY] Fichier .env.production non trouvé, utilisation des variables d'environnement"
fi

# Construire l'URL de connexion si nécessaire
if [ -z "$DATABASE_URL" ]; then
    if [ -n "$POSTGRES_USER" ] && [ -n "$POSTGRES_PASSWORD" ] && [ -n "$POSTGRES_DB" ]; then
        export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@logiflow-db:5432/${POSTGRES_DB}"
        echo "🔧 [VERIFY] URL de base de données construite à partir des variables"
    else
        echo "❌ [VERIFY] Impossible de construire l'URL de base de données"
        exit 1
    fi
fi

echo "🔗 [VERIFY] Test de connexion à la base de données..."
if ! psql "$DATABASE_URL" -c "SELECT 1" > /dev/null 2>&1; then
    echo "❌ [VERIFY] Connexion à la base de données échouée"
    exit 1
fi
echo "✅ [VERIFY] Connexion à la base de données réussie"

# Vérifier l'existence de la table dlc_products
echo "🔍 [VERIFY] Vérification de l'existence de la table dlc_products..."
if ! psql "$DATABASE_URL" -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema='public' AND table_name='dlc_products');" | grep -q "t"; then
    echo "❌ [VERIFY] Table dlc_products n'existe pas"
    exit 1
fi
echo "✅ [VERIFY] Table dlc_products existe"

# Vérifier les colonnes stock épuisé
echo "🔍 [VERIFY] Vérification des colonnes stock épuisé..."
missing_columns=()

for column in "stock_epuise" "stock_epuise_by" "stock_epuise_at"; do
    if psql "$DATABASE_URL" -tAc "SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name='dlc_products' AND column_name='$column');" | grep -q "f"; then
        missing_columns+=("$column")
    fi
done

if [ ${#missing_columns[@]} -gt 0 ]; then
    echo "❌ [VERIFY] Colonnes manquantes: ${missing_columns[*]}"
    echo "🔧 [VERIFY] La migration doit être exécutée"
    exit 1
else
    echo "✅ [VERIFY] Toutes les colonnes stock épuisé sont présentes"
fi

# Vérifier les types de données
echo "🔍 [VERIFY] Vérification des types de données..."
psql "$DATABASE_URL" -c "
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'dlc_products' 
AND column_name IN ('stock_epuise', 'stock_epuise_by', 'stock_epuise_at')
ORDER BY column_name;
"

# Vérifier l'index
echo "🔍 [VERIFY] Vérification de l'index stock épuisé..."
if psql "$DATABASE_URL" -tAc "SELECT EXISTS (SELECT FROM pg_indexes WHERE tablename='dlc_products' AND indexname='idx_dlc_products_stock_epuise');" | grep -q "t"; then
    echo "✅ [VERIFY] Index idx_dlc_products_stock_epuise existe"
else
    echo "⚠️ [VERIFY] Index idx_dlc_products_stock_epuise manquant"
fi

# Test d'une requête simple
echo "🔍 [VERIFY] Test d'une requête avec les nouveaux champs..."
if psql "$DATABASE_URL" -c "SELECT stock_epuise, stock_epuise_by, stock_epuise_at FROM dlc_products LIMIT 1;" > /dev/null 2>&1; then
    echo "✅ [VERIFY] Requête avec les nouveaux champs réussie"
else
    echo "❌ [VERIFY] Erreur lors de la requête avec les nouveaux champs"
    exit 1
fi

# Compter les produits par statut de stock
echo "🔍 [VERIFY] Statistiques des produits par statut de stock..."
psql "$DATABASE_URL" -c "
SELECT 
    CASE 
        WHEN stock_epuise = true THEN 'stock_epuise'
        WHEN stock_epuise = false THEN 'stock_disponible'
        ELSE 'indetermine'
    END as statut_stock,
    COUNT(*) as nombre_produits
FROM dlc_products 
GROUP BY stock_epuise
ORDER BY stock_epuise;
"

echo ""
echo "✅ [VERIFY] Vérification de la migration DLC terminée avec succès!"
echo "🚀 [VERIFY] L'application peut maintenant utiliser les fonctionnalités stock épuisé"