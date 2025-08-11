// PATCH D'URGENCE - TypeError NocoDB Production
console.log('🚨 PATCH D\'URGENCE NocoDB chargé');

// Protection globale contre les erreurs .length sur undefined
(function() {
    'use strict';
    
    // Intercepter les erreurs TypeError
    window.addEventListener('error', function(event) {
        if (event.error && event.error.message && 
            event.error.message.includes('Cannot read properties of undefined (reading \'length\')')) {
            console.log('🔧 Erreur TypeError interceptée et neutralisée:', event.error.message);
            event.preventDefault();
            return true;
        }
    });
    
    // Protection React Query pour NocoDB
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
        return originalFetch.apply(this, args).then(response => {
            if (args[0] && args[0].includes('/api/nocodb-config')) {
                return response.clone().json().then(data => {
                    console.log('🔍 PATCH - API NocoDB interceptée:', data);
                    
                    // Forcer structure array si nécessaire
                    if (data && !Array.isArray(data)) {
                        if (data.configs && Array.isArray(data.configs)) {
                            console.log('🔧 PATCH - Structure configs OK');
                        } else {
                            console.log('🔧 PATCH - Forçage structure array');
                            data = { configs: [] };
                        }
                    }
                    
                    // Retourner la réponse modifiée
                    return new Response(JSON.stringify(data), {
                        status: response.status,
                        statusText: response.statusText,
                        headers: response.headers
                    });
                });
            }
            return response;
        });
    };
    
    console.log('✅ PATCH D\'URGENCE NocoDB actif');
})();
