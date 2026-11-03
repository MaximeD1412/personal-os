import * as z from 'zod';
import { zAllergen } from './ingredient';
import { zInstant } from './valeurs';

/**
 * Le type d'une Préférence alimentaire. Une allergie ne se contourne jamais,
 * un aliment exclu non plus ; un aliment peu apprécié est seulement évité.
 */
export const FOOD_PREFERENCE_KINDS = [
  'ALLERGY',
  'EXCLUDED',
  'DISLIKED',
] as const;

export const zFoodPreferenceKind = /* @__PURE__ */ z.enum(
  FOOD_PREFERENCE_KINDS,
);

export type FoodPreferenceKind = z.infer<typeof zFoodPreferenceKind>;

export const LIBELLES_DES_PREFERENCES: Readonly<
  Record<FoodPreferenceKind, string>
> = {
  ALLERGY: 'Allergie',
  EXCLUDED: 'Aliment exclu',
  DISLIKED: 'Peu apprécié',
};

/** Ce qu'une Préférence vise : un Allergène de la liste fermée, ou un Ingrédient. */
export const FOOD_PREFERENCE_TARGETS = ['ALLERGEN', 'INGREDIENT'] as const;

export type FoodPreferenceTarget = (typeof FOOD_PREFERENCE_TARGETS)[number];

const MESSAGE_DE_CIBLE =
  'Une Préférence alimentaire vise soit un Allergène, soit un Ingrédient : jamais les deux, ni aucun.';

/** Le champ de l'autre cible : le nommer, c'est viser les deux. */
const zAutreCible = /* @__PURE__ */ z
  .never({ error: MESSAGE_DE_CIBLE })
  .optional();

const zId = /* @__PURE__ */ z.string().trim().min(1);

/**
 * Une Préférence alimentaire, rattachée à un Compte du Foyer. Elle est dans
 * l'Espace foyer, que le module pose : les deux Comptes voient et modifient
 * les préférences des deux.
 */
export const zFoodPreference = /* @__PURE__ */ z.discriminatedUnion('target', [
  z.object({
    id: z.string(),
    userId: z.string(),
    kind: zFoodPreferenceKind,
    target: z.literal('ALLERGEN'),
    allergen: zAllergen,
    createdAt: zInstant,
  }),
  z.object({
    id: z.string(),
    userId: z.string(),
    kind: zFoodPreferenceKind,
    target: z.literal('INGREDIENT'),
    ingredientId: z.string(),
    /** Le libellé de l'Ingrédient, tel que le catalogue l'affiche. */
    ingredientDisplayName: z.string(),
    createdAt: zInstant,
  }),
]);

export type FoodPreference = z.infer<typeof zFoodPreference>;

/**
 * La saisie d'une Préférence : une union discriminée sur sa cible, à plat
 * pour qu'un formulaire se préremplisse par son URL
 * (`?target=ALLERGEN&allergen=TREE_NUTS`). Elle vise soit un Allergène, soit
 * un Ingrédient : le schéma refuse les deux comme aucun, en 400. Que le
 * Compte soit du Foyer, que l'Ingrédient existe et que la Préférence soit
 * nouvelle sont des règles métier, jugées par le service.
 */
export const zFoodPreferenceInput = /* @__PURE__ */ z.discriminatedUnion(
  'target',
  [
    z.object({
      userId: zId,
      kind: zFoodPreferenceKind,
      target: z.literal('ALLERGEN'),
      allergen: zAllergen,
      ingredientId: zAutreCible,
    }),
    z.object({
      userId: zId,
      kind: zFoodPreferenceKind,
      target: z.literal('INGREDIENT'),
      ingredientId: zId,
      allergen: zAutreCible,
    }),
  ],
  { error: MESSAGE_DE_CIBLE },
);

export type FoodPreferenceInput = z.infer<typeof zFoodPreferenceInput>;

/**
 * La lecture des Préférences : celles du Foyer, ou celles d'un Compte. Le
 * Foyer est sa borne (deux Comptes, quelques Préférences chacun).
 */
export const zFoodPreferenceListQuery = /* @__PURE__ */ z.object({
  userId: /* @__PURE__ */ zId.optional(),
});

export type FoodPreferenceListQuery = z.infer<typeof zFoodPreferenceListQuery>;
