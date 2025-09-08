# 🔧 GUIDE DE DÉPLOIEMENT URGENT - Serveur de Production

## 🚨 PROBLÈME IDENTIFIÉ
Votre serveur de production utilise encore l'ancien code avec les erreurs TypeScript, pas le code corrigé.

## 📋 ÉTAPES DE RÉSOLUTION

### 1. VÉRIFIEZ LES LOGS DU SERVEUR
```bash
# Option 1: Si vous utilisez PM2
pm2 logs your_app_name

# Option 2: Si vous utilisez systemctl  
journalctl -u your_service_name -f

# Option 3: Si vous utilisez Docker
docker logs your_container_name
```

### 2. IDENTIFIEZ L'ERREUR EXACTE
Cherchez dans les logs des erreurs comme :
- `No overload matches this call`
- `AuthRequest`
- `requireModulePermission`

### 3. DÉPLOYEZ LE CODE CORRIGÉ

**Option A - Git (Recommandé)**
```bash
cd /chemin/vers/votre/application
git pull origin main
# ou
git pull origin master
```

**Option B - Copie manuelle**
1. Copiez le fichier `server/routes.ts` depuis ce projet Replit
2. Remplacez-le sur votre serveur de production

### 4. VÉRIFIEZ LE CODE DÉPLOYÉ
Dans votre fichier `server/routes.ts` en production, vous devez avoir :

```javascript
// ✅ CORRECT - Nouveau code
app.get('/api/avoirs', isAuthenticated, async (req: any, res) => {

// ❌ INCORRECT - Ancien code (cause l'erreur)
app.get('/api/avoirs', requireModulePermission('avoir', 'view'), async (req: AuthRequest, res) => {
```

### 5. REDÉMARREZ LE SERVEUR
```bash
# Option 1: PM2
pm2 restart your_app_name

# Option 2: systemctl
systemctl restart your_service_name

# Option 3: Docker
docker restart your_container_name

# Option 4: Service classique
sudo service your_service restart
```

### 6. VÉRIFIEZ QUE ÇA MARCHE
1. Rechargez votre page web
2. L'erreur générale devrait disparaître
3. Testez l'accès aux autres modules
4. Testez la création d'un avoir

## 🎯 DIAGNOSTIC RAPIDE

Si vous n'arrivez pas à identifier le problème :

1. **Envoyez-moi les logs d'erreur exacts**
2. **Confirmez que le code a été déployé**
3. **Vérifiez que le serveur a redémarré**

## 🚀 APRÈS RÉSOLUTION

Une fois que l'application fonctionne de nouveau :
1. Testez la création d'un avoir
2. Si ça ne marche pas, le problème sera alors dans la base de données
3. Mais d'abord, résolvez le problème de déploiement !