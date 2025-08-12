# Fix DLC GroupId - Production

## Problème Identifié

**Utilisateurs assignés au magasin #2 créent des DLC pour le magasin #1**

## Cause du Problème

Dans `client/src/pages/DlcPage.tsx` ligne 208, la logique était incorrecte :

```javascript
// AVANT (Problématique)
groupId: selectedStoreId || stores[0]?.id || 2
```

**Problème** : Pour un utilisateur non-admin assigné au magasin #2 :
- `selectedStoreId` = undefined (pas admin)
- `stores[0]?.id` = 1 (premier magasin de la liste)
- Résultat : DLC créée pour magasin #1 au lieu de #2

## Solution Appliquée

**Nouvelle logique de sélection groupId :**

```javascript
// APRÈS (Corrigé)
let groupId;
if (user?.role === 'admin' && selectedStoreId) {
  // Admin avec magasin sélectionné
  groupId = selectedStoreId;
} else if (user?.userGroups?.[0]?.groupId) {
  // Utilisateur non-admin : utiliser son groupe assigné ✅
  groupId = user.userGroups[0].groupId;
} else if (user?.role === 'admin') {
  // Admin sans sélection : premier magasin disponible
  groupId = stores[0]?.id || 1;
} else {
  // Fallback par défaut
  groupId = 1;
}
```

## Priorité de Sélection

1. **Admin avec magasin sélectionné** → `selectedStoreId`
2. **Utilisateur avec groupe assigné** → `user.userGroups[0].groupId` ✅ **FIX PRINCIPAL**
3. **Admin sans sélection** → Premier magasin disponible
4. **Fallback** → Magasin #1

## Log de Debug Ajouté

```javascript
console.log("🏪 DLC GroupId Selection:", {
  userRole: user?.role,
  selectedStoreId,
  userGroups: user?.userGroups?.map(ug => ({groupId: ug.groupId, groupName: ug.group?.name})),
  finalGroupId: groupId
});
```

## Test Production

Maintenant un employé assigné au magasin #2 devrait créer des DLC avec `groupId: 2` au lieu de `groupId: 1`.

## Déploiement

1. ✅ Logique groupId corrigée dans `DlcPage.tsx`
2. ✅ Debug logs ajoutés pour traçabilité
3. 🔄 **Redémarrer serveur production**
4. 🧪 **Tester création DLC avec employé magasin #2**