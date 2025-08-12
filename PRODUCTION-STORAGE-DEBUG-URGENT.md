# Debug Production Storage - GroupId Mystery

## Problème Production

Utilisateur assigné magasin #2 crée DLC/commandes → apparaît magasin #1

## Analyse Couche Storage

Il y a 2 implémentations storage :

### 1. MemStorage (Développement)
```javascript
async createDlcProduct(dlcProduct: any): Promise<any> { 
    const newProduct = { id, ...dlcProduct, createdAt, updatedAt };
    // Enregistre directement les données passées
}
```

### 2. Drizzle ORM (Production)  
```javascript
async createDlcProduct(dlcProductData: InsertDlcProductFrontend): Promise<DlcProductFrontend> {
    const { dlcDate, ...restData } = dlcProductData as any;
    const [dlcProduct] = await db.insert(dlcProducts).values({
        ...restData, // ⚠️ SI restData.groupId = 1, il sera enregistré tel quel
        expiryDate: dlcDate,
    });
}
```

## Hypothèses du Problème

1. **Frontend envoie groupId: 1** malgré les corrections
2. **Backend force finalGroupId: 2** mais quelque chose le rechange
3. **Storage reçoit groupId: 1** et l'enregistre tel quel
4. **Base de données a une contrainte/trigger** qui force groupId: 1

## Debug Ajouté

### 1. Logs Storage Drizzle (Production)
```javascript
console.log("🔍 STORAGE DEBUG - DLC insertData:", insertData);
console.log("🔍 STORAGE DEBUG - DLC insertData.groupId:", insertData.groupId, typeof insertData.groupId);
console.log("🔍 STORAGE DEBUG - DLC returned from DB:", dlcProduct);
console.log("🔍 STORAGE DEBUG - DLC returned groupId:", dlcProduct.groupId, typeof dlcProduct.groupId);
```

### 2. Même Logs pour Customer Orders

## Plan de Debug Production

1. ✅ **Logs routse backend** - Voir finalGroupId calculé
2. ✅ **Logs storage layer** - Voir données envoyées à DB  
3. ✅ **Logs retour DB** - Voir ce que la DB retourne
4. 🔄 **Déployer en production**
5. 🧪 **Tester création DLC/commande avec employé magasin #2**
6. 📋 **Analyser logs complets pour identifier où groupId change**

## Résultat Attendu

Les logs révéleront :
- Frontend calcule-t-il groupId: 2 ?
- Backend force-t-il finalGroupId: 2 ?  
- Storage reçoit-il groupId: 2 ?
- DB retourne-t-elle groupId: 1 ou 2 ?

**POINT DE RUPTURE IDENTIFIÉ = PROBLÈME RÉSOLU**