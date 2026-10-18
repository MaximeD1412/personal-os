---
id: CUISINE-13
title: "Écart entre planning et liste figée, et liste de complément"
epic: CUISINE
type: feature
priority: P1
size: M
milestone: M3 Cuisine boucle
blocked_by: [CUISINE-9]
adr: [0012, 0030]
risques: []
revue_visuelle: true
reprend: 20
---

## Contexte

Une liste produite est figée (ADR 0012). Si le planning change ensuite, l'application **signale l'écart** et propose une **liste de complément** ; elle ne modifie jamais la liste figée, ses articles cochés ni ses ajouts manuels.

## État actuel du code

- `consolider`, `ShoppingList.mealPlanId` (CUISINE-9) ; planning réouvert puis modifié (CUISINE-7).

## À faire

- `courses/ecart.ts` (pur) : `ecart(besoinActuel, listesDuPlanning) → { manquants: { ingredientId, quantite }[] }` (ce que la consolidation actuelle exige au-delà de ce que les listes déjà produites pour ce planning couvrent ; un excédent n'est pas signalé).
- `GET /meal-plans/:id/shopping-gap` ; `POST /meal-plans/:id/shopping-lists?complement=true` produit une liste avec les seuls manquants.
- Écran : bandeau sur `/courses/:id` et sur le planning quand l'écart n'est pas vide (« Le planning a changé : 3 ingrédients manquent. Produire une liste de complément »).

## Décisions déjà prises

- Maquette : `liste-de-courses-1424.png`, `liste-de-courses-390.png` dans `design/captures/ecrans/` (frames `Bb4hE`, `I5yWov` de `design/personalos.pen`). Elle donne l'apparence, ce ticket le périmètre : un élément de maquette absent du ticket n'est pas implémenté, ses textes de remplissage ne sont pas repris, et l'écran se compose avec les composants du design system (`docs/design-system.md`).
- Un excédent (repas retiré après la liste) n'est jamais signalé : les courses faites restent faites.

## Critères d'acceptation

- [ ] Ajouter un repas après production signale exactement ses ingrédients manquants.
- [ ] La liste de complément ne contient que les manquants ; la liste figée est inchangée.

## Vérification

- `pnpm exec nx test api -- ecart` ; `pnpm exec nx test-integration api -- shopping-list` ; `pnpm exec nx affected -t lint test build --base=origin/develop`.
- Captures : `scripts/captures.sh /courses/<id>` avec un écart.

## Pour la prod

Rien.

## Hors périmètre

Aucun.

## Dépendances

- CUISINE-9.
