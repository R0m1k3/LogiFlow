# Fix Final Frontend - GroupId Production

## Problème Identifié en Production

Les logs production montrent clairement :
- ✅ **Utilisateur assigné groupe #2** : `group_id: 2, group_name: 'Houdemont'`
- ✅ **API DLC lit correctement** : `userGroups: [ { groupId: 2, groupName: 'Houdemont' } ]`
- ❌ **Création utilise groupId: 1** au lieu du groupe assigné

## Cause Exacte

Le frontend ne priorise pas correctement le groupe assigné lors de la création. La logique donnait priorité à `selectedStoreId` (admin) avant le groupe assigné de l'utilisateur.

## Fix Appliqué

### 1. DLC Page - Nouvelle Priorité
```javascript
// AVANT (Problématique)
if (user?.role === 'admin' && selectedStoreId) {
  groupId = selectedStoreId; // Admin prioritaire
} else if (user?.userGroups?.[0]?.groupId) {
  groupId = user.userGroups[0].groupId; // Groupe utilisateur second
}

// APRÈS (Corrigé)
if (user?.userGroups?.[0]?.groupId) {
  // PRIORITÉ ABSOLUE: groupe assigné utilisateur
  groupId = user.userGroups[0].groupId;
} else if (user?.role === 'admin' && selectedStoreId) {
  // Admin seulement si pas de groupe assigné
  groupId = selectedStoreId;
}
```

### 2. Customer Order Form - Même Logique
```javascript
// Même priorité dans les deux endroits:
// 1. user.userGroups[0].groupId (PRIORITÉ)
// 2. admin selectedStoreId
// 3. fallbacks...
```

### 3. Formulaire Default Value Fix
```javascript
// AVANT
groupId: order?.groupId || (user?.role === 'admin' && selectedStoreId ? selectedStoreId : user?.userGroups?.[0]?.groupId) || 1

// APRÈS  
groupId: order?.groupId || (user?.userGroups?.[0]?.groupId || (user?.role === 'admin' && selectedStoreId ? selectedStoreId : 1))
```

## Logique de Priorité Unifiée

**PARTOUT DANS L'APPLICATION :**
1. 🎯 **Groupe assigné utilisateur** (`user.userGroups[0].groupId`) - **PRIORITÉ ABSOLUE**
2. 🏪 **Admin store selection** (`selectedStoreId`) - Si pas de groupe assigné
3. 📋 **Premier groupe disponible** - Fallback admin
4. 🚨 **groupId = 1** - Urgence

## Résultat Attendu Production

Employé assigné magasin #2 (Houdemont) :
- ✅ **DLC création** → `groupId: 2` (groupe assigné prioritaire)
- ✅ **Commande client** → `groupId: 2` (groupe assigné prioritaire)  
- ✅ **Cohérence** avec les autres modules qui fonctionnent déjà

**DÉPLOIEMENT PRODUCTION IMMÉDIAT REQUIS**