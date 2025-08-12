#!/usr/bin/env node

/**
 * Debug final pour vérifier pourquoi les DLC créées par l'employé n'apparaissent pas
 */

console.log('🔍 Debug Final - Visibilité DLC Employé');

async function debugDlcVisibility() {
  try {
    const fetch = require('node-fetch');
    
    console.log('\n=== DEBUG VISIBILITÉ DLC EMPLOYÉ ===');
    
    // 1. Login admin pour test de contrôle
    console.log('1. Test admin...');
    const adminLogin = await fetch('http://localhost:5000/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin' })
    });
    
    if (!adminLogin.ok) {
      console.log('❌ Admin login failed');
      return;
    }
    
    const adminCookies = adminLogin.headers.get('set-cookie');
    
    // 2. Créer une DLC avec admin
    console.log('2. Création DLC par admin...');
    const dlcData = {
      productName: 'Test DLC Visibilité Admin',
      dlcDate: '2025-08-20',
      dateType: 'DLC',
      quantity: 1,
      unit: 'Unité',
      supplierId: 1,
      location: 'Test Rayon',
      groupId: 2, // Groupe Houdemont (même que l'employé)
      status: 'en_cours'
    };
    
    const createDlc = await fetch('http://localhost:5000/api/dlc-products', {
      method: 'POST',
      headers: {
        'Cookie': adminCookies,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(dlcData)
    });
    
    console.log('Status création:', createDlc.status);
    
    if (createDlc.ok) {
      const newDlc = await createDlc.json();
      console.log('✅ DLC créée:', {
        id: newDlc.id,
        productName: newDlc.productName,
        groupId: newDlc.groupId
      });
    }
    
    // 3. Vérifier la liste complète DLC
    console.log('\n3. Vérification liste DLC...');
    const dlcList = await fetch('http://localhost:5000/api/dlc-products', {
      headers: { 'Cookie': adminCookies }
    });
    
    if (dlcList.ok) {
      const dlcs = await dlcList.json();
      console.log('📋 Total DLC:', dlcs.length);
      
      // Filtrer par groupe 2 (Houdemont)
      const group2Dlcs = dlcs.filter(d => d.groupId === 2);
      console.log('🏪 DLC Groupe 2 (Houdemont):', group2Dlcs.length);
      
      // Dernières DLC créées
      const recentDlcs = dlcs.slice(0, 5);
      console.log('🆕 5 dernières DLC:');
      recentDlcs.forEach(dlc => {
        console.log(`  - ID: ${dlc.id}, Nom: ${dlc.productName}, Groupe: ${dlc.groupId}`);
      });
    }
    
    console.log('\n4. Instructions pour test employé production:');
    console.log('- Se connecter avec compte employé');
    console.log('- Aller sur page DLC Products');
    console.log('- Vérifier si les DLC du groupe 2 sont visibles');
    console.log('- Regarder dans les outils dev si la requête API retourne des données');
    console.log('- Vérifier le cache React Query dans les dev tools');
    
    console.log('\n🔍 Points à vérifier:');
    console.log('1. Cache React Query invalidé après création ?');
    console.log('2. Filtre groupId correct dans la requête ?');
    console.log('3. État de loading/error du composant ?');
    console.log('4. Données reçues mais pas affichées ?');
    
  } catch (error) {
    console.log('❌ Erreur debug:', error.message);
  }
}

debugDlcVisibility();