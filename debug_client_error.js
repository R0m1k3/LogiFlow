// 🔍 DEBUG CLIENT-SIDE ERRORS
// Ajoutez ce script dans la console de votre navigateur pour capturer les erreurs

console.log('🔍 DEBUG AVOIRS - Initialisation...');

// Intercepter les erreurs React
window.addEventListener('error', (event) => {
  console.error('🚨 ERREUR JAVASCRIPT:', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error
  });
});

// Intercepter les erreurs de Promise non gérées
window.addEventListener('unhandledrejection', (event) => {
  console.error('🚨 ERREUR PROMISE:', {
    reason: event.reason,
    promise: event.promise
  });
});

// Tester l'accès direct à l'API
fetch('/api/avoirs', { credentials: 'include' })
  .then(response => response.json())
  .then(data => {
    console.log('✅ API TEST SUCCESS:', data);
    console.log('📊 Nombre d\'avoirs:', data.length);
    if (data.length > 0) {
      console.log('📋 Premier avoir:', data[0]);
      console.log('🔍 Structure:', {
        hasInvoiceReference: data[0].invoiceReference !== undefined,
        hasAmount: data[0].amount !== undefined,
        invoiceRefType: typeof data[0].invoiceReference,
        amountType: typeof data[0].amount
      });
    }
  })
  .catch(error => {
    console.error('❌ API TEST ERROR:', error);
  });

console.log('🔍 DEBUG initialisé - surveillez les erreurs ci-dessus');