import * as z from 'zod';
import { zInstant } from './valeurs';

/** La forme sous laquelle un Produit se vend. */
export const FORMES_DE_PRODUIT = [
  'FRESH',
  'FROZEN',
  'CANNED',
  'DRY',
  'OTHER',
] as const;

export const zProductForm = /* @__PURE__ */ z.enum(FORMES_DE_PRODUIT);

export type ProductForm = z.infer<typeof zProductForm>;

export const LIBELLES_DES_FORMES: Readonly<Record<ProductForm, string>> = {
  FRESH: 'Frais',
  FROZEN: 'Surgelé',
  CANNED: 'Conserve',
  DRY: 'Sec',
  OTHER: 'Autre',
};

/**
 * Un Produit : une façon concrète d'acheter un Ingrédient (CUISINE-12). Le
 * catalogue des Produits est global, comme celui des Ingrédients.
 * `packageQuantity` est ce que contient un conditionnement, dans l'Unité
 * canonique de l'Ingrédient ; `packageLabel` le nomme, au singulier
 * (« boîte »).
 */
export const zProduct = /* @__PURE__ */ z.object({
  id: /* @__PURE__ */ z.string(),
  ingredientId: /* @__PURE__ */ z.string(),
  brand: /* @__PURE__ */ z.string().nullable(),
  form: zProductForm,
  packageQuantity: /* @__PURE__ */ z.number(),
  packageLabel: /* @__PURE__ */ z.string(),
  createdAt: zInstant,
});

export type Product = z.infer<typeof zProduct>;

const zBrand = /* @__PURE__ */ z
  .string()
  .trim()
  .min(1, { error: 'La marque est vide : laissez-la absente.' })
  .max(120, { error: 'La marque dépasse 120 caractères.' });

/** Au millième près, comme la base la garde, et strictement positive. */
const zPackageQuantity = /* @__PURE__ */ z
  .number({ error: 'La contenance est un nombre.' })
  .gt(0, { error: 'La contenance est strictement positive.' })
  .max(10_000_000, { error: 'La contenance dépasse dix millions.' })
  .refine((quantite) => Math.round(quantite * 1000) / 1000 === quantite, {
    error: 'La contenance se donne au millième près.',
  });

const zPackageLabel = /* @__PURE__ */ z
  .string()
  .trim()
  .min(1, { error: 'Le conditionnement porte un nom (« boîte », « sachet »).' })
  .max(40, { error: 'Le nom du conditionnement dépasse 40 caractères.' });

/**
 * La création d'un Produit (`POST /products`). Que l'Ingrédient existe est
 * une règle métier (`food.unknown_ingredient`).
 */
export const zProductInput = /* @__PURE__ */ z.object({
  ingredientId: /* @__PURE__ */ z.string().trim().min(1),
  brand: /* @__PURE__ */ zBrand.nullable().default(null),
  form: zProductForm,
  packageQuantity: zPackageQuantity,
  packageLabel: zPackageLabel,
});

export type ProductInput = z.infer<typeof zProductInput>;

/**
 * Une modification ne porte que ce qu'elle change, sans valeur par défaut. Un
 * Produit ne change pas d'Ingrédient : sa contenance n'aurait plus de sens.
 */
export const zProductUpdate = /* @__PURE__ */ z
  .object({
    brand: /* @__PURE__ */ zBrand.nullable(),
    form: zProductForm,
    packageQuantity: zPackageQuantity,
    packageLabel: zPackageLabel,
  })
  .partial();

export type ProductUpdate = z.infer<typeof zProductUpdate>;

/**
 * Le choix du Produit préféré d'un Ingrédient
 * (`POST /ingredients/:id/preferred-product`) : l'un des siens, ou aucun.
 */
export const zPreferredProductInput = /* @__PURE__ */ z.object({
  productId: /* @__PURE__ */ z.string().trim().min(1).nullable(),
});

export type PreferredProductInput = z.infer<typeof zPreferredProductInput>;
