# Task: Corrections sélecteur d'année module publicités

## Context

L'utilisateur signale que dans le module "publicités", les années antérieures (comme 2025) ne sont plus visibles dans le sélecteur depuis le passage à 2026. Il est nécessaire de pouvoir consulter l'historique.

## Current Focus

Vérification de la correction.

## Master Plan

- [x] Localiser le code du module "publicités" et du sélecteur d'année.
- [x] Analyser la logique qui peuple le sélecteur d'années.
- [x] Modifier la logique pour inclure les années précédentes (ex: année courante - N années).
- [x] Vérifier que la correction permet d'afficher 2025 et les années antérieures si nécessaire.

## Progress Log

- Création du task.md.
- Analyse de `client/src/pages/Publicities.tsx` : la liste des années commençait à `currentYear`.
- Correction appliquée pour commencer à `currentYear - 2`.
