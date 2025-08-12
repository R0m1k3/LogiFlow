# CORRECTIONS FINALES POUR SERVEUR DE PRODUCTION
# Erreurs 403 Employés - Version Corrigée

## ⚠️ CLARIFICATION IMPORTANTE
**Les employés ne doivent PAS créer de tâches, seulement les voir**

## CORRECTIONS À APPLIQUER SUR VOTRE SERVEUR PRIVÉ

### 1️⃣ FICHIER: client/src/pages/Tasks.tsx
**Correction erreur 403 /api/users**

#### A) Ligne 84-85 (requête des utilisateurs):
```typescript
// REMPLACER:
enabled: !!user,

// PAR:
enabled: !!user && (user.role === 'admin' || user.role === 'manager' || user.role === 'directeur'),
```

### 2️⃣ FICHIER: server/routes.ts
**Les permissions dans shared/permissions.ts restent inchangées**

#### A) Route GET /api/suppliers (environ ligne 188-194):
```typescript
// REMPLACER:
if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
  return res.status(403).json({ message: "Insufficient permissions" });
}

// PAR:
if (!user || (user.role !== 'admin' && user.role !== 'manager' && user.role !== 'directeur' && user.role !== 'employee')) {
  return res.status(403).json({ message: "Insufficient permissions" });
}
```

#### B) Route POST /api/suppliers (environ ligne 240-242):
```typescript
// REMPLACER:
if (user.role !== 'admin' && user.role !== 'manager') {
  console.error('❌ Insufficient permissions:', { userRole: user.role, required: ['admin', 'manager'] });
  return res.status(403).json({ message: "Insufficient permissions" });
}

// PAR:
if (user.role !== 'admin' && user.role !== 'manager' && user.role !== 'directeur') {
  console.error('❌ Insufficient permissions:', { userRole: user.role, required: ['admin', 'manager', 'directeur'] });
  return res.status(403).json({ message: "Insufficient permissions" });
}
```

#### C) Route PUT /api/suppliers/:id (environ ligne 281-283):
```typescript
// REMPLACER:
if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
  return res.status(403).json({ message: "Insufficient permissions" });
}

// PAR:
if (!user || (user.role !== 'admin' && user.role !== 'manager' && user.role !== 'directeur')) {
  return res.status(403).json({ message: "Insufficient permissions" });
}
```

#### D) Route DELETE /api/suppliers/:id (environ ligne 298-300):
```typescript
// REMPLACER:
if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
  return res.status(403).json({ message: "Insufficient permissions" });
}

// PAR:
if (!user || (user.role !== 'admin' && user.role !== 'directeur')) {
  return res.status(403).json({ message: "Insufficient permissions" });
}
```

#### E) Route POST /api/dlc-products/:id/validate (environ ligne 2332-2334):
```typescript
// REMPLACER:
if (!user || !['admin', 'manager'].includes(user.role)) {
  return res.status(403).json({ message: "Insufficient permissions to validate products" });
}

// PAR:
if (!user || !['admin', 'manager', 'directeur'].includes(user.role)) {
  return res.status(403).json({ message: "Insufficient permissions to validate products" });
}
```

## 📋 ÉTAPES D'APPLICATION SIMPLIFIÉES

1. **Sauvegarde** (sur votre serveur de production):
```bash
cp server/routes.ts server/routes.ts.backup
```

2. **Modification**: Ouvrez `server/routes.ts` et effectuez les 5 corrections ci-dessus

3. **Redémarrage**: Redémarrez votre serveur Node.js

4. **Test**: Testez avec un compte employé

## ✅ RÉSULTAT ATTENDU

- ✅ Employés peuvent voir les fournisseurs (modules Commandes Client et DLC)
- ✅ Employés peuvent voir la page tâches et les tâches existantes
- ❌ Employés ne peuvent PAS créer de tâches (comportement inchangé)
- ✅ Directeurs peuvent valider les produits DLC
- ✅ Plus d'erreurs 403 sur les actions autorisées

## 🔍 PERMISSIONS FINALES PAR RÔLE

### Employés:
- **Fournisseurs**: Lecture seulement
- **Tâches**: Lecture seulement (voir page et tâches)
- **Commandes Client**: Voir + Créer
- **DLC**: Voir + Créer

### Problème Résolu:
Les erreurs 403 venaient principalement des restrictions d'accès aux **fournisseurs**, pas des tâches. Les employés ont besoin de voir les fournisseurs pour créer des commandes client et des produits DLC.

## 🧪 COMMANDE DE TEST POST-CORRECTION

```bash
# Test accès fournisseurs pour employé (doit fonctionner):
curl -X GET "https://votre-serveur.com/api/suppliers" \
  -H "Cookie: session=TOKEN_SESSION_EMPLOYE"

# Résultat attendu: HTTP 200 avec liste des fournisseurs
```

**Note**: Les permissions des tâches restent inchangées - les employés peuvent seulement voir les tâches, pas les créer.