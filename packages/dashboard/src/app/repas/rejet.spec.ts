import type { RejectedSlot } from '@personal-os/contracts';
import { raisonDuRejet } from './rejet';

const NOMS = new Map([
  ['compte-a', 'Maxime'],
  ['compte-b', 'Léa'],
]);

const CRENEAU: RejectedSlot['slot'] = {
  day: '2026-10-22',
  moment: 'LUNCH',
  participantIds: ['compte-a', 'compte-b'],
  guestCount: 0,
};

function rejet(partiel: Partial<RejectedSlot>): RejectedSlot {
  return {
    slot: CRENEAU,
    reason: 'NO_PROPOSAL',
    ingredient: null,
    allergen: null,
    participantIds: [],
    ...partiel,
  };
}

describe('La raison d’un créneau écarté', () => {
  it('nomme l’ingrédient, l’allergène et le Compte allergique', () => {
    expect(
      raisonDuRejet(
        rejet({
          reason: 'ALLERGEN',
          ingredient: { label: 'noix de cajou', ingredientId: 'cajou' },
          allergen: 'TREE_NUTS',
          participantIds: ['compte-a'],
        }),
        NOMS,
      ),
    ).toBe(
      'Écarté : contient noix de cajou (fruits à coque), allergie de Maxime.',
    );
  });

  it('nomme chacun des Comptes concernés', () => {
    expect(
      raisonDuRejet(
        rejet({
          reason: 'ALLERGEN',
          ingredient: { label: 'crème', ingredientId: 'creme' },
          allergen: 'MILK',
          participantIds: ['compte-a', 'compte-b'],
        }),
        NOMS,
      ),
    ).toBe('Écarté : contient crème (lait), allergie de Maxime et Léa.');
  });

  it('nomme l’aliment interdit et à qui', () => {
    expect(
      raisonDuRejet(
        rejet({
          reason: 'EXCLUDED_INGREDIENT',
          ingredient: { label: 'coriandre', ingredientId: 'coriandre' },
          participantIds: ['compte-b'],
        }),
        NOMS,
      ),
    ).toBe('Écarté : contient coriandre, interdit à Léa.');
  });

  it('garde l’identifiant d’un Compte qu’il ne sait pas nommer', () => {
    expect(
      raisonDuRejet(
        rejet({
          reason: 'EXCLUDED_INGREDIENT',
          ingredient: { label: 'coriandre', ingredientId: 'coriandre' },
          participantIds: ['compte-x'],
        }),
        NOMS,
      ),
    ).toBe('Écarté : contient coriandre, interdit à compte-x.');
  });

  it('dit qu’un ingrédient inconnu rend la proposition incontrôlable', () => {
    expect(
      raisonDuRejet(
        rejet({
          reason: 'UNKNOWN_INGREDIENT',
          ingredient: { label: 'yuzu kosho', ingredientId: null },
        }),
        NOMS,
      ),
    ).toBe(
      "Écarté : «\u00a0yuzu kosho\u00a0» n'est pas au catalogue d'Ingrédients, la proposition n'a pas pu être contrôlée.",
    );
  });

  it('dit qu’une Recette citée n’existe pas', () => {
    expect(raisonDuRejet(rejet({ reason: 'UNKNOWN_RECIPE' }), NOMS)).toBe(
      "Écarté : la proposition cite une Recette que le Foyer n'a pas.",
    );
  });

  it('dit que l’IA n’a rien proposé', () => {
    expect(raisonDuRejet(rejet({ reason: 'NO_PROPOSAL' }), NOMS)).toBe(
      "Écarté : l'IA n'a rien proposé pour ce créneau.",
    );
  });
});
