# CORRECTION FINALE - Erreur 500 Annonces Production

## Problème identifié
```
TypeError: announcementStorage.getAnnouncement is not a function
```

La méthode `getAnnouncement` (singulier) manque dans `server/announcementStorage.ts`.

## Solution complète à appliquer

### 1. Fichier `server/announcementStorage.ts`

**AJOUTEZ cette méthode dans la classe `AnnouncementDatabaseStorage` (après la méthode `getAnnouncements`) :**

```javascript
async getAnnouncement(id: number): Promise<AnnouncementWithRelations | null> {
  console.log('🔍 [DB] Getting single announcement:', id);
  
  const result = await db
    .select({
      id: dashboardMessages.id,
      title: dashboardMessages.title,
      content: dashboardMessages.content,
      type: dashboardMessages.type,
      storeId: dashboardMessages.storeId,
      createdBy: dashboardMessages.createdBy,
      createdAt: dashboardMessages.createdAt,
      author: {
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        username: users.username,
      },
      group: {
        id: groups.id,
        name: groups.name,
      },
    })
    .from(dashboardMessages)
    .leftJoin(users, eq(dashboardMessages.createdBy, users.username))
    .leftJoin(groups, eq(dashboardMessages.storeId, groups.id))
    .where(eq(dashboardMessages.id, id))
    .limit(1);

  if (result.length === 0) {
    console.log('❌ [DB] Announcement not found:', id);
    return null;
  }

  const announcement = result[0];
  console.log('✅ [DB] Found announcement:', announcement.id, announcement.title);

  return {
    id: announcement.id,
    title: announcement.title,
    content: announcement.content,
    type: announcement.type,
    storeId: announcement.storeId,
    createdBy: announcement.createdBy,
    createdAt: announcement.createdAt,
    author: announcement.author as User,
    group: announcement.group as Group | undefined,
  };
}
```

**MODIFIEZ l'interface `IAnnouncementStorage` (vers le haut du fichier) :**

```javascript
interface IAnnouncementStorage {
  getAnnouncements(groupIds?: number[]): Promise<AnnouncementWithRelations[]>;
  getAnnouncement(id: number): Promise<AnnouncementWithRelations | null>;  // ← AJOUTEZ CETTE LIGNE
  createAnnouncement(announcement: InsertAnnouncement): Promise<DashboardMessage>;
  updateAnnouncement(id: number, announcement: Partial<InsertAnnouncement>): Promise<DashboardMessage>;
  deleteAnnouncement(id: number): Promise<void>;
}
```

**AJOUTEZ aussi cette méthode dans la classe `AnnouncementMemoryStorage` (après `initializeTestData`) :**

```javascript
async getAnnouncement(id: number): Promise<AnnouncementWithRelations | null> {
  const announcement = this.announcements.get(id);
  if (!announcement) {
    return null;
  }

  // Ajouter les relations
  const users = await this.usersGetter();
  const groups = await this.groupsGetter();

  const author = users.find(u => u.id === announcement.createdBy || u.username === announcement.createdBy);
  const group = announcement.storeId ? groups.find(g => g.id === announcement.storeId) : undefined;

  return {
    ...announcement,
    author: author || { id: announcement.createdBy, firstName: 'Utilisateur', lastName: 'Inconnu', username: announcement.createdBy } as User,
    group,
  };
}
```

### 2. VÉRIFICATIONS après correction

1. **Redémarrez votre serveur**
2. **Testez la modification d'une annonce**
3. **Vérifiez les logs**, vous devriez voir :
   ```
   🔍 [DB] Getting single announcement: 16
   ✅ [DB] Found announcement: 16 Titre...
   🔍 [DB] Updating announcement with data: {...}
   ✅ [DB] Updated announcement: {...}
   ```

## Causes des erreurs précédentes

1. ❌ **Méthode `getAnnouncement` manquante** → Interface incomplète
2. ❌ **Jointure incorrecte** → `users.id` au lieu de `users.username` 
3. ❌ **Imports incorrects** → `nocodbConfigs` au lieu de `nocodbConfig`

## Test final

Après application, la modification d'annonce devrait réussir sans erreur 500.

---

**Cette correction résout définitivement le problème.**