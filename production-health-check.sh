#!/bin/bash

# Script de vérification de santé pour LogiFlow en production
echo "🔍 Vérification de santé LogiFlow Production"
echo "=============================================="

# Vérifier le status des containers
echo "📊 Status des containers:"
docker-compose ps

echo ""
echo "🏥 Health checks:"
docker-compose exec logiflow wget --spider -q http://localhost:3000/api/health
if [ $? -eq 0 ]; then
    echo "✅ Health check API OK"
else
    echo "❌ Health check API FAILED"
fi

# Vérifier les fichiers statiques
echo ""
echo "📁 Vérification des fichiers statiques:"
docker-compose exec logiflow ls -la /app/dist/public/ | head -10

# Test des endpoints critiques
echo ""
echo "🌐 Test des endpoints:"
echo "Health:"
curl -s -o /dev/null -w "Status: %{http_code}\n" https://logiflow.ffnancy.fr/api/health

echo "Root:"
curl -s -o /dev/null -w "Status: %{http_code}\n" https://logiflow.ffnancy.fr/

echo "SAV:"
curl -s -o /dev/null -w "Status: %{http_code}\n" https://logiflow.ffnancy.fr/sav

# Dernières logs
echo ""
echo "📋 Dernières logs (10 lignes):"
docker-compose logs --tail=10 logiflow

echo ""
echo "🔧 Si erreur 502 persistent:"
echo "   docker-compose restart logiflow"
echo "   docker-compose up --build -d  # Rebuild complet"