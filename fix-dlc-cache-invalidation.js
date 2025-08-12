#!/usr/bin/env node

// Fix pour invalidation cache DLC - Test avec curl direct

const testDlcEndpoint = async () => {
  const { execSync } = require('child_process');
  
  console.log('🔍 Test Direct API DLC Products');
  
  try {
    // 1. Login admin
    console.log('1. Login admin...');
    const loginResult = execSync(`curl -X POST http://localhost:5000/api/login \
      -H "Content-Type: application/json" \
      -d '{"username":"admin","password":"admin"}' \
      -c cookies.txt \
      -w "%{http_code}" \
      -s`, { encoding: 'utf8' });
    
    console.log('Login status:', loginResult.slice(-3));
    
    // 2. Test GET DLC products
    console.log('2. GET DLC products...');
    const dlcResult = execSync(`curl -X GET http://localhost:5000/api/dlc-products \
      -b cookies.txt \
      -w "%{http_code}" \
      -s`, { encoding: 'utf8' });
    
    const statusCode = dlcResult.slice(-3);
    const responseBody = dlcResult.slice(0, -3);
    
    console.log('Status:', statusCode);
    
    if (statusCode === '200') {
      const dlcs = JSON.parse(responseBody);
      console.log('✅ Total DLC:', dlcs.length);
      
      if (dlcs.length > 0) {
        console.log('📋 Sample DLC:', {
          id: dlcs[0].id,
          productName: dlcs[0].productName,
          groupId: dlcs[0].groupId,
          status: dlcs[0].status
        });
        
        // Grouper par groupId
        const byGroup = dlcs.reduce((acc, dlc) => {
          acc[dlc.groupId] = (acc[dlc.groupId] || 0) + 1;
          return acc;
        }, {});
        
        console.log('📊 DLC par groupe:', byGroup);
      }
    } else {
      console.log('❌ Erreur:', responseBody);
    }
    
    console.log('\n3. Instructions debug frontend:');
    console.log('- Ouvrir DevTools Network');
    console.log('- Recharger page DLC Products');
    console.log('- Vérifier si requête API est envoyée');
    console.log('- Vérifier la réponse de l\'API');
    console.log('- Vérifier React Query cache dans Components');
    
  } catch (error) {
    console.log('❌ Erreur:', error.message);
  }
};

testDlcEndpoint();