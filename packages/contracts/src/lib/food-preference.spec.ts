import {
  FOOD_PREFERENCE_KINDS,
  LIBELLES_DES_PREFERENCES,
  zFoodPreferenceInput,
  zFoodPreferenceListQuery,
} from './food-preference';

/** Les chemins des champs qu'un schéma refuse, comme `fields` les rendra. */
function cheminsRefuses(resultat: {
  success: boolean;
  error?: { issues: { path: PropertyKey[] }[] };
}): string[] {
  return (resultat.error?.issues ?? []).map(({ path }) => path.join('.'));
}

describe('zFoodPreferenceInput', () => {
  it('accepte une Préférence qui vise un Allergène', () => {
    expect(
      zFoodPreferenceInput.parse({
        userId: 'compte-a',
        kind: 'ALLERGY',
        target: 'ALLERGEN',
        allergen: 'TREE_NUTS',
      }),
    ).toEqual({
      userId: 'compte-a',
      kind: 'ALLERGY',
      target: 'ALLERGEN',
      allergen: 'TREE_NUTS',
    });
  });

  it('accepte une Préférence qui vise un Ingrédient', () => {
    expect(
      zFoodPreferenceInput.parse({
        userId: 'compte-a',
        kind: 'DISLIKED',
        target: 'INGREDIENT',
        ingredientId: 'coriandre',
      }),
    ).toEqual({
      userId: 'compte-a',
      kind: 'DISLIKED',
      target: 'INGREDIENT',
      ingredientId: 'coriandre',
    });
  });

  it.each([
    [
      'les deux',
      { target: 'ALLERGEN', allergen: 'MILK', ingredientId: 'beurre' },
      'ingredientId',
    ],
    [
      'les deux, côté Ingrédient',
      { target: 'INGREDIENT', ingredientId: 'beurre', allergen: 'MILK' },
      'allergen',
    ],
    ['aucune', {}, 'target'],
    ['un Allergène sans dire sa cible', { allergen: 'MILK' }, 'target'],
    ['une cible inconnue', { target: 'RECIPE' }, 'target'],
    ['un Allergène absent', { target: 'ALLERGEN' }, 'allergen'],
    ['un Ingrédient absent', { target: 'INGREDIENT' }, 'ingredientId'],
    [
      'un Ingrédient vide',
      { target: 'INGREDIENT', ingredientId: ' ' },
      'ingredientId',
    ],
    [
      'un Allergène hors liste',
      { target: 'ALLERGEN', allergen: 'NUTS' },
      'allergen',
    ],
  ])('refuse une cible qui nomme %s', (_cas, cible, chemin) => {
    const resultat = zFoodPreferenceInput.safeParse({
      userId: 'compte-a',
      kind: 'ALLERGY',
      ...cible,
    });

    expect(cheminsRefuses(resultat)).toEqual([chemin]);
  });

  it.each([
    ['aucune', {}],
    ['les deux', { target: 'ALLERGEN', allergen: 'MILK', ingredientId: 'b' }],
  ])('dit la règle de la cible quand elle en nomme %s', (_cas, cible) => {
    const resultat = zFoodPreferenceInput.safeParse({
      userId: 'compte-a',
      kind: 'ALLERGY',
      ...cible,
    });

    expect(resultat.error?.issues[0].message).toBe(
      'Une Préférence alimentaire vise soit un Allergène, soit un Ingrédient : jamais les deux, ni aucun.',
    );
  });

  it.each([
    ['un type inconnu', { kind: 'VEGETARIAN' }, 'kind'],
    ['un Compte vide', { userId: ' ' }, 'userId'],
  ])('refuse %s', (_cas, ecart, chemin) => {
    const resultat = zFoodPreferenceInput.safeParse({
      userId: 'compte-a',
      kind: 'EXCLUDED',
      target: 'ALLERGEN',
      allergen: 'MILK',
      ...ecart,
    });

    expect(cheminsRefuses(resultat)).toEqual([chemin]);
  });
});

describe('zFoodPreferenceListQuery', () => {
  it('lit tout le Foyer, ou un seul Compte', () => {
    expect(zFoodPreferenceListQuery.parse({})).toEqual({});
    expect(zFoodPreferenceListQuery.parse({ userId: 'compte-a' })).toEqual({
      userId: 'compte-a',
    });
  });
});

describe('FOOD_PREFERENCE_KINDS', () => {
  it('nomme les trois types de Préférence', () => {
    expect(
      FOOD_PREFERENCE_KINDS.map((kind) => LIBELLES_DES_PREFERENCES[kind]),
    ).toEqual(['Allergie', 'Aliment exclu', 'Peu apprécié']);
  });
});
