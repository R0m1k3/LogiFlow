#!/usr/bin/env node

/**
 * Script de correction finale des erreurs 403 pour les employés
 * Applique les corrections nécessaires au serveur de production
 */

console.log('🔧 SCRIPT DE CORRECTION DES ERREURS 403 EMPLOYÉS');
console.log('================================================');
console.log('');

console.log('✅ CORRECTIONS APPLIQUÉES DANS REPLIT:');
console.log('');

console.log('1️⃣ client/src/pages/Tasks.tsx - Ligne ~84:');
console.log('   AVANT: enabled: !!user,');
console.log('   APRÈS: enabled: !!user && (user.role === "admin" || user.role === "manager" || user.role === "directeur"),');
console.log('   ➜ Évite l\'appel à /api/users pour les employés');
console.log('');

console.log('2️⃣ Boutons d\'action conditionnels pour les employés');
console.log('   ➜ Les employés ne voient plus les boutons modifier/supprimer des tâches');
console.log('');

console.log('📋 CORRECTIONS À APPLIQUER SUR VOTRE SERVEUR PRIVÉ:');
console.log('');

console.log('💡 SOLUTION SIMPLE - 2 FICHIERS À MODIFIER:');
console.log('');

console.log('🔸 A) client/src/pages/Tasks.tsx (environ ligne 84):');
console.log('');
console.log('// REMPLACER:');
console.log('const { data: users = [] } = useQuery({');
console.log('  queryKey: ["/api/users"],');
console.log('  queryFn: () => fetch(\'/api/users\', {');
console.log('    credentials: \'include\'');
console.log('  }).then(res => {');
console.log('    if (!res.ok) {');
console.log('      throw new Error(`HTTP error! status: ${res.status}`);');
console.log('    }');
console.log('    return res.json();');
console.log('  }),');
console.log('  enabled: !!user,  // ← LIGNE À CHANGER');
console.log('});');
console.log('');
console.log('// PAR:');
console.log('const { data: users = [] } = useQuery({');
console.log('  queryKey: ["/api/users"],');
console.log('  queryFn: () => fetch(\'/api/users\', {');
console.log('    credentials: \'include\'');
console.log('  }).then(res => {');
console.log('    if (!res.ok) {');
console.log('      throw new Error(`HTTP error! status: ${res.status}`);');
console.log('    }');
console.log('    return res.json();');
console.log('  }),');
console.log('  enabled: !!user && (user.role === \'admin\' || user.role === \'manager\' || user.role === \'directeur\'),');
console.log('});');
console.log('');

console.log('🔸 B) server/routes.ts - 5 corrections de permissions fournisseurs:');
console.log('');

console.log('B.1) Route GET /api/suppliers (environ ligne 188-194):');
console.log('// REMPLACER:');
console.log('if (!user || (user.role !== \'admin\' && user.role !== \'manager\')) {');
console.log('// PAR:');
console.log('if (!user || (user.role !== \'admin\' && user.role !== \'manager\' && user.role !== \'directeur\' && user.role !== \'employee\')) {');
console.log('');

console.log('B.2) Route POST /api/suppliers (environ ligne 240-242):');
console.log('// REMPLACER:');
console.log('if (user.role !== \'admin\' && user.role !== \'manager\') {');
console.log('// PAR:');
console.log('if (user.role !== \'admin\' && user.role !== \'manager\' && user.role !== \'directeur\') {');
console.log('');

console.log('B.3) Route PUT /api/suppliers/:id (environ ligne 281-283):');
console.log('// REMPLACER:');
console.log('if (!user || (user.role !== \'admin\' && user.role !== \'manager\')) {');
console.log('// PAR:');
console.log('if (!user || (user.role !== \'admin\' && user.role !== \'manager\' && user.role !== \'directeur\')) {');
console.log('');

console.log('B.4) Route DELETE /api/suppliers/:id (environ ligne 298-300):');
console.log('// REMPLACER:');
console.log('if (!user || (user.role !== \'admin\' && user.role !== \'manager\')) {');
console.log('// PAR:');
console.log('if (!user || (user.role !== \'admin\' && user.role !== \'directeur\')) {');
console.log('');

console.log('B.5) Route POST /api/dlc-products/:id/validate (environ ligne 2332-2334):');
console.log('// REMPLACER:');
console.log('if (!user || ![\'admin\', \'manager\'].includes(user.role)) {');
console.log('// PAR:');
console.log('if (!user || ![\'admin\', \'manager\', \'directeur\'].includes(user.role)) {');
console.log('');

console.log('⚡ ÉTAPES D\'APPLICATION:');
console.log('1. Sauvegarde: cp client/src/pages/Tasks.tsx client/src/pages/Tasks.tsx.backup');
console.log('2. Sauvegarde: cp server/routes.ts server/routes.ts.backup');
console.log('3. Effectuer les corrections A) et B) ci-dessus');
console.log('4. Redémarrer votre serveur Node.js');
console.log('5. Tester avec un compte employé');
console.log('');

console.log('✅ RÉSULTAT ATTENDU:');
console.log('- Plus d\'erreurs 403 dans la console pour les employés');
console.log('- Employés peuvent voir les tâches (mais pas les créer/modifier)');
console.log('- Employés peuvent voir les fournisseurs (pour Commandes Client et DLC)');
console.log('- Directeurs peuvent valider les produits DLC');
console.log('');

console.log('🚨 IMPORTANT:');
console.log('Les permissions dans shared/permissions.ts restent inchangées:');
console.log('tasks: { employee: [\'view\'] } // ← Correct, ne pas modifier');