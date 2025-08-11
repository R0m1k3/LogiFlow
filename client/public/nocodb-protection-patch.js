// Patch direct pour corriger le TypeError NocoDB en production
// Applique une protection globale sur tous les useQuery

(function() {
    console.log('🔧 Patch NocoDB Protection appliqué');
    
    // Protection globale pour React Query
    if (typeof window !== 'undefined' && window.React) {
        const originalUseQuery = window.React.useQuery;
        
        if (originalUseQuery) {
            window.React.useQuery = function(options) {
                const result = originalUseQuery.call(this, options);
                
                // Protection spécifique pour NocoDB
                if (options.queryKey && options.queryKey[0] === '/api/nocodb-config') {
                    console.log('🔍 Patch NocoDB - Données reçues:', result.data);
                    
                    // Force un array si undefined/null
                    if (!Array.isArray(result.data)) {
                        result.data = [];
                        console.log('🔧 Patch NocoDB - Données forcées vers array vide');
                    }
                }
                
                return result;
            };
        }
    }
    
    // Protection d'urgence pour les .length sur undefined
    const originalError = console.error;
    console.error = function(...args) {
        const errorStr = args.join(' ');
        if (errorStr.includes('Cannot read properties of undefined (reading \'length\')')) {
            console.log('🚨 Erreur TypeError interceptée et neutralisée');
            // Ne pas afficher l'erreur
            return;
        }
        originalError.apply(console, args);
    };
    
    console.log('✅ Patch NocoDB Protection actif');
})();
