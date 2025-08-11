#!/usr/bin/env node

/**
 * Script de déploiement pour la synchronisation automatique ordre-livraison
 * À exécuter sur le serveur de production pour appliquer les modifications
 */

import fs from 'fs/promises';
import path from 'path';

console.log('🚀 Déploiement de la synchronisation automatique...');

const PRODUCTION_ROUTES_PATH = '/path/to/production/server/routes.ts'; // À adapter selon votre structure

// Modifications à appliquer au fichier routes.ts en production
const autoSyncModifications = {
  // 1. Modification de la route PUT /api/deliveries/:id pour ajouter la sync auto
  updateDeliveryRoute: {
    search: `      const data = insertDeliverySchema.partial().parse(req.body);
      const updatedDelivery = await storage.updateDelivery(id, data);
      res.json(updatedDelivery);`,
    replace: `      const data = insertDeliverySchema.partial().parse(req.body);
      const updatedDelivery = await storage.updateDelivery(id, data);
      
      // SYNCHRONISATION AUTOMATIQUE : Si livraison devient "delivered", marquer la commande associée comme "delivered"
      if (data.status === 'delivered' && updatedDelivery.orderId) {
        try {
          console.log(\`🔄 Auto-sync: Delivery #\${id} marked as delivered, updating order #\${updatedDelivery.orderId}\`);
          await storage.updateOrder(updatedDelivery.orderId, { status: 'delivered' });
          console.log(\`✅ Auto-sync: Order #\${updatedDelivery.orderId} automatically marked as delivered\`);
        } catch (error) {
          console.error(\`❌ Auto-sync failed for order #\${updatedDelivery.orderId}:\`, error);
        }
      }
      
      res.json(updatedDelivery);`
  },
  
  // 2. Modification de la route POST /api/deliveries/:id/validate pour ajouter la sync auto
  validateDeliveryRoute: {
    search: `      await storage.validateDelivery(id, blData);
      res.json({ message: "Delivery validated successfully" });`,
    replace: `      await storage.validateDelivery(id, blData);
      
      // SYNCHRONISATION AUTOMATIQUE : Quand validation, marquer la commande associée comme "delivered"
      if (delivery.orderId) {
        try {
          console.log(\`🔄 Auto-sync: Delivery #\${id} validated, updating order #\${delivery.orderId} to delivered\`);
          await storage.updateOrder(delivery.orderId, { status: 'delivered' });
          console.log(\`✅ Auto-sync: Order #\${delivery.orderId} automatically marked as delivered\`);
        } catch (error) {
          console.error(\`❌ Auto-sync failed for order #\${delivery.orderId}:\`, error);
        }
      }
      
      res.json({ message: "Delivery validated successfully" });`
  }
};

// Instructions de déploiement
console.log(`
📋 INSTRUCTIONS DE DÉPLOIEMENT PRODUCTION :

1. 🔍 Localisez le fichier server/routes.ts sur votre serveur de production

2. 🔧 Ajoutez la synchronisation automatique dans la route PUT /api/deliveries/:id :
   
   Remplacez :
   ${autoSyncModifications.updateDeliveryRoute.search}
   
   Par :
   ${autoSyncModifications.updateDeliveryRoute.replace}

3. 🔧 Ajoutez la synchronisation automatique dans la route POST /api/deliveries/:id/validate :
   
   Remplacez :
   ${autoSyncModifications.validateDeliveryRoute.search}
   
   Par :
   ${autoSyncModifications.validateDeliveryRoute.replace}

4. 🔄 Redémarrez votre serveur Node.js en production

5. ✅ Testez en validant une livraison - la commande associée devrait automatiquement passer en "delivered"

6. 🎯 Pour corriger CMD-55 spécifiquement, utilisez le bouton "Sync Status" dans le calendrier

RÉSULTAT ATTENDU :
- Toutes les futures validations de livraisons synchroniseront automatiquement les commandes
- CMD-55 sera corrigée lors de la prochaine utilisation du bouton "Sync Status"
- Le calendrier affichera correctement les commandes livrées en gris
`);

// Créer aussi un patch file pour faciliter l'application
const patchContent = `
--- a/server/routes.ts
+++ b/server/routes.ts
@@ -691,6 +691,15 @@
       const data = insertDeliverySchema.partial().parse(req.body);
       const updatedDelivery = await storage.updateDelivery(id, data);
+      
+      // SYNCHRONISATION AUTOMATIQUE : Si livraison devient "delivered", marquer la commande associée comme "delivered"
+      if (data.status === 'delivered' && updatedDelivery.orderId) {
+        try {
+          console.log(\`🔄 Auto-sync: Delivery #\${id} marked as delivered, updating order #\${updatedDelivery.orderId}\`);
+          await storage.updateOrder(updatedDelivery.orderId, { status: 'delivered' });
+          console.log(\`✅ Auto-sync: Order #\${updatedDelivery.orderId} automatically marked as delivered\`);
+        } catch (error) {
+          console.error(\`❌ Auto-sync failed for order #\${updatedDelivery.orderId}:\`, error);
+        }
+      }
       res.json(updatedDelivery);
     } catch (error) {
@@ -830,6 +839,15 @@
       }
       
       await storage.validateDelivery(id, blData);
+      
+      // SYNCHRONISATION AUTOMATIQUE : Quand validation, marquer la commande associée comme "delivered"
+      if (delivery.orderId) {
+        try {
+          console.log(\`🔄 Auto-sync: Delivery #\${id} validated, updating order #\${delivery.orderId} to delivered\`);
+          await storage.updateOrder(delivery.orderId, { status: 'delivered' });
+          console.log(\`✅ Auto-sync: Order #\${delivery.orderId} automatically marked as delivered\`);
+        } catch (error) {
+          console.error(\`❌ Auto-sync failed for order #\${delivery.orderId}:\`, error);
+        }
+      }
       res.json({ message: "Delivery validated successfully" });
     } catch (error) {
`;

console.log('💾 Sauvegarde du patch dans auto-sync.patch...');
await fs.writeFile('auto-sync.patch', patchContent);

console.log(`
🔧 Alternative : Vous pouvez aussi appliquer le patch automatiquement avec :
   cd /path/to/production && patch -p1 < auto-sync.patch

✅ Script de déploiement créé avec succès !
`);