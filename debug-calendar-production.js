#!/usr/bin/env node

/**
 * Script de diagnostic pour le problème de calendrier en production
 * avec le rôle directeur
 */

const fetch = require('node-fetch');

// Configuration de votre serveur de production
const PRODUCTION_URL = process.env.PRODUCTION_URL || 'https://votre-serveur-production.com';
const USERNAME = process.env.PROD_USERNAME || 'votre-directeur-username';
const PASSWORD = process.env.PROD_PASSWORD || 'votre-directeur-password';

async function testCalendarAPIs() {
  console.log('🔍 Test de diagnostic du calendrier en production pour directeur');
  console.log('URL de production:', PRODUCTION_URL);

  try {
    // 1. Test de connexion au serveur
    console.log('\n1. Test de connexion au serveur...');
    const healthResponse = await fetch(`${PRODUCTION_URL}/api/health`, {
      timeout: 10000
    });
    console.log('✅ Serveur accessible:', healthResponse.status);

    // 2. Test d'authentification
    console.log('\n2. Test d\'authentification...');
    const loginResponse = await fetch(`${PRODUCTION_URL}/api/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: USERNAME,
        password: PASSWORD
      })
    });

    if (!loginResponse.ok) {
      console.error('❌ Échec de l\'authentification:', loginResponse.status);
      return;
    }

    const cookies = loginResponse.headers.get('set-cookie');
    console.log('✅ Authentification réussie');

    // 3. Test de récupération du profil utilisateur
    console.log('\n3. Test du profil utilisateur...');
    const userResponse = await fetch(`${PRODUCTION_URL}/api/user`, {
      headers: {
        'Cookie': cookies
      }
    });

    if (!userResponse.ok) {
      console.error('❌ Impossible de récupérer le profil:', userResponse.status);
      return;
    }

    const user = await userResponse.json();
    console.log('✅ Profil utilisateur:', {
      role: user.role,
      id: user.id,
      groupsCount: user.userGroups?.length || 0
    });

    // 4. Test API orders (utilisée par le calendrier)
    console.log('\n4. Test API /api/orders...');
    const ordersResponse = await fetch(`${PRODUCTION_URL}/api/orders?startDate=2025-08-01&endDate=2025-08-31`, {
      headers: {
        'Cookie': cookies
      },
      timeout: 15000
    });

    console.log('Status orders:', ordersResponse.status);
    if (ordersResponse.ok) {
      const orders = await ordersResponse.json();
      console.log('✅ API orders fonctionne, nombre de commandes:', orders.length);
    } else {
      const errorText = await ordersResponse.text();
      console.error('❌ Erreur API orders:', errorText);
    }

    // 5. Test API deliveries (utilisée par le calendrier)
    console.log('\n5. Test API /api/deliveries...');
    const deliveriesResponse = await fetch(`${PRODUCTION_URL}/api/deliveries?startDate=2025-08-01&endDate=2025-08-31`, {
      headers: {
        'Cookie': cookies
      },
      timeout: 15000
    });

    console.log('Status deliveries:', deliveriesResponse.status);
    if (deliveriesResponse.ok) {
      const deliveries = await deliveriesResponse.json();
      console.log('✅ API deliveries fonctionne, nombre de livraisons:', deliveries.length);
    } else {
      const errorText = await deliveriesResponse.text();
      console.error('❌ Erreur API deliveries:', errorText);
    }

    // 6. Test de connectivité réseau détaillé
    console.log('\n6. Test de connectivité réseau...');
    const start = Date.now();
    const timeoutResponse = await fetch(`${PRODUCTION_URL}/api/health`, {
      timeout: 30000
    });
    const duration = Date.now() - start;
    console.log(`✅ Temps de réponse réseau: ${duration}ms`);

  } catch (error) {
    console.error('❌ Erreur de diagnostic:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('💡 Solution: Vérifiez que le serveur est démarré et accessible');
    } else if (error.code === 'ETIMEDOUT') {
      console.log('💡 Solution: Problème de timeout réseau - vérifiez la connectivité');
    } else if (error.message.includes('ENOTFOUND')) {
      console.log('💡 Solution: URL du serveur incorrecte ou problème DNS');
    }
  }
}

// Instructions d'utilisation
console.log(`
🚀 INSTRUCTIONS D'UTILISATION:

1. Configurez les variables d'environnement:
   export PRODUCTION_URL="https://votre-serveur-production.com"
   export PROD_USERNAME="votre-directeur-username"
   export PROD_PASSWORD="votre-directeur-password"

2. Exécutez le script:
   node debug-calendar-production.js

3. Analysez les résultats pour identifier le problème
`);

if (process.argv.includes('--run')) {
  testCalendarAPIs();
}