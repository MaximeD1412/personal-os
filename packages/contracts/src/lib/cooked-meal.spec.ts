import {
  ajusterAuxPortions,
  uniteDeSaisie,
  zCookedMealInput,
} from './cooked-meal';

const UNE_LIGNE = { ingredientId: 'ing-1', quantity: 200, unit: 'G' };

function cheminsEnErreur(resultat: {
  success: boolean;
  error?: { issues: { path: PropertyKey[] }[] };
}): string[] {
  return (resultat.error?.issues ?? []).map(({ path }) => path.join('.'));
}

describe('zCookedMealInput', () => {
  it('accepte un repas et les quantités réellement utilisées', () => {
    expect(
      zCookedMealInput.parse({
        mealPlanEntryId: ' repas-1 ',
        lines: [
          UNE_LIGNE,
          { ingredientId: 'ing-2', quantity: 1.5, unit: 'TSP' },
        ],
      }),
    ).toEqual({
      mealPlanEntryId: 'repas-1',
      lines: [UNE_LIGNE, { ingredientId: 'ing-2', quantity: 1.5, unit: 'TSP' }],
    });
  });

  it.each([
    ['sans repas', { lines: [UNE_LIGNE] }, 'mealPlanEntryId'],
    ['sans ligne', { mealPlanEntryId: 'repas-1', lines: [] }, 'lines'],
    [
      'une quantité nulle',
      { mealPlanEntryId: 'repas-1', lines: [{ ...UNE_LIGNE, quantity: 0 }] },
      'lines.0.quantity',
    ],
    [
      'une quantité plus fine que le millième',
      {
        mealPlanEntryId: 'repas-1',
        lines: [{ ...UNE_LIGNE, quantity: 0.0005 }],
      },
      'lines.0.quantity',
    ],
    [
      'une unité inconnue',
      { mealPlanEntryId: 'repas-1', lines: [{ ...UNE_LIGNE, unit: 'CUP' }] },
      'lines.0.unit',
    ],
    [
      'un Ingrédient vide',
      {
        mealPlanEntryId: 'repas-1',
        lines: [{ ...UNE_LIGNE, ingredientId: '' }],
      },
      'lines.0.ingredientId',
    ],
  ])('refuse %s', (_cas, saisie, chemin) => {
    expect(cheminsEnErreur(zCookedMealInput.safeParse(saisie))).toEqual([
      chemin,
    ]);
  });
});

describe('ajusterAuxPortions', () => {
  it('garde la quantité de la recette pour ses portions de référence', () => {
    expect(ajusterAuxPortions(200, 4, 4)).toBe(200);
  });

  it('la met à la règle de trois pour les portions du repas', () => {
    expect(ajusterAuxPortions(200, 4, 2)).toBe(100);
    expect(ajusterAuxPortions(3, 4, 6)).toBe(4.5);
  });

  it('arrondit au millième, que le contrat accepte', () => {
    expect(ajusterAuxPortions(1, 3, 1)).toBe(0.333);
    expect(ajusterAuxPortions(2, 3, 1)).toBe(0.667);
  });

  it('ne descend jamais à zéro : une ligne de recette a une quantité', () => {
    expect(ajusterAuxPortions(0.001, 100, 1)).toBe(0.001);
  });
});

describe('uniteDeSaisie', () => {
  it("donne l'Unité de recette qui dit une Unité canonique", () => {
    expect(uniteDeSaisie('GRAM')).toBe('G');
    expect(uniteDeSaisie('MILLILITER')).toBe('ML');
    expect(uniteDeSaisie('PIECE')).toBe('PIECE');
  });
});
