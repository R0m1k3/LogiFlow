#!/usr/bin/env node

/**
 * Script de test pour vérifier l'accès des employés aux fournisseurs
 * À exécuter sur le serveur de production pour diagnostiquer les problèmes d'accès
 */

const https = require('https');
const fs = require('fs');

// Configuration pour votre serveur de production
const PRODUCTION_URL = process.env.PRODUCTION_URL || 'https://votre-serveur-production.com';
const TEST_EMPLOYEE_CREDENTIALS = {
  username: process.env.TEST_EMPLOYEE_USERNAME || 'test_employee',
  password: process.env.TEST_EMPLOYEE_PASSWORD || 'password123'
};

console.log('🧪 === TEST D\'ACCÈS FOURNISSEURS POUR EMPLOYÉS ===\n');

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
        'User-Agent': 'LogiFlow-Test-Script/1.0',
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

async function testEmployeeSupplierAccess() {
  try {
    console.log('1️⃣ Test de connexion employé...');
    
    // Étape 1: Se connecter avec un compte employé
    const loginResponse = await makeRequest('/api/login', 'POST', TEST_EMPLOYEE_CREDENTIALS);
    
    console.log(`   Status: ${loginResponse.status}`);
    console.log(`   Response: ${JSON.stringify(loginResponse.data, null, 2)}\n`);
    
    if (loginResponse.status !== 200) {
      console.error('❌ Échec de connexion employé');
      console.error('   Vérifiez que le compte employé existe et que les identifiants sont corrects');
      return;
    }
    
    // Extraire les cookies de session
    const setCookieHeaders = loginResponse.headers['set-cookie'] || [];
    const cookies = setCookieHeaders.join('; ');
    
    console.log('2️⃣ Test d\'accès aux fournisseurs...');
    
    // Étape 2: Tester l'accès à la liste des fournisseurs
    const suppliersResponse = await makeRequest('/api/suppliers', 'GET', null, cookies);
    
    console.log(`   Status: ${suppliersResponse.status}`);
    console.log(`   Response: ${JSON.stringify(suppliersResponse.data, null, 2)}\n`);
    
    if (suppliersResponse.status === 200) {
      console.log('✅ SUCCÈS: L\'employé peut accéder aux fournisseurs');
      console.log(`   Nombre de fournisseurs retournés: ${Array.isArray(suppliersResponse.data) ? suppliersResponse.data.length : 'N/A'}`);
    } else if (suppliersResponse.status === 403) {
      console.log('❌ ÉCHEC: L\'employé n\'a pas l\'autorisation d\'accéder aux fournisseurs');
      console.log('   Le problème est confirmé - permissions insuffisantes');
    } else {
      console.log(`⚠️  ERREUR INATTENDUE: Status ${suppliersResponse.status}`);
    }
    
    console.log('\n3️⃣ Test d\'accès aux fournisseurs DLC...');
    
    // Étape 3: Tester l'accès aux fournisseurs DLC spécifiquement
    const dlcSuppliersResponse = await makeRequest('/api/suppliers?dlc=true', 'GET', null, cookies);
    
    console.log(`   Status: ${dlcSuppliersResponse.status}`);
    console.log(`   Response: ${JSON.stringify(dlcSuppliersResponse.data, null, 2)}\n`);
    
    if (dlcSuppliersResponse.status === 200) {
      console.log('✅ SUCCÈS: L\'employé peut accéder aux fournisseurs DLC');
      console.log(`   Nombre de fournisseurs DLC retournés: ${Array.isArray(dlcSuppliersResponse.data) ? dlcSuppliersResponse.data.length : 'N/A'}`);
    } else if (dlcSuppliersResponse.status === 403) {
      console.log('❌ ÉCHEC: L\'employé n\'a pas l\'autorisation d\'accéder aux fournisseurs DLC');
    }
    
    // Résumé final
    console.log('\n📊 === RÉSUMÉ DU TEST ===');
    console.log(`Connexion employé: ${loginResponse.status === 200 ? '✅ OK' : '❌ ÉCHEC'}`);
    console.log(`Accès fournisseurs: ${suppliersResponse.status === 200 ? '✅ OK' : '❌ ÉCHEC'}`);
    console.log(`Accès fournisseurs DLC: ${dlcSuppliersResponse.status === 200 ? '✅ OK' : '❌ ÉCHEC'}`);
    
    if (suppliersResponse.status === 200 && dlcSuppliersResponse.status === 200) {
      console.log('\n🎉 TOUS LES TESTS PASSÉS - L\'accès employé aux fournisseurs fonctionne correctement');
    } else {
      console.log('\n⚠️  PROBLÈME DÉTECTÉ - Vérifiez les permissions serveur et la configuration des rôles');
    }
    
  } catch (error) {
    console.error('💥 Erreur lors du test:', error.message);
    console.error('   Vérifiez que le serveur de production est accessible');
  }
}

// Instructions d'utilisation
console.log('📋 Instructions:');
console.log('1. Assurez-vous d\'avoir un compte employé de test');
console.log('2. Configurez les variables d\'environnement si nécessaire:');
console.log('   - PRODUCTION_URL=https://votre-serveur.com');
console.log('   - TEST_EMPLOYEE_USERNAME=nom_utilisateur');
console.log('   - TEST_EMPLOYEE_PASSWORD=mot_de_passe');
console.log('3. Exécutez: node test-employee-supplier-access.js\n');

// Exécuter le test si le script est appelé directement
if (require.main === module) {
  testEmployeeSupplierAccess().catch(console.error);
}

module.exports = { testEmployeeSupplierAccess };