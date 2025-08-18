# DIAGNOSTIC PRODUCTION - Erreurs 500 Annonces

## Script de test à exécuter sur votre serveur

### 1. Test de connexion PostgreSQL

```javascript
// Ajoutez temporairement dans server/routes.ts après la ligne 50
app.get('/api/debug/db-connection', async (req, res) => {
  try {
    console.log('🔍 Testing PostgreSQL connection...');
    const result = await db.select().from(dashboardMessages).limit(1);
    console.log('✅ DB Connection OK, sample result:', result);
    res.json({ status: 'ok', connection: 'success', sampleData: result });
  } catch (error) {
    console.error('❌ DB Connection Error:', error);
    res.status(500).json({ status: 'error', error: error.message });
  }
});
```

### 2. Test de mise à jour avec logs détaillés

```javascript
// Remplacez temporairement la route PUT /api/announcements/:id par ceci
app.put('/api/announcements/:id', isAuthenticated, async (req: any, res) => {
  console.log('🔍 [DEBUG] Starting announcement update process');
  console.log('🔍 [DEBUG] Request params:', req.params);
  console.log('🔍 [DEBUG] Request body:', req.body);
  console.log('🔍 [DEBUG] User:', req.user);
  
  try {
    const userId = req.user.claims ? req.user.claims.sub : req.user.id;
    console.log('🔍 [DEBUG] Extracted userId:', userId);
    
    const user = await storage.getUserWithGroups(userId);
    console.log('🔍 [DEBUG] User found:', user ? 'YES' : 'NO');
    if (user) {
      console.log('🔍 [DEBUG] User details:', { id: user.id, username: user.username, role: user.role });
    }

    if (!user) {
      console.error('❌ [DEBUG] User not found');
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role !== 'admin') {
      console.error('❌ [DEBUG] Access denied - user role:', user.role);
      return res.status(403).json({ message: "Only administrators can edit announcements" });
    }

    const id = parseInt(req.params.id);
    console.log('🔍 [DEBUG] Announcement ID to update:', id);

    // Test if announcement exists
    console.log('🔍 [DEBUG] Checking if announcement exists...');
    const existingAnnouncement = await storage.getAnnouncement(id);
    console.log('🔍 [DEBUG] Existing announcement:', existingAnnouncement ? 'FOUND' : 'NOT FOUND');
    if (existingAnnouncement) {
      console.log('🔍 [DEBUG] Existing announcement details:', {
        id: existingAnnouncement.id,
        title: existingAnnouncement.title,
        createdBy: existingAnnouncement.createdBy
      });
    }

    if (!existingAnnouncement) {
      console.error('❌ [DEBUG] Announcement not found:', id);
      return res.status(404).json({ message: "Announcement not found" });
    }

    console.log('🔍 [DEBUG] Validating request data...');
    const announcementData = insertAnnouncementSchema.partial().parse(req.body);
    console.log('🔍 [DEBUG] Validated data:', announcementData);

    console.log('🔍 [DEBUG] Calling storage.updateAnnouncement...');
    const updatedAnnouncement = await storage.updateAnnouncement(id, announcementData);
    console.log('✅ [DEBUG] Update successful:', updatedAnnouncement);
    
    res.json(updatedAnnouncement);
  } catch (error) {
    console.error('❌ [DEBUG] Error in update process:', error);
    console.error('❌ [DEBUG] Error stack:', error.stack);
    
    if (error instanceof z.ZodError) {
      console.error('❌ [DEBUG] Validation errors:', error.errors);
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    
    res.status(500).json({ 
      message: "Failed to update announcement",
      error: error.message,
      debug: true
    });
  }
});
```

### 3. Test de la méthode updateAnnouncement directement

```javascript
// Ajoutez cette route de test
app.post('/api/debug/test-update', isAuthenticated, async (req: any, res) => {
  try {
    console.log('🔍 [DEBUG] Direct update test');
    
    // Test direct sur la base de données
    const testResult = await db
      .update(dashboardMessages)
      .set({ title: 'Test Update ' + new Date().toISOString() })
      .where(eq(dashboardMessages.id, 1))
      .returning();
      
    console.log('✅ [DEBUG] Direct DB update result:', testResult);
    res.json({ status: 'success', result: testResult });
  } catch (error) {
    console.error('❌ [DEBUG] Direct update error:', error);
    res.status(500).json({ status: 'error', error: error.message });
  }
});
```

## Instructions d'utilisation

1. **Ajoutez ces routes de debug** à votre serveur de production
2. **Redémarrez le serveur**
3. **Testez dans l'ordre** :
   - GET `/api/debug/db-connection`
   - POST `/api/debug/test-update`
   - PUT `/api/announcements/1` avec les nouveaux logs
4. **Envoyez-moi les logs complets** de ces tests

## Vérifications supplémentaires

### Vérifiez que les tables existent :
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'dashboard_messages';

SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'dashboard_messages';
```

### Vérifiez les données :
```sql
SELECT id, title, created_by FROM dashboard_messages LIMIT 3;
```

Ces tests nous diront exactement où est le problème dans votre environnement de production.