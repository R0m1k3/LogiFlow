# Correction Erreur Production - "Une erreur s'est produite"

## Problème Identifié
Votre serveur de production affiche une page d'erreur générique au lieu de l'application LogiFlow.

## Diagnostic Immédiat

### 1. Vérifiez les Logs du Serveur
```bash
# Si vous utilisez PM2
pm2 logs your-app-name --lines 50

# Si vous utilisez systemctl
sudo journalctl -u your-service-name -f --lines=50

# Si vous utilisez Docker
docker-compose logs -f --tail=50
```

### 2. Vérifiez le Statut de l'Application
```bash
# PM2
pm2 status
pm2 info your-app-name

# systemctl
sudo systemctl status your-service-name

# Docker
docker-compose ps
```

## Solutions par Ordre de Priorité

### Solution 1 : Redémarrage Simple
```bash
# PM2
pm2 restart your-app-name

# systemctl
sudo systemctl restart your-service-name

# Docker
docker-compose restart
```

### Solution 2 : Vérification des Ports
```bash
# Vérifiez quel processus utilise le port (généralement 5000 ou 3000)
sudo netstat -tulpn | grep :5000
sudo lsof -i :5000

# Si un autre processus occupe le port, le tuer
sudo kill -9 <PID>
```

### Solution 3 : Reconstruction Complete
```bash
# Sauvegarder les modifications récentes
cp -r client/src client/src.current

# Reconstruction complète
npm install
npm run build

# Redémarrage
pm2 restart your-app-name --update-env
```

### Solution 4 : Vérification des Variables d'Environnement
```bash
# Vérifiez que les variables essentielles sont définies
echo $NODE_ENV
echo $DATABASE_URL
echo $PORT

# Si manquantes, les redéfinir
export NODE_ENV=production
export PORT=5000
# etc...
```

### Solution 5 : Vérification de la Base de Données
```bash
# Test de connexion PostgreSQL
psql $DATABASE_URL -c "SELECT 1;"

# Si la connexion échoue, vérifiez les credentials
```

## Scripts de Diagnostic Automatique

### Script de Santé Générale
```bash
#!/bin/bash
echo "=== DIAGNOSTIC PRODUCTION ==="
echo "Date: $(date)"
echo ""

echo "1. Status PM2:"
pm2 status

echo ""
echo "2. Processes sur port 5000:"
sudo lsof -i :5000

echo ""
echo "3. Logs récents (10 dernières lignes):"
pm2 logs your-app-name --lines 10 --nostream

echo ""
echo "4. Espace disque:"
df -h

echo ""
echo "5. Mémoire:"
free -h

echo ""
echo "6. Variables d'environnement critiques:"
echo "NODE_ENV: $NODE_ENV"
echo "PORT: $PORT"
echo "DATABASE_URL: ${DATABASE_URL:0:20}..." # Masque les credentials
```

Sauvegardez ce script sous `production-health-check.sh` et exécutez-le :
```bash
chmod +x production-health-check.sh
./production-health-check.sh
```

## Correction Spécifique selon l'Erreur

### Si l'erreur est "EADDRINUSE" (Port occupé)
```bash
sudo lsof -i :5000
sudo kill -9 <PID_du_processus>
pm2 restart your-app-name
```

### Si l'erreur est "Database connection failed"
```bash
# Testez la connexion DB
psql $DATABASE_URL -c "\dt"

# Redémarrez les services de DB si nécessaire
sudo systemctl restart postgresql
```

### Si l'erreur est "Module not found"
```bash
# Réinstallation complète
rm -rf node_modules package-lock.json
npm install
npm run build
pm2 restart your-app-name
```

## Prévention Future

### 1. Monitoring Automatique
Ajoutez cette ligne à votre crontab :
```bash
crontab -e
# Ajouter cette ligne pour vérifier chaque minute
* * * * * curl -f http://localhost:5000/api/health || pm2 restart your-app-name
```

### 2. Sauvegarde Automatique
```bash
# Script de sauvegarde quotidienne
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
tar -czf /backup/logiflow_$DATE.tar.gz /path/to/your/app
find /backup -name "logiflow_*.tar.gz" -mtime +7 -delete
```

## Actions Immédiates Recommandées

1. **Exécutez** le script de diagnostic ci-dessus
2. **Copiez-collez** les résultats pour analyse
3. **Tentez** un redémarrage simple en premier
4. **Si le problème persiste**, reconstruisez l'application

Une fois que vous aurez exécuté ces commandes, envoyez-moi les logs d'erreur pour un diagnostic plus précis.