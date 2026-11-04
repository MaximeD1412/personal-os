import { zMealWishInput, zMealWishListQuery } from './meal-wish';

function cheminsEnErreur(resultat: {
  success: boolean;
  error?: { issues: { path: PropertyKey[] }[] };
}): string[] {
  return (resultat.error?.issues ?? []).map(({ path }) => path.join('.'));
}

const UNE_SEMAINE = { week: '2028-03-13' };

describe('zMealWishInput', () => {
  it('accepte un Souhait par sa recette', () => {
    expect(zMealWishInput.parse({ ...UNE_SEMAINE, recipeId: 'rec-1' })).toEqual(
      { ...UNE_SEMAINE, recipeId: 'rec-1' },
    );
  });

  it('accepte une envie en texte libre, nettoyée', () => {
    expect(
      zMealWishInput.parse({ ...UNE_SEMAINE, text: '  Un plat de poisson ' }),
    ).toEqual({ ...UNE_SEMAINE, text: 'Un plat de poisson' });
  });

  it('refuse un Souhait sans recette ni texte, sur `text`', () => {
    expect(cheminsEnErreur(zMealWishInput.safeParse(UNE_SEMAINE))).toEqual([
      'text',
    ]);
  });

  it('refuse un texte vide une fois nettoyé', () => {
    expect(
      cheminsEnErreur(
        zMealWishInput.safeParse({ ...UNE_SEMAINE, text: '   ' }),
      ),
    ).toContain('text');
  });

  it('refuse un Souhait qui porte une recette et un texte, sur `text`', () => {
    const resultat = zMealWishInput.safeParse({
      ...UNE_SEMAINE,
      recipeId: 'rec-1',
      text: 'Du poisson',
    });

    expect(cheminsEnErreur(resultat)).toEqual(['text']);
  });

  it("refuse une semaine qui n'est pas un lundi, sur `week`", () => {
    expect(
      cheminsEnErreur(
        zMealWishInput.safeParse({ week: '2028-03-15', recipeId: 'rec-1' }),
      ),
    ).toEqual(['week']);
  });
});

describe('zMealWishListQuery', () => {
  it('exige la semaine, par son lundi', () => {
    expect(zMealWishListQuery.parse(UNE_SEMAINE)).toEqual(UNE_SEMAINE);
    expect(cheminsEnErreur(zMealWishListQuery.safeParse({}))).toEqual(['week']);
  });
});
