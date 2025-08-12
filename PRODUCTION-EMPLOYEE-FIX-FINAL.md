# Fix Production Urgent - Employé Commandes Client & DLC

## Problèmes Identifiés

1. **Employé ne peut pas créer commandes clients** en production
2. **DLC ne fonctionnent pas** en production (même problème qu'en dev)
3. **Cache invalidation manquante** pour DLC

## Analyse du Code

### ✅ Permissions OK
```javascript
// shared/permissions.ts - Lignes 67-73 et 75-81
'customer-orders': {
  employee: ['view', 'create']  // ✅ PERMISSION OK
},
dlc: {
  employee: ['view', 'create']  // ✅ PERMISSION OK  
}
```

### ✅ Routes Backend OK
```javascript
// server/routes.ts
// POST /api/customer-orders - REMOVED: All role restrictions
// POST /api/dlc-products - REMOVED: All role restrictions
```

### ✅ Frontend Permissions OK
```javascript
// client/src/lib/permissions.ts - Ligne 118
const canCreate = (module: Module): boolean => canPerformAction(module, 'create');
// usePermissions(user?.role) fonctionne correctement
```

## Root Cause Probable

Le problème n'est PAS les permissions mais plutôt :

1. **Cache frontend** - L'employé a peut-être un cache obsolète
2. **Erreur validation** - Schema validation qui échoue silencieusement
3. **GroupId manquant** - L'employé n'a pas de groupId défini correctement
4. **DLC Production** - Même problème cache qu'en dev

## Solutions Immédiates

### 1. Fix Cache DLC (Déjà Fait en Dev)
```javascript
// client/src/pages/DlcPage.tsx
queryClient.invalidateQueries({ queryKey: ["/api/dlc-products"], exact: false });
```

### 2. Debug Frontend Production
```javascript
// À tester en console DevTools sur production:
console.log("User:", user);
console.log("Role:", user?.role);
console.log("Groups:", user?.userGroups);
console.log("Can create customer orders:", permissions.canCreate('customer-orders'));
console.log("Can create DLC:", permissions.canCreate('dlc'));
```

### 3. Test Manual Production
```javascript
// Tester en curl direct sur serveur production:
curl -X POST https://votre-serveur/api/customer-orders \
  -H "Content-Type: application/json" \
  -H "Cookie: session=..." \
  -d '{
    "customerName": "Test Production",
    "contactNumber": "0123456789", 
    "productName": "Test",
    "quantity": 1,
    "groupId": 2
  }'
```

## Actions Requises

### Immédiat
1. **Redémarrer serveur production** pour avoir les derniers fixes
2. **Vider cache browser** de l'employé (Ctrl+F5 ou mode incognito)
3. **Tester création commande** avec DevTools ouvert
4. **Noter toute erreur** console/réseau

### Si Problème Persiste
1. **Logs serveur** - Chercher erreurs dans logs production
2. **User Groups** - Vérifier que l'employé a bien un groupe assigné
3. **Schema Validation** - Tester les données envoyées

## Checklist Déploiement

- [x] Routes backend sans restrictions rôle
- [x] Permissions employé définies correctement
- [x] Cache invalidation DLC avec exact:false
- [x] Frontend permissions hook fonctionnel
- [ ] Serveur production redémarré
- [ ] Cache browser employé vidé  
- [ ] Tests création commande/DLC validés

## Fichiers Modifiés

1. `client/src/pages/DlcPage.tsx` - Cache invalidation fix
2. `server/routes.ts` - Debug logs ajoutés
3. `server/storage.ts` - MemStorage DLC fix (dev uniquement)

## Prochain Pas

**Tester immédiatement** après redémarrage serveur production avec un employé en mode incognito + DevTools.