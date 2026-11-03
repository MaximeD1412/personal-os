import Decimal from 'decimal.js';
import type { CanonicalUnit, RecipeUnit } from '@personal-os/contracts';
import { convertir, type EchecDeConversion } from '../conversion/convertir';
import { recaler, type LigneDeStock, type LigneRecalee } from './recaler';

/** Une ligne déclarée d'un Repas cuisiné, dans l'unité où on l'a dite. */
export interface LigneConsommee {
  ingredientId: string;
  quantite: Decimal.Value;
  unite: RecipeUnit;
}

/** Ce que la consommation lit d'un Ingrédient du catalogue. */
export interface IngredientConsomme {
  id: string;
  canonicalUnit: CanonicalUnit;
  gramsPerPiece: Decimal.Value | null;
}

/** La ligne de stock d'un Ingrédient, avant et après la consommation. */
export interface RecalageDeStock {
  ingredientId: string;
  avant: LigneRecalee;
  apres: LigneRecalee;
}

/** Ce que le stock n'avait pas, en Unité canonique. */
export interface Manque {
  ingredientId: string;
  disponible: Decimal;
  manque: Decimal;
}

export type Consommation =
  | { recalages: RecalageDeStock[]; manques: Manque[] }
  | {
      echec: {
        ingredientId: string;
        raison: EchecDeConversion | 'inconnu';
      };
    };

/**
 * Ce qu'un Repas cuisiné fait au Stock domestique (ADR 0013). Chaque ligne se
 * convertit dans l'Unité canonique de son Ingrédient, au millième que la base
 * garde ; deux lignes du même Ingrédient s'additionnent, puisqu'il n'a qu'une
 * ligne de stock. Le recaleur retire la somme sans descendre sous zéro, et ce
 * qui manquait revient en manque, jamais en refus. Un Ingrédient absent du
 * stock n'y entre pas : tout ce qu'on en a utilisé manquait.
 *
 * Une ligne qui ne se convertit pas fait échouer toute la déclaration : le
 * stock ne baisse jamais d'une quantité approchée.
 */
export function consommer(
  lignes: readonly LigneConsommee[],
  catalogue: ReadonlyMap<string, IngredientConsomme>,
  stock: ReadonlyMap<string, LigneDeStock>,
): Consommation {
  const parIngredient = new Map<string, Decimal>();
  for (const { ingredientId, quantite, unite } of lignes) {
    const ingredient = catalogue.get(ingredientId);
    if (!ingredient) {
      return { echec: { ingredientId, raison: 'inconnu' } };
    }
    const conversion = convertir({ quantite, unite }, ingredient);
    if ('echec' in conversion) {
      return { echec: { ingredientId, raison: conversion.echec } };
    }
    parIngredient.set(
      ingredientId,
      (parIngredient.get(ingredientId) ?? new Decimal(0)).plus(
        conversion.quantite.toDecimalPlaces(3, Decimal.ROUND_HALF_UP),
      ),
    );
  }

  const recalages: RecalageDeStock[] = [];
  const manques: Manque[] = [];
  for (const [ingredientId, quantite] of parIngredient) {
    const ligne = stock.get(ingredientId) ?? null;
    const { ligne: apres, manque } = recaler(ligne, {
      type: 'CONSOMMATION',
      quantite,
    });
    const disponible = new Decimal(ligne?.quantite ?? 0);
    if (ligne) {
      recalages.push({
        ingredientId,
        avant: { quantite: disponible, expireLe: ligne.expireLe },
        apres,
      });
    }
    if (manque) {
      manques.push({ ingredientId, disponible, manque });
    }
  }
  return { recalages, manques };
}
