import Decimal from 'decimal.js';
import { convertir, type IngredientAConvertir } from './convertir';

const OIGNON: IngredientAConvertir = {
  canonicalUnit: 'GRAM',
  gramsPerPiece: 100,
};
const FARINE: IngredientAConvertir = {
  canonicalUnit: 'GRAM',
  gramsPerPiece: null,
};
const LAIT: IngredientAConvertir = {
  canonicalUnit: 'MILLILITER',
  gramsPerPiece: null,
};
const CITRON: IngredientAConvertir = {
  canonicalUnit: 'PIECE',
  gramsPerPiece: 120,
};
const OEUF: IngredientAConvertir = {
  canonicalUnit: 'PIECE',
  gramsPerPiece: null,
};

/** La quantité convertie, en texte : une égalité de décimaux, sans flottant. */
function quantite(conversion: ReturnType<typeof convertir>): string {
  if (!('quantite' in conversion))
    throw new Error(`Échec inattendu : ${conversion.echec}`);
  return conversion.quantite.toString();
}

describe('convertir', () => {
  describe('vers les grammes', () => {
    it.each([
      [1.5, 'KG', '1500'],
      [250, 'G', '250'],
      [500, 'MG', '0.5'],
    ] as const)('%s %s font %s g', (valeur, unite, attendu) => {
      expect(quantite(convertir({ quantite: valeur, unite }, FARINE))).toBe(
        attendu,
      );
    });

    it('additionne 2 pièces et 300 g d’oignon (100 g/pièce) en 500 g', () => {
      const pieces = convertir({ quantite: 2, unite: 'PIECE' }, OIGNON);
      const grammes = convertir({ quantite: 300, unite: 'G' }, OIGNON);

      expect(quantite(pieces)).toBe('200');
      expect(
        new Decimal(quantite(pieces)).plus(quantite(grammes)).toString(),
      ).toBe('500');
    });

    it('échoue en facteur_manquant pour des pièces sans poids à la pièce', () => {
      expect(convertir({ quantite: 2, unite: 'PIECE' }, FARINE)).toEqual({
        echec: 'facteur_manquant',
      });
    });

    it.each(['ML', 'CL', 'L', 'TSP', 'TBSP'] as const)(
      'échoue en dimension pour un volume (%s), sans densité',
      (unite) => {
        expect(convertir({ quantite: 1, unite }, OIGNON)).toEqual({
          echec: 'dimension',
        });
      },
    );
  });

  describe('vers les millilitres', () => {
    it.each([
      [3, 'TBSP', '45'],
      [2, 'TSP', '10'],
      [1, 'L', '1000'],
      [25, 'CL', '250'],
      [80, 'ML', '80'],
    ] as const)('%s %s font %s ml', (valeur, unite, attendu) => {
      expect(quantite(convertir({ quantite: valeur, unite }, LAIT))).toBe(
        attendu,
      );
    });

    it.each(['G', 'KG', 'MG', 'PIECE'] as const)(
      'échoue en dimension pour une masse ou des pièces (%s)',
      (unite) => {
        expect(convertir({ quantite: 1, unite }, LAIT)).toEqual({
          echec: 'dimension',
        });
      },
    );
  });

  describe('vers les pièces', () => {
    it('compte des pièces telles quelles, même sans poids à la pièce', () => {
      expect(quantite(convertir({ quantite: 6, unite: 'PIECE' }, OEUF))).toBe(
        '6',
      );
    });

    it('ramène des grammes à des pièces par le poids à la pièce', () => {
      expect(quantite(convertir({ quantite: 0.3, unite: 'KG' }, CITRON))).toBe(
        '2.5',
      );
    });

    it('échoue en facteur_manquant pour des grammes sans poids à la pièce', () => {
      expect(convertir({ quantite: 100, unite: 'G' }, OEUF)).toEqual({
        echec: 'facteur_manquant',
      });
    });

    it('échoue en facteur_manquant pour un poids à la pièce nul, plutôt que de diviser par zéro', () => {
      expect(
        convertir(
          { quantite: 100, unite: 'G' },
          { canonicalUnit: 'PIECE', gramsPerPiece: 0 },
        ),
      ).toEqual({ echec: 'facteur_manquant' });
    });

    it('échoue en dimension pour un volume, poids à la pièce ou non', () => {
      expect(convertir({ quantite: 1, unite: 'TBSP' }, CITRON)).toEqual({
        echec: 'dimension',
      });
    });
  });

  describe('sans flottant', () => {
    it('additionne 0,1 l et 0,2 l en exactement 300 ml', () => {
      const somme = new Decimal(
        quantite(convertir({ quantite: 0.1, unite: 'L' }, LAIT)),
      ).plus(quantite(convertir({ quantite: 0.2, unite: 'L' }, LAIT)));

      expect(somme.toString()).toBe('300');
    });

    it('garde 0,07 kg à exactement 70 g, là où un flottant donnerait 70,000000000000001', () => {
      expect(quantite(convertir({ quantite: 0.07, unite: 'KG' }, FARINE))).toBe(
        '70',
      );
    });

    it('accepte une quantité en texte décimal, telle qu’une saisie la donne', () => {
      expect(
        quantite(convertir({ quantite: '1.1', unite: 'TBSP' }, LAIT)),
      ).toBe('16.5');
    });

    it('accepte un poids à la pièce décimal', () => {
      expect(
        quantite(
          convertir(
            { quantite: 3, unite: 'PIECE' },
            { canonicalUnit: 'GRAM', gramsPerPiece: new Decimal('33.33') },
          ),
        ),
      ).toBe('99.99');
    });
  });
});
