# INSTRUCTIONS FINALES - CALENDRIER PRODUCTION

## PROBLÈME IDENTIFIÉ
Votre serveur de production utilise une version différente de CalendarGrid.tsx qui limite encore l'affichage à 2 éléments.

## SOLUTION DÉFINITIVE

### 1. Fichier de remplacement créé
Le fichier `CalendarGrid.PRODUCTION.tsx` contient la version finale optimisée pour votre production avec :

- ✅ **MAX_VISIBLE_ITEMS = 4** (fixé et forcé)
- ✅ **Bouton "+X autres" en blanc/gris** (fini l'orange)
- ✅ **Hauteur cellules = h-36** (plus d'espace)
- ✅ **Styles inline forcés** pour éviter les conflits CSS
- ✅ **Modal Dialog** pour voir tous les éléments

### 2. Étapes de déploiement sur votre serveur

1. **Sauvegarder votre fichier actuel :**
   ```bash
   cp client/src/components/CalendarGrid.tsx client/src/components/CalendarGrid.tsx.backup
   ```

2. **Remplacer par la nouvelle version :**
   ```bash
   cp CalendarGrid.PRODUCTION.tsx client/src/components/CalendarGrid.tsx
   ```

3. **Redémarrer votre application :**
   ```bash
   npm run build
   pm2 restart all
   # ou votre méthode de redémarrage
   ```

4. **Vider le cache navigateur :** Ctrl+F5

### 3. Vérifications post-déploiement

- [ ] Maximum 4 éléments visibles par jour
- [ ] Bouton "+X autres" blanc/gris visible
- [ ] Modal s'ouvre en cliquant sur "+X autres"
- [ ] Toutes les commandes/livraisons affichées dans le modal
- [ ] Pas de problèmes d'affichage ou de CSS

### 4. En cas de problème

Si ça ne fonctionne toujours pas :
1. Vérifiez que le bon fichier a été copié
2. Vérifiez les logs de votre serveur
3. Essayez un redémarrage complet
4. Contactez-moi avec les logs d'erreur

---
**IMPORTANT :** Ce fichier CalendarGrid.PRODUCTION.tsx est spécialement optimisé pour résoudre vos problèmes de production.