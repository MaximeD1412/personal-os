import { Injectable } from '@nestjs/common';
import type {
  FoodPreference,
  FoodPreferenceInput,
  FoodPreferenceListQuery,
} from '@personal-os/contracts';
import { ID_ESPACE_FOYER } from '@personal-os/database';
import { ErreurMetier, Introuvable } from '../erreurs/erreur-metier';
import {
  FoodPreferenceRepository,
  type FoodPreferenceRecord,
} from './food-preference.repository';

/**
 * Les Préférences alimentaires du Foyer. Le schéma d'entrée a déjà jugé la
 * cible : un Allergène ou un Ingrédient, jamais les deux ni aucun. Il reste
 * ici ce qu'il ne voit pas : un Compte hors du Foyer, un Ingrédient absent du
 * catalogue, une Préférence déjà enregistrée.
 *
 * Elles vivent dans l'Espace foyer, que le module pose lui-même (ADR 0014) :
 * les deux Comptes voient et modifient les Préférences des deux.
 */
@Injectable()
export class FoodPreferenceService {
  constructor(private readonly repository: FoodPreferenceRepository) {}

  async lister(
    { userId }: FoodPreferenceListQuery,
    compteId: string,
  ): Promise<FoodPreference[]> {
    if (userId !== undefined) {
      await this.verifierLeMembre(userId, compteId);
    }

    return (await this.repository.lister(userId)).map(exposer);
  }

  async creer(
    saisie: FoodPreferenceInput,
    compteId: string,
  ): Promise<FoodPreference> {
    await this.verifierLeMembre(saisie.userId, compteId);
    if (
      saisie.target === 'INGREDIENT' &&
      !(await this.repository.ingredientExiste(saisie.ingredientId))
    ) {
      throw ingredientInconnu();
    }

    try {
      return exposer(
        await this.repository.creer({
          scopeId: ID_ESPACE_FOYER,
          userId: saisie.userId,
          kind: saisie.kind,
          allergen: saisie.target === 'ALLERGEN' ? saisie.allergen : null,
          ingredientId:
            saisie.target === 'INGREDIENT' ? saisie.ingredientId : null,
        }),
      );
    } catch (erreur) {
      throw traduire(erreur);
    }
  }

  async supprimer(id: string): Promise<void> {
    if ((await this.repository.supprimer(id)) === 0) {
      throw new Introuvable(
        'food.preference_not_found',
        'Aucune Préférence alimentaire de cet identifiant.',
      );
    }
  }

  private async verifierLeMembre(
    userId: string,
    compteId: string,
  ): Promise<void> {
    if (!(await this.repository.duMemeFoyer(userId, compteId))) {
      throw new ErreurMetier(
        'food.unknown_member',
        "Ce Compte n'est pas un membre du Foyer.",
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

/**
 * La base tranche entre deux saisies simultanées : son index unique refuse
 * un doublon, sa clé étrangère un Ingrédient supprimé entre-temps.
 */
function traduire(erreur: unknown): unknown {
  const code =
    typeof erreur === 'object' && erreur !== null && 'code' in erreur
      ? erreur.code
      : undefined;

  if (code === 'P2002') {
    return new ErreurMetier(
      'food.preference_duplicate',
      'Ce Compte a déjà cette Préférence alimentaire.',
    );
  }
  if (code === 'P2003') {
    return ingredientInconnu();
  }
  return erreur;
}

function exposer(preference: FoodPreferenceRecord): FoodPreference {
  const commun = {
    id: preference.id,
    userId: preference.userId,
    kind: preference.kind,
    createdAt: preference.createdAt.toISOString(),
  };

  if (preference.allergen !== null) {
    return { ...commun, target: 'ALLERGEN', allergen: preference.allergen };
  }
  return {
    ...commun,
    target: 'INGREDIENT',
    ingredientId: preference.ingredientId ?? '',
    ingredientDisplayName: preference.ingredient?.displayName ?? '',
  };
}
