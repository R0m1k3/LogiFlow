# Fix Final - Problème GroupId Commandes Client Production

## Problème Identifié

**DLC** ✅ → `groupId: 2` (fonctionne)  
**Commandes Client** ❌ → `groupId: 1` (ne fonctionne pas)

## Cause Racine

Les `defaultValues` du formulaire sont calculés avant que `user.userGroups` soit complètement chargé depuis `/api/user`. 

**Séquence problématique :**
1. Formulaire se render → `user.userGroups` = `undefined`
2. `getDefaultGroupId()` → retourne `1` (fallback)
3. `/api/user` charge → `user.userGroups` = `[{groupId: 2}]`  
4. Mais `defaultValues` déjà fixés à `1` ❌

## Solution Appliquée

### 1. Double Sécurité (DefaultValues + Override)
```javascript
// ÉTAPE 1: defaultValues avec priorité groupe assigné
const getDefaultGroupId = () => {
  if (user?.userGroups?.[0]?.groupId) {
    return user.userGroups[0].groupId; // Priorité absolue
  }
  return 1; // Fallback temporaire
};

// ÉTAPE 2: Override dans handleSubmit si besoin
if (!groupId || groupId === 1) {
  if (user?.userGroups?.[0]?.groupId) {
    groupId = user.userGroups[0].groupId; // ✅ Force groupId correct
  }
}
```

### 2. Logique de Priorité Unifiée
**PARTOUT (DLC + Commandes Client) :**
1. 🎯 **Groupe assigné utilisateur** - PRIORITÉ ABSOLUE
2. 🏪 **Admin store selection** - Si pas de groupe assigné  
3. 🚨 **Fallback** `1` - Urgence seulement

## Résultat Attendu

Employé magasin #2 (Houdemont) :
- ✅ **DLC** → `groupId: 2` (déjà fixé)
- ✅ **Commandes Client** → `groupId: 2` (maintenant fixé avec override)

**Test de Validation :**
```javascript
🎯 CustomerOrderForm defaultValue: Using user's assigned group: 2
🔧 Customer Order Override: Using user's assigned group: 2  // ✅ Double sécurité
✅ Final groupId after override check: 2
```

## Déploiement

**PRÊT POUR PRODUCTION** - Fix double sécurité garantit le bon groupId même si defaultValues ne sont pas corrects au moment du render initial.