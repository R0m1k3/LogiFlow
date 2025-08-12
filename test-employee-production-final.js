#!/usr/bin/env node

// Test complet production pour employé - commandes client et DLC
// Script pour reproduire les erreurs et identifier la cause exacte

const testEmployeeProduction = async () => {
  console.log('🧪 TEST EMPLOYÉ PRODUCTION');
  console.log('========================');
  
  console.log('\n📋 Scénarios à tester:');
  console.log('1. ✅ Connexion employé');
  console.log('2. 🔍 Vérifier permissions frontend');
  console.log('3. 📝 Créer commande client');
  console.log('4. 🍃 Créer produit DLC');
  console.log('5. 📊 Vérifier affichage données');
  
  console.log('\n🔍 Debug Frontend (à faire dans DevTools):');
  console.log('1. Console.log user object complet');
  console.log('2. Vérifier hasPermission("customer-orders", "create")');
  console.log('3. Vérifier hasPermission("dlc", "create")');
  console.log('4. Logs requêtes POST qui échouent');
  console.log('5. Vérifier groupId envoyé dans requests');
  
  console.log('\n📤 Requête test commande client:');
  const testCustomerOrder = {
    customerName: "Test Client Production",
    contactNumber: "0123456789",
    productName: "Produit Test Employé",
    quantity: 1,
    groupId: 2, // Houdemont d'après les logs
    deposit: 0,
    isPromotionalPrice: false,
    notes: "Test création employé production"
  };
  console.log(JSON.stringify(testCustomerOrder, null, 2));
  
  console.log('\n📤 Requête test DLC:');
  const testDlc = {
    productName: "DLC Test Employé",
    dlcDate: "2025-08-25",
    dateType: "dlc",
    quantity: 1,
    unit: "Unité",
    supplierId: 1,
    location: "Test Location",
    groupId: 2, // Houdemont
    status: "en_cours"
  };
  console.log(JSON.stringify(testDlc, null, 2));
  
  console.log('\n⚠️ Points de contrôle:');
  console.log('1. Bouton "Créer" visible dans l\'interface?');
  console.log('2. Formulaire s\'ouvre sans erreur?');
  console.log('3. Soumission génère une requête HTTP?');
  console.log('4. Réponse serveur (200/400/403/500)?');
  console.log('5. Message d\'erreur affiché?');
  
  console.log('\n🔧 Solutions selon erreurs:');
  console.log('- 403 Forbidden: Problème permissions base');
  console.log('- 400 Bad Request: Problème validation schema');
  console.log('- 500 Server Error: Problème côté serveur');
  console.log('- Pas de requête: Problème frontend/permissions');
  
  console.log('\n📋 Checklist production déjà fait:');
  console.log('✅ Routes backend sans restrictions rôle');
  console.log('✅ Permissions définies dans shared/permissions.ts');
  console.log('✅ Schema validation corrigé');
  console.log('✅ Cache invalidation DLC avec exact:false');
  
  console.log('\n🎯 Actions immédiates:');
  console.log('1. Ouvrir DevTools > Console');
  console.log('2. Essayer créer commande client');
  console.log('3. Noter toute erreur console/réseau');
  console.log('4. Même test pour DLC');
  console.log('5. Envoyer logs complets pour debug');
};

console.log('🚀 Prêt pour test employé production');
console.log('👉 Exécuter les étapes manuellement avec DevTools ouverts');