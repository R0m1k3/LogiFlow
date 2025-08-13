# Guide Complet - Configuration NocoDB Production

## ❌ PROBLÈME IDENTIFIÉ

Votre serveur de production n'a **aucune configuration NocoDB** dans la base de données. C'est pourquoi vous ne voyez rien.

## ✅ SOLUTION : Configuration Complète

### Étape 1 : Ajout Configuration NocoDB

Connectez-vous à votre base PostgreSQL de production et exécutez :

```sql
-- 1. Vérifier si la table existe
\d nocodb_config

-- 2. Insérer votre configuration NocoDB
INSERT INTO nocodb_config (
  name, 
  base_url, 
  project_id, 
  api_token, 
  description, 
  is_active
) VALUES (
  'Production Principal', 
  'https://app.nocodb.com',  -- ou votre URL NocoDB
  'VOTRE_PROJECT_ID',        -- À remplacer
  'VOTRE_API_TOKEN',         -- À remplacer  
  'Configuration principale pour vérification automatique factures',
  true
);

-- 3. Vérifier l'insertion
SELECT * FROM nocodb_config;
```

### Étape 2 : Configuration des Magasins

```sql
-- Lister vos magasins existants
SELECT id, name FROM groups;

-- Configurer chaque magasin (exemple pour ID 1)
UPDATE groups SET 
  nocodb_config_id = 1,  -- ID de la config créée
  nocodb_table_name = 'VOTRE_TABLE_FACTURES',  -- Nom réel de votre table NocoDB
  invoice_column_name = 'reference_facture',    -- Colonne référence
  nocodb_bl_column_name = 'numero_bl',          -- Colonne BL
  nocodb_amount_column_name = 'montant',        -- Colonne montant
  nocodb_supplier_column_name = 'fournisseur'   -- Colonne fournisseur
WHERE id = 1;  -- Remplacer par l'ID réel

-- Répéter pour chaque magasin avec ses propres paramètres
```

### Étape 3 : Obtenir les Informations NocoDB

1. **Project ID** : Dans NocoDB, aller dans Project Settings
2. **API Token** : Account Settings > Tokens > Create new token
3. **Table Names** : Noter les noms exacts de vos tables
4. **Column Names** : Noter les noms exacts de vos colonnes

### Étape 4 : Test de Configuration

Une fois configuré, redémarrez votre serveur et vous devriez voir :
- Boutons loupe et coche dans le rapprochement
- Logs de débogage dans la console serveur
- Notifications de succès/erreur

### Étape 5 : Vérification

```sql
-- Voir toutes les configurations
SELECT 
  g.id,
  g.name as magasin,
  g.nocodb_config_id,
  g.nocodb_table_name,
  g.invoice_column_name,
  nc.base_url,
  nc.is_active
FROM groups g
LEFT JOIN nocodb_config nc ON g.nocodb_config_id = nc.id;
```

## 🔧 Structure Attendue de vos Tables NocoDB

Chaque table de factures doit contenir au minimum :
- **Référence Facture** (ex: FAC-2024-001)
- **Numéro BL** (ex: BL123456)
- **Montant** (ex: 150.75)
- **Fournisseur** (ex: "Fournisseur ABC")

## 🚨 Points Critiques

1. **API Token** : Doit avoir accès lecture à vos tables
2. **Noms Exacts** : Table/colonne names doivent être exacts (sensible à la casse)
3. **Données Test** : Ayez quelques factures test dans NocoDB
4. **Connexion** : Vérifiez que votre serveur peut accéder à NocoDB

## 📞 Support

Si ça ne marche toujours pas après configuration :
1. Vérifiez les logs serveur Node.js
2. Testez l'API NocoDB manuellement avec curl
3. Confirmez que les noms de colonnes sont corrects