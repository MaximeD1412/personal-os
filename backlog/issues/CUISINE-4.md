---
id: CUISINE-4
title: "Fusionner deux Ingrédients en doublon"
epic: CUISINE
type: feature
priority: P2
size: S
milestone: M3 Cuisine boucle
blocked_by: [CUISINE-12]
adr: [0030]
risques: [CUI-3]
revue_visuelle: true
---

## Contexte

Malgré le résolveur, le catalogue finira par contenir des doublons. Fusionner deux Ingrédients repointe tout ce qui référence le doublon vers l'Ingrédient conservé, et garde le libellé du doublon comme Alias.

## État actuel du code

- Références vers `Ingredient` : `IngredientAlias`, `RecipeLine`, `PantryItem`, `ShoppingListItem`, `CookedMealLine`, `FoodPreference`, `Product`, `Ingredient.preferredProductId`.

## À faire

- `POST /ingredients/:id/merge` (`{ intoId }`) : dans une transaction, repointe toutes les références ; fusionne les lignes de stock (quantités additionnées, péremption la plus proche, via `recaler`) ; crée un Alias du nom du doublon ; supprime le doublon. Mêmes unités canoniques exigées (422 `food.merge_unit_mismatch`).
- Écran : action « Fusionner avec… » sur `/repas/ingredients/:id`, confirmée par `DccmConfirm`.

## Décisions déjà prises

- Les préférences en double après fusion sont dédupliquées.

## Critères d'acceptation

- [ ] Après fusion, aucune référence ne pointe vers le doublon, et son nom est reconnu par le résolveur.

## Vérification

- `pnpm exec nx test-integration api -- ingredient` ; `pnpm exec nx affected -t lint test build --base=origin/develop`.
- Captures : `scripts/captures.sh /repas/ingredients/<id>`.

## Pour la prod

Rien.

## Hors périmètre

Aucun.

## Dépendances

- CUISINE-12.
