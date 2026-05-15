import fetch from 'node-fetch';
import FormData from 'form-data';

const webhookUrl = 'https://workflow.ffnancy.fr/webhook-test/acf9cbf7-040a-4cf5-a43d-80210420d30a';

async function testWebhook() {
  console.log('🚀 Testing webhook:', webhookUrl);
  
  const formData = new FormData();
  formData.append('file', Buffer.from('test content'), {
    filename: 'test.txt',
    contentType: 'text/plain'
  });
  formData.append('supplier', 'Test Supplier');
  formData.append('blNumber', '12345');
  formData.append('type', 'Facture');

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      body: formData,
      headers: formData.getHeaders()
    });

    console.log('📡 Response status:', response.status);
    const text = await response.text();
    console.log('📄 Response body:', text);
  } catch (error) {
    console.error('❌ Error calling webhook:', error);
  }
}

testWebhook();
