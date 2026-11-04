import type { CanonicalUnit, FoodPreferenceKind } from '@personal-os/contracts';
import { ErreurMetier } from '../../erreurs/erreur-metier';
import {
  recaler,
  type LigneDeStock,
  type LigneRecalee,
} from '../stock/recaler';

/** Une Préférence alimentaire qui vise un Ingrédient. */
export interface PreferenceDIngredient {
  id: string;
  userId: string;
  kind: FoodPreferenceKind;
}

/** Ce que la fusion lit d'un Ingrédient : ce qui ne se repointe pas tel quel. */
export interface IngredientAFusionner {
  id: string;
  /** Le libellé normalisé : celui du doublon devient un Alias. */
  name: string;
  canonicalUnit: CanonicalUnit;
  preferredProductId: string | null;
  /** Sa ligne du Stock domestique, vide s'il n'en a pas. */
  stock: LigneDeStock | null;
  preferences: readonly PreferenceDIngredient[];
}

/** Ce que la fusion fait de la ligne de stock du doublon. */
export type FusionDuStock =
  /** Le doublon n'est pas en stock. */
  | { type: 'AUCUN' }
  /** Seul le doublon l'est : sa ligne passe au conservé, telle quelle. */
  | { type: 'REPRENDRE'; avant: LigneDeStock }
  /** Les deux le sont : la ligne du conservé reçoit celle du doublon, qui disparaît. */
  | {
      type: 'ADDITIONNER';
      duDoublon: LigneDeStock;
      duConserve: LigneDeStock;
      apres: LigneRecalee;
    };

export interface PlanDeFusion {
  /** Le libellé à rattacher au conservé : le nom du doublon. */
  alias: string;
  stock: FusionDuStock;
  /** Les Préférences du doublon que le conservé a déjà : elles disparaissent. */
  preferencesEnDouble: string[];
  /** Les Comptes dont une Préférence change : leur version grandit (CUISINE-16). */
  comptesTouches: string[];
  /** Le Produit préféré du conservé après la fusion. */
  produitPrefere: string | null;
}

/**
 * Ce que la fusion d'un doublon dans l'Ingrédient conservé écrit, au-delà des
 * références qui se repointent telles quelles (lignes de recette, de repas
 * cuisiné et de courses, Alias, Produits). Une quantité ne garde son sens que
 * dans la même Unité canonique : sans elle, la fusion est refusée.
 *
 * Il n'y a qu'une ligne de stock par Ingrédient : les deux s'additionnent par
 * la voie d'ajout du recaleur, qui garde la péremption la plus proche. Une
 * Préférence ne s'enregistre qu'une fois par Compte et par type : celle que la
 * fusion rendrait double disparaît. Le conservé garde son Produit préféré, ou
 * reprend celui du doublon s'il n'en avait pas.
 */
export function fusionner(
  doublon: IngredientAFusionner,
  conserve: IngredientAFusionner,
): PlanDeFusion {
  if (doublon.id === conserve.id) {
    throw new ErreurMetier(
      'food.merge_same_ingredient',
      'Un Ingrédient ne se fusionne pas avec lui-même : choisissez son doublon.',
    );
  }
  if (doublon.canonicalUnit !== conserve.canonicalUnit) {
    throw new ErreurMetier(
      'food.merge_unit_mismatch',
      "Deux Ingrédients ne se fusionnent que s'ils se comptent dans la même Unité canonique : alignez-la d'abord.",
    );
  }

  const dejaLa = new Set(
    conserve.preferences.map(({ userId, kind }) => `${userId}:${kind}`),
  );

  return {
    alias: doublon.name,
    stock: fusionDuStock(doublon.stock, conserve.stock),
    preferencesEnDouble: doublon.preferences
      .filter(({ userId, kind }) => dejaLa.has(`${userId}:${kind}`))
      .map(({ id }) => id),
    comptesTouches: [
      ...new Set(doublon.preferences.map(({ userId }) => userId)),
    ],
    produitPrefere: conserve.preferredProductId ?? doublon.preferredProductId,
  };
}

function fusionDuStock(
  duDoublon: LigneDeStock | null,
  duConserve: LigneDeStock | null,
): FusionDuStock {
  if (!duDoublon) return { type: 'AUCUN' };
  if (!duConserve) return { type: 'REPRENDRE', avant: duDoublon };

  const { ligne } = recaler(duConserve, {
    type: 'ACHAT',
    quantite: duDoublon.quantite,
    expireLe: duDoublon.expireLe,
  });
  return { type: 'ADDITIONNER', duDoublon, duConserve, apres: ligne };
}
