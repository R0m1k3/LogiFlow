# Ajout Colonne Écart - Module Rapprochement

## 🎯 Demande Utilisateur

Ajouter une colonne **"Écart"** dans le module rapprochement qui calcule la différence entre le montant BL et le montant Facture.

## ✅ Implementation

### 1. **Structure des Tableaux**

#### **Onglet Manuel**
```
| Fournisseur | N° BL | Date Livr. | Montant BL | Ref. Facture | Montant Fact. | **Écart** | Magasin | Actions |
```

#### **Onglet Automatique**  
```
| Fournisseur | N° BL | Date Livr. | Date Valid. | Montant BL | Ref. Facture | Montant Fact. | **Écart** | Magasin | Actions |
```

### 2. **Logique de Calcul**

```typescript
const blAmount = delivery.blAmount ? parseFloat(delivery.blAmount) : 0;
const invoiceAmount = delivery.invoiceAmount ? parseFloat(delivery.invoiceAmount) : 0;

if (blAmount && invoiceAmount) {
  const diff = blAmount - invoiceAmount;
  // BL > Facture = +XX.XX€ (positif)
  // BL < Facture = -XX.XX€ (négatif)
  // BL = Facture = 0.00€ (équilibré)
}
```

### 3. **Couleurs Indicatives**

```css
/* Aucun écart - Parfait */
diff === 0 → text-green-600

/* Écart faible (≤ 10€) - Attention */  
diffAbs ≤ 10 → text-orange-600

/* Écart important (> 10€) - Problème */
diffAbs > 10 → text-red-600
```

### 4. **Affichage par Cas**

#### **Cas Complet** (BL + Facture renseignés)
- `+15.50€` (BL supérieur de 15.50€)
- `-8.25€` (Facture supérieure de 8.25€)  
- `0.00€` (Montants identiques)

#### **Cas Incomplet** (données manquantes)
- `-` (grisé, données insuffisantes)

### 5. **Headers de Colonnes**

```typescript
// Manuel
<th>Écart</th>

// Automatique  
<th>Écart</th>
```

## 🎨 Rendu Visuel

### Exemples d'Affichage

| Montant BL | Montant Fact. | Écart | Couleur |
|------------|---------------|--------|---------|
| 150.00€ | 150.00€ | `0.00€` | 🟢 Vert |
| 155.50€ | 150.00€ | `+5.50€` | 🟠 Orange |
| 140.00€ | 165.75€ | `-25.75€` | 🔴 Rouge |
| 100.00€ | - | `-` | ⚪ Gris |

### États Visuels par Seuil

```css
/* Équilibré - Vert */
.text-green-600 { color: #16a34a; }

/* Écart modéré - Orange */  
.text-orange-600 { color: #ea580c; }

/* Écart important - Rouge */
.text-red-600 { color: #dc2626; }

/* Non applicable - Gris */
.text-gray-400 { color: #9ca3af; }
```

## 🔧 Code Implementation

### Header (Manuel)
```typescript
<th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
  Écart
</th>
```

### Cellule Data
```typescript
<td className="px-3 py-2 text-sm">
  {(() => {
    const blAmount = delivery.blAmount ? parseFloat(delivery.blAmount) : 0;
    const invoiceAmount = delivery.invoiceAmount ? parseFloat(delivery.invoiceAmount) : 0;
    if (blAmount && invoiceAmount) {
      const diff = blAmount - invoiceAmount;
      const diffAbs = Math.abs(diff);
      return (
        <div className={`font-medium ${
          diff === 0 ? 'text-green-600' : 
          diffAbs > 10 ? 'text-red-600' : 'text-orange-600'
        }`}>
          {diff > 0 ? '+' : ''}{diff.toFixed(2)}€
        </div>
      );
    }
    return <span className="text-gray-400 italic text-xs">-</span>;
  })()}
</td>
```

## 🧪 Tests de Validation

### Test 1 : Calcul d'Écart
1. BL: 100.00€, Facture: 95.00€
2. **Vérifier** : Écart = `+5.00€` (orange)

### Test 2 : Équilibre  
1. BL: 150.00€, Facture: 150.00€
2. **Vérifier** : Écart = `0.00€` (vert)

### Test 3 : Écart Important
1. BL: 200.00€, Facture: 185.00€  
2. **Vérifier** : Écart = `+15.00€` (rouge)

### Test 4 : Données Manquantes
1. BL: 100.00€, Facture: non renseigné
2. **Vérifier** : Écart = `-` (gris)

## 📊 Status

- ✅ Colonne Écart ajoutée sur onglet Manuel
- ✅ Colonne Écart ajoutée sur onglet Automatique  
- ✅ Calcul automatique (BL - Facture)
- ✅ Couleurs indicatives par seuil
- ✅ Gestion des cas de données manquantes
- ✅ Format d'affichage cohérent (+/-XX.XX€)

**La colonne Écart permet maintenant de visualiser instantanément les différences entre BL et factures !**