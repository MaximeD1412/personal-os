---
id: CUISINE-3
title: "Résolveur d'ingrédients et Alias : un libellé rattaché n'est plus jamais redemandé"
epic: CUISINE
type: feature
priority: P0
size: M
milestone: M2 Cuisine socle
blocked_by: [CUISINE-1]
adr: [0030]
risques: [CUI-3, IA-3]
revue_visuelle: false
---

## Contexte

Module profond du PRD : `(libellé libre) → Ingrédient | inconnu`. Un **Alias** rattache un libellé à un Ingrédient ; une fois rattaché, le système ne redemande plus. Il sert à la saisie de recette (CUISINE-6) et à la génération IA (CUISINE-16).

## État actuel du code

- `Ingredient`, `normaliserLibelle()` (CUISINE-1).

## À faire

- Prisma : `IngredientAlias { id, label (normalisé, unique), ingredientId, createdAt }`, hors Espace (catalogue global, `MODELES_HORS_ESPACE`).
- `packages/api/src/app/food/resolution/resoudre.ts` (pur) : `resoudre(libelle, { ingredients, alias }) → { ingredientId } | { inconnu: true, suggestions: ingredientId[] }`. Ordre : alias exact, puis nom exact, sinon inconnu avec au plus 5 suggestions (Ingrédients dont le nom contient un des mots du libellé, les plus de mots communs d'abord).
- Routes : `POST /ingredients/resolve` (`{ labels: string[] }` → un résultat par libellé, dans l'ordre), `POST /ingredient-aliases` (`{ label, ingredientId }`, `food.alias_conflict` en 422 si le libellé est déjà rattaché à un autre Ingrédient).

## Décisions déjà prises

- Pas de similarité floue (distance d'édition) en V1 : les suggestions par mots suffisent, l'Alias fait le reste.
- Un Alias n'est jamais créé automatiquement : toujours par un geste de l'utilisateur (ou une confirmation explicite).

## Critères d'acceptation

- [ ] Un libellé inconnu est signalé avec des suggestions.
- [ ] Après rattachement, le même libellé (casse et accents différents) est reconnu.
- [ ] « Oignon rouge » ne résout pas vers « Oignon jaune » s'ils sont deux Ingrédients.

## Vérification

- `pnpm exec nx test api -- resoudre` ; `pnpm exec nx test-integration api -- ingredient` ; `pnpm exec nx affected -t lint test build --base=origin/develop`.

## Pour la prod

Rien.

## Hors périmètre

- L'écran de rattachement : CUISINE-6.

## Dépendances

- CUISINE-1.
