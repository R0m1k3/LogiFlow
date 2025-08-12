#!/usr/bin/env node

/**
 * Test simple pour vérifier la création de commandes client par employé
 */

console.log('🔍 Test création commande client - Tous rôles');

async function testCreation() {
  try {
    const fetch = require('node-fetch');
    
    console.log('\n=== TEST CRÉATION COMMANDE CLIENT ===');
    
    // 1. Login admin local
    console.log('1. Login admin...');
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
    console.log('✅ Admin login OK');
    
    // 2. Test création commande admin
    console.log('\n2. Test création commande admin...');
    const testOrder = {
      customerName: 'Test Client Admin',
      contactNumber: '0123456789',
      productName: 'Produit Test',
      productDescription: 'Description test',
      quantity: 1,
      groupId: 1,
      isPickup: false,
      notes: 'Test admin'
    };
    
    const adminCreate = await fetch('http://localhost:5000/api/customer-orders', {
      method: 'POST',
      headers: {
        'Cookie': adminCookies,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testOrder)
    });
    
    console.log('Status admin:', adminCreate.status);
    const adminResponse = await adminCreate.text();
    
    if (adminCreate.ok) {
      console.log('✅ Admin peut créer des commandes client');
      console.log('Réponse:', JSON.parse(adminResponse));
    } else {
      console.log('❌ Admin ne peut pas créer:', adminResponse);
    }
    
    // 3. Vérifier les logs du serveur
    console.log('\n3. Instructions pour vérifier en production:');
    console.log('- Ouvrir les logs du serveur');
    console.log('- Essayer de créer une commande en tant qu\'employé');
    console.log('- Regarder les messages console.log() de POST /api/customer-orders');
    console.log('- Vérifier s\'il y a des erreurs de validation Zod');
    
  } catch (error) {
    console.log('❌ Erreur test:', error.message);
  }
}

testCreation();