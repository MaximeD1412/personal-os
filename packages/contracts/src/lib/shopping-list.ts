import * as z from 'zod';
import { zCanonicalUnit } from './ingredient';
import { zInstant, zWeek } from './valeurs';

/** Une Liste de courses est ouverte au magasin, puis close (CUISINE-10). */
export const STATUTS_DE_LISTE = ['OPEN', 'CLOSED'] as const;

export const zShoppingListStatus = /* @__PURE__ */ z.enum(STATUTS_DE_LISTE);

export type ShoppingListStatus = z.infer<typeof zShoppingListStatus>;

/** D'où vient un Article de courses : du Planning de repas, ou d'un ajout à la main. */
export const ORIGINES_D_ARTICLE = ['PLAN', 'MANUAL'] as const;

export const zShoppingListItemOrigin =
  /* @__PURE__ */ z.enum(ORIGINES_D_ARTICLE);

export type ShoppingListItemOrigin = z.infer<typeof zShoppingListItemOrigin>;

/**
 * Un Article de courses. Issu du planning, il porte toujours un Ingrédient et
 * sa quantité consolidée, en Unité canonique. Ajouté à la main, il porte un
 * Ingrédient ou un simple libellé (« liquide vaisselle »), avec ou sans
 * quantité. `unit` est l'Unité canonique de l'Ingrédient au moment de l'ajout :
 * vide sans Ingrédient ou sans quantité, une quantité de libellé se compte.
 */
export const zShoppingListItem = /* @__PURE__ */ z.object({
  id: /* @__PURE__ */ z.string(),
  ingredient: /* @__PURE__ */ z
    .object({ id: z.string(), displayName: z.string() })
    .nullable(),
  label: /* @__PURE__ */ z.string().nullable(),
  quantity: /* @__PURE__ */ z.number().nullable(),
  unit: /* @__PURE__ */ zCanonicalUnit.nullable(),
  origin: zShoppingListItemOrigin,
  checked: /* @__PURE__ */ z.boolean(),
  position: /* @__PURE__ */ z.int(),
});

export type ShoppingListItem = z.infer<typeof zShoppingListItem>;

/**
 * Une Liste de courses, figée à sa production (ADR 0012) : une modification
 * ultérieure du planning ne la change jamais. Ses articles sont dans leur
 * ordre : ceux du planning, puis les ajouts manuels.
 */
export const zShoppingList = /* @__PURE__ */ z.object({
  id: /* @__PURE__ */ z.string(),
  /** Le Planning de repas dont elle est tirée. */
  mealPlan: /* @__PURE__ */ z
    .object({ id: z.string(), week: zWeek })
    .nullable(),
  status: zShoppingListStatus,
  producedAt: zInstant,
  closedAt: /* @__PURE__ */ zInstant.nullable(),
  items: /* @__PURE__ */ z.array(zShoppingListItem),
});

export type ShoppingList = z.infer<typeof zShoppingList>;

/**
 * La lecture des Listes de courses : un statut est exigé, c'est la borne de la
 * lecture (ADR 0030). Les plus récentes d'abord.
 */
export const zShoppingListQuery = /* @__PURE__ */ z.object({
  status: zShoppingListStatus,
});

export type ShoppingListQuery = z.infer<typeof zShoppingListQuery>;

/** Au millième près, comme la base la garde, et strictement positive. */
const zQuantity = /* @__PURE__ */ z
  .number({ error: 'La quantité est un nombre.' })
  .gt(0, { error: 'La quantité est strictement positive.' })
  .max(10_000_000, { error: 'La quantité dépasse dix millions.' })
  .refine((quantite) => Math.round(quantite * 1000) / 1000 === quantite, {
    error: 'La quantité se donne au millième près.',
  });

/**
 * Un ajout manuel (`POST /shopping-lists/:id/items`) : un Ingrédient du
 * catalogue, dont la quantité se donne en Unité canonique, ou un simple
 * libellé, jamais les deux ni aucun. Un libellé seul ne fait jamais monter le
 * Stock domestique. Que l'Ingrédient existe est une règle métier.
 */
export const zShoppingListItemInput = /* @__PURE__ */ z
  .object({
    ingredientId: /* @__PURE__ */ z.string().trim().min(1).optional(),
    label: /* @__PURE__ */ z
      .string()
      .trim()
      .min(1, { error: "Le libellé de l'article est vide." })
      .max(120, { error: 'Le libellé dépasse 120 caractères.' })
      .optional(),
    quantity: /* @__PURE__ */ zQuantity.optional(),
  })
  .refine(
    ({ ingredientId, label }) =>
      (ingredientId === undefined) !== (label === undefined),
    {
      path: ['label'],
      error:
        'Un article porte soit un Ingrédient, soit un libellé : jamais les deux, ni aucun.',
    },
  );

export type ShoppingListItemInput = z.infer<typeof zShoppingListItemInput>;

/** Ce qu'on achète d'un article : un Ingrédient du catalogue, ou un simple libellé. */
export function designation(article: {
  ingredient: { displayName: string } | null;
  label: string | null;
}): string {
  return article.ingredient?.displayName ?? article.label ?? '';
}
