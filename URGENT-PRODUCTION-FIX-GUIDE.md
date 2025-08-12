# CORRECTION URGENTE PRODUCTION - Commandes et Livraisons

## Problème identifié
La colonne `email` manque dans la table `suppliers` en production, ce qui cause des erreurs 500 sur les API `/api/orders` et `/api/deliveries`.

## Erreurs constatées
```
Error fetching orders: error: column orders_supplier.email does not exist
Error fetching deliveries: error: column deliveries_supplier.email does not exist
```

## Solution immédiate

### 1. Exécuter le script SQL
Connectez-vous à votre base de données de production et exécutez :

```sql
-- Ajouter la colonne email manquante
ALTER TABLE suppliers ADD COLUMN email character varying(255);
```

### 2. Vérification
Après exécution, vérifiez que la colonne a été ajoutée :

```sql
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'suppliers' 
AND table_schema = 'public'
ORDER BY ordinal_position;
```

### 3. Redémarrer l'application
Une fois la colonne ajoutée, redémarrez votre application Node.js.

## Colonnes attendues vs réelles

### Actuellement en production (8 colonnes)
1. id
2. name  
3. contact
4. phone
5. has_dlc
6. created_at
7. updated_at  
8. automatic_reconciliation

### Attendu par le code Drizzle (9 colonnes)
1. id
2. name
3. contact  
4. phone
5. **email** ← MANQUANTE
6. address
7. has_dlc
8. automatic_reconciliation
9. created_at
10. updated_at

## Diagnostic complet
- 40 fournisseurs en base
- Relations Drizzle tentent d'accéder à supplier.email
- Colonne n'existe pas → erreur SQL → erreur 500

## Test après correction
Les pages Orders et Deliveries devraient fonctionner normalement une fois la colonne ajoutée.