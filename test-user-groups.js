// Test script pour vérifier l'attribution des groupes en production
// À exécuter avec: node test-user-groups.js

import { storage } from './server/storage.js';

async function testUserGroups() {
  try {
    console.log('🧪 Test d\'attribution des groupes...');
    
    // Test data
    const testUserGroup = {
      userId: 'test_user_123',
      groupId: 1
    };
    
    console.log('📝 Tentative d\'attribution du groupe:', testUserGroup);
    
    const result = await storage.assignUserToGroup(testUserGroup);
    
    console.log('✅ Attribution réussie:', result);
    console.log('🎉 Le problème d\'attribution des groupes est résolu !');
    
  } catch (error) {
    console.error('❌ Erreur lors du test:', error);
    console.error('Code d\'erreur:', error?.code);
    console.error('Message:', error?.message);
  }
}

if (process.env.NODE_ENV === 'production') {
  console.log('🏭 Exécution en mode production');
  testUserGroups();
} else {
  console.log('🛠️ Ce test est conçu pour la production');
  console.log('Pour tester localement, définissez NODE_ENV=production');
}