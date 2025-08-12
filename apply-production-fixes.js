#!/usr/bin/env node

/**
 * Script pour appliquer les corrections 403 employés sur votre serveur de production privé
 * Ce script documente les changements à effectuer manuellement sur votre serveur
 */

console.log('🔧 === CORRECTIONS À APPLIQUER SUR VOTRE SERVEUR DE PRODUCTION ===\n');

console.log('📝 FICHIERS À MODIFIER SUR VOTRE SERVEUR PRIVÉ:');
console.log('================================================\n');

console.log('1️⃣ FICHIER: shared/permissions.ts');
console.log('-----------------------------------');
console.log('LIGNE À MODIFIER (environ ligne 84-91):');
console.log('');
console.log('// REMPLACER:');
console.log('tasks: {');
console.log('  admin: [\'view\', \'create\', \'edit\', \'delete\', \'validate\'],');
console.log('  directeur: [\'view\', \'create\', \'edit\', \'delete\', \'validate\'],');
console.log('  manager: [\'view\', \'validate\'],');
console.log('  employee: [\'view\']  // ← PROBLÈME ICI');
console.log('}');
console.log('');
console.log('// PAR:');
console.log('tasks: {');
console.log('  admin: [\'view\', \'create\', \'edit\', \'delete\', \'validate\'],');
console.log('  directeur: [\'view\', \'create\', \'edit\', \'delete\', \'validate\'],');
console.log('  manager: [\'view\', \'validate\'],');
console.log('  employee: [\'view\']  // ← PERMISSIONS INCHANGÉES - VOIR SEULEMENT');
console.log('}');
console.log('\n');

console.log('2️⃣ FICHIER: server/routes.ts');
console.log('-----------------------------');
console.log('CORRECTIONS MULTIPLES À EFFECTUER:\n');

console.log('A) Route GET /api/suppliers (environ ligne 188-194):');
console.log('// REMPLACER:');
console.log('if (!user || (user.role !== \'admin\' && user.role !== \'manager\')) {');
console.log('  return res.status(403).json({ message: "Insufficient permissions" });');
console.log('}');
console.log('');
console.log('// PAR:');
console.log('if (!user || (user.role !== \'admin\' && user.role !== \'manager\' && user.role !== \'directeur\' && user.role !== \'employee\')) {');
console.log('  return res.status(403).json({ message: "Insufficient permissions" });');
console.log('}');
console.log('\n');

console.log('B) Route POST /api/suppliers (environ ligne 240-242):');
console.log('// REMPLACER:');
console.log('if (user.role !== \'admin\' && user.role !== \'manager\') {');
console.log('  console.error(\'❌ Insufficient permissions:\', { userRole: user.role, required: [\'admin\', \'manager\'] });');
console.log('  return res.status(403).json({ message: "Insufficient permissions" });');
console.log('}');
console.log('');
console.log('// PAR:');
console.log('if (user.role !== \'admin\' && user.role !== \'manager\' && user.role !== \'directeur\') {');
console.log('  console.error(\'❌ Insufficient permissions:\', { userRole: user.role, required: [\'admin\', \'manager\', \'directeur\'] });');
console.log('  return res.status(403).json({ message: "Insufficient permissions" });');
console.log('}');
console.log('\n');

console.log('C) Route PUT /api/suppliers/:id (environ ligne 281-283):');
console.log('// REMPLACER:');
console.log('if (!user || (user.role !== \'admin\' && user.role !== \'manager\')) {');
console.log('  return res.status(403).json({ message: "Insufficient permissions" });');
console.log('}');
console.log('');
console.log('// PAR:');
console.log('if (!user || (user.role !== \'admin\' && user.role !== \'manager\' && user.role !== \'directeur\')) {');
console.log('  return res.status(403).json({ message: "Insufficient permissions" });');
console.log('}');
console.log('\n');

console.log('D) Route DELETE /api/suppliers/:id (environ ligne 298-300):');
console.log('// REMPLACER:');
console.log('if (!user || (user.role !== \'admin\' && user.role !== \'manager\')) {');
console.log('  return res.status(403).json({ message: "Insufficient permissions" });');
console.log('}');
console.log('');
console.log('// PAR:');
console.log('if (!user || (user.role !== \'admin\' && user.role !== \'directeur\')) {');
console.log('  return res.status(403).json({ message: "Insufficient permissions" });');
console.log('}');
console.log('\n');

console.log('E) Route POST /api/dlc-products/:id/validate (environ ligne 2332-2334):');
console.log('// REMPLACER:');
console.log('if (!user || ![\'admin\', \'manager\'].includes(user.role)) {');
console.log('  return res.status(403).json({ message: "Insufficient permissions to validate products" });');
console.log('}');
console.log('');
console.log('// PAR:');
console.log('if (!user || ![\'admin\', \'manager\', \'directeur\'].includes(user.role)) {');
console.log('  return res.status(403).json({ message: "Insufficient permissions to validate products" });');
console.log('}');
console.log('\n');

console.log('📋 ÉTAPES D\'APPLICATION:');
console.log('========================');
console.log('1. Connectez-vous à votre serveur de production');
console.log('2. Sauvegardez les fichiers originaux:');
console.log('   cp shared/permissions.ts shared/permissions.ts.backup');
console.log('   cp server/routes.ts server/routes.ts.backup');
console.log('3. Ouvrez shared/permissions.ts et effectuez la correction 1️⃣');
console.log('4. Ouvrez server/routes.ts et effectuez les corrections 2️⃣A à 2️⃣E');
console.log('5. Redémarrez votre serveur Node.js');
console.log('6. Testez avec un compte employé');
console.log('\n');

console.log('🧪 COMMANDES DE TEST POST-CORRECTION:');
console.log('====================================');
console.log('# Test rapide des fournisseurs pour employé:');
console.log('curl -X GET "https://votre-serveur.com/api/suppliers" \\');
console.log('  -H "Cookie: session=TOKEN_SESSION_EMPLOYE"');
console.log('');
console.log('# Test création tâche pour employé:');
console.log('curl -X POST "https://votre-serveur.com/api/tasks" \\');
console.log('  -H "Content-Type: application/json" \\');
console.log('  -H "Cookie: session=TOKEN_SESSION_EMPLOYE" \\');
console.log('  -d \'{"title":"Test","description":"Test employé","priority":"medium","status":"pending","groupId":1}\'');
console.log('\n');

console.log('✅ RÉSULTAT ATTENDU APRÈS CORRECTIONS:');
console.log('======================================');
console.log('- Employés peuvent accéder aux fournisseurs (modules Commandes Client et DLC)');
console.log('- Employés peuvent créer des tâches dans leurs magasins assignés');
console.log('- Directeurs peuvent valider les produits DLC');
console.log('- Plus d\'erreurs 403 pour les actions autorisées');
console.log('\n');

console.log('⚠️  REMARQUES IMPORTANTES:');
console.log('==========================');
console.log('- Ces corrections doivent être appliquées sur votre serveur de production');
console.log('- Testez d\'abord sur un environnement de staging si possible');
console.log('- Gardez les sauvegardes des fichiers originaux');
console.log('- Redémarrez le serveur après les modifications');
console.log('- Surveillez les logs après les changements');
console.log('\n');

console.log('🎯 Ces corrections résolvent spécifiquement:');
console.log('- Erreurs 403 sur /api/suppliers pour employés');
console.log('- Erreurs 403 sur /api/tasks POST pour employés');
console.log('- Erreurs 403 sur /api/dlc-products/:id/validate pour directeurs');
console.log('- Permissions incohérentes entre frontend et backend');