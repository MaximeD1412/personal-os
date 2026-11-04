import * as z from 'zod';
import { zCanonicalUnit } from './ingredient';
import { aujourdhui, zDay, zInstant } from './valeurs';

/**
 * Une ligne du Stock domestique : la quantité d'un Ingrédient en Unité
 * canonique, et la péremption la plus proche, vide quand on ne la connaît pas.
 * Une seule ligne par Ingrédient (ADR 0013), qui se désigne donc par lui. Le
 * stock est déclaratif : ce que le Foyer a dit avoir, pas une vérité garantie.
 */
export const zPantryItem = /* @__PURE__ */ z.object({
  id: /* @__PURE__ */ z.string(),
  ingredient: /* @__PURE__ */ z.object({
    id: /* @__PURE__ */ z.string(),
    displayName: /* @__PURE__ */ z.string(),
    canonicalUnit: zCanonicalUnit,
  }),
  quantity: /* @__PURE__ */ z.number(),
  expiresOn: /* @__PURE__ */ zDay.nullable(),
  updatedAt: zInstant,
});

export type PantryItem = z.infer<typeof zPantryItem>;

/**
 * La base garde la quantité au millième (`Decimal(12,3)`) : une quantité plus
 * fine serait arrondie en silence. Zéro est une quantité : un Ingrédient épuisé
 * garde sa ligne tant qu'on ne la supprime pas. L'écran éditable en place
 * affiche ces messages tels quels, sous le champ.
 */
const zQuantity = /* @__PURE__ */ z
  .number({ error: 'La quantité est un nombre.' })
  .min(0, { error: 'La quantité ne peut pas être négative.' })
  .max(10_000_000, { error: 'La quantité dépasse dix millions.' })
  .refine((quantite) => Math.round(quantite * 1000) / 1000 === quantite, {
    error: 'La quantité se donne au millième près.',
  });

/**
 * La correction manuelle d'une ligne (`PUT /pantry-items/:ingredientId`) : elle
 * remplace la quantité et la péremption, et crée la ligne au besoin. Une
 * péremption omise est effacée ; une ligne à zéro n'en garde aucune.
 */
export const zPantryItemInput = /* @__PURE__ */ z.object({
  quantity: zQuantity,
  expiresOn: /* @__PURE__ */ zDay.nullable().default(null),
});

export type PantryItemInput = z.infer<typeof zPantryItemInput>;

/**
 * L'ajout d'un Ingrédient au stock, tel que son écran le saisit et se
 * préremplit (`/repas/stock/nouveau?ingredientId=…&quantity=6`) : la
 * correction, et l'Ingrédient qu'elle vise, qui part dans le chemin.
 */
export const zPantryItemAddition = /* @__PURE__ */ zPantryItemInput.extend({
  ingredientId: /* @__PURE__ */ z.string().min(1),
});

export type PantryItemAddition = z.infer<typeof zPantryItemAddition>;

/** « Périme bientôt » : dans les trois jours civils, à Paris. */
export const PEREMPTION_PROCHE_EN_JOURS = 3;

/** Les jours civils d'un jour à la péremption : 0 le jour même, négatif une fois passée. */
export function joursAvantPeremption(
  expiresOn: string,
  jour: string = aujourdhui(),
): number {
  // Deux minuits UTC : aucun changement d'heure ne s'intercale.
  return Math.round(
    (Date.parse(`${expiresOn}T00:00:00Z`) - Date.parse(`${jour}T00:00:00Z`)) /
      86_400_000,
  );
}

/**
 * Vrai si la ligne périme dans les trois jours, ou a déjà périmé : dans les
 * deux cas, elle est à consommer ou à écarter en premier.
 */
export function perimeBientot(
  expiresOn: string | null,
  jour: string = aujourdhui(),
): boolean {
  return (
    expiresOn !== null &&
    joursAvantPeremption(expiresOn, jour) <= PEREMPTION_PROCHE_EN_JOURS
  );
}
