---
id: FOYER-2
title: "Préférences alimentaires : allergie, aliment exclu, peu apprécié, sur un Allergène ou un Ingrédient"
epic: FOYER
type: feature
priority: P0
size: M
milestone: M2 Cuisine socle
blocked_by: [FOYER-1, CUISINE-1]
adr: [0014, 0030]
risques: [IA-1]
revue_visuelle: true
reprend: 77
---

## Contexte

Une **Préférence alimentaire** est rattachée à un Compte : allergie, aliment exclu, aliment peu apprécié. Elle vise un **Allergène** ou un **Ingrédient** précis. Une allergie ne se contourne jamais, une aversion peut l'être. Ces préférences alimentent la génération et son contrôle déterministe (CUISINE-16).

## État actuel du code

- `GET /household` (FOYER-1) ; `Ingredient`, `Allergen` (CUISINE-1).

## À faire

- Prisma : `FoodPreference { id, scopeId, userId, kind (ALLERGY | EXCLUDED | DISLIKED), allergen Allergen?, ingredientId String?, createdAt }`, contrainte : exactement l'un de `allergen` et `ingredientId` ; unicité `(userId, kind, allergen, ingredientId)`. Cloisonné, **Espace foyer**, posé par le module (`@Espaces('HOUSEHOLD')`, ADR 0030).
- `contracts` : `zFoodPreference`, `zFoodPreferenceInput` (union discriminée sur la cible), `zFoodPreferenceListQuery` (`userId?`).
- Routes : `GET /food-preferences?userId=`, `POST /food-preferences`, `DELETE /food-preferences/:id`. `food.preference_target_invalid` (400 via zod) ; `food.preference_duplicate` (422) ; `userId` hors Foyer → 422 `food.unknown_member`.
- Module profond `preferences/appliquer.ts` (pur) : `contraintesDuRepas(preferences, participantIds) → { interdits: { allergenes, ingredients }, evites: { allergenes, ingredients } }` (ALLERGY et EXCLUDED → interdits ; DISLIKED → évités), utilisé par CUISINE-16.
- Écran `/foyer/preferences` : une colonne par Compte, ajout par type et par cible (Allergène dans la liste fermée, ou recherche d'Ingrédient), suppression.
- Semeur de démo : une allergie (fruits à coque) et une aversion (coriandre).

## Décisions déjà prises

- Maquette : `preferences-alimentaires-1424.png`, `preferences-alimentaires-390.png` dans `design/captures/ecrans/` (frames `msw9z`, `LgbDJ` de `design/personalos.pen`). Elle donne l'apparence, ce ticket le périmètre : un élément de maquette absent du ticket n'est pas implémenté, ses textes de remplissage ne sont pas repris, et l'écran se compose avec les composants du design system (`docs/design-system.md`).
- Les deux Comptes voient et modifient les préférences des deux : ce sont des données du Foyer.
- Pas de « régime » (végétarien…) en V1 : il s'exprime par des exclusions.

## Critères d'acceptation

- [ ] Une préférence vise soit un Allergène, soit un Ingrédient, jamais les deux ni aucun.
- [ ] `contraintesDuRepas` ignore les préférences d'un Compte absent du repas.
- [ ] Socle de tests de l'ADR 0030 (module Foyer seul : pas de cas 404 cross-Espace personnel).

## Vérification

- `pnpm exec nx test api -- appliquer` ; `pnpm exec nx test-integration api -- food-preference` ; `pnpm exec nx affected -t lint test build --base=origin/develop`.
- Captures : `scripts/captures.sh /foyer/preferences`.

## Pour la prod

Rien.

## Hors périmètre

- Le contrôle des repas générés : CUISINE-16.

## Dépendances

- FOYER-1, CUISINE-1.
