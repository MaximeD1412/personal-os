import {
  ALLERGENES,
  LIBELLES_DES_ALLERGENES,
  normaliserLibelle,
  zIngredientInput,
  zIngredientListQuery,
  zIngredientUpdate,
} from './ingredient';

/** Les chemins des champs qu'un schéma refuse, comme `fields` les rendra. */
function cheminsRefuses(resultat: {
  success: boolean;
  error?: { issues: { path: PropertyKey[] }[] };
}): string[] {
  return (resultat.error?.issues ?? []).map(({ path }) => path.join('.'));
}

describe('normaliserLibelle', () => {
  it.each([
    ['Tomate', 'tomate'],
    ['  Oignon   JAUNE ', 'oignon jaune'],
    ['Crème fraîche', 'creme fraiche'],
    ['Céleri-rave', 'celeri-rave'],
    ['Œufs', 'oeufs'],
    ['Lætitia', 'laetitia'],
    ['Huile d’olive', "huile d'olive"],
    ['Farine de blé.', 'farine de ble'],
    ['Noix ?!', 'noix'],
    ['Sel…', 'sel'],
    ['Piment\td’Espelette', "piment d'espelette"],
  ])('« %s » devient « %s »', (texte, attendu) => {
    expect(normaliserLibelle(texte)).toBe(attendu);
  });

  it('rend le même nom à deux libellés qui ne diffèrent que par la casse ou les accents', () => {
    expect(normaliserLibelle('Pâte BRISÉE')).toBe(
      normaliserLibelle('pate brisee'),
    );
  });

  it('rend une chaîne vide pour un libellé sans lettre', () => {
    expect(normaliserLibelle(' ... ')).toBe('');
  });
});

describe('ALLERGENES', () => {
  it('liste les quatorze familles réglementaires, chacune avec son libellé', () => {
    expect(ALLERGENES).toHaveLength(14);
    expect(ALLERGENES.map((code) => LIBELLES_DES_ALLERGENES[code])).toEqual([
      'Gluten',
      'Crustacés',
      'Œufs',
      'Poissons',
      'Arachides',
      'Soja',
      'Lait',
      'Fruits à coque',
      'Céleri',
      'Moutarde',
      'Sésame',
      'Sulfites',
      'Lupin',
      'Mollusques',
    ]);
  });
});

describe('zIngredientInput', () => {
  it('complète une saisie minimale : aucun allergène, non périssable, sans poids à la pièce', () => {
    expect(
      zIngredientInput.parse({
        displayName: ' Poireau ',
        canonicalUnit: 'GRAM',
      }),
    ).toEqual({
      displayName: 'Poireau',
      canonicalUnit: 'GRAM',
      gramsPerPiece: null,
      allergens: [],
      perishable: false,
    });
  });

  it('refuse un libellé qui ne nomme rien une fois normalisé, sur `displayName`', () => {
    expect(
      cheminsRefuses(
        zIngredientInput.safeParse({
          displayName: '?!',
          canonicalUnit: 'GRAM',
        }),
      ),
    ).toEqual(['displayName']);
  });

  it('refuse un allergène inconnu, et un allergène nommé deux fois', () => {
    expect(
      cheminsRefuses(
        zIngredientInput.safeParse({
          displayName: 'Beurre',
          canonicalUnit: 'GRAM',
          allergens: ['BUTTER'],
        }),
      ),
    ).toEqual(['allergens.0']);
    expect(
      cheminsRefuses(
        zIngredientInput.safeParse({
          displayName: 'Beurre',
          canonicalUnit: 'GRAM',
          allergens: ['MILK', 'MILK'],
        }),
      ),
    ).toEqual(['allergens']);
  });

  it('refuse un poids à la pièce nul ou négatif', () => {
    expect(
      cheminsRefuses(
        zIngredientInput.safeParse({
          displayName: 'Œuf',
          canonicalUnit: 'PIECE',
          gramsPerPiece: 0,
        }),
      ),
    ).toEqual(['gramsPerPiece']);
  });
});

describe('zIngredientUpdate', () => {
  it('ne porte que ce qui change, sans valeur par défaut', () => {
    expect(zIngredientUpdate.parse({ perishable: true })).toEqual({
      perishable: true,
    });
  });
});

describe('zIngredientListQuery', () => {
  it('accepte une lecture sans recherche', () => {
    expect(zIngredientListQuery.parse({})).toEqual({});
  });
});
