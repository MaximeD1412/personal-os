import { designation, zShoppingListItemInput } from './shopping-list';

function cheminsEnErreur(resultat: {
  success: boolean;
  error?: { issues: { path: PropertyKey[] }[] };
}): string[] {
  return (resultat.error?.issues ?? []).map(({ path }) => path.join('.'));
}

describe('zShoppingListItemInput', () => {
  it('accepte un Ingrédient du catalogue, avec ou sans quantité', () => {
    expect(
      zShoppingListItemInput.parse({ ingredientId: 'farine', quantity: 500 }),
    ).toEqual({ ingredientId: 'farine', quantity: 500 });
    expect(zShoppingListItemInput.parse({ ingredientId: 'farine' })).toEqual({
      ingredientId: 'farine',
    });
  });

  it('accepte un simple libellé, rogné', () => {
    expect(
      zShoppingListItemInput.parse({ label: '  liquide vaisselle ' }),
    ).toEqual({ label: 'liquide vaisselle' });
  });

  it('refuse un Ingrédient et un libellé à la fois, ou aucun des deux, sur `label`', () => {
    expect(
      cheminsEnErreur(
        zShoppingListItemInput.safeParse({
          ingredientId: 'farine',
          label: 'farine',
        }),
      ),
    ).toEqual(['label']);
    expect(
      cheminsEnErreur(zShoppingListItemInput.safeParse({ quantity: 2 })),
    ).toEqual(['label']);
  });

  it('refuse un libellé vide', () => {
    expect(
      cheminsEnErreur(zShoppingListItemInput.safeParse({ label: '   ' })),
    ).toContain('label');
  });

  it('refuse une quantité nulle, négative, ou plus fine que le millième', () => {
    for (const quantity of [0, -1, 0.0005]) {
      expect(
        cheminsEnErreur(
          zShoppingListItemInput.safeParse({ label: 'éponges', quantity }),
        ),
      ).toEqual(['quantity']);
    }
  });
});

describe('designation', () => {
  it("nomme l'Ingrédient, ou à défaut le libellé", () => {
    expect(
      designation({ ingredient: { displayName: 'Farine' }, label: null }),
    ).toBe('Farine');
    expect(designation({ ingredient: null, label: 'Éponges' })).toBe('Éponges');
  });
});
