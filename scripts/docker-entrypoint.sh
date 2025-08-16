#!/bin/bash
# Point d'entrée Docker avec migration automatique
# Ce script remplace le point d'entrée par défaut du conteneur

set -e

echo "🚀 [ENTRYPOINT] Démarrage du conteneur avec migration automatique..."

# Attendre que la base de données soit prête
echo "⏳ [ENTRYPOINT] Attente de la base de données..."
timeout=60
counter=0

while ! psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; do
    counter=$((counter + 1))
    if [ $counter -gt $timeout ]; then
        echo "❌ [ENTRYPOINT] Timeout: impossible de se connecter à la base de données après ${timeout}s"
        exit 1
    fi
    echo "⏳ [ENTRYPOINT] Tentative $counter/$timeout..."
    sleep 1
done

echo "✅ [ENTRYPOINT] Base de données accessible"

# Exécuter les migrations automatiques
if [ -f "/app/scripts/auto-migrate-production.sh" ]; then
    echo "🔄 [ENTRYPOINT] Exécution des migrations automatiques..."
    chmod +x /app/scripts/auto-migrate-production.sh
    /app/scripts/auto-migrate-production.sh
else
    echo "⚠️ [ENTRYPOINT] Script de migration non trouvé, poursuite sans migration"
fi

# Démarrer l'application
echo "🎯 [ENTRYPOINT] Démarrage de l'application..."
exec "$@"