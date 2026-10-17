---
id: CUISINE-11
title: "Repas cuisiné : déclarer les quantités réellement utilisées, le stock baisse"
epic: CUISINE
type: feature
priority: P1
size: S
milestone: M2 Cuisine socle
blocked_by: [CUISINE-7, CUISINE-8]
adr: [0013, 0030]
risques: [CUI-1]
revue_visuelle: true
---

## Contexte

Un **Repas cuisiné** est un Repas planifié déclaré réalisé, avec les quantités **réellement** utilisées. C'est la seule chose qui fait baisser le stock par consommation.

## État actuel du code

- `MealPlanEntry` (CUISINE-7), `Recipe` (CUISINE-5), `recaler`, `convertir`.

## À faire

- Prisma : `CookedMeal { id, scopeId, mealPlanEntryId (unique), cookedAt, lines: { ingredientId, quantity, unit }[] }` (lignes en table `CookedMealLine` avec `scopeId`).
- Route `POST /cooked-meals` : `{ mealPlanEntryId, lines }` ; chaque ligne convertie puis `recaler(CONSOMMATION)` ; le manque éventuel est renvoyé dans la réponse (`shortfalls`), jamais bloquant. Repas déjà cuisiné → 422 `food.meal_already_cooked`. Repas sans recette : lignes libres permises.
- Écran : « Cuisiné » sur un repas du planning ouvre `/repas/cuisine/nouveau?mealPlanEntryId=…`, prérempli des quantités de la recette ajustées aux portions, modifiables ; le manque s'affiche après enregistrement (« Le stock n'avait que 200 g de farine. »).

## Décisions déjà prises

- Un Repas cuisiné ne se modifie pas ; une erreur se corrige dans l'écran de stock.

## Critères d'acceptation

- [ ] Le stock baisse des quantités déclarées, pas de celles de la recette.
- [ ] Un manque est signalé sans quantité négative.
- [ ] Socle de tests de l'ADR 0030.

## Vérification

- `pnpm exec nx test-integration api -- cooked-meal` ; `pnpm exec nx affected -t lint test build --base=origin/develop`.
- Captures : `scripts/captures.sh '/repas/cuisine/nouveau?mealPlanEntryId=<id de démo>'`.

## Pour la prod

Rien.

## Hors périmètre

Aucun.

## Dépendances

- CUISINE-7, CUISINE-8.
