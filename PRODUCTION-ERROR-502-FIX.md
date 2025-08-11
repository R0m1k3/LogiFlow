# Correction des Erreurs 502 - Production

## Problème Identifié
- Erreurs 502 (Bad Gateway) lors des appels API `/api/deliveries` et `/api/orders`
- CMD-55 n'apparaît pas en gris dans le calendrier
- Erreurs TypeScript dans le code du calendrier

## Solutions

### 1. Vérification du Serveur Backend

Vérifiez que votre serveur Node.js fonctionne :

```bash
# Vérifier le processus
ps aux | grep node

# Vérifier les logs du serveur
tail -f /path/to/your/server/logs

# Vérifier si le port est écouté
netstat -tlnp | grep :YOUR_PORT
```

### 2. Redémarrage du Serveur

```bash
# Via PM2
pm2 restart your-app-name
pm2 logs your-app-name

# Via systemctl
sudo systemctl restart your-node-service
sudo systemctl status your-node-service

# Via Docker
docker-compose restart
docker-compose logs -f
```

### 3. Vérification de la Configuration Proxy/Nginx

Si vous utilisez un proxy inverse (Nginx), vérifiez la configuration :

```nginx
location /api/ {
    proxy_pass http://localhost:YOUR_NODE_PORT/api/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
    proxy_read_timeout 86400;
}
```

### 4. Correction SQL Directe pour CMD-55

Pendant que vous résolvez les erreurs 502, corrigez CMD-55 directement :

```sql
-- Connexion à votre base
psql -h your-host -U your-user -d your-database

-- Correction CMD-55
UPDATE orders 
SET status = 'delivered'
WHERE id = 55 
  AND status != 'delivered'
  AND EXISTS (
    SELECT 1 FROM deliveries d 
    WHERE d."orderId" = 55 
    AND d.status = 'delivered'
  );

-- Vérifier le résultat
SELECT o.id, o.status, COUNT(d.id) as deliveries, 
       COUNT(CASE WHEN d.status = 'delivered' THEN 1 END) as delivered_deliveries
FROM orders o
LEFT JOIN deliveries d ON o.id = d."orderId"
WHERE o.id = 55
GROUP BY o.id, o.status;
```

### 5. Test des API manuellement

```bash
# Tester l'API orders
curl -X GET "http://your-server.com/api/orders" \
  -H "Cookie: your-session-cookie"

# Tester l'API deliveries  
curl -X GET "http://your-server.com/api/deliveries" \
  -H "Cookie: your-session-cookie"
```

## Actions Prioritaires

1. **Immédiat** : Exécuter la correction SQL pour CMD-55
2. **Urgent** : Redémarrer votre serveur Node.js
3. **Important** : Vérifier les logs pour identifier la cause des 502

## Diagnostic des Logs

Recherchez dans vos logs :

```bash
# Erreurs Node.js
grep -i "error\|crash\|exception" /path/to/logs

# Erreurs de base de données
grep -i "database\|postgres\|connection" /path/to/logs

# Erreurs de mémoire
grep -i "memory\|heap" /path/to/logs
```

## Résultat Attendu

Après correction :
- Les API `/api/orders` et `/api/deliveries` répondent sans erreur 502
- CMD-55 apparaît en gris dans le calendrier
- Le bouton "Sync Status" fonctionne correctement

---

**Note** : La correction SQL de CMD-55 peut être appliquée immédiatement, indépendamment de la résolution des erreurs 502.