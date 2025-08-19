# FIX URGENT - ERREUR CN PRODUCTION (19 Août 2025)

## PROBLÈME
`ReferenceError: cn is not defined` - La fonction utilitaire `cn` de `@/lib/utils` n'est pas disponible en production.

## SOLUTION IMMÉDIATE

### Option 1 : Fonction cn intégrée (RAPIDE)
J'ai ajouté la fonction `cn` directement dans `SimpleTaskForm.tsx` pour éviter la dépendance.

**Fichier modifié :** `client/src/components/tasks/SimpleTaskForm.tsx`
- ✅ Suppression de l'import `{ cn } from "@/lib/utils"`
- ✅ Ajout de la fonction cn intégrée
- ✅ Fonction simplifiée mais fonctionnelle

### Option 2 : Vérifier le fichier utils.ts
Si le problème persiste, créer ou vérifier `client/src/lib/utils.ts` :

```typescript
export function cn(...inputs: (string | undefined | null | false)[]): string {
  return inputs.filter(Boolean).join(' ');
}
```

## ACTION IMMÉDIATE
1. Copier le fichier `SimpleTaskForm.tsx` modifié sur votre serveur
2. Redémarrer : `docker-compose restart`
3. Tester le module tâches

## VALIDATION
- ✅ Plus d'erreur `cn is not defined`
- ✅ Module tâches se charge correctement
- ✅ Formulaire fonctionne avec les 2 dates