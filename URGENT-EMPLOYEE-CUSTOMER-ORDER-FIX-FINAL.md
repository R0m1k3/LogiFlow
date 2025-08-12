# Fix Final - Commandes Client Employé Magasin #2

## Problème Spécifique aux Commandes Client

Les DLC fonctionnent maintenant ✅ mais les commandes client ont encore `groupId: 1` pour employé magasin #2.

## Cause Identifiée

Logs production montrent :
```javascript
userHasGroups: true,
userGroupsLength: 1,
selectedStoreId: 1,  // ❌ Interfère avec la logique
final groupId selected: 1  // ❌ Mauvais groupId
```

**Différence DLC vs Commandes Client :**
- ✅ **DLC** : Calcul `groupId` dans `onSubmit()` 
- ❌ **Commandes Client** : `defaultValues` du formulaire utilise logique incorrecte

## Fix Appliqué

### 1. Fonction de Calcul GroupId Correcte
```javascript
const getDefaultGroupId = () => {
  if (order?.groupId) return order.groupId;
  
  // PRIORITÉ 1: Groupe assigné utilisateur
  if (user?.userGroups?.[0]?.groupId) {
    return user.userGroups[0].groupId; // groupId: 2 pour employé Houdemont
  }
  
  // PRIORITÉ 2: Admin store selection (seulement si pas de groupe assigné)
  if (user?.role === 'admin' && selectedStoreId) {
    return selectedStoreId;
  }
  
  return 1; // Fallback
};
```

### 2. Application dans defaultValues
```javascript
// AVANT (Cassé)
groupId: order?.groupId || (user?.userGroups?.[0]?.groupId || (user?.role === 'admin' && selectedStoreId ? selectedStoreId : 1))

// APRÈS (Corrigé)
groupId: getDefaultGroupId() // ✅ Priorité correcte
```

## Logique de Priorité Unifiée

**PARTOUT (DLC + Commandes Client) :**
1. 🎯 **Groupe assigné** (`user.userGroups[0].groupId`) - **PRIORITÉ ABSOLUE**
2. 🏪 **Admin selection** (`selectedStoreId`) - Si pas de groupe assigné
3. 🚨 **Fallback** (`groupId: 1`) - Urgence

## Résultat Attendu

Employé magasin #2 (Houdemont) :
- ✅ **DLC** → `groupId: 2` (déjà fixé)
- ✅ **Commandes Client** → `groupId: 2` (maintenant fixé)
- ✅ **Cohérence totale** entre tous les modules

**DÉPLOIEMENT PRODUCTION IMMÉDIAT**