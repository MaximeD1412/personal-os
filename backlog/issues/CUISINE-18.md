---
id: CUISINE-18
title: "Souhaits : déposer des envies ou des Recettes avant la génération d'une semaine"
epic: CUISINE
type: feature
priority: P0
size: S
milestone: M3 Cuisine boucle
blocked_by: [CUISINE-7]
adr: [0030]
risques: []
revue_visuelle: true
---

## Contexte

Un **Souhait** est une Recette ou une envie déposée avant la génération, que le planning de la semaine visée doit honorer. C'est une contrainte d'entrée, pas une proposition de l'IA.

## État actuel du code

- `MealPlan` (CUISINE-7), `Recipe` (CUISINE-5).

## À faire

- Prisma : `MealWish { id, scopeId, week Date, recipeId String?, text String?, authorId, createdAt }`, contrainte : recette ou texte.
- Routes : `GET /meal-wishes?week=`, `POST /meal-wishes`, `DELETE /meal-wishes/:id`.
- Écran : panneau « Souhaits de la semaine » sur `/repas/planning?semaine=…` (ajout d'une recette ou d'un texte libre, suppression).

## Décisions déjà prises

- Un Souhait honoré n'est pas supprimé : il reste lié à sa semaine.

## Critères d'acceptation

- [ ] Un Souhait se dépose et se retire pour une semaine donnée.
- [ ] Socle de tests de l'ADR 0030.

## Vérification

- `pnpm exec nx test-integration api -- meal-wish` ; `pnpm exec nx affected -t lint test build --base=origin/develop`.
- Captures : `scripts/captures.sh '/repas/planning?semaine=<lundi suivant>'`.

## Pour la prod

Rien.

## Hors périmètre

- Leur prise en compte par la génération : CUISINE-16.

## Dépendances

- CUISINE-7.
