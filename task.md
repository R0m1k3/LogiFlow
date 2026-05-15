# Task: Debugging Webhook Error 500 on Invoice Sending

## Context

L'utilisateur a redémarré son serveur et rencontre une erreur 500 lors de l'envoi d'une facture via le proxy `/api/reconciliation/send-invoice`. L'appel vers le webhook N8N (`https://workflow.ffnancy.fr/webhook/...`) échoue avec un code 500.

## Current Focus

Identifier la cause de l'erreur 500 lors de l'appel au webhook N8N et corriger le comportement du proxy de facture.

## Master Plan

- [x] **Analyse du code source**
  - [x] Examiner `server/routes.ts` pour trouver l'endpoint `/api/reconciliation/send-invoice`.
  - [x] Analyser la construction de la requête vers N8N (utilisation de `FormData` natif vs bibliothèque `form-data`).
- [x] **Investigation technique**
  - [x] Vérifier la version de Node.js (v24.11.1 détectée).
  - [x] Identifier pourquoi N8N renvoie 500 (problème de format multipart et de headers avec l'ancienne bibliothèque).
  - [x] Prendre en compte l'URL de test fournie : `https://workflow.ffnancy.fr/webhook-test/...`.
- [x] **Correction et Test**
  - [x] Remplacer l'implémentation personnalisée par une utilisation plus propre des APIs natives Node.js.
  - [x] Améliorer le parsing du boundary pour gérer les guillemets.
  - [x] Utiliser les APIs natives `fetch` et `FormData` de Node.js pour plus de robustesse.
  - [/] Demander à l'utilisateur de tester après avoir reconstruit son image Docker (`docker compose build`).
  - [ ] Analyser la réponse détaillée du webhook si l'erreur persiste.

## Progress Log

- Initialisation de la tâche pour déboguer l'erreur 500 sur l'envoi de facture.
- Analyse du code : le proxy utilisait une ancienne bibliothèque `form-data` manuellement importée via `require`, ce qui peut causer des problèmes de compatibilité en Node 24.
- Correction appliquée : passage aux APIs natives `fetch` et `FormData` de Node.js et amélioration du parsing du boundary.
