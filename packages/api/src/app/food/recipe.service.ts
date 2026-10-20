import { Injectable } from '@nestjs/common';
import type {
  Recipe,
  RecipeInput,
  RecipeLineInput,
  RecipeListQuery,
  RecipeUpdate,
} from '@personal-os/contracts';
import { ErreurMetier, Introuvable } from '../erreurs/erreur-metier';
import {
  RecipeRepository,
  type RecipeRecord,
  type RecipeWrite,
} from './recipe.repository';

/**
 * Les saisies arrivent validées par leur schéma (ADR 0030) : il ne reste ici
 * que ce qu'un schéma ne peut pas juger seul. Un Ingrédient absent du
 * catalogue, une modification vide, une recette introuvable.
 */
@Injectable()
export class RecipeService {
  constructor(private readonly repository: RecipeRepository) {}

  /** Toutes les recettes, ou celles dont le titre contient chaque mot de `q`. */
  async lister({ q }: RecipeListQuery): Promise<Recipe[]> {
    const mots = (q ?? '').split(/\s+/).filter(Boolean);

    return (await this.repository.lister(mots)).map(exposer);
  }

  async lire(id: string): Promise<Recipe> {
    const recette = await this.repository.lire(id);
    if (!recette) {
      throw introuvable();
    }
    return exposer(recette);
  }

  async creer({ lines, ...saisie }: RecipeInput): Promise<Recipe> {
    await this.verifierLesIngredients(lines);

    return exposer(await this.repository.creer(saisie, lines));
  }

  async modifier(
    id: string,
    { lines, ...saisie }: RecipeUpdate,
  ): Promise<Recipe> {
    const changements = enChangements(saisie);

    if (Object.keys(changements).length === 0 && !lines) {
      throw new ErreurMetier(
        'food.recipe_empty_update',
        'La modification ne change rien.',
      );
    }
    if (lines) {
      await this.verifierLesIngredients(lines);
    }

    return exposer(
      await introuvableSinon(this.repository.modifier(id, changements, lines)),
    );
  }

  /**
   * `food.recipe_in_use` refusera la suppression d'une recette qu'un Repas
   * planifié à venir utilise. Le Planning de repas n'existe pas encore
   * (CUISINE-7) : rien ne peut aujourd'hui retenir une recette, et la règle
   * arrivera avec lui.
   */
  async supprimer(id: string): Promise<void> {
    await introuvableSinon(this.repository.supprimer(id));
  }

  /** Une ligne ne cite qu'un Ingrédient du catalogue : un libellé libre se résout avant. */
  private async verifierLesIngredients(
    lignes: readonly RecipeLineInput[],
  ): Promise<void> {
    const ids = new Set(lignes.map(({ ingredientId }) => ingredientId));
    const connus = await this.repository.ingredientsConnus([...ids]);

    if (connus.size !== ids.size) {
      throw new ErreurMetier(
        'food.recipe_unknown_ingredient',
        "Une ligne cite un Ingrédient qui n'est pas au catalogue.",
      );
    }
  }
}

function introuvable(): Introuvable {
  return new Introuvable(
    'food.recipe_not_found',
    'Aucune Recette de cet identifiant.',
  );
}

/** Une recette absente, ou hors de l'Espace foyer, fait échouer l'écriture. */
async function introuvableSinon<T>(operation: Promise<T>): Promise<T> {
  try {
    return await operation;
  } catch (erreur) {
    if (
      typeof erreur === 'object' &&
      erreur !== null &&
      'code' in erreur &&
      erreur.code === 'P2025'
    ) {
      throw introuvable();
    }
    throw erreur;
  }
}

/** Une modification ne porte que ce qu'elle change. */
function enChangements(
  saisie: Omit<RecipeUpdate, 'lines'>,
): Partial<RecipeWrite> {
  return Object.fromEntries(
    Object.entries(saisie).filter(([, valeur]) => valeur !== undefined),
  );
}

function exposer(recette: RecipeRecord): Recipe {
  return {
    id: recette.id,
    title: recette.title,
    servings: recette.servings,
    steps: recette.steps,
    source: recette.source,
    lines: recette.lines.map(({ id, ingredient, quantity, unit }) => ({
      id,
      ingredient: { id: ingredient.id, displayName: ingredient.displayName },
      quantity,
      unit,
    })),
    createdAt: recette.createdAt.toISOString(),
    updatedAt: recette.updatedAt.toISOString(),
  };
}
