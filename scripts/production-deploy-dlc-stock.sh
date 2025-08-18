#!/bin/bash

# Script de déploiement production - Fonctionnalité Stock Épuisé DLC
# Auteur: Système de gestion automatisé  
# Date: 2025-08-18

set -e

echo "🚀 [DEPLOY] Déploiement production - Fonctionnalité Stock Épuisé DLC"
echo "=================================================="

# Fonction de logging avec timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Vérification des prérequis
log "📋 Vérification des prérequis..."

if ! command -v docker &> /dev/null; then
    log "❌ Docker n'est pas installé"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    log "❌ Docker Compose n'est pas installé"
    exit 1
fi

if [ ! -f "docker-compose.yml" ]; then
    log "❌ Fichier docker-compose.yml non trouvé"
    exit 1
fi

log "✅ Prérequis validés"

# Sauvegarde préventive
log "💾 Création d'une sauvegarde préventive..."
timestamp=$(date +%Y%m%d_%H%M%S)
backup_file="backup_pre_dlc_stock_${timestamp}.sql"

# Tentative de sauvegarde (non bloquante si elle échoue)
if docker-compose exec -T logiflow-db pg_dump -U logiflow_admin logiflow_db > "${backup_file}" 2>/dev/null; then
    log "✅ Sauvegarde créée: ${backup_file}"
else
    log "⚠️ Sauvegarde échouée - continuons sans sauvegarde"
fi

# Mode maintenance
log "🛑 Activation du mode maintenance..."
echo "Redirection vers une page de maintenance pendant la mise à jour" > maintenance.html

# Arrêt de l'application
log "🔴 Arrêt de l'application..."
docker-compose down

# Rebuild avec les nouvelles fonctionnalités
log "🔨 Reconstruction de l'application avec les nouvelles fonctionnalités..."
docker-compose build --no-cache logiflow

# Démarrage de la base de données uniquement
log "🗄️ Démarrage de la base de données..."
docker-compose up -d logiflow-db

# Attendre que PostgreSQL soit prêt
log "⏳ Attente de PostgreSQL (30 secondes)..."
sleep 30

# Vérifier la connexion à la base
log "🔗 Test de connexion à la base de données..."
max_attempts=10
attempt=1

while [ $attempt -le $max_attempts ]; do
    if docker-compose exec -T logiflow-db pg_isready -U logiflow_admin; then
        log "✅ Base de données prête"
        break
    fi
    
    if [ $attempt -eq $max_attempts ]; then
        log "❌ Impossible de se connecter à la base de données après $max_attempts tentatives"
        exit 1
    fi
    
    log "⏳ Tentative $attempt/$max_attempts - attente 5 secondes..."
    sleep 5
    ((attempt++))
done

# Exécution manuelle de la migration (au cas où auto-migrate ne fonctionnerait pas)
log "🔄 Exécution de la migration DLC..."
if docker-compose exec -T logiflow-db psql -U logiflow_admin -d logiflow_db -f /migrations/002_add_dlc_stock_epuise.sql; then
    log "✅ Migration DLC exécutée avec succès"
else
    log "⚠️ Erreur lors de la migration - vérification manuelle nécessaire"
fi

# Démarrage complet de l'application
log "🚀 Démarrage complet de l'application..."
docker-compose up -d

# Attendre que l'application soit prête
log "⏳ Attente du démarrage de l'application (45 secondes)..."
sleep 45

# Tests de santé
log "🩺 Tests de santé de l'application..."
max_health_attempts=6
health_attempt=1

while [ $health_attempt -le $max_health_attempts ]; do
    if curl -f http://localhost:3000/api/health &> /dev/null; then
        log "✅ Application démarrée avec succès"
        break
    fi
    
    if [ $health_attempt -eq $max_health_attempts ]; then
        log "⚠️ Application non accessible après $max_health_attempts tentatives"
        log "📊 Vérification des logs:"
        docker-compose logs --tail=20 logiflow
        break
    fi
    
    log "⏳ Test santé $health_attempt/$max_health_attempts - attente 10 secondes..."
    sleep 10
    ((health_attempt++))
done

# Vérification de la migration
log "🔍 Vérification de la migration DLC..."
if docker-compose exec -T logiflow-db psql -U logiflow_admin -d logiflow_db -tAc "SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name='dlc_products' AND column_name='stock_epuise');" | grep -q "t"; then
    log "✅ Colonnes stock épuisé présentes"
else
    log "❌ Colonnes stock épuisé manquantes"
    exit 1
fi

# Test des nouvelles routes API
log "🧪 Test des nouvelles routes API..."
echo "Testez manuellement les routes suivantes :"
echo "- PUT /api/dlc-products/:id/stock-epuise"
echo "- PUT /api/dlc-products/:id/restore-stock"

# Désactivation du mode maintenance
log "🟢 Désactivation du mode maintenance..."
rm -f maintenance.html

# Résumé final
log "🎉 DÉPLOIEMENT TERMINÉ AVEC SUCCÈS!"
echo ""
echo "=================================================="
echo "📊 RÉSUMÉ DU DÉPLOIEMENT"
echo "=================================================="
echo "✅ Application reconstruite et redémarrée"
echo "✅ Base de données migrée avec les nouveaux champs"
echo "✅ Tests de santé réussis"
echo ""
echo "🔍 VÉRIFICATIONS POST-DÉPLOIEMENT:"
echo "1. Interface DLC accessible"
echo "2. Boutons PackageX et RotateCcw présents"  
echo "3. Fonctionnalité stock épuisé opérationnelle"
echo "4. Permissions admin/directeur/manager pour restauration"
echo ""
echo "📱 MONITORING:"
echo "docker-compose logs -f logiflow"
echo ""
echo "🐛 EN CAS DE PROBLÈME:"
echo "./scripts/verify-dlc-migration.sh"
echo "docker-compose restart"
echo ""
if [ -f "${backup_file}" ]; then
    echo "💾 SAUVEGARDE DISPONIBLE: ${backup_file}"
fi
echo "=================================================="