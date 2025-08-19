# CORRECTION PRODUCTION - MODULE TÂCHES (19 Août 2025)

## PROBLÈME IDENTIFIÉ
L'implémentation des dates de départ a causé des erreurs JavaScript en production qui empêchent le module tâches de se charger.

## CORRECTION IMMÉDIATE

### 1. Backend - Robustesse des données

Le backend doit retourner des données sécurisées :
- Filtrage des tâches nulles
- Gestion sécurisée des dates
- Validation des propriétés

### 2. Frontend - Gestion d'erreur

Le frontend doit gérer les cas d'erreur :
- Validation des données reçues
- Protection contre les propriétés undefined
- Fallback pour les erreurs de parsing de dates

### 3. Fichiers à copier en production

**Priorité CRITIQUE :** Copier ces fichiers dans l'ordre :

1. `server/storage.ts` - Méthode getTasks corrigée
2. `client/src/pages/Tasks.tsx` - Gestion d'erreur renforcée  
3. `client/src/components/tasks/NewTaskForm.tsx` - Validation des données
4. `shared/schema.ts` - Types mis à jour

## TEST DE VALIDATION

Après copie des fichiers :
1. Redémarrer le serveur Docker
2. Tester l'accès au module tâches
3. Vérifier la création d'une nouvelle tâche
4. Confirmer l'affichage correct des dates

## ROLLBACK SI PROBLÈME

Si les erreurs persistent, remplacer uniquement `client/src/components/tasks/TaskForm.tsx` par :

```typescript
// Version simplifiée sans dates de départ
export { default } from "./SimpleTaskForm";
```

Et créer un SimpleTaskForm.tsx basique sans les nouvelles fonctionnalités.