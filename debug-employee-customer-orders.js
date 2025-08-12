#!/usr/bin/env node

/**
 * Script de diagnostic pour le problème de création de commandes client 
 * avec le rôle employé en production
 */

const fetch = require('node-fetch');

// Configuration de votre serveur de production
const PRODUCTION_URL = process.env.PRODUCTION_URL || 'https://votre-serveur-production.com';
const EMPLOYEE_USERNAME = process.env.EMPLOYEE_USERNAME || 'votre-employee-username';
const EMPLOYEE_PASSWORD = process.env.EMPLOYEE_PASSWORD || 'votre-employee-password';

async function testEmployeeCustomerOrders() {
  console.log('🔍 Test de diagnostic des commandes client pour employé');
  console.log('URL de production:', PRODUCTION_URL);

  try {
    // 1. Test d'authentification employé
    console.log('\n1. Test d\'authentification employé...');
    const loginResponse = await fetch(`${PRODUCTION_URL}/api/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: EMPLOYEE_USERNAME,
        password: EMPLOYEE_PASSWORD
      })
    });

    if (!loginResponse.ok) {
      console.error('❌ Échec de l\'authentification employé:', loginResponse.status);
      return;
    }

    const cookies = loginResponse.headers.get('set-cookie');
    console.log('✅ Authentification employé réussie');

    // 2. Vérifier le profil utilisateur
    console.log('\n2. Vérification du profil employé...');
    const userResponse = await fetch(`${PRODUCTION_URL}/api/user`, {
      headers: {
        'Cookie': cookies
      }
    });

    if (!userResponse.ok) {
      console.error('❌ Impossible de récupérer le profil employé:', userResponse.status);
      return;
    }

    const user = await userResponse.json();
    console.log('✅ Profil employé:', {
      role: user.role,
      id: user.id,
      groupsCount: user.userGroups?.length || 0,
      groups: user.userGroups?.map(ug => ug.group?.name || ug.groupId) || []
    });

    if (user.role !== 'employee') {
      console.error('❌ L\'utilisateur n\'est pas un employé, rôle actuel:', user.role);
      return;
    }

    // 3. Test de récupération des commandes client (GET)
    console.log('\n3. Test API GET /api/customer-orders...');
    const getOrdersResponse = await fetch(`${PRODUCTION_URL}/api/customer-orders`, {
      headers: {
        'Cookie': cookies
      }
    });

    console.log('Status GET customer-orders:', getOrdersResponse.status);
    if (getOrdersResponse.ok) {
      const orders = await getOrdersResponse.json();
      console.log('✅ API GET customer-orders fonctionne, nombre:', orders.length);
    } else {
      const errorText = await getOrdersResponse.text();
      console.error('❌ Erreur API GET customer-orders:', errorText);
    }

    // 4. Test de création d'une commande client (POST)
    console.log('\n4. Test API POST /api/customer-orders...');
    
    // Utiliser le premier groupe de l'employé
    const groupId = user.userGroups?.[0]?.groupId;
    if (!groupId) {
      console.error('❌ Employé n\'est assigné à aucun groupe');
      return;
    }

    const testOrder = {
      customerName: 'Test Client Diagnostic',
      contactNumber: '0123456789',
      productName: 'Test Produit',
      productDescription: 'Description test',
      quantity: 1,
      groupId: groupId,
      isPickup: false,
      notes: 'Commande test pour diagnostic'
    };

    console.log('📦 Données de test:', testOrder);

    const createOrderResponse = await fetch(`${PRODUCTION_URL}/api/customer-orders`, {
      method: 'POST',
      headers: {
        'Cookie': cookies,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testOrder)
    });

    console.log('Status POST customer-orders:', createOrderResponse.status);
    
    if (createOrderResponse.ok) {
      const createdOrder = await createOrderResponse.json();
      console.log('✅ Commande client créée avec succès:', {
        id: createdOrder.id,
        customerName: createdOrder.customerName,
        status: createdOrder.status
      });

      // 5. Nettoyer - supprimer la commande test (si l'employé a permission)
      console.log('\n5. Test de suppression de la commande test...');
      const deleteResponse = await fetch(`${PRODUCTION_URL}/api/customer-orders/${createdOrder.id}`, {
        method: 'DELETE',
        headers: {
          'Cookie': cookies
        }
      });

      if (deleteResponse.ok) {
        console.log('✅ Commande test supprimée');
      } else {
        console.log('ℹ️ Commande test conservée (employé n\'a pas permission de supprimer)');
      }
    } else {
      const errorText = await createOrderResponse.text();
      console.error('❌ Erreur API POST customer-orders:', errorText);
      
      // Analyser les erreurs courantes
      if (createOrderResponse.status === 403) {
        console.log('💡 Problème de permissions - vérifiez le système de permissions côté serveur');
      } else if (createOrderResponse.status === 400) {
        console.log('💡 Problème de validation - vérifiez les données envoyées');
      } else if (createOrderResponse.status === 500) {
        console.log('💡 Erreur serveur - vérifiez les logs serveur');
      }
    }

    // 6. Test des permissions spécifiques
    console.log('\n6. Test des permissions employé...');
    console.log('Permissions attendues pour customer-orders:');
    console.log('- view: ✅ (employé doit pouvoir voir)');
    console.log('- create: ✅ (employé doit pouvoir créer)');
    console.log('- edit: ❌ (employé ne doit pas pouvoir modifier)');
    console.log('- delete: ❌ (employé ne doit pas pouvoir supprimer)');

  } catch (error) {
    console.error('❌ Erreur de diagnostic:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('💡 Solution: Vérifiez que le serveur est démarré et accessible');
    } else if (error.code === 'ETIMEDOUT') {
      console.log('💡 Solution: Problème de timeout réseau');
    } else if (error.message.includes('ENOTFOUND')) {
      console.log('💡 Solution: URL du serveur incorrecte');
    }
  }
}

// Instructions d'utilisation
console.log(`
🚀 INSTRUCTIONS D'UTILISATION:

1. Configurez les variables d'environnement:
   export PRODUCTION_URL="https://votre-serveur-production.com"
   export EMPLOYEE_USERNAME="votre-employee-username"
   export EMPLOYEE_PASSWORD="votre-employee-password"

2. Exécutez le script:
   node debug-employee-customer-orders.js --run

3. Analysez les résultats pour identifier le problème
`);

if (process.argv.includes('--run')) {
  testEmployeeCustomerOrders();
}