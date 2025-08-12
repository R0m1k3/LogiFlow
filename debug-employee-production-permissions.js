#!/usr/bin/env node

// Script de debug pour permissions employé en production
// À exécuter dans la console DevTools du navigateur

const debugEmployeePermissions = () => {
  console.log('🔍 DEBUG PERMISSIONS EMPLOYÉ PRODUCTION');
  console.log('=====================================');
  
  // 1. Vérifier l'utilisateur connecté
  console.log('\n👤 UTILISATEUR:');
  if (window.user || localStorage.getItem('user')) {
    const user = window.user || JSON.parse(localStorage.getItem('user') || '{}');
    console.log('ID:', user.id);
    console.log('Role:', user.role);
    console.log('Groups:', user.userGroups);
    console.log('Nom:', user.firstName, user.lastName);
  } else {
    console.log('❌ Aucun utilisateur trouvé');
    return;
  }
  
  // 2. Vérifier les permissions via hook
  console.log('\n🔐 PERMISSIONS HOOK:');
  try {
    // Simuler usePermissions
    const testPermissions = {
      'customer-orders': ['view', 'create'],
      'dlc': ['view', 'create']
    };
    
    console.log('Customer Orders - canCreate:', testPermissions['customer-orders'].includes('create'));
    console.log('DLC - canCreate:', testPermissions['dlc'].includes('create'));
  } catch (error) {
    console.log('❌ Erreur permissions:', error);
  }
  
  // 3. Vérifier les éléments DOM
  console.log('\n🖥️ INTERFACE:');
  const nouvelleCommande = document.querySelector('button:contains("Nouvelle Commande")') || 
                          document.querySelector('[class*="button"]:contains("Nouvelle")');
  console.log('Bouton "Nouvelle Commande" visible:', !!nouvelleCommande);
  
  const dlcButton = document.querySelector('button:contains("Nouveau DLC")') ||
                   document.querySelector('[class*="button"]:contains("DLC")');
  console.log('Bouton création DLC visible:', !!dlcButton);
  
  // 4. Test requête API directe
  console.log('\n🌐 TEST API:');
  console.log('Ouvrir DevTools > Network pour voir les requêtes');
  console.log('Essayer de créer une commande et noter la réponse');
  
  // 5. Logs à surveiller
  console.log('\n📋 LOGS À SURVEILLER:');
  console.log('- Erreurs console (rouge)');
  console.log('- Requêtes réseau échouées (400/403/500)');
  console.log('- Messages d\'erreur formulaire');
  console.log('- Validation schema échouée');
  
  return {
    user: window.user || JSON.parse(localStorage.getItem('user') || '{}'),
    canCreateOrders: true, // Devrait être true pour employé
    canCreateDLC: true,    // Devrait être true pour employé
    timestamp: new Date().toISOString()
  };
};

// Instructions pour utilisation en production
console.log('🎯 INSTRUCTIONS PRODUCTION:');
console.log('1. Ouvrir DevTools (F12)');
console.log('2. Aller dans Console');
console.log('3. Coller ce script et Entrée');
console.log('4. Analyser les résultats');
console.log('5. Essayer créer commande/DLC');
console.log('6. Envoyer logs complets pour debug');

// Export pour utilisation
if (typeof module !== 'undefined') {
  module.exports = debugEmployeePermissions;
}