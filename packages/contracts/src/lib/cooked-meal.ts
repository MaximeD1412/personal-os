import * as z from 'zod';
import {
  zCanonicalUnit,
  zRecipeUnit,
  type CanonicalUnit,
  type RecipeUnit,
} from './ingredient';
import { zInstant } from './valeurs';

/**
 * Une ligne d'un Repas cuisiné : un Ingrédient, la quantité **réellement**
 * utilisée et l'unité dans laquelle on l'a dite, conservée telle quelle.
 */
export const zCookedMealLine = /* @__PURE__ */ z.object({
  id: /* @__PURE__ */ z.string(),
  ingredient: /* @__PURE__ */ z.object({
    id: /* @__PURE__ */ z.string(),
    displayName: /* @__PURE__ */ z.string(),
  }),
  quantity: /* @__PURE__ */ z.number(),
  unit: zRecipeUnit,
});

export type CookedMealLine = z.infer<typeof zCookedMealLine>;

/**
 * Ce que le stock n'avait pas : la consommation d'un Ingrédient a ramené sa
 * ligne à zéro, sans aller en dessous. `available` est ce qu'il avait,
 * `missing` ce qui manquait, en Unité canonique. Un manque se signale, il ne
 * bloque jamais (ADR 0013).
 */
export const zCookedMealShortfall = /* @__PURE__ */ z.object({
  ingredient: /* @__PURE__ */ z.object({
    id: /* @__PURE__ */ z.string(),
    displayName: /* @__PURE__ */ z.string(),
    canonicalUnit: zCanonicalUnit,
  }),
  available: /* @__PURE__ */ z.number(),
  missing: /* @__PURE__ */ z.number(),
});

export type CookedMealShortfall = z.infer<typeof zCookedMealShortfall>;

/**
 * Un Repas cuisiné : un Repas planifié déclaré réalisé, avec les quantités
 * réellement utilisées. C'est la seule chose qui fait baisser le stock par
 * consommation. Il ne se modifie pas : une erreur se corrige dans l'écran de
 * stock. Sa déclaration rend en plus ce que le stock n'avait pas.
 */
export const zCookedMeal = /* @__PURE__ */ z.object({
  id: /* @__PURE__ */ z.string(),
  mealPlanEntryId: /* @__PURE__ */ z.string(),
  cookedAt: zInstant,
  lines: /* @__PURE__ */ z.array(zCookedMealLine),
  shortfalls: /* @__PURE__ */ z.array(zCookedMealShortfall),
});

export type CookedMeal = z.infer<typeof zCookedMeal>;

/**
 * La base garde la quantité au millième (`Decimal(12,3)`) : une quantité plus
 * fine serait arrondie en silence. Un Ingrédient qu'on n'a pas utilisé se
 * retire de la déclaration plutôt que de s'y dire à zéro.
 */
const zQuantity = /* @__PURE__ */ z
  .number({ error: 'La quantité est un nombre.' })
  .positive({ error: 'La quantité utilisée est positive.' })
  .max(1_000_000, { error: 'La quantité dépasse un million.' })
  .refine((quantite) => Math.round(quantite * 1000) / 1000 === quantite, {
    error: 'La quantité se donne au millième près.',
  });

/**
 * Une ligne déclarée, par l'identifiant de son Ingrédient. Qu'il soit au
 * catalogue, et que son unité se convertisse vers son Unité canonique, sont
 * des règles métier.
 */
export const zCookedMealLineInput = /* @__PURE__ */ z.object({
  ingredientId: /* @__PURE__ */ z.string().trim().min(1),
  quantity: zQuantity,
  unit: zRecipeUnit,
});

export type CookedMealLineInput = z.infer<typeof zCookedMealLineInput>;

/**
 * La déclaration d'un Repas cuisiné (`POST /cooked-meals`). Le repas d'une
 * recette se préremplit de ses lignes ajustées aux portions ; un repas sans
 * recette déclare des lignes libres. Que le repas existe, soit approuvé et ne
 * soit pas déjà cuisiné sont des règles métier.
 */
export const zCookedMealInput = /* @__PURE__ */ z.object({
  mealPlanEntryId: /* @__PURE__ */ z.string().trim().min(1),
  lines: /* @__PURE__ */ z
    .array(zCookedMealLineInput)
    .min(1, { error: 'Un Repas cuisiné déclare au moins un Ingrédient.' })
    .max(100),
});

export type CookedMealInput = z.infer<typeof zCookedMealInput>;

/**
 * La quantité d'une ligne de recette pour les portions d'un repas : la règle
 * de trois, au millième, sans jamais tomber à zéro.
 */
export function ajusterAuxPortions(
  quantite: number,
  portionsDeLaRecette: number,
  portionsDuRepas: number,
): number {
  const ajustee =
    Math.round(((quantite * portionsDuRepas) / portionsDeLaRecette) * 1000) /
    1000;
  return Math.max(ajustee, 0.001);
}

const UNITE_DE_SAISIE: Readonly<Record<CanonicalUnit, RecipeUnit>> = {
  GRAM: 'G',
  MILLILITER: 'ML',
  PIECE: 'PIECE',
};

/** L'Unité de recette qui dit l'Unité canonique : celle d'une ligne libre. */
export function uniteDeSaisie(unite: CanonicalUnit): RecipeUnit {
  return UNITE_DE_SAISIE[unite];
}
