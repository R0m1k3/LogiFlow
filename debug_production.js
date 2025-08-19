#!/usr/bin/env node

// Script de débogage pour tester les endpoints de production
import https from 'https';

const BASE_URL = 'https://logiflow.ffnancy.fr';

async function makeRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const requestOptions = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Debug-Script/1.0',
        ...options.headers
      }
    };

    const req = https.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: data,
          length: data.length
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

async function debugProduction() {
  console.log('🔍 Testing production endpoints...\n');
  
  try {
    // Test 1: Health check
    console.log('1. Health check:');
    const health = await makeRequest('/api/health');
    console.log(`   Status: ${health.status}`);
    console.log(`   Response: ${health.data.substring(0, 100)}...\n`);

    // Test 2: Default credentials check
    console.log('2. Default credentials check:');
    const defaultCreds = await makeRequest('/api/default-credentials-check');
    console.log(`   Status: ${defaultCreds.status}`);
    console.log(`   Response: ${defaultCreds.data}\n`);

    // Test 3: Login attempts with different credentials
    const credentialsList = [
      { username: 'admin', password: 'admin' },
      { username: 'administrator', password: 'administrator' },
      { username: 'lff', password: 'lff2024' },
      { username: 'logiflow', password: 'logiflow' },
      { username: 'root', password: 'root' }
    ];
    
    let login = null;
    let cookies = '';
    
    for (const creds of credentialsList) {
      console.log(`3. Login attempt with ${creds.username}:${creds.password}:`);
      login = await makeRequest('/api/login', {
        method: 'POST',
        body: JSON.stringify(creds)
      });
      console.log(`   Status: ${login.status}`);
      console.log(`   Response: ${login.data.substring(0, 200)}...\n`);
      
      if (login.status === 200 && login.headers['set-cookie']) {
        cookies = login.headers['set-cookie'].map(c => c.split(';')[0]).join('; ');
        console.log(`✅ Successful login with ${creds.username}\n`);
        break;
      }
    }
    
    // Cookies already extracted above if login was successful

    // Test 4: User info (with cookies)
    if (cookies) {
      console.log('4. User info (authenticated):');
      const user = await makeRequest('/api/user', {
        headers: { 'Cookie': cookies }
      });
      console.log(`   Status: ${user.status}`);
      console.log(`   Response: ${user.data.substring(0, 200)}...\n`);

      // Test 5: Tasks (with cookies)
      console.log('5. Tasks list (authenticated):');
      const tasks = await makeRequest('/api/tasks', {
        headers: { 'Cookie': cookies }
      });
      console.log(`   Status: ${tasks.status}`);
      console.log(`   Response: ${tasks.data.substring(0, 300)}...\n`);

      // Test 6: Test task update (with cookies) - testing the problematic endpoint
      console.log('6. Task update test (problematic endpoint):');
      const taskUpdate = await makeRequest('/api/tasks/99', {
        method: 'PUT',
        headers: { 'Cookie': cookies },
        body: JSON.stringify({
          title: 'Test Debug',
          description: 'Test de debug',
          priority: 'medium',
          status: 'pending',
          assignedTo: 'admin',
          startDate: '2025-08-20',
          dueDate: null
        })
      });
      console.log(`   Status: ${taskUpdate.status}`);
      console.log(`   Response: ${taskUpdate.data}\n`);
    } else {
      console.log('❌ No cookies received from login - cannot test authenticated endpoints\n');
    }

  } catch (error) {
    console.error('❌ Error during debug:', error.message);
  }
}

debugProduction();