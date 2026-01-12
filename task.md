# Task: Correction blocage API Publicités

## Context

L'utilisateur rencontre une erreur `net::ERR_BLOCKED_BY_CLIENT` lors de l'appel à l'API `/api/publicities`. Cette erreur est typique des bloqueurs de publicité (AdBlock, uBlock) qui filtrent les requêtes contenant des mots-clés comme "publicity" ou "ads".

## Current Focus

Renommer les endpoints API pour éviter le blocage par les bloqueurs de publicité.

## Master Plan

- [x] **Remplacement des API calls (Client-side)**
  - [x] `client/src/pages/Calendar.tsx`
  - [x] `client/src/pages/Dashboard.tsx`
  - [x] `client/src/components/PublicityForm.tsx`
  - [x] `client/src/pages/Publicities.tsx`
  - [x] `client/src/pages/mobile/PublicitiesPage.tsx`

- [x] **Revue du sélecteur d'année Mobile**
  - [x] Vérifier la logique de génération des années dans `client/src/pages/mobile/PublicitiesPage.tsx` pour inclure les années passées (ex: 2024 en 2026).
  - [x] Aligner avec la correction desktop si nécessaire.

- [x] **Correction des erreurs Lint TypeScript**
  - [x] Installer les paquets `@types` manquants (`node`, `express`, `react`, etc.).
  - [x] Fixer les paramètres `req` et `res` (implicitement `any`) dans `server/routes.ts`.
  - [x] Corriger l'erreur de propriété `invoiceAmountTTC` dans `server/routes.ts`.
  - [x] Résoudre `Property 'env' does not exist on type 'ImportMeta'`.
  - [x] Résoudre `JSX element implicitly has type 'any'`.

- [x] **Tests et Validation**
  - [x] Vérifier que les appels API utilisent bien `/api/ad-campaigns`.
  - [x] Tester le sélecteur d'année sur mobile.
  - [x] Compiler le projet (`npm run check`) pour s'assurer que les erreurs critiques sont résolues.

## Progress Log

- Création de la tâche suite aux logs fournis.
