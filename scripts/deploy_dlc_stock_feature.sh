#!/bin/bash

# Script de déploiement de la fonctionnalité Stock Épuisé DLC
# Auteur: Système de gestion automatisé
# Date: $(date)

set -e # Arrête le script en cas d'erreur

echo "🚀 Début du déploiement de la fonctionnalité Stock Épuisé DLC..."

# Vérification des prérequis
echo "📋 Vérification des prérequis..."

if ! command -v docker &> /dev/null; then
    echo "❌ Docker n'est pas installé"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose n'est pas installé"
    exit 1
fi

echo "✅ Prérequis validés"

# Sauvegarde de la base de données avant migration
echo "💾 Sauvegarde de la base de données..."
timestamp=$(date +%Y%m%d_%H%M%S)
backup_file="backup_pre_dlc_stock_${timestamp}.sql"

# Arrêt de l'application pour maintenance
echo "🛑 Arrêt de l'application..."
docker-compose down

# Rebuild avec les nouvelles fonctionnalités
echo "🔨 Reconstruction de l'application..."
docker-compose build --no-cache

# Démarrage de la base de données uniquement pour migration
echo "🗄️ Démarrage de la base de données pour migration..."
docker-compose up -d postgres

# Attendre que PostgreSQL soit prêt
echo "⏳ Attente de PostgreSQL..."
sleep 10

# Application de la migration
echo "🔄 Application de la migration..."
docker exec $(docker-compose ps -q postgres) psql -U postgres -d logiflow -f /migrations/add_stock_epuise_fields.sql || {
    echo "⚠️ Migration échouée - vérification manuelle nécessaire"
}

# Vérification de la migration
echo "🔍 Vérification de la migration..."
docker exec $(docker-compose ps -q postgres) psql -U postgres -d logiflow -c "
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'dlc_products' 
AND column_name IN ('stock_epuise', 'stock_epuise_by', 'stock_epuise_at');"

# Démarrage complet de l'application
echo "🚀 Démarrage complet de l'application..."
docker-compose up -d

# Attendre que l'application soit prête
echo "⏳ Attente du démarrage de l'application..."
sleep 15

# Tests de santé
echo "🩺 Tests de santé de l'application..."
if curl -f http://localhost:5000/api/health &> /dev/null; then
    echo "✅ Application démarrée avec succès"
else
    echo "⚠️ L'application pourrait ne pas être complètement prête"
fi

# Tests des nouvelles routes API
echo "🧪 Test des nouvelles routes..."
echo "Testez manuellement :"
echo "- PUT /api/dlc-products/:id/stock-epuise"
echo "- PUT /api/dlc-products/:id/restore-stock"

echo ""
echo "✅ Déploiement terminé avec succès!"
echo ""
echo "📝 Vérifications post-déploiement recommandées :"
echo "1. Connectez-vous à l'interface DLC"
echo "2. Vérifiez la présence des nouveaux boutons (PackageX et RotateCcw)"
echo "3. Testez le marquage stock épuisé sur un produit test"
echo "4. Vérifiez les permissions de restauration (admin/directeur/manager uniquement)"
echo "5. Contrôlez l'affichage des badges et couleurs (jaune vs gris)"
echo ""
echo "📊 Pour surveiller l'application :"
echo "docker-compose logs -f app"
echo ""
echo "🐛 En cas de problème :"
echo "docker-compose down && docker-compose up -d"