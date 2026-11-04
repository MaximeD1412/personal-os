import * as z from 'zod';
import { zInstant, zWeek } from './valeurs';

/**
 * Un Souhait : une Recette, ou une envie en texte libre, déposée avant la
 * génération d'une semaine, que son Planning de repas doit honorer. C'est une
 * contrainte d'entrée, pas une proposition de l'IA. Honoré, il reste lié à sa
 * semaine.
 */
export const zMealWish = /* @__PURE__ */ z.object({
  id: /* @__PURE__ */ z.string(),
  week: zWeek,
  recipe: /* @__PURE__ */ z
    .object({ id: z.string(), title: z.string() })
    .nullable(),
  text: /* @__PURE__ */ z.string().nullable(),
  /** Le Compte du Foyer qui l'a déposé. */
  authorId: /* @__PURE__ */ z.string(),
  createdAt: zInstant,
});

export type MealWish = z.infer<typeof zMealWish>;

/**
 * Le dépôt d'un Souhait, à plat pour que l'écran se préremplisse par son URL.
 * Il porte une recette ou un texte, et le schéma refuse les deux comme aucun.
 * Que la recette existe est une règle métier.
 */
export const zMealWishInput = /* @__PURE__ */ z
  .object({
    week: zWeek,
    recipeId: /* @__PURE__ */ z.string().trim().min(1).optional(),
    text: /* @__PURE__ */ z.string().trim().min(1).max(160).optional(),
  })
  .refine(
    ({ recipeId, text }) => (recipeId === undefined) !== (text === undefined),
    {
      path: ['text'],
      error:
        'Un Souhait porte soit une recette, soit un texte : jamais les deux, ni aucun.',
    },
  );

export type MealWishInput = z.infer<typeof zMealWishInput>;

/** Les Souhaits se lisent par semaine, désignée par son lundi. */
export const zMealWishListQuery = /* @__PURE__ */ z.object({ week: zWeek });

export type MealWishListQuery = z.infer<typeof zMealWishListQuery>;
