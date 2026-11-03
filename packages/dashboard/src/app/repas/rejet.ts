import {
  LIBELLES_DES_ALLERGENES,
  type RejectedSlot,
} from '@personal-os/contracts';

/** « Maxime », « Maxime et Léa », « Maxime, Léa et Sam ». */
function enumerer(noms: readonly string[]): string {
  return noms.length > 1
    ? `${noms.slice(0, -1).join(', ')} et ${noms[noms.length - 1]}`
    : (noms[0] ?? '');
}

/**
 * Pourquoi le contrôle a vidé un créneau, en une phrase : l'ingrédient en
 * cause, l'Allergène, et les Comptes dont la Préférence l'a écarté. Un Compte
 * que l'écran ne sait pas nommer garde son identifiant : la raison ne perd
 * jamais qui est concerné.
 */
export function raisonDuRejet(
  rejet: RejectedSlot,
  noms: ReadonlyMap<string, string>,
): string {
  const qui = enumerer(rejet.participantIds.map((id) => noms.get(id) ?? id));
  const ingredient = rejet.ingredient?.label ?? 'un ingrédient';

  switch (rejet.reason) {
    case 'ALLERGEN': {
      const allergene = rejet.allergen
        ? ` (${LIBELLES_DES_ALLERGENES[rejet.allergen].toLowerCase()})`
        : '';
      return `Écarté : contient ${ingredient}${allergene}, allergie de ${qui}.`;
    }
    case 'EXCLUDED_INGREDIENT':
      return `Écarté : contient ${ingredient}, interdit à ${qui}.`;
    case 'UNKNOWN_INGREDIENT':
      return `Écarté : «\u00a0${ingredient}\u00a0» n'est pas au catalogue d'Ingrédients, la proposition n'a pas pu être contrôlée.`;
    case 'UNKNOWN_RECIPE':
      return "Écarté : la proposition cite une Recette que le Foyer n'a pas.";
    case 'NO_PROPOSAL':
      return "Écarté : l'IA n'a rien proposé pour ce créneau.";
  }
}
