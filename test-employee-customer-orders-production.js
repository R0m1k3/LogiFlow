#!/usr/bin/env node

/**
 * Script de test pour diagnostiquer le problème de création de commandes client 
 * avec le rôle employé en production
 */

console.log('🔍 Test de diagnostic production - Commandes client employé');

// Test local d'abord
async function testLocal() {
  const fetch = require('node-fetch');
  
  console.log('\n=== TEST LOCAL (http://localhost:5000) ===');
  
  try {
    // 1. Connexion admin locale pour référence
    console.log('1. Test admin local...');
    const adminLogin = await fetch('http://localhost:5000/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin' })
    });
    
    if (adminLogin.ok) {
      const adminCookies = adminLogin.headers.get('set-cookie');
      console.log('✅ Admin login local réussi');
      
      // Test création commande admin
      const testOrder = {
        customerName: 'Test Admin Local',
        contactNumber: '0123456789',
        productName: 'Test Produit Admin',
        productDescription: 'Description test admin',
        quantity: 1,
        groupId: 1, // Utiliser le premier groupe
        isPickup: false,
        notes: 'Test admin local'
      };
      
      const adminCreate = await fetch('http://localhost:5000/api/customer-orders', {
        method: 'POST',
        headers: {
          'Cookie': adminCookies,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testOrder)
      });
      
      console.log('Status création admin:', adminCreate.status);
      if (adminCreate.ok) {
        console.log('✅ Admin peut créer des commandes client');
      } else {
        const error = await adminCreate.text();
        console.log('❌ Admin ne peut pas créer:', error);
      }
    } else {
      console.log('❌ Admin login local échoué');
    }
    
  } catch (error) {
    console.log('❌ Erreur test local:', error.message);
  }
}

// Instructions pour test production
function showProductionInstructions() {
  console.log(`

=== INSTRUCTIONS POUR TEST PRODUCTION ===

1. Connectez-vous à votre serveur de production
2. Modifiez les valeurs ci-dessous avec vos vraies données:

   export PROD_URL="https://votre-serveur-production.com"
   export EMPLOYEE_USERNAME="votre-employee-username" 
   export EMPLOYEE_PASSWORD="votre-employee-password"
   export ADMIN_USERNAME="votre-admin-username"
   export ADMIN_PASSWORD="votre-admin-password"

3. Ensuite exécutez ce script avec:
   node test-employee-customer-orders-production.js --production

Le script va:
✓ Tester la connexion admin (pour référence)
✓ Tester la connexion employé  
✓ Comparer les réponses des deux rôles
✓ Identifier le problème exact

`);
}

// Test production (à exécuter avec les vraies données)
async function testProduction() {
  const fetch = require('node-fetch');
  
  const PROD_URL = process.env.PROD_URL || 'https://your-production-server.com';
  const EMPLOYEE_USERNAME = process.env.EMPLOYEE_USERNAME;
  const EMPLOYEE_PASSWORD = process.env.EMPLOYEE_PASSWORD;
  const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
  
  console.log('\n=== TEST PRODUCTION ===');
  console.log('URL:', PROD_URL);
  
  if (!EMPLOYEE_USERNAME || !EMPLOYEE_PASSWORD) {
    console.log('❌ Variables d\'environnement employé manquantes');
    showProductionInstructions();
    return;
  }
  
  try {
    // Test admin d'abord (pour référence)
    if (ADMIN_USERNAME && ADMIN_PASSWORD) {
      console.log('\n1. Test admin production...');
      const adminLogin = await fetch(\`\${PROD_URL}/api/login\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD })
      });
      
      if (adminLogin.ok) {
        console.log('✅ Admin login production réussi');
        const adminCookies = adminLogin.headers.get('set-cookie');
        
        // Récupérer les groupes admin
        const groupsResponse = await fetch(\`\${PROD_URL}/api/groups\`, {
          headers: { 'Cookie': adminCookies }
        });
        
        if (groupsResponse.ok) {
          const groups = await groupsResponse.json();
          console.log(\`📋 Groupes disponibles: \${groups.length}\`);
          
          if (groups.length > 0) {
            // Test création commande admin
            const testOrder = {
              customerName: 'Test Admin Production',
              contactNumber: '0123456789',
              productName: 'Test Produit Admin Prod',
              productDescription: 'Description test admin production',
              quantity: 1,
              groupId: groups[0].id,
              isPickup: false,
              notes: 'Test admin production'
            };
            
            const adminCreate = await fetch(\`\${PROD_URL}/api/customer-orders\`, {
              method: 'POST',
              headers: {
                'Cookie': adminCookies,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(testOrder)
            });
            
            console.log('Status création admin:', adminCreate.status);
            if (adminCreate.ok) {
              console.log('✅ Admin peut créer des commandes client en production');
            } else {
              const error = await adminCreate.text();
              console.log('❌ Admin ne peut pas créer:', error);
            }
          }
        }
      } else {
        console.log('❌ Admin login production échoué');
      }
    }
    
    // Test employé
    console.log('\n2. Test employé production...');
    const empLogin = await fetch(\`\${PROD_URL}/api/login\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: EMPLOYEE_USERNAME, password: EMPLOYEE_PASSWORD })
    });
    
    if (empLogin.ok) {
      console.log('✅ Employé login production réussi');
      const empCookies = empLogin.headers.get('set-cookie');
      
      // Vérifier profil employé
      const userResponse = await fetch(\`\${PROD_URL}/api/user\`, {
        headers: { 'Cookie': empCookies }
      });
      
      if (userResponse.ok) {
        const user = await userResponse.json();
        console.log('👤 Profil employé:', {
          role: user.role,
          groupsCount: user.userGroups?.length || 0
        });
        
        if (user.userGroups && user.userGroups.length > 0) {
          // Test création commande employé
          const testOrder = {
            customerName: 'Test Employé Production',
            contactNumber: '0123456789',
            productName: 'Test Produit Employé Prod',
            productDescription: 'Description test employé production',
            quantity: 1,
            groupId: user.userGroups[0].groupId,
            isPickup: false,
            notes: 'Test employé production'
          };
          
          console.log('📦 Données test employé:', testOrder);
          
          const empCreate = await fetch(\`\${PROD_URL}/api/customer-orders\`, {
            method: 'POST',
            headers: {
              'Cookie': empCookies,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(testOrder)
          });
          
          console.log('Status création employé:', empCreate.status);
          const empResponse = await empCreate.text();
          
          if (empCreate.ok) {
            console.log('✅ Employé peut créer des commandes client en production');
            console.log('📋 Commande créée:', JSON.parse(empResponse));
          } else {
            console.log('❌ Employé ne peut pas créer:');
            console.log('Response:', empResponse);
            
            // Analyser l'erreur
            try {
              const errorObj = JSON.parse(empResponse);
              console.log('💡 Erreur structurée:', errorObj);
            } catch (e) {
              console.log('💡 Erreur texte brute:', empResponse);
            }
          }
        } else {
          console.log('❌ Employé n\'est assigné à aucun groupe');
        }
      } else {
        console.log('❌ Impossible de récupérer le profil employé');
      }
    } else {
      console.log('❌ Employé login production échoué');
    }
    
  } catch (error) {
    console.log('❌ Erreur test production:', error.message);
  }
}

// Exécution
if (process.argv.includes('--production')) {
  testProduction();
} else if (process.argv.includes('--local')) {
  testLocal();
} else {
  console.log('Usage:');
  console.log('  node test-employee-customer-orders-production.js --local    # Test local');
  console.log('  node test-employee-customer-orders-production.js --production # Test production');
  console.log('');
  showProductionInstructions();
}