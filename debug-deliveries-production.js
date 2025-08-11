#!/usr/bin/env node

// Script de test spécifique pour les livraisons en production
const url = process.argv[2] || 'https://logiflow.ffnancy.fr';

const testDeliveriesAPI = async () => {
  console.log(`🚚 Test des livraisons sur ${url}\n`);
  
  try {
    // 1. Connexion
    console.log('1. 🔐 Test de connexion...');
    const loginResponse = await fetch(`${url}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin' }),
      credentials: 'include'
    });
    
    if (!loginResponse.ok) {
      console.log('❌ Connexion échouée:', loginResponse.status);
      return;
    }
    
    const cookies = loginResponse.headers.get('set-cookie');
    console.log('✅ Connexion réussie');
    
    // 2. Test API livraisons
    console.log('\n2. 📦 Test API livraisons...');
    const deliveriesResponse = await fetch(`${url}/api/deliveries`, {
      headers: { 'Cookie': cookies || '' }
    });
    
    if (!deliveriesResponse.ok) {
      console.log('❌ API livraisons échouée:', deliveriesResponse.status);
      return;
    }
    
    const deliveries = await deliveriesResponse.json();
    console.log('✅ API livraisons OK:', deliveries.length, 'livraisons trouvées');
    
    // 3. Test API commandes pour comparaison
    console.log('\n3. 📋 Test API commandes...');
    const ordersResponse = await fetch(`${url}/api/orders`, {
      headers: { 'Cookie': cookies || '' }
    });
    
    if (ordersResponse.ok) {
      const orders = await ordersResponse.json();
      console.log('✅ API commandes OK:', orders.length, 'commandes trouvées');
    }
    
    // 4. Comparaison
    console.log('\n🔍 Résultats:');
    console.log(`   Livraisons: ${deliveries.length} items`);
    if (deliveries.length === 0) {
      console.log('⚠️  Aucune livraison trouvée - Vérifiez la base de données');
    } else {
      console.log('✅ Des livraisons sont présentes');
    }
    
  } catch (error) {
    console.log('❌ Erreur de test:', error.message);
  }
};

testDeliveriesAPI().catch(console.error);