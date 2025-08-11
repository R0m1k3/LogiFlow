#!/usr/bin/env node

/**
 * Script de test pour la création d'utilisateur en production
 * Usage: node test-create-user-production.js
 */

const https = require('https');
const fs = require('fs');

const config = {
  hostname: process.env.PRODUCTION_HOST || 'your-domain.com',
  port: 443,
  headers: {
    'Content-Type': 'application/json',
    'Cookie': process.env.SESSION_COOKIE || ''
  }
};

// Test data
const testUser = {
  username: `test_${Date.now()}`,
  email: `test_${Date.now()}@example.com`,
  firstName: 'Test',
  lastName: 'User',
  password: 'TestPassword123',
  role: 'employee'
};

console.log('🔍 Testing user creation in production...');
console.log('📊 Test user data:', JSON.stringify(testUser, null, 2));

const postData = JSON.stringify(testUser);

const options = {
  ...config,
  path: '/api/users',
  method: 'POST',
  headers: {
    ...config.headers,
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = https.request(options, (res) => {
  console.log(`📡 Response status: ${res.statusCode}`);
  console.log('📡 Response headers:', res.headers);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      if (res.statusCode === 200 || res.statusCode === 201) {
        console.log('✅ User created successfully!');
        console.log('👤 New user:', response);
      } else {
        console.log('❌ User creation failed');
        console.log('📄 Error response:', response);
      }
    } catch (error) {
      console.log('❌ Failed to parse response:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request error:', error);
});

req.write(postData);
req.end();

// Also test the users endpoint
setTimeout(() => {
  console.log('\n🔍 Testing users list endpoint...');
  
  const getUsersOptions = {
    ...config,
    path: '/api/users',
    method: 'GET'
  };
  
  const getUsersReq = https.request(getUsersOptions, (res) => {
    console.log(`📡 Users list status: ${res.statusCode}`);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
        const users = JSON.parse(data);
        if (Array.isArray(users)) {
          console.log(`✅ Found ${users.length} users`);
          console.log('👥 Users:', users.map(u => ({ username: u.username, role: u.role, groups: u.userGroups?.length || 0 })));
        } else {
          console.log('❌ Invalid users response:', users);
        }
      } catch (error) {
        console.log('❌ Failed to parse users response:', data);
      }
    });
  });
  
  getUsersReq.on('error', (error) => {
    console.error('❌ Users request error:', error);
  });
  
  getUsersReq.end();
}, 2000);