import {
  joursAvantPeremption,
  perimeBientot,
  zPantryItemAddition,
  zPantryItemInput,
} from './pantry-item';

function cheminsEnErreur(resultat: {
  success: boolean;
  error?: { issues: { path: PropertyKey[] }[] };
}): string[] {
  return (resultat.error?.issues ?? []).map(({ path }) => path.join('.'));
}

describe('zPantryItemInput', () => {
  it('accepte une quantité et sa péremption', () => {
    expect(
      zPantryItemInput.parse({ quantity: 250.5, expiresOn: '2026-10-22' }),
    ).toEqual({ quantity: 250.5, expiresOn: '2026-10-22' });
  });

  it("accepte une quantité nulle, et une péremption qu'on ne connaît pas", () => {
    expect(zPantryItemInput.parse({ quantity: 0 })).toEqual({
      quantity: 0,
      expiresOn: null,
    });
    expect(zPantryItemInput.parse({ quantity: 3, expiresOn: null })).toEqual({
      quantity: 3,
      expiresOn: null,
    });
  });

  it.each([
    ['une quantité négative', { quantity: -1 }, 'quantity'],
    ['une quantité au-delà du millième', { quantity: 0.0005 }, 'quantity'],
    ['une quantité démesurée', { quantity: 10_000_001 }, 'quantity'],
    ['une quantité absente', {}, 'quantity'],
    [
      'un instant pour péremption',
      { quantity: 1, expiresOn: '2026-10-22T00:00:00Z' },
      'expiresOn',
    ],
    [
      'un jour impossible',
      { quantity: 1, expiresOn: '2026-02-30' },
      'expiresOn',
    ],
  ])('refuse %s', (_cas, saisie, chemin) => {
    expect(cheminsEnErreur(zPantryItemInput.safeParse(saisie))).toEqual([
      chemin,
    ]);
  });

  it.each([
    [-1, 'La quantité ne peut pas être négative.'],
    [null, 'La quantité est un nombre.'],
    [0.0005, 'La quantité se donne au millième près.'],
  ])(
    'dit en français pourquoi il refuse %s : l’écran le montre sous le champ',
    (quantity, message) => {
      const resultat = zPantryItemInput.safeParse({ quantity });

      expect(resultat.error?.issues.map((issue) => issue.message)).toEqual([
        message,
      ]);
    },
  );
});

describe('zPantryItemAddition', () => {
  it("nomme en plus l'Ingrédient à ajouter", () => {
    expect(
      zPantryItemAddition.parse({ ingredientId: 'ing-1', quantity: 2 }),
    ).toEqual({ ingredientId: 'ing-1', quantity: 2, expiresOn: null });
    expect(
      cheminsEnErreur(zPantryItemAddition.safeParse({ quantity: 2 })),
    ).toEqual(['ingredientId']);
  });
});

describe('la péremption', () => {
  const AUJOURDHUI = '2026-10-20';

  it('compte les jours civils qui la séparent du jour donné', () => {
    expect(joursAvantPeremption('2026-10-20', AUJOURDHUI)).toBe(0);
    expect(joursAvantPeremption('2026-10-23', AUJOURDHUI)).toBe(3);
    expect(joursAvantPeremption('2026-10-18', AUJOURDHUI)).toBe(-2);
    // Le changement d'heure du 25 octobre ne décale rien.
    expect(joursAvantPeremption('2026-10-27', AUJOURDHUI)).toBe(7);
  });

  it('est proche dans les trois jours, et quand elle est passée', () => {
    expect(perimeBientot('2026-10-23', AUJOURDHUI)).toBe(true);
    expect(perimeBientot('2026-10-20', AUJOURDHUI)).toBe(true);
    expect(perimeBientot('2026-10-19', AUJOURDHUI)).toBe(true);
    expect(perimeBientot('2026-10-24', AUJOURDHUI)).toBe(false);
    expect(perimeBientot(null, AUJOURDHUI)).toBe(false);
  });
});
