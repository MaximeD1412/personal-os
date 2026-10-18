---
id: CUISINE-5
title: "Recettes : modèle, API, liste et détail"
epic: CUISINE
type: feature
priority: P0
size: M
milestone: M2 Cuisine socle
blocked_by: [CUISINE-3, SOCLE-6]
adr: [0030, 0028]
risques: [SEC-1]
revue_visuelle: true
reprend: 13
---

## Contexte

Une **Recette** est une préparation réutilisable : des Ingrédients en quantités, des étapes, un nombre de portions de référence. Elle ne connaît que des Ingrédients, jamais des Produits. Elle vit dans l'**Espace foyer**, posé par le module.

## État actuel du code

- `Ingredient`, convertisseur (CUISINE-2), résolveur (CUISINE-3), garde des écritures imbriquées (SOCLE-6).

## À faire

- Prisma : `Recipe { id, scopeId, title, servings Int (≥ 1), steps String[], source (MANUAL | GENERATED), createdAt, updatedAt }` ; `RecipeLine { id, scopeId, recipeId, ingredientId, quantity Decimal (> 0), unit RecipeUnit, position Int }`.
- `contracts` : `zRecipe` (avec ses lignes et le `displayName` de chaque Ingrédient), `zRecipeInput` (lignes par `ingredientId` : les libellés libres sont résolus avant, par CUISINE-6), `zRecipeUpdate` (remplace les lignes en entier quand elles sont fournies), `zRecipeListQuery` (`q?`).
- Routes : `GET /recipes?q=`, `GET /recipes/:id`, `POST /recipes`, `PATCH /recipes/:id`, `DELETE /recipes/:id` (`food.recipe_in_use` en 422 si un Repas planifié futur l'utilise).
- Écrans : `/repas/recettes` (liste, recherche), `/repas/recettes/:id` (détail : ingrédients et quantités pour les portions de référence, étapes).
- Semeur de démo : six recettes courantes en ingrédients du catalogue de démo.

## Décisions déjà prises

- Maquette : `recettes-ingredients-1424.png`, `recettes-ingredients-390.png` dans `design/captures/ecrans/` (frames `G2E7s`, `WgPSA` de `design/personalos.pen`). Elle donne l'apparence, ce ticket le périmètre : un élément de maquette absent du ticket n'est pas implémenté, ses textes de remplissage ne sont pas repris, et l'écran se compose avec les composants du design system (`docs/design-system.md`).
- La mise à jour des lignes se fait par remplacement complet dans une transaction (suppression puis création imbriquée), jamais ligne à ligne.
- Unité de chaque ligne : celle saisie, conservée ; la conversion n'a lieu qu'à la consolidation.

## Critères d'acceptation

- [ ] Une recette se crée avec ses lignes, se lit, se modifie, se supprime.
- [ ] Les lignes portent le `scopeId` de leur recette (garde SOCLE-6).
- [ ] Socle de tests de l'ADR 0030.

## Vérification

- `pnpm exec nx test-integration api -- recipe` ; `pnpm exec nx affected -t lint test build --base=origin/develop`.
- Captures : `scripts/captures.sh /repas/recettes /repas/recettes/<id d'une recette de démo>`.

## Pour la prod

Rien.

## Hors périmètre

- Le formulaire de saisie : CUISINE-6. Recette générée sauvegardée : CUISINE-19.

## Dépendances

- CUISINE-3, SOCLE-6.
