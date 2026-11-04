import { Injectable } from '@nestjs/common';
import type { PantryItem, PantryItemInput } from '@personal-os/contracts';
import { ErreurMetier, Introuvable } from '../erreurs/erreur-metier';
import {
  PantryItemRepository,
  type PantryItemRecord,
} from './pantry-item.repository';
import { recaler } from './stock/recaler';

/**
 * Le Stock domestique du Foyer : une ligne par Ingrédient, déclarative (ADR
 * 0013). Ce service en porte la troisième voie de recalage, la correction
 * manuelle ; l'achat et la consommation viendront des Courses et des Repas
 * cuisinés, par le même recaleur.
 */
@Injectable()
export class PantryItemService {
  constructor(private readonly repository: PantryItemRepository) {}

  async lister(): Promise<PantryItem[]> {
    return (await this.repository.lister()).map(exposer);
  }

  async corriger(
    ingredientId: string,
    saisie: PantryItemInput,
  ): Promise<PantryItem> {
    if (!(await this.repository.ingredientExiste(ingredientId))) {
      throw ingredientInconnu();
    }

    const { ligne } = recaler(null, {
      type: 'CORRECTION',
      quantite: saisie.quantity,
      expireLe: saisie.expiresOn,
    });
    const ecriture = {
      quantity: ligne.quantite.toString(),
      expiresOn: ligne.expireLe,
    };

    try {
      return exposer(await this.repository.poser(ingredientId, ecriture));
    } catch (erreur) {
      // Deux premières saisies simultanées : la seconde trouve la ligne que
      // la première vient de créer, et la remplace.
      if (codeDe(erreur) === 'P2002') {
        return exposer(await this.repository.poser(ingredientId, ecriture));
      }
      // L'Ingrédient a disparu entre la vérification et l'écriture.
      if (codeDe(erreur) === 'P2003') {
        throw ingredientInconnu();
      }
      throw erreur;
    }
  }

  async supprimer(ingredientId: string): Promise<void> {
    if ((await this.repository.supprimer(ingredientId)) === 0) {
      throw new Introuvable(
        'food.pantry_item_not_found',
        "Cet Ingrédient n'est pas dans le stock.",
      );
    }
  }
}

function ingredientInconnu(): ErreurMetier {
  return new ErreurMetier(
    'food.unknown_ingredient',
    "Cet Ingrédient n'est pas au catalogue.",
  );
}

function codeDe(erreur: unknown): unknown {
  return typeof erreur === 'object' && erreur !== null && 'code' in erreur
    ? erreur.code
    : undefined;
}

function exposer(ligne: PantryItemRecord): PantryItem {
  return {
    id: ligne.id,
    ingredient: ligne.ingredient,
    quantity: ligne.quantity.toNumber(),
    expiresOn: ligne.expiresOn?.toISOString().slice(0, 10) ?? null,
    updatedAt: ligne.updatedAt.toISOString(),
  };
}
