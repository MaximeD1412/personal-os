import {
  normaliserLibelle,
  perimeBientot,
  UNITES_AVEC_POIDS_A_LA_PIECE,
  zIngredientInput,
  zRecipeInput,
} from '@personal-os/contracts';
import { ID_ESPACE_FOYER } from '../lib/espace/foyer';
import { porteeCourante } from '../lib/espace/portee';
import type { PrismaService } from '../lib/prisma.service';
import {
  CORIANDRE_DE_DEMO,
  INGREDIENTS_DE_DEMO,
  RECETTES_DE_DEMO,
  semerLaCuisine,
  semerLesPreferences,
  semerLeStock,
  STOCK_DE_DEMO,
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

describe('Les recettes de démo', () => {
  it('sont six, chacune conforme à la saisie du contrat', () => {
    expect(RECETTES_DE_DEMO).toHaveLength(6);
    for (const { lines, ...recette } of RECETTES_DE_DEMO) {
      const saisie = {
        ...recette,
        lines: lines.map(({ ingredient, ...ligne }) => ({
          ...ligne,
          ingredientId: ingredient,
        })),
      };
      expect(zRecipeInput.safeParse(saisie).success).toBe(true);
    }
  });

  it('ne portent jamais deux fois le même titre', () => {
    const titres = RECETTES_DE_DEMO.map(({ title }) => title);

    expect(new Set(titres).size).toBe(titres.length);
  });

  it('ne citent que des Ingrédients du catalogue de démo', () => {
    for (const { lines } of RECETTES_DE_DEMO) {
      for (const { ingredient } of lines) {
        expect(() => trouver(ingredient)).not.toThrow();
      }
    }
  });

  it('ne mesurent en cuillères que des liquides, en pièces que ce qui a un poids à la pièce', () => {
    for (const { lines } of RECETTES_DE_DEMO) {
      for (const { ingredient, unit } of lines) {
        const { canonicalUnit } = trouver(ingredient);
        if (['ML', 'CL', 'L', 'TSP', 'TBSP'].includes(unit)) {
          expect(canonicalUnit).toBe('MILLILITER');
        }
        if (unit === 'PIECE') {
          expect(canonicalUnit).toBe('PIECE');
        }
        if (['G', 'KG', 'MG'].includes(unit)) {
          expect(['GRAM', 'PIECE']).toContain(canonicalUnit);
        }
      }
    }
  });
});

describe('semerLaCuisine', () => {
  function unFauxPrisma(recettesExistantes: Record<string, string> = {}) {
    const portees: unknown[] = [];
    const suivre =
      <T>(valeur: T) =>
      () => {
        portees.push(porteeCourante());
        return Promise.resolve(valeur);
      };
    const prisma = {
      ingredient: {
        upsert: jest.fn(({ where }: { where: { name: string } }) =>
          Promise.resolve({ id: `id-${where.name}` }),
        ),
      },
      recipe: {
        findFirst: jest.fn(({ where }: { where: { title: string } }) => {
          portees.push(porteeCourante());
          const id = recettesExistantes[where.title];
          return Promise.resolve(id ? { id } : null);
        }),
        create: jest.fn(suivre(undefined)),
        update: jest.fn(() => 'mise-a-jour'),
      },
      recipeLine: { deleteMany: jest.fn(() => 'suppression') },
      $transaction: jest.fn(suivre([])),
    };

    return { prisma, portees, service: prisma as unknown as PrismaService };
  }

  it('retrouve chaque Ingrédient par son nom normalisé et le remet dans son état', async () => {
    const { prisma, service } = unFauxPrisma();

    await semerLaCuisine(service);

    expect(prisma.ingredient.upsert).toHaveBeenCalledTimes(
      INGREDIENTS_DE_DEMO.length,
    );
    expect(prisma.ingredient.upsert).toHaveBeenCalledWith({
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
      select: { id: true },
    });
  });

  it("crée les recettes dans l'Espace foyer, sous sa portée, avec leurs lignes dans l'ordre", async () => {
    const { prisma, portees, service } = unFauxPrisma();

    await semerLaCuisine(service);

    expect(prisma.recipe.create).toHaveBeenCalledTimes(6);
    expect(prisma.recipe.create).toHaveBeenCalledWith({
      data: {
        title: 'Crêpes',
        servings: 4,
        steps: expect.any(Array),
        source: 'MANUAL',
        scope: { connect: { id: ID_ESPACE_FOYER } },
        lines: {
          create: [
            {
              ingredientId: 'id-farine de ble',
              quantity: 250,
              unit: 'G',
              position: 0,
            },
            {
              ingredientId: 'id-oeufs',
              quantity: 4,
              unit: 'PIECE',
              position: 1,
            },
            {
              ingredientId: 'id-lait demi-ecreme',
              quantity: 50,
              unit: 'CL',
              position: 2,
            },
            {
              ingredientId: 'id-beurre doux',
              quantity: 50,
              unit: 'G',
              position: 3,
            },
            {
              ingredientId: 'id-sucre en poudre',
              quantity: 20,
              unit: 'G',
              position: 4,
            },
            { ingredientId: 'id-sel fin', quantity: 1, unit: 'G', position: 5 },
          ],
        },
      },
    });
    expect(portees.length).toBeGreaterThan(0);
    for (const portee of portees) {
      expect(portee).toEqual({
        espaces: [{ id: ID_ESPACE_FOYER, kind: 'HOUSEHOLD' }],
        typesAcceptes: ['HOUSEHOLD'],
      });
    }
  });

  it('remplace les lignes d’une recette déjà semée, dans une transaction', async () => {
    const { prisma, service } = unFauxPrisma({ Crêpes: 'recette-crepes' });

    await semerLaCuisine(service);

    expect(prisma.recipe.create).toHaveBeenCalledTimes(5);
    expect(prisma.recipeLine.deleteMany).toHaveBeenCalledWith({
      where: { recipeId: 'recette-crepes' },
    });
    expect(prisma.recipe.update).toHaveBeenCalledWith({
      where: { id: 'recette-crepes' },
      data: expect.objectContaining({
        title: 'Crêpes',
        lines: { create: expect.any(Array) },
      }),
    });
    expect(prisma.$transaction).toHaveBeenCalledWith([
      'suppression',
      'mise-a-jour',
    ]);
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

describe('semerLeStock', () => {
  const JOUR = '2026-10-20';

  /** Un Prisma qui connaît tout le catalogue de démo, ou une part, et note les lignes posées. */
  function prismaDeDemo(catalogue = INGREDIENTS_DE_DEMO) {
    const posees: { where: unknown; create: Record<string, unknown> }[] = [];
    const portees: unknown[] = [];
    const prisma = {
      ingredient: {
        findMany: () =>
          Promise.resolve(
            catalogue.map(({ displayName }) => ({
              id: `id-${displayName}`,
              name: normaliserLibelle(displayName),
            })),
          ),
      },
      pantryItem: {
        upsert: (requete: {
          where: unknown;
          create: Record<string, unknown>;
        }) => {
          portees.push(porteeCourante());
          posees.push(requete);
          return Promise.resolve(requete.create);
        },
      },
    } as unknown as PrismaService;

    return { prisma, posees, portees };
  }

  it("tient une dizaine de lignes d'Ingrédients du catalogue, dont deux qui périment bientôt", () => {
    expect(STOCK_DE_DEMO.length).toBeGreaterThanOrEqual(8);
    expect(STOCK_DE_DEMO.length).toBeLessThanOrEqual(12);
    for (const { ingredient } of STOCK_DE_DEMO) {
      expect(() => trouver(ingredient)).not.toThrow();
    }
    expect(
      new Set(STOCK_DE_DEMO.map(({ ingredient }) => ingredient)).size,
    ).toBe(STOCK_DE_DEMO.length);
  });

  it("pose chaque ligne dans l'Espace foyer, sa péremption comptée depuis le jour du semis", async () => {
    const { prisma, posees, portees } = prismaDeDemo();

    await semerLeStock(prisma, JOUR);

    expect(posees).toHaveLength(STOCK_DE_DEMO.length);
    expect(posees[0]).toEqual({
      where: {
        scopeId_ingredientId: {
          scopeId: ID_ESPACE_FOYER,
          ingredientId: `id-${STOCK_DE_DEMO[0].ingredient}`,
        },
      },
      create: {
        scopeId: ID_ESPACE_FOYER,
        ingredientId: `id-${STOCK_DE_DEMO[0].ingredient}`,
        quantity: STOCK_DE_DEMO[0].quantity,
        expiresOn: expect.any(Date),
      },
      update: {
        quantity: STOCK_DE_DEMO[0].quantity,
        expiresOn: expect.any(Date),
      },
    });
    for (const portee of portees) {
      expect(portee).toEqual({
        espaces: [{ id: ID_ESPACE_FOYER, kind: 'HOUSEHOLD' }],
        typesAcceptes: ['HOUSEHOLD'],
      });
    }

    const peremptions = posees.map(({ create }) =>
      create['expiresOn'] instanceof Date
        ? create['expiresOn'].toISOString().slice(0, 10)
        : null,
    );
    expect(
      peremptions.filter((jour) => perimeBientot(jour, JOUR)),
    ).toHaveLength(2);
    expect(peremptions.every((jour) => jour === null || jour > JOUR)).toBe(
      true,
    );
  });

  it('refuse de semer sans le catalogue de démo', async () => {
    const { prisma, posees } = prismaDeDemo([]);

    await expect(semerLeStock(prisma, JOUR)).rejects.toThrow(
      /n'est pas dans le catalogue de démo/,
    );
    expect(posees).toEqual([]);
  });
});
