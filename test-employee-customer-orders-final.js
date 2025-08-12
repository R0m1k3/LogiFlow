#!/usr/bin/env node

/**
 * Test final pour la création de commandes client par employé
 */

console.log('🔍 Test Final - Création Commande Client Employé');

async function testEmployeeCustomerOrder() {
  try {
    const fetch = require('node-fetch');
    
    console.log('\n=== TEST FINAL CRÉATION COMMANDE CLIENT ===');
    
    // 1. Login admin
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
    
    // 2. Test création avec nouveau format
    const orderData = {
      customerName: 'Client Test Final',
      contactNumber: '0123456789',
      productName: 'Produit Test Final',
      quantity: 1,
      groupId: 1,
      isPickup: false,
      notes: 'Test final avec nouveau schema'
    };
    
    console.log('2. Envoi données:', orderData);
    
    const createOrder = await fetch('http://localhost:5000/api/customer-orders', {
      method: 'POST',
      headers: {
        'Cookie': adminCookies,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(orderData)
    });
    
    console.log('Status:', createOrder.status);
    const response = await createOrder.text();
    
    if (createOrder.ok) {
      console.log('✅ Commande créée avec succès');
      console.log('Réponse:', JSON.parse(response));
    } else {
      console.log('❌ Erreur création:', response);
    }
    
    console.log('\n3. Instructions pour test employé en production:');
    console.log('- Se connecter avec un compte employé');
    console.log('- Essayer de créer une commande client');
    console.log('- Vérifier les logs pour "Frontend submit data" et "Backend data mapped"');
    console.log('- Si erreur 403, vérifier que l\'employé est assigné au bon groupe');
    
  } catch (error) {
    console.log('❌ Erreur test:', error.message);
  }
}

testEmployeeCustomerOrder();