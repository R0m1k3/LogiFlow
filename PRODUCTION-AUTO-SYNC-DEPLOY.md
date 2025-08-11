# Déploiement de la Synchronisation Automatique - Production

## Résumé des Modifications

Le système de synchronisation automatique permet aux commandes de passer automatiquement en statut "delivered" quand leurs livraisons sont validées ou mises à jour vers "delivered".

## Fichiers à Modifier en Production

### 1. server/routes.ts

#### Modification 1 : Route PUT `/api/deliveries/:id`
**Localiser la section (vers ligne 691-693) :**
```typescript
const data = insertDeliverySchema.partial().parse(req.body);
const updatedDelivery = await storage.updateDelivery(id, data);
res.json(updatedDelivery);
```

**Remplacer par :**
```typescript
const data = insertDeliverySchema.partial().parse(req.body);
const updatedDelivery = await storage.updateDelivery(id, data);

// SYNCHRONISATION AUTOMATIQUE : Si livraison devient "delivered", marquer la commande associée comme "delivered"
if (data.status === 'delivered' && updatedDelivery.orderId) {
  try {
    console.log(`🔄 Auto-sync: Delivery #${id} marked as delivered, updating order #${updatedDelivery.orderId}`);
    await storage.updateOrder(updatedDelivery.orderId, { status: 'delivered' });
    console.log(`✅ Auto-sync: Order #${updatedDelivery.orderId} automatically marked as delivered`);
  } catch (error) {
    console.error(`❌ Auto-sync failed for order #${updatedDelivery.orderId}:`, error);
  }
}

res.json(updatedDelivery);
```

#### Modification 2 : Route POST `/api/deliveries/:id/validate`
**Localiser la section (vers ligne 830-831) :**
```typescript
await storage.validateDelivery(id, blData);
res.json({ message: "Delivery validated successfully" });
```

**Remplacer par :**
```typescript
await storage.validateDelivery(id, blData);

// SYNCHRONISATION AUTOMATIQUE : Quand validation, marquer la commande associée comme "delivered"
if (delivery.orderId) {
  try {
    console.log(`🔄 Auto-sync: Delivery #${id} validated, updating order #${delivery.orderId} to delivered`);
    await storage.updateOrder(delivery.orderId, { status: 'delivered' });
    console.log(`✅ Auto-sync: Order #${delivery.orderId} automatically marked as delivered`);
  } catch (error) {
    console.error(`❌ Auto-sync failed for order #${delivery.orderId}:`, error);
  }
}

res.json({ message: "Delivery validated successfully" });
```

## Étapes de Déploiement

### 1. Sauvegarde
```bash
cp server/routes.ts server/routes.ts.backup
```

### 2. Application des Modifications
Éditez le fichier `server/routes.ts` et appliquez les deux modifications ci-dessus.

### 3. Redémarrage du Serveur
```bash
# Méthode selon votre setup de production
pm2 restart your-app-name
# ou
systemctl restart your-node-service
# ou
docker-compose restart
```

### 4. Vérification des Logs
Surveillez les logs pour voir les messages de synchronisation automatique :
```bash
tail -f /path/to/your/logs
```

## Test de Fonctionnement

1. **Test Automatique** : Validez une livraison via l'interface - la commande associée devrait automatiquement passer en "delivered"

2. **Correction des Anciennes Commandes** : Utilisez le bouton "Sync Status" dans le calendrier pour corriger CMD-55 et autres commandes similaires

## Logs Attendus

Quand une livraison est validée, vous devriez voir :
```
🔄 Auto-sync: Delivery #123 validated, updating order #55 to delivered
✅ Auto-sync: Order #55 automatically marked as delivered
```

## Résolution de CMD-55

Une fois la synchronisation automatique déployée :
1. Cliquez sur "Sync Status" dans le calendrier
2. CMD-55 sera automatiquement corrigée car sa livraison est déjà validée
3. Elle apparaîtra en gris dans le calendrier

## Rollback en Cas de Problème

```bash
cp server/routes.ts.backup server/routes.ts
# Redémarrer le serveur
```

---

**Note** : La synchronisation automatique ne s'applique qu'aux nouvelles actions. Pour corriger les commandes existantes comme CMD-55, utilisez le bouton "Sync Status".