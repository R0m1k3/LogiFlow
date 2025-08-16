#!/bin/bash
# Script d'urgence pour corriger la production immédiatement

echo "🚨 CORRECTION URGENTE - Création de la table announcements"

# Option 1: Copier le fichier SQL dans le conteneur et l'exécuter
echo "📋 Copie du script SQL dans le conteneur..."
docker cp create_announcements_production.sql logiflow-logiflow-1:/tmp/

echo "🔧 Exécution du script SQL..."
docker exec logiflow-logiflow-1 psql $DATABASE_URL -f /tmp/create_announcements_production.sql

echo "✅ Script exécuté. Vérification..."
docker exec logiflow-logiflow-1 psql $DATABASE_URL -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name='announcements') as table_exists;"

echo "🎯 Redémarrage de l'application..."
docker restart logiflow-logiflow-1

echo "✅ CORRECTION TERMINÉE"