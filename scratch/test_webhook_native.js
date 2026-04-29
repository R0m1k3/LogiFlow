const webhookUrl = 'https://workflow.ffnancy.fr/webhook-test/acf9cbf7-040a-4cf5-a43d-80210420d30a';

async function testWebhook() {
  console.log('🚀 Testing webhook (Native Fetch/FormData):', webhookUrl);
  
  const formData = new FormData();
  const fileBlob = new Blob(['test content'], { type: 'text/plain' });
  formData.append('file', fileBlob, 'test.txt');
  formData.append('supplier', 'Test Supplier');
  formData.append('blNumber', '12345');
  formData.append('type', 'Facture');

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      body: formData
    });

    console.log('📡 Response status:', response.status);
    const text = await response.text();
    console.log('📄 Response body:', text);
  } catch (error) {
    console.error('❌ Error calling webhook:', error);
  }
}

testWebhook();
