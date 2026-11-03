import type { PreferenceAAppliquer } from '../preferences/appliquer';
import { controler, type ContexteDuControle } from './controler';
import type { PropositionDeRepas, RecetteProposee } from './proposition';
import type { Creneau } from './tours';

const LUNDI = '2028-03-13';
const MARDI = '2028-03-14';

const NOIX = { id: 'noix', name: 'noix', allergens: ['TREE_NUTS' as const] };
const SALADE = { id: 'salade', name: 'salade verte', allergens: [] };
const CREVETTE = {
  id: 'crevette',
  name: 'crevette',
  allergens: ['CRUSTACEANS' as const],
};
const LENTILLES = { id: 'lentilles', name: 'lentilles vertes', allergens: [] };

function contexte(
  preferences: PreferenceAAppliquer[] = [],
  recettes: ContexteDuControle['recettes'] = [],
): ContexteDuControle {
  return {
    catalogue: {
      ingredients: [NOIX, SALADE, CREVETTE, LENTILLES],
      alias: [{ label: 'cerneaux de noix', ingredientId: 'noix' }],
    },
    recettes,
    preferences,
  };
}

function allergie(userId: string, allergen: 'TREE_NUTS'): PreferenceAAppliquer {
  return { userId, kind: 'ALLERGY', allergen, ingredientId: null };
}

function creneau(
  day: string,
  moment: Creneau['moment'] = 'DINNER',
  participantIds: string[] = ['a', 'b'],
): Creneau {
  return { day, moment, participantIds, guestCount: 0 };
}

function nouvelle(...labels: string[]): RecetteProposee {
  return {
    title: 'Salade composée',
    servings: 2,
    steps: ['Mélanger.'],
    ingredients: labels.map((label) => ({ label, quantity: 100, unit: 'G' })),
  };
}

function proposition(
  day: string,
  recette: RecetteProposee | string,
  moment: Creneau['moment'] = 'DINNER',
): PropositionDeRepas {
  return typeof recette === 'string'
    ? { day, moment, recipeId: recette, recipe: null }
    : { day, moment, recipeId: null, recipe: recette };
}

