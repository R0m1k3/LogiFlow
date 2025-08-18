# CORRECTION URGENTE - Erreurs 500 Modification Annonces Production

## Problème
Erreurs 500 lors de la modification des annonces en production dues à une jointure PostgreSQL incorrecte.

## Solution - Modifications à appliquer sur votre serveur

### 1. Fichier `server/routes.ts` - Ligne 44
**AVANT :**
```javascript
customerOrders, nocodbConfigs, dlcProducts, tasks, invoiceVerifications, dashboardMessages
```

**APRÈS :**
```javascript
customerOrders, nocodbConfig, dlcProducts, tasks, invoiceVerificationCache, dashboardMessages
```

### 2. Fichier `server/announcementStorage.ts` - Ligne 46
**AVANT :**
```javascript
.leftJoin(users, eq(dashboardMessages.createdBy, users.id))
```

**APRÈS :**
```javascript
.leftJoin(users, eq(dashboardMessages.createdBy, users.username))
```

### 3. Fichier `server/announcementStorage.ts` - Lignes 70-76
**REMPLACER la méthode updateAnnouncement par :**
```javascript
async updateAnnouncement(id: number, announcement: Partial<InsertAnnouncement>): Promise<DashboardMessage> {
  console.log('📝 [DB] Updating announcement with data:', announcement);
  
  const [updated] = await db
    .update(dashboardMessages)
    .set(announcement)
    .where(eq(dashboardMessages.id, id))
    .returning();
    
  console.log('📝 [DB] Updated announcement:', updated);
  
  if (!updated) {
    throw new Error(`Announcement with id ${id} not found`);
  }
  
  return updated;
}
```

## Cause du problème
La jointure PostgreSQL utilisait `users.id` au lieu de `users.username` pour la relation avec le champ `createdBy`, qui contient des usernames en production.

## Test après correction
Après application des modifications, redémarrez votre serveur et testez la modification d'une annonce.