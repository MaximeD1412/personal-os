---
id: CMD-4
title: "Premières actions annotées pour la barre de commande"
epic: CMD
type: feature
priority: P1
size: S
milestone: M5 Tableau de bord et barre de commande
blocked_by: [CMD-3, SPORT-1, CUISINE-9]
adr: [0018, 0030]
risques: []
revue_visuelle: false
---

## Contexte

Le catalogue démarre petit et grossit sur preuve d'usage (journal des commandes non comprises). Point de départ retenu : créer un Événement, créer une Séance, ajouter un Article de courses, ouvrir le planning de la semaine.

## État actuel du code

- `@Command` (CMD-1) ; routes `POST /events`, `POST /training-sessions`, `POST /shopping-lists/:id/items`, `GET /meal-plans?week=` ; leurs formulaires préremplis par URL.

## À faire

- Annoter ces quatre opérations (intent, cinq exemples chacune, `screen`, `params`).
- Pour l'ajout d'un Article : l'action vise la liste ouverte ; le formulaire `/courses/articles/nouveau?label=…` (à créer s'il manque) choisit la liste ouverte, ou propose d'en créer une.
- Régénérer le catalogue.

## Décisions déjà prises

- « Ouvrir le planning » : `screen` = `/repas/planning`, `params` = `semaine` (optionnel, lundi de la semaine courante par défaut).

## Critères d'acceptation

- [ ] Les quatre actions sont dans le catalogue et se résolvent depuis leurs exemples (double IA programmé).

## Vérification

- `pnpm exec nx run api:command-catalog` ; `pnpm exec nx test-integration api -- command-bar` ; `pnpm exec nx affected -t lint test build --base=origin/develop`.

## Pour la prod

Rien.

## Hors périmètre

Aucun.

## Dépendances

- CMD-3, SPORT-1, CUISINE-9.
