import { Injectable } from '@nestjs/common';
import type { MealWish, MealWishInput } from '@personal-os/contracts';
import { ErreurMetier, Introuvable } from '../erreurs/erreur-metier';
import {
  MealWishRepository,
  type MealWishRecord,
} from './meal-wish.repository';

/**
 * Les dépôts arrivent validés par leur schéma (ADR 0030) : il ne reste ici que
 * ce qu'un schéma ne peut pas juger seul. Une Recette absente, un Souhait
 * introuvable. Leur prise en compte par la génération vient avec CUISINE-16.
 */
@Injectable()
export class MealWishService {
  constructor(private readonly repository: MealWishRepository) {}

  /** Les Souhaits d'une semaine, des deux Comptes, dans l'ordre du dépôt. */
  async lister(semaine: string): Promise<MealWish[]> {
    return (await this.repository.lister(semaine)).map(exposer);
  }

  async deposer(
    { week, recipeId, text }: MealWishInput,
    auteurId: string,
  ): Promise<MealWish> {
    if (
      recipeId !== undefined &&
      !(await this.repository.recetteExiste(recipeId))
    ) {
      throw new ErreurMetier(
        'food.wish_unknown_recipe',
        "Ce Souhait cite une Recette qui n'existe pas.",
      );
    }

    return exposer(
      await this.repository.deposer({
        week,
        recipeId: recipeId ?? null,
        text: text ?? null,
        authorId: auteurId,
      }),
    );
  }

  async retirer(id: string): Promise<void> {
    if (!(await this.repository.retirer(id))) {
      throw new Introuvable(
        'food.wish_not_found',
        'Aucun Souhait de cet identifiant.',
      );
    }
  }
}

function exposer(souhait: MealWishRecord): MealWish {
  return {
    id: souhait.id,
    week: souhait.week,
    recipe: souhait.recipe,
    text: souhait.text,
    authorId: souhait.authorId,
    createdAt: souhait.createdAt.toISOString(),
  };
}
