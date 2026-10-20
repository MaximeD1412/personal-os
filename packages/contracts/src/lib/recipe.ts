import * as z from 'zod';
import { zRecipeUnit } from './ingredient';
import { zInstant } from './valeurs';

/**
 * L'origine d'une Recette : saisie à la main, ou proposée par la génération
 * du planning (CUISINE-15). Elle se lit, elle ne se saisit pas : une recette
 * créée par `POST /recipes` est toujours `MANUAL`.
 */
export const ORIGINES_DE_RECETTE = ['MANUAL', 'GENERATED'] as const;

export const zRecipeSource = /* @__PURE__ */ z.enum(ORIGINES_DE_RECETTE);

export type RecipeSource = z.infer<typeof zRecipeSource>;

/**
 * Une ligne de Recette : un Ingrédient du catalogue, une quantité et l'unité
 * dans laquelle on l'a saisie. L'unité est conservée telle quelle : la
 * conversion vers l'Unité canonique n'a lieu qu'à la consolidation.
 */
export const zRecipeLine = /* @__PURE__ */ z.object({
  id: /* @__PURE__ */ z.string(),
  ingredient: /* @__PURE__ */ z.object({
    id: /* @__PURE__ */ z.string(),
    displayName: /* @__PURE__ */ z.string(),
  }),
  quantity: /* @__PURE__ */ z.number(),
  unit: zRecipeUnit,
});

export type RecipeLine = z.infer<typeof zRecipeLine>;

/**
 * Une Recette : une préparation réutilisable, pour un nombre de portions de
 * référence. Elle ne connaît que des Ingrédients, jamais des Produits. Ses
 * lignes et ses étapes sont dans leur ordre.
 */
export const zRecipe = /* @__PURE__ */ z.object({
  id: /* @__PURE__ */ z.string(),
  title: /* @__PURE__ */ z.string(),
  servings: /* @__PURE__ */ z.int(),
  steps: /* @__PURE__ */ z.array(z.string()),
  source: zRecipeSource,
  lines: /* @__PURE__ */ z.array(zRecipeLine),
  createdAt: zInstant,
  updatedAt: zInstant,
});

export type Recipe = z.infer<typeof zRecipe>;

const zTitle = /* @__PURE__ */ z.string().trim().min(1).max(160);

/** De quoi nourrir une tablée, pas une cantine. */
const zServings = /* @__PURE__ */ z.int().min(1).max(100);

const zSteps = /* @__PURE__ */ z
  .array(z.string().trim().min(1).max(2000))
  .max(50);

/**
 * La base garde la quantité au millième (`Decimal(12,3)`) : une quantité plus
 * fine serait arrondie en silence, et 0,0005 deviendrait 0.
 */
const zQuantity = /* @__PURE__ */ z
  .number()
  .positive()
  .max(1_000_000)
  .refine((quantite) => Math.round(quantite * 1000) / 1000 === quantite, {
    error: 'La quantité se donne au millième près.',
  });

/**
 * Une ligne saisie, par l'identifiant de son Ingrédient : un libellé libre se
 * résout avant (`POST /ingredients/resolve`, CUISINE-6). Qu'il existe au
 * catalogue est une règle métier (`food.recipe_unknown_ingredient`).
 */
export const zRecipeLineInput = /* @__PURE__ */ z.object({
  ingredientId: /* @__PURE__ */ z.string().min(1),
  quantity: zQuantity,
  unit: zRecipeUnit,
});

export type RecipeLineInput = z.infer<typeof zRecipeLineInput>;

/** Les lignes d'une saisie, dans leur ordre : elles remplacent toujours toutes les autres. */
const zLines = /* @__PURE__ */ z.array(zRecipeLineInput).min(1).max(100);

/**
 * Ce qu'une création porte. L'Espace n'en fait pas partie : la Cuisine vit
 * dans l'Espace foyer, et le module le pose lui-même (ADR 0030).
 */
export const zRecipeInput = /* @__PURE__ */ z.object({
  title: zTitle,
  servings: zServings,
  steps: /* @__PURE__ */ zSteps.default([]),
  lines: zLines,
});

export type RecipeInput = z.infer<typeof zRecipeInput>;

/**
 * Une modification ne porte que ce qu'elle change. Des lignes fournies
 * remplacent toutes les lignes de la recette, jamais une à une.
 */
export const zRecipeUpdate = /* @__PURE__ */ z
  .object({
    title: zTitle,
    servings: zServings,
    steps: zSteps,
    lines: zLines,
  })
  .partial();

export type RecipeUpdate = z.infer<typeof zRecipeUpdate>;

/**
 * La lecture des recettes : toutes, ou celles dont le titre contient chaque
 * mot de `q`. Les recettes d'un foyer sont bornées par nature ; le filtre est
 * leur borne quand on en a une (ADR 0030).
 */
export const zRecipeListQuery = /* @__PURE__ */ z.object({
  q: /* @__PURE__ */ z.string().max(120).optional(),
});

export type RecipeListQuery = z.infer<typeof zRecipeListQuery>;
