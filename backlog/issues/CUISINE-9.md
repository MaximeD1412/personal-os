---
id: CUISINE-9
title: "Liste de courses figée : consolidateur, Articles cochés, ajouts manuels"
epic: CUISINE
type: feature
priority: P0
size: M
milestone: M2 Cuisine socle
blocked_by: [CUISINE-7, CUISINE-8]
adr: [0012, 0013, 0030]
risques: [CUI-2]
revue_visuelle: true
reprend: 17
---

## Contexte

Produire une liste de courses à partir d'un Planning de repas arrêté la **fige** (ADR 0012) : une modification ultérieure du planning ne la change jamais. Les besoins sont consolidés par Ingrédient en Unité canonique, le Stock domestique est déduit. Les Articles cochés et les ajouts manuels sont intouchables.

## État actuel du code

- `MealPlan` arrêté (CUISINE-7), `Recipe` (CUISINE-5), `PantryItem` (CUISINE-8), `convertir` (CUISINE-2).

## À faire

- Module profond `courses/consolider.ts` (pur) : `consolider(repas, recettes, stock, ingredients) → { articles: { ingredientId, quantite }[] } | { echecs: { ingredientId, raison }[] }`. Pour chaque repas avec recette : quantités × (portions du repas / portions de la recette), converties ; agrégation par Ingrédient ; déduction du stock ; un besoin entièrement couvert ne produit pas d'article. Un repas sans recette (intitulé) ne produit rien. Tout échec de conversion fait échouer l'ensemble (aucune liste partielle).
- Prisma : `ShoppingList { id, scopeId, mealPlanId String?, status (OPEN | CLOSED), producedAt, closedAt? }` ; `ShoppingListItem { id, scopeId, shoppingListId, ingredientId String?, label String?, quantity Decimal?, origin (PLAN | MANUAL), checked Boolean, position Int }`.
- Routes : `POST /meal-plans/:id/shopping-lists` (planning arrêté exigé, sinon 422 `food.plan_not_stopped` ; échec de conversion → 422 `food.conversion_missing` avec la liste des Ingrédients en `fields`), `GET /shopping-lists?status=OPEN`, `GET /shopping-lists/:id`, `POST /shopping-lists/:id/items` (ajout manuel), `POST /shopping-lists/:id/items/:itemId/check` et `/uncheck`, `DELETE /shopping-lists/:id/items/:itemId` (seulement un article manuel).
- Écran `/courses` (liste ouverte) et `/courses/:id` : articles groupés (planning, puis manuels), case à cocher en un geste, ajout manuel rapide en tête de liste, vue lisible au magasin sur mobile.
- Semeur de démo : une liste ouverte issue du planning de démo, avec deux articles cochés et un ajout manuel.

## Décisions déjà prises

- Maquette : `liste-de-courses-1424.png`, `liste-de-courses-390.png` dans `design/captures/ecrans/` (frames `Bb4hE`, `I5yWov` de `design/personalos.pen`). Elle donne l'apparence, ce ticket le périmètre : un élément de maquette absent du ticket n'est pas implémenté, ses textes de remplissage ne sont pas repris, et l'écran se compose avec les composants du design system (`docs/design-system.md`).
- **Un ajout manuel peut être un Ingrédient du catalogue ou un simple libellé** (« liquide vaisselle ») ; un libellé seul n'alimente jamais le Stock domestique. Les articles issus du planning portent toujours un Ingrédient.
- La liste ne se recalcule jamais : produire de nouveau depuis le même planning crée une **autre** liste (le complément est CUISINE-13).

## Critères d'acceptation

- [ ] Deux recettes qui utilisent le même Ingrédient en unités différentes donnent un seul article en Unité canonique.
- [ ] Le stock est déduit ; un besoin couvert ne produit pas d'article.
- [ ] Modifier le planning après production ne change pas la liste.
- [ ] Un échec de conversion nomme les Ingrédients en cause, et aucune liste n'est créée.
- [ ] Socle de tests de l'ADR 0030.

## Vérification

- `pnpm exec nx test api -- consolider` ; `pnpm exec nx test-integration api -- shopping-list` ; `pnpm exec nx affected -t lint test build --base=origin/develop`.
- Captures : `scripts/captures.sh /courses`.

## Pour la prod

Rien.

## Hors périmètre

- Clôture : CUISINE-10. Produits et arrondi : CUISINE-12. Écart et complément : CUISINE-13.

## Dépendances

- CUISINE-7, CUISINE-8.
