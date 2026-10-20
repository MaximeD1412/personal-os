import * as z from 'zod';
import { zInstant } from './valeurs';

/**
 * Le nom canonique d'un libellé : en minuscules, sans accents ni ligatures,
 * apostrophes unifiées, espaces réduits, sans ponctuation finale. Deux
 * libellés qui ne diffèrent que par là désignent le même Ingrédient.
 *
 * Il sert l'unicité du catalogue, sa recherche, et le résolveur d'Alias
 * (CUISINE-3) : la règle ne vit qu'ici.
 */
export function normaliserLibelle(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/[’‘`´]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[\s.,;:!?…]+$/u, '')
    .trim();
}

/** Les quatorze familles d'Allergènes à déclaration obligatoire de l'UE. */
export const ALLERGENES = [
  'GLUTEN',
  'CRUSTACEANS',
  'EGGS',
  'FISH',
  'PEANUTS',
  'SOY',
  'MILK',
  'TREE_NUTS',
  'CELERY',
  'MUSTARD',
  'SESAME',
  'SULPHITES',
  'LUPIN',
  'MOLLUSCS',
] as const;

export const zAllergen = /* @__PURE__ */ z.enum(ALLERGENES);

export type Allergen = z.infer<typeof zAllergen>;

export const LIBELLES_DES_ALLERGENES: Readonly<Record<Allergen, string>> = {
  GLUTEN: 'Gluten',
  CRUSTACEANS: 'Crustacés',
  EGGS: 'Œufs',
  FISH: 'Poissons',
  PEANUTS: 'Arachides',
  SOY: 'Soja',
  MILK: 'Lait',
  TREE_NUTS: 'Fruits à coque',
  CELERY: 'Céleri',
  MUSTARD: 'Moutarde',
  SESAME: 'Sésame',
  SULPHITES: 'Sulfites',
  LUPIN: 'Lupin',
  MOLLUSCS: 'Mollusques',
};

/** L'Unité canonique : celle dans laquelle toute quantité de l'Ingrédient se ramène. */
export const UNITES_CANONIQUES = ['GRAM', 'MILLILITER', 'PIECE'] as const;

export const zCanonicalUnit = /* @__PURE__ */ z.enum(UNITES_CANONIQUES);

export type CanonicalUnit = z.infer<typeof zCanonicalUnit>;

export const LIBELLES_DES_UNITES: Readonly<Record<CanonicalUnit, string>> = {
  GRAM: 'Gramme (g)',
  MILLILITER: 'Millilitre (ml)',
  PIECE: 'Pièce',
};

/**
 * L'Unité de recette : celle dans laquelle une recette donne une quantité.
 * Le convertisseur la ramène à l'Unité canonique de l'Ingrédient.
 */
export const UNITES_DE_RECETTE = [
  'G',
  'KG',
  'MG',
  'ML',
  'CL',
  'L',
  'TSP',
  'TBSP',
  'PIECE',
] as const;

export const zRecipeUnit = /* @__PURE__ */ z.enum(UNITES_DE_RECETTE);

export type RecipeUnit = z.infer<typeof zRecipeUnit>;

export const LIBELLES_DES_UNITES_DE_RECETTE: Readonly<
  Record<RecipeUnit, string>
> = {
  G: 'Gramme (g)',
  KG: 'Kilogramme (kg)',
  MG: 'Milligramme (mg)',
  ML: 'Millilitre (ml)',
  CL: 'Centilitre (cl)',
  L: 'Litre (l)',
  TSP: 'Cuillère à café (5 ml)',
  TBSP: 'Cuillère à soupe (15 ml)',
  PIECE: 'Pièce',
};

/**
 * Les unités où un poids à la pièce a un sens : un Ingrédient compté en
 * grammes qu'on achète à la pièce, ou l'inverse. Un liquide n'en a pas.
 */
export const UNITES_AVEC_POIDS_A_LA_PIECE: readonly CanonicalUnit[] = [
  'GRAM',
  'PIECE',
];

/**
 * Un Ingrédient du catalogue. Le catalogue est global : il n'a pas d'Espace,
 * les deux Comptes du Foyer le partagent. `name` est le libellé normalisé
 * (`normaliserLibelle`), unique ; `displayName` est le libellé tel qu'on
 * l'affiche.
 */
export const zIngredient = /* @__PURE__ */ z.object({
  id: /* @__PURE__ */ z.string(),
  name: /* @__PURE__ */ z.string(),
  displayName: /* @__PURE__ */ z.string(),
  canonicalUnit: zCanonicalUnit,
  /** Le poids d'une pièce, en grammes ; vide quand on ne le connaît pas. */
  gramsPerPiece: /* @__PURE__ */ z.number().nullable(),
  allergens: /* @__PURE__ */ z.array(zAllergen),
  perishable: /* @__PURE__ */ z.boolean(),
  createdAt: zInstant,
});

export type Ingredient = z.infer<typeof zIngredient>;

const zDisplayName = /* @__PURE__ */ z
  .string()
  .trim()
  .min(1)
  .max(120)
  .refine((libelle) => normaliserLibelle(libelle).length > 0, {
    error: 'Le libellé doit contenir au moins une lettre ou un chiffre.',
  });

/**
 * La base garde le poids au centième de gramme (`Decimal(10,2)`) : un poids
 * plus fin serait arrondi en silence, et 0,001 deviendrait 0.
 */
const zGramsPerPiece = /* @__PURE__ */ z
  .number()
  .positive()
  .max(100_000)
  .refine((grammes) => Math.round(grammes * 100) / 100 === grammes, {
    error: 'Le poids à la pièce se donne au centième de gramme près.',
  });

const zAllergens = /* @__PURE__ */ z
  .array(zAllergen)
  .refine((allergenes) => new Set(allergenes).size === allergenes.length, {
    error: 'Un Allergène ne se déclare qu’une fois.',
  });

/**
 * Ce qu'une saisie porte. Le nom canonique ne se saisit pas : il se déduit du
 * libellé. Qu'un poids à la pièce n'aille qu'avec les grammes ou les pièces
 * est une règle métier, que le service juge contre l'Ingrédient en base
 * (`food.grams_per_piece_not_applicable`).
 */
export const zIngredientInput = /* @__PURE__ */ z.object({
  displayName: zDisplayName,
  canonicalUnit: zCanonicalUnit,
  gramsPerPiece: /* @__PURE__ */ zGramsPerPiece.nullable().default(null),
  allergens: /* @__PURE__ */ zAllergens.default([]),
  perishable: /* @__PURE__ */ z.boolean().default(false),
});

export type IngredientInput = z.infer<typeof zIngredientInput>;

/** Une modification ne porte que ce qu'elle change, sans valeur par défaut. */
export const zIngredientUpdate = /* @__PURE__ */ z
  .object({
    displayName: zDisplayName,
    canonicalUnit: zCanonicalUnit,
    gramsPerPiece: /* @__PURE__ */ zGramsPerPiece.nullable(),
    allergens: zAllergens,
    perishable: /* @__PURE__ */ z.boolean(),
  })
  .partial();

export type IngredientUpdate = z.infer<typeof zIngredientUpdate>;

/**
 * La lecture du catalogue : tout le catalogue, ou les Ingrédients dont le nom
 * contient chaque mot de `q`, normalisé comme le nom. Le catalogue est borné
 * par nature (quelques centaines d'Ingrédients), le filtre est sa borne quand
 * on en a une (ADR 0030).
 */
export const zIngredientListQuery = /* @__PURE__ */ z.object({
  q: /* @__PURE__ */ z.string().max(120).optional(),
});

export type IngredientListQuery = z.infer<typeof zIngredientListQuery>;
