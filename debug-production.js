#!/usr/bin/env node

// Script de diagnostic pour la production LogiFlow
// Usage: node debug-production.js [URL_BASE]

const url = process.argv[2] || 'https://logiflow.ffnancy.fr';

const runDiagnostics = async () => {
  console.log(`🔍 Diagnostic de production pour ${url}\n`);
  
  const endpoints = [
    { path: '/api/health', desc: 'Health Check' },
    { path: '/api/user', desc: 'API User (attendu: 401)' },
    { path: '/api/default-credentials-check', desc: 'Credentials Check' },
    { path: '/', desc: 'Page principale' },
    { path: '/sav', desc: 'Page SAV' }
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`📡 Test ${endpoint.desc}: ${url}${endpoint.path}`);
      
      const response = await fetch(`${url}${endpoint.path}`, {
        method: 'GET',
        headers: {
          'User-Agent': 'LogiFlow-Debug/1.0'
        }
      });
      
      console.log(`   Status: ${response.status} ${response.statusText}`);
      
      if (endpoint.path === '/api/health' && response.ok) {
        const data = await response.json();
        console.log(`   Détails:`, data);
      }
      
      if (response.status === 502) {
        console.log(`   ❌ Erreur 502: Service indisponible ou problème de proxy`);
      } else if (response.ok || response.status === 401) {
        console.log(`   ✅ Service répond correctement`);
      } else {
        console.log(`   ⚠️  Status inattendu`);
      }
      
    } catch (error) {
      console.log(`   ❌ Erreur de connexion: ${error.message}`);
    }
    
    console.log('');
  }
  
  console.log('🔧 Actions recommandées:');
  console.log('1. Vérifier les logs Docker: docker-compose logs logiflow');
  console.log('2. Vérifier le status: docker-compose ps');
  console.log('3. Redémarrer si nécessaire: docker-compose restart logiflow');
  console.log('4. Forcer rebuild: docker-compose up --build -d');
};

runDiagnostics().catch(console.error);