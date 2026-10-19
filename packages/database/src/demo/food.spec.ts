import {
  normaliserLibelle,
  UNITES_AVEC_POIDS_A_LA_PIECE,
  zIngredientInput,
} from '@personal-os/contracts';
import type { PrismaService } from '../lib/prisma.service';
import { INGREDIENTS_DE_DEMO, semerLaCuisine } from './food';

function trouver(displayName: string) {
  const ingredient = INGREDIENTS_DE_DEMO.find(
    (candidat) => candidat.displayName === displayName,
  );
  if (!ingredient) {
    throw new Error(`${displayName} n'est pas dans le jeu de démo.`);
  }
  return ingredient;
}

describe('Le catalogue de démo', () => {
  it('compte une trentaine d’Ingrédients, chacun conforme à la saisie du contrat', () => {
    expect(INGREDIENTS_DE_DEMO.length).toBeGreaterThanOrEqual(30);
    for (const ingredient of INGREDIENTS_DE_DEMO) {
      expect(zIngredientInput.safeParse(ingredient).success).toBe(true);
    }
  });

  it('ne nomme jamais deux fois le même Ingrédient', () => {
    const noms = INGREDIENTS_DE_DEMO.map(({ displayName }) =>
      normaliserLibelle(displayName),
    );

    expect(new Set(noms).size).toBe(noms.length);
  });

  it('ne donne de poids à la pièce qu’en grammes ou en pièces', () => {
    for (const { canonicalUnit, gramsPerPiece } of INGREDIENTS_DE_DEMO) {
      if (gramsPerPiece !== undefined) {
        expect(UNITES_AVEC_POIDS_A_LA_PIECE).toContain(canonicalUnit);
      }
    }
  });

  it.each([
    ['Lait demi-écrémé', ['MILK'], true],
    ['Beurre doux', ['MILK'], true],
    ['Farine de blé', ['GLUTEN'], false],
    ['Œufs', ['EGGS'], true],
    ['Oignon jaune', [], false],
    ['Oignon rouge', [], false],
    ['Tomate fraîche', [], true],
    ['Tomate en conserve', [], false],
    ['Cerneaux de noix', ['TREE_NUTS'], false],
  ])(
    'déclare %s avec ses Allergènes et sa périssabilité',
    (nom, allergenes, perissable) => {
      const ingredient = trouver(nom);

      expect(ingredient.allergens ?? []).toEqual(allergenes);
      expect(ingredient.perishable).toBe(perissable);
    },
  );
});

describe('semerLaCuisine', () => {
  it('retrouve chaque Ingrédient par son nom normalisé et le remet dans son état', async () => {
    const upsert = jest.fn().mockResolvedValue(undefined);
    const prisma = { ingredient: { upsert } } as unknown as PrismaService;

    await semerLaCuisine(prisma);

    expect(upsert).toHaveBeenCalledTimes(INGREDIENTS_DE_DEMO.length);
    expect(upsert).toHaveBeenCalledWith({
      where: { name: 'oeufs' },
      create: {
        name: 'oeufs',
        displayName: 'Œufs',
        canonicalUnit: 'PIECE',
        gramsPerPiece: 55,
        allergens: ['EGGS'],
        perishable: true,
      },
      update: {
        displayName: 'Œufs',
        canonicalUnit: 'PIECE',
        gramsPerPiece: 55,
        allergens: ['EGGS'],
        perishable: true,
      },
    });
  });
});
