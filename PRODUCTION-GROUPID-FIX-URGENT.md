# Fix Urgent Production - GroupId Magasin #2 → #1

## Problème Production Confirmé

Utilisateur production assigné au magasin #2 (Houdemont) :
```
group_id: 2,
group_name: 'Houdemont'
```

**MAIS** : DLC et commandes client créées pour magasin #1 malgré le fix backend.

## Cause Probable

Les logs production montrent que l'utilisateur a bien `group_id: 2` dans la base, mais la structure de données `user.userGroups` en production peut être différente du développement.

## Fix Appliqué

### 1. Debug Logs Production Renforcés
```javascript
console.log("🔍 DLC GroupId Debug Production:", {
  originalGroupId: req.body.groupId,
  userGroups: user.userGroups?.map(ug => ({
    groupId: ug.groupId, 
    groupName: ug.group?.name,
    rawGroup: ug.group
  })),
  userGroupsLength: user.userGroups?.length,
  firstUserGroup: user.userGroups?.[0]
});
```

### 2. Accès Alternatif pour Production
```javascript
if (user.userGroups?.[0]?.groupId) {
  finalGroupId = user.userGroups[0].groupId;
} else if (user.userGroups?.[0]?.group?.id) {
  // Alternative access pattern for production
  finalGroupId = user.userGroups[0].group.id;
} else {
  finalGroupId = 1; // Emergency fallback
}
```

## Hypothèses Production

1. **Structure différente** : `user.userGroups[0].group.id` au lieu de `user.userGroups[0].groupId`
2. **Mapping manquant** : Les relations ne sont pas correctement chargées en production
3. **Cache production** : Les données utilisateur ne sont pas à jour

## Actions Requises

1. ✅ **Logs debug renforcés** pour identifier structure exacte
2. ✅ **Accès alternatif** aux données groupe 
3. 🔄 **Déployer en production**
4. 🧪 **Tester création DLC/commande avec employé magasin #2**
5. 📋 **Analyser logs pour identifier structure de données exacte**

## Résultat Attendu

Après déploiement, les logs production révéleront :
- Structure exacte de `user.userGroups[0]`
- Chemin d'accès correct pour `groupId`
- Fix automatique via accès alternatif

**DÉPLOIEMENT PRODUCTION URGENT REQUIS**