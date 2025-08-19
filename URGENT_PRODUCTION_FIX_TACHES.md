# FIX URGENT PRODUCTION - MODULE TÂCHES (19 Août 2025)

## PROBLÈME
Le module tâches ne se charge pas en production à cause des nouvelles fonctionnalités de dates de départ.

## SOLUTION IMMÉDIATE - ROLLBACK TEMPORAIRE

### Étape 1 : Modifier TaskForm.tsx
Remplacer le contenu du fichier `client/src/components/tasks/TaskForm.tsx` par :

```typescript
// Rollback temporaire - utilise la version simple sans dates de départ
export { default } from "./SimpleTaskForm";
```

### Étape 2 : Créer SimpleTaskForm.tsx  
Copier le fichier `client/src/components/tasks/SimpleTaskForm.tsx` sur votre serveur.

### Étape 3 : Redémarrer
```bash
docker-compose restart
```

## CE QUE FAIT CE FIX
- Supprime temporairement les dates de départ problématiques
- Garde toutes les autres fonctionnalités (création, modification, suppression)
- Permet au module de fonctionner immédiatement

## ALTERNATIVE - Correction backend si vous préférez garder les dates
Si vous voulez garder les dates de départ, corrigez le backend :

1. Dans `server/storage.ts`, remplacer la méthode `getTasks` (lignes ~1587-1669)
2. Dans `client/src/pages/Tasks.tsx`, ajouter la gestion d'erreur robuste
3. Redémarrer le serveur

## VALIDATION
Après le fix :
- ✅ Le module tâches se charge
- ✅ Création de tâches fonctionne
- ✅ Liste des tâches s'affiche
- ⚠️ Dates de départ temporairement désactivées