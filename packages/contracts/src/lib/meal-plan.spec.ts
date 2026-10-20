import {
  portions,
  zMealPlanEntryInput,
  zMealPlanEntryUpdate,
  zMealPlanQuery,
} from './meal-plan';

function cheminsEnErreur(resultat: {
  success: boolean;
  error?: { issues: { path: PropertyKey[] }[] };
}): string[] {
  return (resultat.error?.issues ?? []).map(({ path }) => path.join('.'));
}

const UN_REPAS = {
  day: '2028-03-15',
  moment: 'DINNER',
  participantIds: ['compte-a'],
};

describe('portions', () => {
  it('compte les Participants et les Invités', () => {
    expect(portions({ participantIds: ['a', 'b'], guestCount: 3 })).toBe(5);
    expect(portions({ participantIds: ['a'], guestCount: 0 })).toBe(1);
  });
});

describe('zMealPlanEntryInput', () => {
  it('accepte un repas par sa recette, sans Invités par défaut', () => {
    expect(
      zMealPlanEntryInput.parse({ ...UN_REPAS, recipeId: 'rec-1' }),
    ).toEqual({ ...UN_REPAS, recipeId: 'rec-1', guestCount: 0 });
  });

  it('accepte un repas par un intitulé libre, nettoyé', () => {
    expect(
      zMealPlanEntryInput.parse({
        ...UN_REPAS,
        title: '  Restes de la veille ',
        guestCount: 2,
      }),
    ).toEqual({ ...UN_REPAS, title: 'Restes de la veille', guestCount: 2 });
  });

  it('refuse un repas sans recette ni intitulé, sur `title`', () => {
    expect(cheminsEnErreur(zMealPlanEntryInput.safeParse(UN_REPAS))).toEqual([
      'title',
    ]);
  });

  it('refuse un repas qui porte une recette et un intitulé', () => {
    const resultat = zMealPlanEntryInput.safeParse({
      ...UN_REPAS,
      recipeId: 'rec-1',
      title: 'Pâtes',
    });

    expect(cheminsEnErreur(resultat)).toEqual(['title']);
  });

  it('refuse un moment inconnu, un jour mal formé et des Invités négatifs', () => {
    const resultat = zMealPlanEntryInput.safeParse({
      ...UN_REPAS,
      recipeId: 'rec-1',
      day: '15/03/2028',
      moment: 'BRUNCH',
      guestCount: -1,
    });

    expect(cheminsEnErreur(resultat).sort()).toEqual([
      'day',
      'guestCount',
      'moment',
    ]);
  });
});

describe('zMealPlanEntryUpdate', () => {
  it('accepte une modification partielle', () => {
    expect(zMealPlanEntryUpdate.parse({ guestCount: 4 })).toEqual({
      guestCount: 4,
    });
  });

  it('refuse une recette et un intitulé à la fois', () => {
    const resultat = zMealPlanEntryUpdate.safeParse({
      recipeId: 'rec-1',
      title: 'Pâtes',
    });

    expect(cheminsEnErreur(resultat)).toEqual(['title']);
  });
});

describe('zMealPlanQuery', () => {
  it("refuse une semaine qui n'est pas un lundi", () => {
    expect(zMealPlanQuery.safeParse({ week: '2028-03-13' }).success).toBe(true);
    expect(
      cheminsEnErreur(zMealPlanQuery.safeParse({ week: '2028-03-15' })),
    ).toEqual(['week']);
  });
});
