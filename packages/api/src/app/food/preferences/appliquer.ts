import type { Allergen, FoodPreferenceKind } from '@personal-os/contracts';

/** Ce que l'application lit d'une Préférence alimentaire : la ligne en base. */
export interface PreferenceAAppliquer {
  userId: string;
  kind: FoodPreferenceKind;
  allergen: Allergen | null;
  ingredientId: string | null;
}

/** Des Allergènes et des Ingrédients, chacun une fois. */
export interface Cibles {
  allergenes: Allergen[];
  ingredients: string[];
}

/**
 * Ce qu'un repas doit respecter : les `interdits` ne s'y trouvent jamais, les
 * `evites` seulement si rien d'autre ne convient.
 */
export interface ContraintesDuRepas {
  interdits: Cibles;
  evites: Cibles;
}

/** Une allergie et un aliment exclu interdisent ; un aliment peu apprécié fait éviter. */
const INTERDIT: Readonly<Record<FoodPreferenceKind, boolean>> = {
  ALLERGY: true,
  EXCLUDED: true,
  DISLIKED: false,
};

/**
 * Les contraintes d'un repas, tirées des Préférences de ses Participants
 * seulement : celles d'un Compte absent ne comptent pas. Chaque cible n'y
 * figure qu'une fois, et ce qu'un Participant s'interdit n'est plus « évité »
 * pour un autre : l'interdit l'emporte.
 */
export function contraintesDuRepas(
  preferences: readonly PreferenceAAppliquer[],
  participantIds: readonly string[],
): ContraintesDuRepas {
  const participants = new Set(participantIds);
  const retenues = preferences.filter(({ userId }) => participants.has(userId));
  const interdits = ciblesDe(retenues.filter(({ kind }) => INTERDIT[kind]));
  const evites = ciblesDe(retenues.filter(({ kind }) => !INTERDIT[kind]));

  return {
    interdits,
    evites: {
      allergenes: evites.allergenes.filter(
        (allergene) => !interdits.allergenes.includes(allergene),
      ),
      ingredients: evites.ingredients.filter(
        (ingredient) => !interdits.ingredients.includes(ingredient),
      ),
    },
  };
}

function ciblesDe(preferences: readonly PreferenceAAppliquer[]): Cibles {
  const allergenes = new Set<Allergen>();
  const ingredients = new Set<string>();
  for (const { allergen, ingredientId } of preferences) {
    if (allergen !== null) allergenes.add(allergen);
    if (ingredientId !== null) ingredients.add(ingredientId);
  }
  return { allergenes: [...allergenes], ingredients: [...ingredients] };
}
