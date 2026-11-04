import type { CookedMealShortfall } from '@personal-os/contracts';
import { messageDeManque } from './manque';

function manque(
  displayName: string,
  available: number,
  canonicalUnit: CookedMealShortfall['ingredient']['canonicalUnit'] = 'GRAM',
): CookedMealShortfall {
  return {
    ingredient: { id: 'ingredient-1', displayName, canonicalUnit },
    available,
    missing: 100,
  };
}

describe('messageDeManque', () => {
  it('dit ce que le stock avait, en Unité canonique', () => {
    expect(messageDeManque(manque('Farine', 200))).toBe(
      "Le stock n'avait que 200 g de farine.",
    );
    expect(
      messageDeManque(manque('Lait demi-écrémé', 1500, 'MILLILITER')),
    ).toBe("Le stock n'avait que 1 500 ml de lait demi-écrémé.");
  });

  it('élide « de » devant une voyelle ou un h muet', () => {
    expect(messageDeManque(manque('Huile d’olive', 20, 'MILLILITER'))).toBe(
      "Le stock n'avait que 20 ml d'huile d’olive.",
    );
    expect(messageDeManque(manque('Œufs', 2, 'PIECE'))).toBe(
      "Le stock n'avait que 2 pièce(s) d'œufs.",
    );
  });

  it('dit qu’il n’en avait pas du tout', () => {
    expect(messageDeManque(manque('Sucre', 0))).toBe(
      "Le stock n'avait pas de sucre.",
    );
    expect(messageDeManque(manque('Avoine', 0))).toBe(
      "Le stock n'avait pas d'avoine.",
    );
  });
});
