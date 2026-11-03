import { zDay, zMealMoment, zRecipeUnit } from '@personal-os/contracts';
import * as z from 'zod';

/** Le but des appels au modèle, qui nomme leurs traces. */
export const BUT_GENERATION = 'meal-plan.generate';

/**
 * Une recette nouvelle, telle que le modèle la propose : ses ingrédients sont
 * des libellés libres, que le contrôle résout avant toute chose.
 */
export const zRecetteProposee = z.object({
  title: z.string().trim().min(1).max(160),
  servings: z.int().min(1).max(100),
  steps: z.array(z.string().trim().min(1).max(2000)).max(50),
  ingredients: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(160),
        quantity: z.number().positive().max(1_000_000),
        unit: zRecipeUnit,
      }),
    )
    .min(1)
    .max(100),
});

export type RecetteProposee = z.infer<typeof zRecetteProposee>;

/**
 * La proposition du modèle pour un créneau : une Recette du Foyer
 * (`recipeId`), ou une recette nouvelle (`recipe`). Une seule forme d'objet
 * plutôt qu'une union : la sortie structurée du fournisseur ne connaît que des
 * objets fermés. Quand les deux sont donnés, la Recette du Foyer l'emporte.
 */
export const zPropositionDeRepas = z.object({
  day: zDay,
  moment: zMealMoment,
  recipeId: z.string().nullable(),
  recipe: zRecetteProposee.nullable(),
});

export type PropositionDeRepas = z.infer<typeof zPropositionDeRepas>;

/** Ce que le modèle rend : un objet, comme l'exige la sortie structurée. */
export const zSortieDeGeneration = z.object({
  propositions: z.array(zPropositionDeRepas).max(50),
});

export type SortieDeGeneration = z.infer<typeof zSortieDeGeneration>;
