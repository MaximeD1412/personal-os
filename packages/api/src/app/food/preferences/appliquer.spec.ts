import { contraintesDuRepas, type PreferenceAAppliquer } from './appliquer';

const ALICE = 'compte-alice';
const BRUNO = 'compte-bruno';

function allergie(userId: string, allergen: PreferenceAAppliquer['allergen']) {
  return { userId, kind: 'ALLERGY', allergen, ingredientId: null } as const;
}

function surIngredient(
  userId: string,
  kind: PreferenceAAppliquer['kind'],
  ingredientId: string,
) {
  return { userId, kind, allergen: null, ingredientId } as const;
}

describe('contraintesDuRepas', () => {
  it('interdit les allergies et les aliments exclus, évite ce qui est peu apprécié', () => {
    expect(
      contraintesDuRepas(
        [
          allergie(ALICE, 'TREE_NUTS'),
          surIngredient(ALICE, 'EXCLUDED', 'porc'),
          surIngredient(ALICE, 'DISLIKED', 'coriandre'),
          {
            userId: ALICE,
            kind: 'DISLIKED',
            allergen: 'FISH',
            ingredientId: null,
          },
        ],
        [ALICE],
      ),
    ).toEqual({
      interdits: { allergenes: ['TREE_NUTS'], ingredients: ['porc'] },
      evites: { allergenes: ['FISH'], ingredients: ['coriandre'] },
    });
  });

  it("ignore les Préférences d'un Compte absent du repas", () => {
    const preferences = [
      allergie(ALICE, 'TREE_NUTS'),
      surIngredient(BRUNO, 'EXCLUDED', 'porc'),
      surIngredient(BRUNO, 'DISLIKED', 'coriandre'),
    ];

    expect(contraintesDuRepas(preferences, [ALICE])).toEqual({
      interdits: { allergenes: ['TREE_NUTS'], ingredients: [] },
      evites: { allergenes: [], ingredients: [] },
    });
    expect(contraintesDuRepas(preferences, [BRUNO])).toEqual({
      interdits: { allergenes: [], ingredients: ['porc'] },
      evites: { allergenes: [], ingredients: ['coriandre'] },
    });
  });

  it('ne contraint rien quand personne ne mange', () => {
    expect(contraintesDuRepas([allergie(ALICE, 'MILK')], [])).toEqual({
      interdits: { allergenes: [], ingredients: [] },
      evites: { allergenes: [], ingredients: [] },
    });
  });

  it('réunit les Préférences des Participants, chaque cible une fois', () => {
    expect(
      contraintesDuRepas(
        [
          allergie(ALICE, 'MILK'),
          allergie(BRUNO, 'MILK'),
          surIngredient(ALICE, 'EXCLUDED', 'porc'),
          surIngredient(BRUNO, 'ALLERGY', 'porc'),
          surIngredient(ALICE, 'DISLIKED', 'coriandre'),
          surIngredient(BRUNO, 'DISLIKED', 'coriandre'),
        ],
        [ALICE, BRUNO],
      ),
    ).toEqual({
      interdits: { allergenes: ['MILK'], ingredients: ['porc'] },
      evites: { allergenes: [], ingredients: ['coriandre'] },
    });
  });

  it("n'évite pas ce qu'un autre Participant s'interdit déjà", () => {
    expect(
      contraintesDuRepas(
        [
          surIngredient(ALICE, 'DISLIKED', 'coriandre'),
          surIngredient(BRUNO, 'EXCLUDED', 'coriandre'),
          {
            userId: BRUNO,
            kind: 'DISLIKED',
            allergen: 'SESAME',
            ingredientId: null,
          },
          allergie(ALICE, 'SESAME'),
        ],
        [ALICE, BRUNO],
      ),
    ).toEqual({
      interdits: { allergenes: ['SESAME'], ingredients: ['coriandre'] },
      evites: { allergenes: [], ingredients: [] },
    });
  });
});
