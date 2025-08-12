# Fix Validation Errors - Commandes Client Production

## Problème Identifié

**Erreurs de validation dans le formulaire de commande client :**
1. `"Expected number, received string"` pour le champ **Fournisseur** (`supplierId`)
2. `"Expected number, received string"` pour le champ **Acompte** (`deposit`)

## Cause du Problème

Le formulaire frontend envoie des valeurs string, mais le schema Zod attend des numbers :

```javascript
// AVANT (Problématique)
supplierId: z.number().int().positive().optional().default(1)
deposit: z.number().optional().default(0)

// APRÈS (Corrigé)
supplierId: z.coerce.number().int().positive().optional().default(1)
deposit: z.coerce.number().optional().default(0)
```

## Solution Appliquée

**Fichier modifié :** `shared/schema.ts`

✅ Ajouté `z.coerce.number()` pour forcer la conversion automatique string → number
✅ Appliqué aussi pour `quantity` et `groupId` par précaution
✅ Corrigé `customerEmail` pour accepter chaîne vide avec `.or(z.literal(""))`

## Schema Corrigé

```javascript
export const insertCustomerOrderFrontendSchema = z.object({
  customerName: z.string().min(1, "Customer name is required"),
  contactNumber: z.string().min(1, "Contact number is required"),
  productName: z.string().min(1, "Product name is required"),
  productDescription: z.string().optional(),
  quantity: z.coerce.number().int().positive().default(1), // ✅ CORRIGÉ
  groupId: z.coerce.number().int().positive(), // ✅ CORRIGÉ
  isPickup: z.boolean().default(false),
  notes: z.string().optional(),
  orderTaker: z.string().optional(),
  gencode: z.string().optional().default(""),
  supplierId: z.coerce.number().int().positive().optional().default(1), // ✅ CORRIGÉ
  deposit: z.coerce.number().optional().default(0), // ✅ CORRIGÉ
  isPromotionalPrice: z.boolean().default(false),
  customerEmail: z.string().email().optional().or(z.literal("")), // ✅ CORRIGÉ
  productReference: z.string().optional(),
});
```

## Test

Après cette correction, les employés devraient pouvoir créer des commandes client sans erreur de validation en production.

## Déploiement

1. ✅ Schema corrigé dans `shared/schema.ts`
2. 🔄 **Redémarrer le serveur production**
3. 🧪 **Tester création commande client avec employé**