describe('controler', () => {
  it('rejette un plat aux noix pour un Participant allergique aux fruits à coque, et vide le créneau', () => {
    const resultat = controler(
      [proposition(LUNDI, nouvelle('Salade verte', 'Cerneaux de noix'))],
      [creneau(LUNDI)],
      contexte([allergie('b', 'TREE_NUTS')]),
    );

    expect(resultat.retenues).toEqual([]);
    expect(resultat.rejetes).toEqual([
      {
        slot: creneau(LUNDI),
        reason: 'ALLERGEN',
        ingredient: { label: 'Cerneaux de noix', ingredientId: 'noix' },
        allergen: 'TREE_NUTS',
        participantIds: ['b'],
      },
    ]);
  });

  it("retient le plat quand l'allergique est absent du repas", () => {
    const resultat = controler(
      [proposition(LUNDI, nouvelle('Salade verte', 'noix'))],
      [creneau(LUNDI, 'DINNER', ['a'])],
      contexte([allergie('b', 'TREE_NUTS')]),
    );

    expect(resultat.rejetes).toEqual([]);
    expect(resultat.retenues).toEqual([
      {
        creneau: creneau(LUNDI, 'DINNER', ['a']),
        recette: {
          nouvelle: {
            title: 'Salade composée',
            servings: 2,
            steps: ['Mélanger.'],
            lignes: [
              { ingredientId: 'salade', quantity: 100, unit: 'G' },
              { ingredientId: 'noix', quantity: 100, unit: 'G' },
            ],
          },
        },
      },
    ]);
  });

  it("ne présente pas une proposition dont un libellé est inconnu : elle n'est pas contrôlable", () => {
    const resultat = controler(
      [proposition(LUNDI, nouvelle('Salade verte', 'Sauce mystère'))],
      [creneau(LUNDI)],
      contexte(),
    );

    expect(resultat.retenues).toEqual([]);
    expect(resultat.rejetes).toEqual([
      {
        slot: creneau(LUNDI),
        reason: 'UNKNOWN_INGREDIENT',
        ingredient: { label: 'Sauce mystère', ingredientId: null },
        allergen: null,
        participantIds: [],
      },
    ]);
  });

  it("donne l'allergène plutôt que l'inconnu quand la proposition a les deux", () => {
    const { rejetes } = controler(
      [proposition(LUNDI, nouvelle('Sauce mystère', 'noix'))],
      [creneau(LUNDI)],
      contexte([allergie('a', 'TREE_NUTS')]),
    );

    expect(rejetes.map(({ reason }) => reason)).toEqual(['ALLERGEN']);
  });

  it('rejette un ingrédient exclu par un Participant, et nomme chacun de ceux qui l’excluent', () => {
    const { rejetes } = controler(
      [proposition(LUNDI, nouvelle('Lentilles vertes'))],
      [creneau(LUNDI)],
      contexte([
        {
          userId: 'a',
          kind: 'EXCLUDED',
          allergen: null,
          ingredientId: 'lentilles',
        },
        {
          userId: 'b',
          kind: 'ALLERGY',
          allergen: null,
          ingredientId: 'lentilles',
        },
      ]),
    );

    expect(rejetes).toEqual([
      expect.objectContaining({
        reason: 'EXCLUDED_INGREDIENT',
        ingredient: { label: 'Lentilles vertes', ingredientId: 'lentilles' },
        allergen: null,
        participantIds: ['a', 'b'],
      }),
    ]);
  });

  it('rejette un Allergène exclu sans allergie (un régime), comme une allergie', () => {
    const { rejetes } = controler(
      [proposition(LUNDI, nouvelle('Crevette'))],
      [creneau(LUNDI)],
      contexte([
        {
          userId: 'a',
          kind: 'EXCLUDED',
          allergen: 'CRUSTACEANS',
          ingredientId: null,
        },
      ]),
    );

    expect(rejetes).toEqual([
      expect.objectContaining({ reason: 'ALLERGEN', allergen: 'CRUSTACEANS' }),
    ]);
  });

  it("ne contrôle pas un aliment peu apprécié : il n'est qu'évité", () => {
    const { retenues, rejetes } = controler(
      [proposition(LUNDI, nouvelle('Lentilles vertes'))],
      [creneau(LUNDI)],
      contexte([
        {
          userId: 'a',
          kind: 'DISLIKED',
          allergen: null,
          ingredientId: 'lentilles',
        },
      ]),
    );

    expect(rejetes).toEqual([]);
    expect(retenues).toHaveLength(1);
  });

  it('contrôle une Recette du Foyer par ses lignes', () => {
    const tarte = {
      id: 'tarte',
      lines: [
        { ingredientId: 'salade', label: 'Salade verte' },
        { ingredientId: 'noix', label: 'Noix' },
      ],
    };
    const resultat = controler(
      [proposition(LUNDI, 'tarte'), proposition(MARDI, 'tarte')],
      [creneau(LUNDI), creneau(MARDI, 'DINNER', ['a'])],
      contexte([allergie('b', 'TREE_NUTS')], [tarte]),
    );

    expect(resultat.rejetes).toEqual([
      {
        slot: creneau(LUNDI),
        reason: 'ALLERGEN',
        ingredient: { label: 'Noix', ingredientId: 'noix' },
        allergen: 'TREE_NUTS',
        participantIds: ['b'],
      },
    ]);
    expect(resultat.retenues).toEqual([
      {
        creneau: creneau(MARDI, 'DINNER', ['a']),
        recette: { recipeId: 'tarte' },
      },
    ]);
  });

  it("rejette une Recette que le Foyer n'a pas", () => {
    const { rejetes } = controler(
      [proposition(LUNDI, 'inventee')],
      [creneau(LUNDI)],
      contexte(),
    );

    expect(rejetes).toEqual([
      {
        slot: creneau(LUNDI),
        reason: 'UNKNOWN_RECIPE',
        ingredient: null,
        allergen: null,
        participantIds: [],
      },
    ]);
  });

  it('préfère la Recette du Foyer quand la proposition donne aussi une recette nouvelle', () => {
    const { retenues } = controler(
      [{ ...proposition(LUNDI, 'lentilles'), recipe: nouvelle('noix') }],
      [creneau(LUNDI)],
      contexte(
        [allergie('a', 'TREE_NUTS')],
        [
          {
            id: 'lentilles',
            lines: [{ ingredientId: 'lentilles', label: 'Lentilles' }],
          },
        ],
      ),
    );

    expect(retenues).toEqual([
      { creneau: creneau(LUNDI), recette: { recipeId: 'lentilles' } },
    ]);
  });

  it("vide un créneau pour lequel l'IA n'a rien proposé, et ignore ce qui n'était pas demandé", () => {
    const resultat = controler(
      [
        proposition(MARDI, nouvelle('Salade verte')),
        { day: LUNDI, moment: 'DINNER', recipeId: null, recipe: null },
      ],
      [creneau(LUNDI, 'LUNCH'), creneau(LUNDI)],
      contexte(),
    );

    expect(resultat.retenues).toEqual([]);
    expect(resultat.rejetes).toEqual([
      {
        slot: creneau(LUNDI, 'LUNCH'),
        reason: 'NO_PROPOSAL',
        ingredient: null,
        allergen: null,
        participantIds: [],
      },
      {
        slot: creneau(LUNDI),
        reason: 'NO_PROPOSAL',
        ingredient: null,
        allergen: null,
        participantIds: [],
      },
    ]);
  });

  it('ne retient que la première proposition d’un créneau', () => {
    const { retenues, rejetes } = controler(
      [
        proposition(LUNDI, nouvelle('noix')),
        proposition(LUNDI, nouvelle('Salade verte')),
      ],
      [creneau(LUNDI)],
      contexte([allergie('a', 'TREE_NUTS')]),
    );

    expect(retenues).toEqual([]);
    expect(rejetes.map(({ reason }) => reason)).toEqual(['ALLERGEN']);
  });

  it('arrondit une quantité au millième, sans jamais la ramener à zéro', () => {
    const recette = nouvelle('Salade verte', 'Lentilles vertes');
    recette.ingredients[0].quantity = 12.34567;
    recette.ingredients[1].quantity = 0.0001;

    const { retenues } = controler(
      [proposition(LUNDI, recette)],
      [creneau(LUNDI)],
      contexte(),
    );

    const [retenue] = retenues;
    expect(
      'nouvelle' in retenue.recette &&
        retenue.recette.nouvelle.lignes.map(({ quantity }) => quantity),
    ).toEqual([12.346, 0.001]);
  });
});
