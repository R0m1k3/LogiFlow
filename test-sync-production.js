// Script pour tester la synchronisation directement en production
const https = require('https');

const data = JSON.stringify({});

const options = {
  hostname: 'logiflow-logiflow-1.c-2.us-east-2.aws.neon.tech',
  port: 443,
  path: '/api/sync-order-delivery-status',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
    // Vous devez remplacer par votre cookie de session réel
    'Cookie': 'connect.sid=VOTRE_SESSION_COOKIE_ICI'
  }
};

console.log('🔄 Testing production sync API...');

const req = https.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log(`Headers:`, res.headers);

  let responseData = '';
  res.on('data', (chunk) => {
    responseData += chunk;
  });

  res.on('end', () => {
    console.log('Response:', responseData);
    try {
      const parsed = JSON.parse(responseData);
      console.log('✅ Sync result:', JSON.stringify(parsed, null, 2));
    } catch (e) {
      console.log('Raw response:', responseData);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Error:', error);
});

req.write(data);
req.end();