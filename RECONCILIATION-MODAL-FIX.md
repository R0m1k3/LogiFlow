# Fix Rapprochement - Restrictions Édition

## 🎯 Demandes Utilisateur

1. **Les rapprochements validés ne peuvent plus être édités**
2. **Ajouter bouton supprimer pour les admins** (onglet automatique)

## ✅ Corrections Appliquées

### 1. **Onglet Manuel** - Édition Restreinte
```typescript
// Avant : Bouton modifier toujours disponible
<button onClick={() => handleOpenModal(delivery)}>
  <Settings className="w-4 h-4" />
</button>

// Après : Modifier seulement si non validé
{!delivery.reconciled && (
  <button onClick={() => handleOpenModal(delivery)}>
    <Settings className="w-4 h-4" />
  </button>
)}
```

### 2. **Onglet Automatique** - Boutons Admin
```typescript
// Avant : Seulement modifier + dévalider
<div className="flex items-center space-x-2">
  <button onClick={() => handleOpenModal(delivery)}>Modifier</button>
  {admin && <button>Dévalider</button>}
</div>

// Après : Supprimer + édition restreinte
<div className="flex items-center space-x-2">
  {admin && delivery.reconciled && <button>Dévalider</button>}
  {admin && <button>Supprimer</button>}
  {!delivery.reconciled && <button>Modifier</button>}
</div>
```

## 🔒 Logique des Boutons par État

### **Rapprochement Non Validé** (`delivery.reconciled = false`)
- ✅ **Modifier** : Disponible pour tous les rôles autorisés
- ✅ **Valider** : Disponible selon permissions
- ✅ **Supprimer** : Admin uniquement

### **Rapprochement Validé** (`delivery.reconciled = true`)
- ❌ **Modifier** : BLOQUÉ (plus d'édition possible)
- ✅ **Dévalider** : Admin uniquement
- ✅ **Supprimer** : Admin uniquement

## 🎨 Interface Utilisateur

### États Visuels
```css
/* Non validé */
bg-white (normal) ou bg-red-50 (problème)

/* Validé */
bg-gray-100 opacity-60 text-gray-500 (grisé)
```

### Boutons par Onglet

#### **Manuel**
- Non validé : `[Valider] [Supprimer] [Modifier]`
- Validé : `[Dévalider] [Supprimer]` (admin) ou `[]` (autres)

#### **Automatique**  
- Non validé : `[Modifier]`
- Validé : `[Dévalider] [Supprimer]` (admin) ou `[]` (autres)

## 🔧 Imports Requis

```typescript
import { Trash2, Ban, Settings, Check } from 'lucide-react';
```

## 🧪 Tests de Validation

### Test 1 : Édition Restreinte
1. Créer une livraison
2. **Vérifier** : Bouton modifier visible
3. Valider le rapprochement
4. **Vérifier** : Bouton modifier DISPARU
5. **Vérifier** : Ligne grisée

### Test 2 : Boutons Admin (Automatique)
1. Se connecter comme admin
2. Aller sur onglet "Automatique"
3. **Vérifier** : Bouton supprimer visible
4. **Vérifier** : Dévalider visible si validé
5. **Vérifier** : Modifier visible si non validé

### Test 3 : Permissions Non-Admin
1. Se connecter comme manager/directeur
2. **Vérifier** : Pas de bouton supprimer
3. **Vérifier** : Pas de bouton dévalider
4. **Vérifier** : Modifier visible si non validé

## 📊 Status

- ✅ Édition bloquée pour rapprochements validés
- ✅ Bouton supprimer ajouté pour admins (automatique)
- ✅ Logique cohérente entre onglets manuel/automatique
- ✅ Permissions respectées selon le rôle
- ✅ Interface claire avec grisage des validés

**Les rapprochements validés sont maintenant protégés contre l'édition !**