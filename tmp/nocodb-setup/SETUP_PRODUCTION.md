# Configuration NocoDB pour Production

## 1. Configuration de la base de données

Votre table `nocodb_config` existe déjà. Vous devez y ajouter une configuration :

```sql
-- Insertion d'une configuration NocoDB de base
INSERT INTO nocodb_config (
  name, 
  base_url, 
  project_id, 
  api_token, 
  description, 
  is_active,
  created_by,
  created_at,
  updated_at
) VALUES (
  'Configuration Principale', 
  'https://votre-nocodb.domain.com', 
  'votre-project-id', 
  'votre-api-token-personnel', 
  'Configuration principale pour vérification factures',
  true,
  'admin',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);
```

## 2. Configuration des groupes (magasins)

Mettez à jour vos magasins avec les configurations NocoDB :

```sql
-- Exemple pour Magasin A
UPDATE groups SET 
  nocodb_config_id = 1,  -- ID de la config NocoDB créée ci-dessus
  nocodb_table_name = 'nom_table_factures_magasin_a',  -- Nom de votre table NocoDB
  invoice_column_name = 'reference_facture',  -- Colonne référence facture
  nocodb_bl_column_name = 'numero_bl',  -- Colonne numéro BL  
  nocodb_amount_column_name = 'montant',  -- Colonne montant
  nocodb_supplier_column_name = 'fournisseur'  -- Colonne fournisseur
WHERE id = 1;  -- Remplacer par l'ID de votre magasin

-- Répéter pour chaque magasin avec ses propres noms de table/colonnes
```

## 3. API Token NocoDB

Pour obtenir votre API Token :
1. Allez dans NocoDB > Account Settings > Tokens
2. Créez un nouveau Personal API Token
3. Copiez le token dans la configuration ci-dessus

## 4. Structure de votre table NocoDB

Assurez-vous que vos tables NocoDB contiennent ces colonnes :
- Référence facture (ex: `reference_facture`)
- Numéro BL (ex: `numero_bl`) 
- Montant (ex: `montant`)
- Fournisseur (ex: `fournisseur`)

## 5. Test de la configuration

Une fois configuré, le système :
- ✅ Affichera des boutons de vérification dans le rapprochement BL/Factures
- ✅ Vérifiera automatiquement les références factures existantes
- ✅ Auto-remplira les champs manquants en recherchant par BL
- ✅ Affichera des coches vertes pour les factures vérifiées

## 6. Débogage

Les logs de production afficheront :
```
🔍 Vérification facture: {groupId: 1, invoiceReference: "FAC123", supplierName: "Fournisseur A"}
🌐 Requête NocoDB: https://votre-nocodb.domain.com/api/v1/db/data/project-id/table-name?where=...
✅ Réponse NocoDB: {count: 1}
```