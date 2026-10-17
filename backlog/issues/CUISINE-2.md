---
id: CUISINE-2
title: "Convertisseur de quantités vers l'Unité canonique, facteur pièce/poids validé"
epic: CUISINE
type: feature
priority: P0
size: S
milestone: M2 Cuisine socle
blocked_by: [CUISINE-1]
adr: [0030]
risques: [CUI-2]
revue_visuelle: false
---

## Contexte

Module profond du PRD : `(quantité, unité source, Ingrédient) → quantité en Unité canonique`. Il encapsule les conversions dimensionnelles et le facteur pièce↔poids validé une fois par Ingrédient, et **échoue explicitement** plutôt que d'approximer.

## État actuel du code

- `Ingredient.canonicalUnit`, `gramsPerPiece` (CUISINE-1).

## À faire

- `contracts` : `UNITES_DE_RECETTE` = `G`, `KG`, `MG`, `ML`, `CL`, `L`, `TSP` (cuillère à café, 5 ml), `TBSP` (cuillère à soupe, 15 ml), `PIECE`, avec libellés français.
- `packages/api/src/app/food/conversion/convertir.ts` (pur, sans Nest) : `convertir({ quantite, unite }, ingredient) → { quantite } | { echec: 'dimension' | 'facteur_manquant' }`. Masse ↔ masse et volume ↔ volume toujours ; pièce ↔ gramme seulement avec `gramsPerPiece` ; volume ↔ masse jamais.
- Quantités en `Decimal` (pas de flottant) : `decimal.js` ou `Prisma.Decimal`.
- Écran Ingrédient (`/repas/ingredients/:id`) : champ « Poids moyen d'une pièce (g) » quand l'unité canonique est `GRAM` ou `PIECE`, avec la mention « Utilisé pour additionner des recettes en pièces et en grammes ».

## Décisions déjà prises

- Aucune densité volume/masse en V1 : une recette en ml d'un ingrédient en grammes est un échec `dimension`.

## Critères d'acceptation

- [ ] 2 pièces + 300 g d'oignon (100 g/pièce) donnent 500 g.
- [ ] Une pièce sans facteur échoue en `facteur_manquant`, jamais en silence.
- [ ] 3 c. à soupe = 45 ml ; 1,5 kg = 1500 g ; aucun flottant ne déborde (0,1 + 0,2).

## Vérification

- `pnpm exec nx test api -- convertir` (unitaire, sans base).

## Pour la prod

Rien.

## Hors périmètre

- La consolidation : CUISINE-9.

## Dépendances

- CUISINE-1.
