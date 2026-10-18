---
id: CUISINE-1
title: "Catalogue d'Ingrédients : Unité canonique, Allergènes, périssable, recherche"
epic: CUISINE
type: feature
priority: P0
size: M
milestone: M2 Cuisine socle
blocked_by: [SOCLE-3, UI-3]
adr: [0030]
risques: [CUI-3, IA-1]
revue_visuelle: true
reprend: 12
---

## Contexte

Un **Ingrédient** est une entrée canonique du catalogue, désignée par un identifiant stable et une **Unité canonique** ; il déclare ses **Allergènes** (liste fermée des quatorze familles réglementaires de l'UE). Le catalogue est **global** (hors Espace, PRD #1) : il est partagé par tout le Foyer et ne porte pas de `scopeId`. Deux libellés qui ne se cuisinent ni ne s'achètent pareil sont deux Ingrédients.

## État actuel du code

- Aucun module `food`. Imite `packages/api/src/app/calendar/` (après SOCLE-3) pour la structure, et `packages/database/src/lib/espace/modeles.ts` pour déclarer un modèle hors Espace.

## À faire

- Prisma : `Ingredient { id, name (unique, normalisé), displayName, canonicalUnit (GRAM | MILLILITER | PIECE), gramsPerPiece Decimal?, allergens Allergen[], perishable Boolean, createdAt }` ; `enum Allergen { GLUTEN CRUSTACEANS EGGS FISH PEANUTS SOY MILK TREE_NUTS CELERY MUSTARD SESAME SULPHITES LUPIN MOLLUSCS }`. Ajouter `Ingredient` à `MODELES_HORS_ESPACE`.
- `contracts` : `zIngredient`, `zIngredientInput`, `zIngredientUpdate`, `zIngredientListQuery` (`q?`), `ALLERGENES` avec leurs libellés français (« Gluten », « Crustacés », « Œufs », « Poissons », « Arachides », « Soja », « Lait », « Fruits à coque », « Céleri », « Moutarde », « Sésame », « Sulfites », « Lupin », « Mollusques »).
- `normaliserLibelle(texte)` dans `contracts` : minuscules, sans accents, espaces réduits, sans ponctuation finale ; partagé avec le résolveur (CUISINE-3).
- Routes (module `food`) : `GET /ingredients?q=` (tout le catalogue, ou filtré : `name` normalisé contient chaque mot de `q`), `POST /ingredients`, `PATCH /ingredients/:id`. Pas de suppression (CUISINE-4 fusionne). `food.ingredient_duplicate` (422) si le nom normalisé existe.
- Écrans : `/repas/ingredients` (liste, recherche), `/repas/ingredients/nouveau` (prérempli par URL : `displayName`, `canonicalUnit`, `perishable`), `/repas/ingredients/:id`.
- Semeur de démo `food.ts` : une trentaine d'Ingrédients courants, avec allergènes et périssabilité justes (lait, beurre, farine de blé, œufs, oignon jaune, oignon rouge, tomate fraîche, tomate en conserve, noix…).
- Ajouter `Ingredient` et `Allergen` à la table de correspondance d'`AGENTS.md` (déjà présents : vérifier).

## Décisions déjà prises

- Maquette : `recettes-ingredients-1424.png`, `recettes-ingredients-390.png` dans `design/captures/ecrans/` (frames `G2E7s`, `WgPSA` de `design/personalos.pen`). Elle donne l'apparence, ce ticket le périmètre : un élément de maquette absent du ticket n'est pas implémenté, ses textes de remplissage ne sont pas repris, et l'écran se compose avec les composants du design system (`docs/design-system.md`).
- `gramsPerPiece` n'a de sens que si l'unité canonique est `GRAM` ou `PIECE` ; sa validation par l'utilisateur est CUISINE-2.
- Le catalogue n'a pas d'Espace : les deux Comptes le partagent.

## Critères d'acceptation

- [ ] Un Ingrédient se crée, se modifie et se recherche.
- [ ] Deux noms qui ne diffèrent que par la casse ou les accents sont refusés comme doublon.
- [ ] Socle de tests de l'ADR 0030 (pas de 404 cross-Espace : modèle hors Espace).

## Vérification

- `pnpm exec nx test-integration api -- ingredient` ; `pnpm exec nx test contracts` ; `pnpm exec nx affected -t lint test build --base=origin/develop`.
- Captures : `scripts/captures.sh /repas/ingredients '/repas/ingredients/nouveau?displayName=Poireau&canonicalUnit=GRAM&perishable=true'`.

## Pour la prod

Rien (migration additive).

## Hors périmètre

- Conversion : CUISINE-2. Alias et résolveur : CUISINE-3. Fusion : CUISINE-4.

## Dépendances

- SOCLE-3, UI-3.
