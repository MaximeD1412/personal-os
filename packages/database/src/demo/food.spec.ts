import {
  normaliserLibelle,
  UNITES_AVEC_POIDS_A_LA_PIECE,
  zIngredientInput,
} from '@personal-os/contracts';
import { ID_ESPACE_FOYER } from '../lib/espace/foyer';
import { porteeCourante } from '../lib/espace/portee';
import type { PrismaService } from '../lib/prisma.service';
import {
  CORIANDRE_DE_DEMO,
  INGREDIENTS_DE_DEMO,
  semerLaCuisine,
  semerLesPreferences,
} from './food';

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
    [CORIANDRE_DE_DEMO, [], true],
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

describe('semerLesPreferences', () => {
  /** Un Prisma qui connaît ces Comptes et ces Préférences, et note les créations. */
  function prismaDeDemo(
    comptes: string[],
    existantes: Record<string, unknown>[] = [],
  ) {
    const creees: unknown[] = [];
    const portees: unknown[] = [];
    const prisma = {
      user: {
        findMany: () => Promise.resolve(comptes.map((id) => ({ id }))),
      },
      ingredient: {
        findUnique: () => Promise.resolve({ id: 'coriandre' }),
      },
      foodPreference: {
        findFirst: ({ where }: { where: Record<string, unknown> }) => {
          portees.push(porteeCourante());
          return Promise.resolve(
            existantes.some(
              (existante) =>
                JSON.stringify(existante) === JSON.stringify(where),
            )
              ? { id: 'deja-la' }
              : null,
          );
        },
        create: ({ data }: { data: unknown }) => {
          portees.push(porteeCourante());
          creees.push(data);
          return Promise.resolve(data);
        },
      },
    } as unknown as PrismaService;

    return { prisma, creees, portees };
  }

  const ALLERGIE = {
    userId: 'compte-a',
    kind: 'ALLERGY',
    allergen: 'TREE_NUTS',
    ingredientId: null,
  };
  const CORIANDRE = (userId: string) => ({
    userId,
    kind: 'DISLIKED',
    allergen: null,
    ingredientId: 'coriandre',
  });

  it("donne l'allergie aux fruits à coque au premier Compte, la coriandre au second, dans l'Espace foyer", async () => {
    const { prisma, creees, portees } = prismaDeDemo(['compte-a', 'compte-b']);

    await semerLesPreferences(prisma);

    expect(creees).toEqual([
      { scopeId: ID_ESPACE_FOYER, ...ALLERGIE },
      { scopeId: ID_ESPACE_FOYER, ...CORIANDRE('compte-b') },
    ]);
    for (const portee of portees) {
      expect(portee).toEqual({
        espaces: [{ id: ID_ESPACE_FOYER, kind: 'HOUSEHOLD' }],
        typesAcceptes: ['HOUSEHOLD'],
      });
    }
  });

  it('donne les deux au Compte seul', async () => {
    const { prisma, creees } = prismaDeDemo(['compte-a']);

    await semerLesPreferences(prisma);

    expect(creees).toEqual([
      { scopeId: ID_ESPACE_FOYER, ...ALLERGIE },
      { scopeId: ID_ESPACE_FOYER, ...CORIANDRE('compte-a') },
    ]);
  });

  it('ne repose pas une Préférence déjà là', async () => {
    const { prisma, creees } = prismaDeDemo(
      ['compte-a', 'compte-b'],
      [ALLERGIE],
    );

    await semerLesPreferences(prisma);

    expect(creees).toEqual([
      { scopeId: ID_ESPACE_FOYER, ...CORIANDRE('compte-b') },
    ]);
  });

  it('ne fait rien sans Compte à qui les donner', async () => {
    const { prisma, creees } = prismaDeDemo([]);

    await semerLesPreferences(prisma);

    expect(creees).toEqual([]);
  });
});
