---
id: CUISINE-10
title: "Clôture d'une liste de courses : le Stock domestique monte des quantités achetées"
epic: CUISINE
type: feature
priority: P0
size: S
milestone: M2 Cuisine socle
blocked_by: [CUISINE-9]
adr: [0012, 0013, 0030]
risques: [CUI-1]
revue_visuelle: true
---

## Contexte

Clôturer une liste fait monter le Stock domestique des quantités **réellement achetées**. Pour un Ingrédient périssable, une date de péremption est demandée.

## État actuel du code

- `ShoppingList`, `ShoppingListItem` (CUISINE-9), `recaler` (CUISINE-8), `Ingredient.perishable` (CUISINE-1).

## À faire

- Route `POST /shopping-lists/:id/close` : `{ items: { itemId, purchasedQuantity?, expiresOn? }[] }`. Les articles cochés sont achetés (quantité de l'article par défaut, ou `purchasedQuantity`) ; les non cochés ne le sont pas ; un article libellé seul est ignoré par le stock. Un article coché d'Ingrédient périssable sans `expiresOn` → 422 `food.expiry_required` (avec `fields`). Liste déjà close → 422 `food.list_closed`. Tout dans une transaction : `recaler(ACHAT)` pour chaque article acheté, puis statut `CLOSED`.
- Écran : « Clôturer » sur `/courses/:id` ouvre un récapitulatif (articles cochés, quantité achetée modifiable, péremption pour les périssables), confirmé par `DccmConfirm`.

## Décisions déjà prises

- La quantité achetée est en Unité canonique ; l'arrondi au conditionnement arrive avec les Produits (CUISINE-12).

## Critères d'acceptation

- [ ] Après clôture, le stock reflète les quantités achetées, pas celles de la liste.
- [ ] Un périssable sans péremption bloque la clôture.
- [ ] Socle de tests de l'ADR 0030.

## Vérification

- `pnpm exec nx test-integration api -- shopping-list pantry` ; `pnpm exec nx affected -t lint test build --base=origin/develop`.
- Captures : `scripts/captures.sh /courses/<id de la liste de démo>` (récapitulatif de clôture ouvert).

## Pour la prod

Rien.

## Hors périmètre

- Conditionnement : CUISINE-12.

## Dépendances

- CUISINE-9.
