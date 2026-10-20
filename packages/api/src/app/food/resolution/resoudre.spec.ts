import { resoudre, type Catalogue } from './resoudre';

const CATALOGUE: Catalogue = {
  ingredients: [
    { id: 'tomate', name: 'tomate' },
    { id: 'oignon-jaune', name: 'oignon jaune' },
  ],
  alias: [{ label: 'belles tomates', ingredientId: 'tomate' }],
};

describe('resoudre', () => {
  it("résout un libellé qui est le nom d'un Ingrédient", () => {
    expect(resoudre('tomate', CATALOGUE)).toEqual({ ingredientId: 'tomate' });
  });

  it('reconnaît un nom malgré la casse, les accents et les espaces', () => {
    expect(resoudre('  OIGNON   Jaune. ', CATALOGUE)).toEqual({
      ingredientId: 'oignon-jaune',
    });
  });

  it("résout un libellé rattaché par un Alias, quelle qu'en soit la graphie", () => {
    expect(resoudre('Belles Tomätes', CATALOGUE)).toEqual({
      ingredientId: 'tomate',
    });
  });

  it("préfère l'Alias au nom quand les deux répondent", () => {
    const catalogue: Catalogue = {
      ingredients: [
        { id: 'oignon', name: 'oignon' },
        { id: 'oignon-jaune', name: 'oignon jaune' },
      ],
      alias: [{ label: 'oignon', ingredientId: 'oignon-jaune' }],
    };

    expect(resoudre('oignon', catalogue)).toEqual({
      ingredientId: 'oignon-jaune',
    });
  });

  describe('un libellé inconnu', () => {
    const OIGNONS: Catalogue = {
      ingredients: [
        { id: 'oignon-jaune', name: 'oignon jaune' },
        { id: 'oignon-rouge', name: 'oignon rouge' },
        { id: 'poivron-rouge', name: 'poivron rouge' },
        { id: 'farine', name: 'farine de ble' },
      ],
      alias: [],
    };

    it('ne résout pas « Oignon rouge » vers « Oignon jaune »', () => {
      expect(resoudre('Oignon rouge', OIGNONS)).toEqual({
        ingredientId: 'oignon-rouge',
      });

      const sansLeRouge: Catalogue = {
        ingredients: [{ id: 'oignon-jaune', name: 'oignon jaune' }],
        alias: [],
      };
      expect(resoudre('Oignon rouge', sansLeRouge)).toEqual({
        inconnu: true,
        suggestions: ['oignon-jaune'],
      });
    });

    it('suggère les Ingrédients qui ont le plus de mots en commun, en premier', () => {
      expect(resoudre('oignon rouge émincé', OIGNONS)).toEqual({
        inconnu: true,
        suggestions: ['oignon-rouge', 'oignon-jaune', 'poivron-rouge'],
      });
    });

    it('reconnaît un mot au sein du nom', () => {
      expect(resoudre('oign', OIGNONS)).toEqual({
        inconnu: true,
        suggestions: ['oignon-jaune', 'oignon-rouge'],
      });
    });

    it('reconnaît au pluriel un mot que le nom porte au singulier', () => {
      expect(resoudre('Oignons', OIGNONS)).toEqual({
        inconnu: true,
        suggestions: ['oignon-jaune', 'oignon-rouge'],
      });
      expect(
        resoudre('choux', {
          ingredients: [{ id: 'chou', name: 'chou rouge' }],
          alias: [],
        }),
      ).toEqual({
        inconnu: true,
        suggestions: ['chou'],
      });
      // « pois » n'est pas le pluriel de « poi » : « poivron » ne répond pas.
      expect(resoudre('pois', OIGNONS)).toEqual({
        inconnu: true,
        suggestions: [],
      });
    });

    it('ne suggère rien sur un mot grammatical', () => {
      expect(resoudre('pâte de coing', OIGNONS)).toEqual({
        inconnu: true,
        suggestions: [],
      });
    });

    it("sépare les mots aux apostrophes et aux traits d'union", () => {
      const amandes: Catalogue = {
        ingredients: [{ id: 'amande', name: 'amande effilee' }],
        alias: [],
      };

      expect(resoudre("Pâte d'amande", amandes)).toEqual({
        inconnu: true,
        suggestions: ['amande'],
      });
    });

    it('suggère au plus cinq Ingrédients', () => {
      const tomates: Catalogue = {
        ingredients: ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((lettre) => ({
          id: lettre,
          name: `tomate ${lettre}`,
        })),
        alias: [],
      };

      expect(resoudre('tomates', tomates)).toEqual({
        inconnu: true,
        suggestions: ['a', 'b', 'c', 'd', 'e'],
      });
    });
  });
});
