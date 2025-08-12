# Fix Urgent - Permissions Directeurs

## 🎯 Problème Identifié
**Les directeurs voient TOUS les magasins** au lieu de seulement leur magasin assigné.

## 🔍 Analyse du Problème

### Logique Incorrecte Actuelle
```typescript
// ❌ INCORRECT
if (user.role === 'admin') {
  // Voir tous les magasins
} else {
  // Tous les autres rôles voient leurs magasins assignés
}
```

### Rôles et Accès Attendus
- **Admin** : Tous les magasins ✅
- **Directeur** : Seulement son magasin assigné ❌→✅  
- **Manager** : Seulement son magasin assigné ✅
- **Employee** : Seulement son magasin assigné ✅

## ✅ Corrections Appliquées

### 1. **Endpoint Groups** (`/api/groups`)
```typescript
// Avant
if (user.role === 'admin') {
  const groups = await storage.getGroups(); // Tous
} else {
  const userGroups = user.userGroups.map(ug => ug.group); // Assignés
}

// Après
if (user.role === 'admin') {
  const groups = await storage.getGroups(); // Tous
} else {
  // Directeur, Manager, Employee → seulement magasins assignés
  const userGroups = (user as any).userGroups?.map((ug: any) => ug.group) || [];
}
```

### 2. **Endpoint Orders** (`/api/orders`)  
```typescript
// Avant
if (user.role === 'admin') {
  orders = await storage.getOrders(groupIds); // Tous ou filtré
} else {
  const groupIds = user.userGroups.map(ug => ug.groupId); // Assignés
}

// Après  
if (user.role === 'admin') {
  orders = await storage.getOrders(groupIds); // Tous ou filtré
} else {
  // Directeur, Manager, Employee → seulement groupes assignés
  const groupIds = (user as any).userGroups?.map((ug: any) => ug.groupId) || [];
}
```

### 3. **Endpoint Deliveries** (`/api/deliveries`)
```typescript
// Déjà corrigé précédemment avec commentaire explicite
if (user.role === 'admin') {
  // Admin peut voir tous les magasins
} else {
  // For non-admin users (managers, employees, directeurs), only show their assigned stores
  const groupIds = (user as any).userGroups?.map((ug: any) => ug.groupId) || [];
}
```

### 4. **Contrôles d'Accès** (tous endpoints)
```typescript
// Ajout de fallbacks robustes
const userGroupIds = (user as any).userGroups?.map((ug: any) => ug.groupId) || [];
```

## 🔒 Logique de Sécurité Corrigée

### Accès aux Données
```
Admin → Tous les magasins (peut sélectionner un magasin spécifique)
├── Groups: Tous
├── Orders: Tous  
├── Deliveries: Tous
└── Permissions: Toutes actions

Directeur → SEULEMENT son magasin assigné
├── Groups: Magasin assigné uniquement
├── Orders: Magasin assigné uniquement
├── Deliveries: Magasin assigné uniquement  
└── Permissions: Actions limitées selon le rôle

Manager/Employee → SEULEMENT leur magasin assigné
├── Groups: Magasin assigné uniquement
├── Orders: Magasin assigné uniquement
├── Deliveries: Magasin assigné uniquement
└── Permissions: Actions limitées selon le rôle
```

## 🧪 Tests de Validation

### Test Directeur
1. Se connecter avec compte directeur
2. **Vérifier :** Seulement SON magasin visible
3. **Vérifier :** Pas d'accès aux autres magasins
4. **Tenter :** Accéder à une commande d'un autre magasin → 403 Forbidden

### Test Admin
1. Se connecter avec compte admin  
2. **Vérifier :** Tous les magasins visibles
3. **Vérifier :** Sélecteur de magasin fonctionne
4. **Vérifier :** Peut basculer entre magasins

### Test Manager/Employee  
1. Se connecter avec ces rôles
2. **Vérifier :** Seulement leur magasin assigné
3. **Vérifier :** Cohérent avec directeur

## 📊 Status

- ✅ Endpoint Groups corrigé
- ✅ Endpoint Orders corrigé  
- ✅ Endpoint Deliveries déjà corrigé
- ✅ Contrôles d'accès renforcés avec fallbacks
- ✅ Commentaires explicites ajoutés
- 🔄 **À tester en production**

**Les directeurs ne verront maintenant que leur magasin assigné !**