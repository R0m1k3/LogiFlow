#!/usr/bin/env node

/**
 * Script de débogage pour identifier les erreurs 403 des employés en production
 * Analyse les routes et permissions pour diagnostiquer les problèmes d'accès
 */

const https = require('https');

// Configuration pour le serveur de production
const PRODUCTION_URL = process.env.PRODUCTION_URL || 'https://votre-serveur-production.com';
const TEST_EMPLOYEE_CREDENTIALS = {
  username: process.env.TEST_EMPLOYEE_USERNAME || 'test_employee',
  password: process.env.TEST_EMPLOYEE_PASSWORD || 'password123'
};

console.log('🐛 === DÉBOGAGE ERREURS 403 EMPLOYÉS EN PRODUCTION ===\n');

// Routes susceptibles de poser problème pour les employés
const ROUTES_TO_TEST = [
  { path: '/api/tasks', method: 'GET', description: 'Liste des tâches' },
  { path: '/api/tasks', method: 'POST', description: 'Création de tâche', data: { title: 'Test', description: 'Test', priority: 'medium', status: 'pending', groupId: 1 } },
  { path: '/api/suppliers', method: 'GET', description: 'Liste des fournisseurs' },
  { path: '/api/suppliers?dlc=true', method: 'GET', description: 'Fournisseurs DLC' },
  { path: '/api/groups', method: 'GET', description: 'Liste des groupes/magasins' },
  { path: '/api/customer-orders', method: 'GET', description: 'Commandes client' },
  { path: '/api/dlc-products', method: 'GET', description: 'Produits DLC' },
  { path: '/api/user', method: 'GET', description: 'Profil utilisateur' }
];

async function makeRequest(path, method = 'GET', data = null, cookies = '') {
  return new Promise((resolve, reject) => {
    const url = new URL(path, PRODUCTION_URL);
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'LogiFlow-Debug-Script/1.0',
        ...(cookies ? { 'Cookie': cookies } : {}),
        ...(data ? { 'Content-Length': Buffer.byteLength(JSON.stringify(data)) } : {})
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: parsed
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: body
          });
        }
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function debugEmployee403Errors() {
  try {
    console.log('1️⃣ Connexion avec compte employé...');
    
    // Connexion employé
    const loginResponse = await makeRequest('/api/login', 'POST', TEST_EMPLOYEE_CREDENTIALS);
    
    if (loginResponse.status !== 200) {
      console.error('❌ Échec de connexion employé');
      console.error(`   Status: ${loginResponse.status}`);
      console.error(`   Response: ${JSON.stringify(loginResponse.data, null, 2)}`);
      return;
    }
    
    console.log('✅ Connexion employé réussie\n');
    
    // Extraire les cookies de session
    const setCookieHeaders = loginResponse.headers['set-cookie'] || [];
    const cookies = setCookieHeaders.join('; ');
    
    console.log('2️⃣ Test des routes susceptibles de générer des erreurs 403...\n');
    
    const results = [];
    
    // Tester chaque route
    for (const route of ROUTES_TO_TEST) {
      console.log(`🔍 Test: ${route.method} ${route.path} - ${route.description}`);
      
      try {
        const response = await makeRequest(route.path, route.method, route.data, cookies);
        
        const status = response.status;
        const statusIcon = status === 200 ? '✅' : status === 403 ? '❌' : '⚠️';
        
        console.log(`   ${statusIcon} Status: ${status}`);
        
        if (status === 403) {
          console.log(`   🚫 ERREUR 403: ${JSON.stringify(response.data, null, 2)}`);
          results.push({ route, status, error: response.data, success: false });
        } else if (status === 200) {
          const dataSize = Array.isArray(response.data) ? response.data.length : 'N/A';
          console.log(`   📊 Données retournées: ${dataSize} éléments`);
          results.push({ route, status, success: true });
        } else {
          console.log(`   ⚠️ Status inattendu: ${JSON.stringify(response.data, null, 2)}`);
          results.push({ route, status, error: response.data, success: false });
        }
        
      } catch (error) {
        console.log(`   💥 Erreur réseau: ${error.message}`);
        results.push({ route, status: 'ERROR', error: error.message, success: false });
      }
      
      console.log(''); // Ligne vide entre les tests
    }
    
    // Résumé des résultats
    console.log('📊 === RÉSUMÉ DES TESTS ===');
    console.log('==========================\n');
    
    const successfulRoutes = results.filter(r => r.success);
    const forbiddenRoutes = results.filter(r => r.status === 403);
    const errorRoutes = results.filter(r => !r.success && r.status !== 403);
    
    console.log(`✅ Routes accessibles: ${successfulRoutes.length}/${results.length}`);
    console.log(`❌ Erreurs 403: ${forbiddenRoutes.length}/${results.length}`);
    console.log(`⚠️  Autres erreurs: ${errorRoutes.length}/${results.length}\n`);
    
    if (forbiddenRoutes.length > 0) {
      console.log('🚫 ROUTES BLOQUÉES (403):');
      forbiddenRoutes.forEach(result => {
        console.log(`   • ${result.route.method} ${result.route.path} - ${result.route.description}`);
        console.log(`     Erreur: ${result.error?.message || 'Permission refusée'}`);
      });
      console.log('');
    }
    
    if (errorRoutes.length > 0) {
      console.log('⚠️  AUTRES ERREURS:');
      errorRoutes.forEach(result => {
        console.log(`   • ${result.route.method} ${result.route.path} - Status: ${result.status}`);
        console.log(`     Erreur: ${result.error?.message || result.error}`);
      });
      console.log('');
    }
    
    console.log('💡 RECOMMANDATIONS:');
    if (forbiddenRoutes.length === 0) {
      console.log('   🎉 Aucune erreur 403 détectée - les permissions semblent correctes !');
    } else {
      console.log('   1. Vérifiez les permissions dans shared/permissions.ts');
      console.log('   2. Vérifiez les middlewares de permission dans server/permissions.ts');
      console.log('   3. Vérifiez l\'assignation de groupes/magasins à l\'employé');
      console.log('   4. Examinez les logs serveur pendant l\'exécution des requêtes');
    }
    
  } catch (error) {
    console.error('💥 Erreur lors du débogage:', error.message);
  }
}

// Instructions d'utilisation
console.log('📋 Instructions:');
console.log('1. Configurez les variables d\'environnement:');
console.log('   - PRODUCTION_URL=https://votre-serveur.com');
console.log('   - TEST_EMPLOYEE_USERNAME=nom_utilisateur_employe');
console.log('   - TEST_EMPLOYEE_PASSWORD=mot_de_passe');
console.log('2. Exécutez: node debug-employee-403-production.js\n');

// Exécuter le debug si le script est appelé directement
if (require.main === module) {
  debugEmployee403Errors().catch(console.error);
}

module.exports = { debugEmployee403Errors };