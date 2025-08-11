#!/bin/bash
echo "=== DIAGNOSTIC PRODUCTION LOGIFLOW ==="
echo "Date: $(date)"
echo ""

echo "1. Status PM2:"
pm2 status 2>/dev/null || echo "PM2 non disponible"

echo ""
echo "2. Processes sur port 5000:"
sudo lsof -i :5000 2>/dev/null || netstat -tulpn | grep :5000 2>/dev/null || echo "Aucun processus sur port 5000"

echo ""
echo "3. Status systemctl (si applicable):"
sudo systemctl status logiflow 2>/dev/null || echo "Service systemctl non trouvé"

echo ""
echo "4. Status Docker (si applicable):"
docker-compose ps 2>/dev/null || echo "Docker non utilisé"

echo ""
echo "5. Logs récents application:"
if command -v pm2 &> /dev/null; then
    pm2 logs --lines 10 --nostream 2>/dev/null
elif [ -f /var/log/logiflow.log ]; then
    tail -10 /var/log/logiflow.log
else
    echo "Logs non trouvés"
fi

echo ""
echo "6. Espace disque:"
df -h /

echo ""
echo "7. Mémoire:"
free -h

echo ""
echo "8. Variables d'environnement critiques:"
echo "NODE_ENV: ${NODE_ENV:-'NON_DEFINI'}"
echo "PORT: ${PORT:-'NON_DEFINI'}"
echo "DATABASE_URL: ${DATABASE_URL:+DEFINI}"

echo ""
echo "9. Test de connectivité localhost:"
curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/api/health || echo "Service non accessible"

echo ""
echo "10. Processus Node.js actifs:"
ps aux | grep node | grep -v grep || echo "Aucun processus Node.js"

echo ""
echo "=== FIN DIAGNOSTIC ==="