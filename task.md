# Task: Redirection authentification si déconnecté

## Context

L'utilisateur signale que lorsqu'il est déconnecté et navigue ou se trouve sur une page, il n'est pas systématiquement renvoyé vers la page d'authentification. Il souhaite une redirection immédiate.

## Current Focus

Vérification terminée.

## Master Plan

- [x] Analyser le fichier principal de routing (ex: `App.tsx` ou `main.tsx`).
- [x] Examiner le hook d'authentification `useAuthUnified` et les composants de protection de route (ex: `ProtectedRoute`).
- [x] Identifier pourquoi la redirection ne se fait pas ou pas correctement.
- [x] Implémenter/Corriger la logique de redirection vers `/auth` (ou la page de login).
- [x] Vérifier le comportement.

## Progress Log

- Création de la tâche.
- Analyse de `App.tsx` et `useAuthUnified.ts`.
- Identification que `RouterProduction.tsx` renvoyait `NotFound` au lieu de rediriger.
- Modification de `RouterProduction.tsx` pour rediriger vers `/auth` toutes les routes inconnues si non authentifié.
- Correction d'une erreur de remplacement de code en réécrivant le fichier complet.
