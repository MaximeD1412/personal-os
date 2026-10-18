---
id: CUISINE-12
title: "Produits : conditionnement, Produit préféré, arrondi au conditionnement"
epic: CUISINE
type: feature
priority: P1
size: M
milestone: M3 Cuisine boucle
blocked_by: [CUISINE-10]
adr: [0012, 0030]
risques: []
revue_visuelle: true
reprend: 18
---

## Contexte

Un **Produit** est une façon concrète d'acheter un Ingrédient (marque, conditionnement, forme). Un Ingrédient peut avoir un **Produit préféré**, repris dans la liste, qui affiche alors « 2 boîtes » plutôt que « 800 g ». Un Article sans Produit reste valide. Les Produits sont un catalogue global (hors Espace, PRD).

## État actuel du code

- `consolider` (CUISINE-9), clôture (CUISINE-10), `Ingredient` (CUISINE-1).

## À faire

- Prisma : `Product { id, ingredientId, brand String?, form (FRESH | FROZEN | CANNED | DRY | OTHER), packageQuantity Decimal (en Unité canonique de l'Ingrédient), packageLabel (« boîte », « sachet »…) }` hors Espace ; `Ingredient.preferredProductId String?`.
- Routes : `GET /ingredients/:id/products`, `POST /products`, `PATCH /products/:id`, `DELETE /products/:id`, `POST /ingredients/:id/preferred-product` (`{ productId | null }`).
- `consolider` : quand l'Ingrédient a un Produit préféré, l'article porte `productId` et `packages = ceil(quantite / packageQuantity)` ; `ShoppingListItem.productId`, `packages`.
- Clôture : la quantité achetée par défaut d'un article avec produit vaut `packages × packageQuantity`.
- Écrans : section « Produits » sur `/repas/ingredients/:id` ; la liste affiche « 2 boîtes (800 g) ».

## Décisions déjà prises

- Maquette : `liste-de-courses-1424.png`, `liste-de-courses-390.png`, `recettes-ingredients-1424.png`, `recettes-ingredients-390.png` dans `design/captures/ecrans/` (frames `Bb4hE`, `I5yWov`, `G2E7s`, `WgPSA` de `design/personalos.pen`). Elle donne l'apparence, ce ticket le périmètre : un élément de maquette absent du ticket n'est pas implémenté, ses textes de remplissage ne sont pas repris, et l'écran se compose avec les composants du design system (`docs/design-system.md`).
- L'arrondi est toujours au conditionnement supérieur.

## Critères d'acceptation

- [ ] 800 g d'un Ingrédient dont le Produit préféré fait 400 g donnent « 2 boîtes ».
- [ ] La clôture monte le stock de la quantité des conditionnements achetés.
- [ ] Un article sans produit reste inchangé.

## Vérification

- `pnpm exec nx test api -- consolider` ; `pnpm exec nx test-integration api -- product shopping-list` ; `pnpm exec nx affected -t lint test build --base=origin/develop`.
- Captures : `scripts/captures.sh /courses /repas/ingredients/<id>`.

## Pour la prod

Rien.

## Hors périmètre

Aucun.

## Dépendances

- CUISINE-10.
