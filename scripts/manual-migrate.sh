#!/bin/bash
# Script de migration manuelle pour forcer une mise à jour
# Usage: docker exec logiflow-logiflow-1 /app/scripts/manual-migrate.sh

echo "🔧 [MANUAL-MIGRATE] Début de la migration manuelle forcée..."

# Sourcer le script de migration automatique
if [ -f "/app/scripts/auto-migrate-production.sh" ]; then
    source /app/scripts/auto-migrate-production.sh
else
    echo "❌ [MANUAL-MIGRATE] Script de migration automatique non trouvé"
    exit 1
fi

echo "✅ [MANUAL-MIGRATE] Migration manuelle terminée!"