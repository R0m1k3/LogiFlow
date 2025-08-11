// Debug script to check permissions loading
const { storage } = require('./server/storage');

async function debugPermissions() {
  try {
    console.log('=== DEBUG PERMISSIONS ===');
    
    // Get all permissions
    const permissions = await storage.getPermissions();
    console.log('Total permissions found:', permissions.length);
    
    // Check DLC permissions specifically
    const dlcPermissions = permissions.filter(p => p.category === 'gestion_dlc');
    console.log('DLC permissions found:', dlcPermissions.length);
    
    if (dlcPermissions.length > 0) {
      console.log('DLC permissions details:');
      dlcPermissions.forEach(p => {
        console.log(`  - ${p.name}: ${p.displayName} (${p.action})`);
      });
    }
    
    // Check categories
    const categories = [...new Set(permissions.map(p => p.category))];
    console.log('All categories:', categories);
    
    // Check if gestion_dlc is in the list
    const hasDlcCategory = categories.includes('gestion_dlc');
    console.log('Has gestion_dlc category:', hasDlcCategory);
    
    // Check permissions data structure
    console.log('Sample permission structure:', permissions[0]);
    
  } catch (error) {
    console.error('Error debugging permissions:', error);
  }
}

debugPermissions();