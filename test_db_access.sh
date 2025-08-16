#!/bin/bash
# Script de test d'accès à la base de données

echo "🔍 Test d'accès à la base de données..."

# Test de connexion
echo "1. Test de connexion à la base..."
docker exec logiflow-logiflow-1 psql "$DATABASE_URL" -c "SELECT version();" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Connexion à la base réussie"
else
    echo "❌ Erreur de connexion à la base"
    exit 1
fi

# Liste des tables existantes
echo "2. Tables existantes dans la base:"
docker exec logiflow-logiflow-1 psql "$DATABASE_URL" -c "
SELECT tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;
"

# Vérification spécifique de la table announcements
echo "3. Vérification de la table announcements:"
docker exec logiflow-logiflow-1 psql "$DATABASE_URL" -c "
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'announcements'
) as announcements_exists;
"

echo "✅ Test terminé!"