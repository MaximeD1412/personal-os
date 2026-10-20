import { zRecipeInput, zRecipeListQuery, zRecipeUpdate } from './recipe';

const UNE_LIGNE = { ingredientId: 'ing-1', quantity: 200, unit: 'G' };

function cheminsEnErreur(resultat: {
  success: boolean;
  error?: { issues: { path: PropertyKey[] }[] };
}): string[] {
  return (resultat.error?.issues ?? []).map(({ path }) => path.join('.'));
}

describe('zRecipeInput', () => {
  it('accepte une recette avec ses lignes, et nettoie titre et étapes', () => {
    const saisie = zRecipeInput.parse({
      title: '  Dahl de lentilles ',
      servings: 4,
      steps: [' Rincer les lentilles. ', 'Mijoter 20 minutes.'],
      lines: [UNE_LIGNE, { ingredientId: 'ing-2', quantity: 0.5, unit: 'TSP' }],
    });

    expect(saisie).toEqual({
      title: 'Dahl de lentilles',
      servings: 4,
      steps: ['Rincer les lentilles.', 'Mijoter 20 minutes.'],
      lines: [UNE_LIGNE, { ingredientId: 'ing-2', quantity: 0.5, unit: 'TSP' }],
    });
  });

  it("n'exige pas d'étapes", () => {
    expect(
      zRecipeInput.parse({ title: 'Omelette', servings: 1, lines: [UNE_LIGNE] })
        .steps,
    ).toEqual([]);
  });

  it.each([
    ['un titre vide', { title: '   ' }, 'title'],
    ['zéro portion', { servings: 0 }, 'servings'],
    ['des portions fractionnaires', { servings: 2.5 }, 'servings'],
    ['une étape vide', { steps: ['Couper.', '  '] }, 'steps.1'],
    ['aucune ligne', { lines: [] }, 'lines'],
    [
      'une quantité nulle',
      { lines: [{ ...UNE_LIGNE, quantity: 0 }] },
      'lines.0.quantity',
    ],
    [
      'une quantité négative',
      { lines: [{ ...UNE_LIGNE, quantity: -1 }] },
      'lines.0.quantity',
    ],
    [
      'une quantité plus fine que le millième, que la base arrondirait',
      { lines: [{ ...UNE_LIGNE, quantity: 0.0005 }] },
      'lines.0.quantity',
    ],
    [
      'une unité hors des Unités de recette',
      { lines: [{ ...UNE_LIGNE, unit: 'CUP' }] },
      'lines.0.unit',
    ],
    [
      'une ligne sans Ingrédient',
      { lines: [{ quantity: 1, unit: 'PIECE' }] },
      'lines.0.ingredientId',
    ],
  ])('refuse %s', (_cas, changement, chemin) => {
    const resultat = zRecipeInput.safeParse({
      title: 'Omelette',
      servings: 2,
      lines: [UNE_LIGNE],
      ...changement,
    });

    expect(cheminsEnErreur(resultat)).toEqual([chemin]);
  });

  it("ne laisse pas choisir l'origine d'une recette : une saisie est manuelle", () => {
    const saisie = zRecipeInput.parse({
      title: 'Omelette',
      servings: 2,
      lines: [UNE_LIGNE],
      source: 'GENERATED',
    });

    expect(saisie).not.toHaveProperty('source');
  });
});

describe('zRecipeUpdate', () => {
  it('ne porte que ce qui change, sans valeur par défaut', () => {
    expect(zRecipeUpdate.parse({ servings: 6 })).toEqual({ servings: 6 });
  });

  it('refuse des lignes vides : elles remplacent toutes les lignes', () => {
    expect(cheminsEnErreur(zRecipeUpdate.safeParse({ lines: [] }))).toEqual([
      'lines',
    ]);
  });
});

describe('zRecipeListQuery', () => {
  it('borne la recherche', () => {
    expect(zRecipeListQuery.safeParse({ q: 'x'.repeat(121) }).success).toBe(
      false,
    );
    expect(zRecipeListQuery.parse({})).toEqual({});
  });
});
