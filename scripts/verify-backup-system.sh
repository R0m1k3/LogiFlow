#!/bin/bash
# Script de vérification du système de sauvegarde automatique
# Usage: ./scripts/verify-backup-system.sh

set -e

echo "🔍 VÉRIFICATION DU SYSTÈME DE SAUVEGARDE AUTOMATIQUE"
echo "=================================================="

# 1. Vérifier que les containers sont en cours d'exécution
echo "1. Vérification des containers Docker..."
if docker-compose ps | grep -q "logiflow.*Up"; then
    echo "✅ Container LogiFlow en cours d'exécution"
else
    echo "❌ Container LogiFlow non disponible"
    exit 1
fi

if docker-compose ps | grep -q "logiflow-db.*Up"; then
    echo "✅ Container PostgreSQL en cours d'exécution"
else
    echo "❌ Container PostgreSQL non disponible"
    exit 1
fi

# 2. Vérifier la connectivité à la base de données
echo ""
echo "2. Vérification de la connectivité à la base de données..."
if docker-compose exec logiflow-db pg_isready -U logiflow_admin -d logiflow_db > /dev/null 2>&1; then
    echo "✅ Base de données accessible"
else
    echo "❌ Base de données non accessible"
    exit 1
fi

# 3. Vérifier la présence de pg_dump dans le container
echo ""
echo "3. Vérification de pg_dump..."
if docker-compose exec logiflow which pg_dump > /dev/null 2>&1; then
    echo "✅ pg_dump disponible"
    docker-compose exec logiflow pg_dump --version
else
    echo "❌ pg_dump non disponible"
    exit 1
fi

# 4. Vérifier le répertoire de sauvegarde
echo ""
echo "4. Vérification du répertoire de sauvegarde..."
if docker-compose exec logiflow ls -la /app/backups > /dev/null 2>&1; then
    echo "✅ Répertoire /app/backups accessible"
    echo "Contenu du répertoire de sauvegarde :"
    docker-compose exec logiflow ls -la /app/backups
else
    echo "❌ Répertoire de sauvegarde non accessible"
    exit 1
fi

# 5. Vérifier la table database_backups
echo ""
echo "5. Vérification de la table database_backups..."
if docker-compose exec logiflow-db psql -U logiflow_admin -d logiflow_db -c "SELECT COUNT(*) FROM database_backups;" > /dev/null 2>&1; then
    echo "✅ Table database_backups accessible"
    echo "Sauvegardes enregistrées :"
    docker-compose exec logiflow-db psql -U logiflow_admin -d logiflow_db -c "SELECT filename, created_at, backup_type, status FROM database_backups ORDER BY created_at DESC LIMIT 5;" 2>/dev/null || echo "Aucune sauvegarde trouvée"
else
    echo "❌ Table database_backups non accessible"
    exit 1
fi

# 6. Vérifier les logs du service de sauvegarde
echo ""
echo "6. Vérification des logs du service de sauvegarde..."
echo "Recherche du message d'initialisation du service de sauvegarde :"
if docker-compose logs logiflow | grep -q "Backup service initialized for automatic daily backups"; then
    echo "✅ Service de sauvegarde initialisé"
else
    echo "⚠️ Message d'initialisation non trouvé dans les logs récents"
fi

if docker-compose logs logiflow | grep -q "Automatic backup scheduled"; then
    echo "✅ Planification automatique configurée"
else
    echo "⚠️ Message de planification non trouvé dans les logs récents"
fi

echo ""
echo "7. Test de création d'une sauvegarde manuelle..."
echo "Pour tester une sauvegarde manuelle, connectez-vous à l'application et utilisez l'API :"
echo "curl -X POST http://localhost:3000/api/backups -H 'Content-Type: application/json' -d '{\"type\": \"manual\"}'"

echo ""
echo "🎉 VÉRIFICATION TERMINÉE"
echo "========================"
echo ""
echo "💡 INFORMATIONS IMPORTANTES :"
echo "- Les sauvegardes automatiques sont programmées quotidiennement à 2h00"
echo "- Les sauvegardes sont stockées dans le volume Docker 'backup_data'"
echo "- Maximum 10 sauvegardes conservées (les plus anciennes sont supprimées automatiquement)"
echo "- Les sauvegardes sont également enregistrées en base dans la table 'database_backups'"
echo ""
echo "🔧 EN CAS DE PROBLÈME :"
echo "- Redémarrez les containers : docker-compose restart"
echo "- Vérifiez les logs : docker-compose logs logiflow"
echo "- Vérifiez les variables d'environnement : docker-compose config"