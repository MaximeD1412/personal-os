import { Injectable } from '@nestjs/common';
import type {
  CanonicalUnit,
  CookedMeal,
  CookedMealInput,
} from '@personal-os/contracts';
import { ErreurMetier, Introuvable } from '../erreurs/erreur-metier';
import {
  CookedMealRepository,
  type CookedMealRecord,
  type IngredientDeclare,
} from './cooked-meal.repository';
import { consommer, type Manque } from './stock/consommer';

/**
 * Une écriture concurrente du stock fait recommencer la déclaration sur le
 * stock relu ; au-delà de ces essais, on renonce plutôt que d'insister.
 */
const ESSAIS = 5;

const NOMS_D_UNITE: Readonly<Record<CanonicalUnit, string>> = {
  GRAM: 'grammes',
  MILLILITER: 'millilitres',
  PIECE: 'pièces',
};

/**
 * Le Repas cuisiné : la seule voie par laquelle la consommation fait baisser
 * le Stock domestique (ADR 0013). On déclare ce qu'on a réellement utilisé,
 * pas ce que la recette prévoyait. Le stock ne descend jamais sous zéro : ce
 * qu'il n'avait pas revient en manque, jamais en refus. Un repas ne se
 * cuisine qu'une fois et ne se modifie pas : une erreur se corrige au stock.
 */
@Injectable()
export class CookedMealService {
  constructor(private readonly repository: CookedMealRepository) {}

  async declarer({
    mealPlanEntryId,
    lines,
  }: CookedMealInput): Promise<CookedMeal> {
    for (let essai = 1; ; essai++) {
      try {
        return await this.essayer(mealPlanEntryId, lines);
      } catch (erreur) {
        if (codeDe(erreur) === 'P2002') throw dejaCuisine();
        if (codeDe(erreur) === 'P2003') throw repasIntrouvable();
        if (codeDe(erreur) !== 'P2025') throw erreur;
        if (essai === ESSAIS) {
          throw new ErreurMetier(
            'food.pantry_busy',
            'Le stock change en ce moment : déclarez le repas à nouveau.',
          );
        }
      }
    }
  }

  private async essayer(
    mealPlanEntryId: string,
    lignes: CookedMealInput['lines'],
  ): Promise<CookedMeal> {
    const repas = await this.repository.repas(mealPlanEntryId);
    if (!repas) throw repasIntrouvable();
    if (repas.dejaCuisine) throw dejaCuisine();
    if (repas.decision !== 'APPROVED') {
      throw new ErreurMetier(
        'food.entry_not_approved',
        "Seul un repas approuvé se cuisine : statuez d'abord sur celui-ci.",
      );
    }

    const ids = [...new Set(lignes.map(({ ingredientId }) => ingredientId))];
    const [ingredients, stock] = await Promise.all([
      this.repository.ingredients(ids),
      this.repository.stock(ids),
    ]);
    const catalogue = new Map(ingredients.map((i) => [i.id, i]));

    const consommation = consommer(
      lignes.map(({ ingredientId, quantity, unit }) => ({
        ingredientId,
        quantite: quantity,
        unite: unit,
      })),
      catalogue,
      stock,
    );
    if ('echec' in consommation) {
      const { ingredientId, raison } = consommation.echec;
      const ingredient = catalogue.get(ingredientId);
      if (raison === 'inconnu' || !ingredient) {
        throw new ErreurMetier(
          'food.unknown_ingredient',
          "Cet Ingrédient n'est pas au catalogue.",
        );
      }
      throw ligneInconvertible(ingredient, raison);
    }

    const repasCuisine = await this.repository.declarer(
      mealPlanEntryId,
      lignes.map(({ ingredientId, quantity, unit }) => ({
        ingredientId,
        quantity: String(quantity),
        unit,
      })),
      consommation.recalages.map(({ ingredientId, avant, apres }) => ({
        ingredientId,
        avant: {
          quantity: avant.quantite.toString(),
          expiresOn: avant.expireLe,
        },
        apres: {
          quantity: apres.quantite.toString(),
          expiresOn: apres.expireLe,
        },
      })),
    );
    return exposer(repasCuisine, consommation.manques, catalogue);
  }
}

function ligneInconvertible(
  { displayName, canonicalUnit }: IngredientDeclare,
  raison: 'dimension' | 'facteur_manquant',
): ErreurMetier {
  const unite = NOMS_D_UNITE[canonicalUnit];
  return new ErreurMetier(
    'food.cooked_meal_unconvertible_line',
    raison === 'dimension'
      ? `« ${displayName} » se compte en ${unite} : l'unité déclarée ne s'y convertit pas.`
      : `« ${displayName} » n'a pas de poids à la pièce : déclarez-le en ${unite}.`,
  );
}

function dejaCuisine(): ErreurMetier {
  return new ErreurMetier(
    'food.meal_already_cooked',
    'Ce repas est déjà déclaré cuisiné : une erreur se corrige dans le stock.',
  );
}

function repasIntrouvable(): Introuvable {
  return new Introuvable(
    'food.entry_not_found',
    'Aucun Repas planifié de cet identifiant.',
  );
}

function codeDe(erreur: unknown): unknown {
  return typeof erreur === 'object' && erreur !== null && 'code' in erreur
    ? erreur.code
    : undefined;
}

function exposer(
  repas: CookedMealRecord,
  manques: readonly Manque[],
  catalogue: ReadonlyMap<string, IngredientDeclare>,
): CookedMeal {
  return {
    id: repas.id,
    mealPlanEntryId: repas.mealPlanEntryId,
    cookedAt: repas.cookedAt.toISOString(),
    lines: repas.lines.map(({ id, ingredient, quantity, unit }) => ({
      id,
      ingredient,
      quantity: quantity.toNumber(),
      unit,
    })),
    // Un manque ne vient que d'un Ingrédient lu au catalogue : `consommer`
    // échoue avant sur un Ingrédient inconnu.
    shortfalls: manques.flatMap(({ ingredientId, disponible, manque }) => {
      const ingredient = catalogue.get(ingredientId);
      if (!ingredient) return [];
      const { id, displayName, canonicalUnit } = ingredient;
      return [
        {
          ingredient: { id, displayName, canonicalUnit },
          available: disponible.toNumber(),
          missing: manque.toNumber(),
        },
      ];
    }),
  };
}
