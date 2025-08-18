# Mise à jour Production - Fonctionnalité Stock Épuisé DLC

## Nouveaux champs ajoutés au module DLC

Cette mise à jour ajoute la fonctionnalité de gestion du stock épuisé pour les produits DLC, permettant de distinguer les produits périmés des produits en rupture de stock.

### Changements de base de données

**Nouveaux champs dans la table `dlc_products` :**
- `stock_epuise` (boolean) - Indique si le produit est épuisé en stock
- `stock_epuise_by` (varchar) - Utilisateur qui a marqué le produit comme épuisé 
- `stock_epuise_at` (timestamp) - Date de marquage comme épuisé

### Scripts de migration

#### Pour une nouvelle installation
Les nouveaux champs sont inclus dans `init.sql` (lignes 188-190)

#### Pour une base de données existante
Exécuter le script : `migrations/add_stock_epuise_fields.sql`

```sql
ALTER TABLE dlc_products 
ADD COLUMN IF NOT EXISTS stock_epuise boolean DEFAULT false NOT NULL,
ADD COLUMN IF NOT EXISTS stock_epuise_by varchar(255),
ADD COLUMN IF NOT EXISTS stock_epuise_at timestamp;
```

### Nouvelles routes API

#### Route pour marquer un produit comme stock épuisé
- **Endpoint:** `PUT /api/dlc-products/:id/stock-epuise`
- **Permissions:** Accessible à tous les utilisateurs authentifiés
- **Fonction:** Marque un produit comme épuisé en stock (avec suivi utilisateur et date)

#### Route pour restaurer le stock d'un produit
- **Endpoint:** `PUT /api/dlc-products/:id/restore-stock`  
- **Permissions:** Réservé aux admin, directeur et manager
- **Fonction:** Remet le produit en stock disponible

### Interface utilisateur

#### Nouveaux boutons
- **Bouton "Stock épuisé"** (icône PackageX) : Visible sur tous les produits non épuisés et non validés
- **Bouton "Restaurer stock"** (icône RotateCcw) : Visible uniquement pour les utilisateurs privilégiés sur les produits épuisés

#### Styles visuels
- **Produits épuisés** : Fond jaune avec badge "Stock épuisé" (jaune)
- **Produits validés** : Fond gris avec badge "Validé" (gris)
- **Produits normaux** : Fond blanc

### Déploiement

1. **Mise à jour Docker :**
   ```bash
   docker-compose down
   docker-compose build
   docker-compose up -d
   ```

2. **Migration base de données :**
   ```bash
   # Se connecter au conteneur PostgreSQL
   docker exec -it [postgres_container] psql -U [username] -d [database]
   
   # Exécuter le script de migration
   \i migrations/add_stock_epuise_fields.sql
   ```

3. **Vérification :**
   - Tester les nouveaux boutons dans l'interface DLC
   - Vérifier les permissions (admin/directeur/manager pour restauration)
   - Contrôler l'affichage des badges et couleurs

### Notes importantes

- Les nouveaux champs ont des valeurs par défaut pour éviter les erreurs sur les données existantes
- La fonctionnalité est rétrocompatible avec les produits DLC existants
- Les permissions suivent la logique existante du système
- Aucun impact sur les fonctionnalités existantes de validation DLC

### Support

En cas de problème :
1. Vérifier que la migration a été appliquée : `\d dlc_products`
2. Contrôler les logs de l'application pour les erreurs API
3. Vérifier les permissions utilisateur dans l'interface admin

---
**Date de création :** $(date)
**Version :** 1.0.0
**Auteur :** Système de gestion DLC