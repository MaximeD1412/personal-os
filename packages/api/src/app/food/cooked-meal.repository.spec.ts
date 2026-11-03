import type { PrismaService } from '@personal-os/database';
import {
  CookedMealRepository,
  type EcritureDeStock,
} from './cooked-meal.repository';

/** Une base qui note l'ordre des écritures de la transaction, sans rien écrire. */
function baseQuiNote(): { prisma: PrismaService; ordre: string[] } {
  const ordre: string[] = [];
  const prisma = {
    $transaction: (operations: unknown[]) => Promise.resolve(operations),
    cookedMeal: {
      create: () => {
        ordre.push('repas');
        return { id: 'cuisine-1' };
      },
    },
    pantryItem: {
      update: ({
        where,
      }: {
        where: { scopeId_ingredientId: { ingredientId: string } };
      }) => {
        ordre.push(where.scopeId_ingredientId.ingredientId);
        return { id: `stock-${where.scopeId_ingredientId.ingredientId}` };
      },
    },
  };
  return { prisma: prisma as unknown as PrismaService, ordre };
}

function ecriture(ingredientId: string): EcritureDeStock {
  return {
    ingredientId,
    avant: { quantity: '1000', expiresOn: null },
    apres: { quantity: '950', expiresOn: null },
  };
}

describe('CookedMealRepository.declarer', () => {
  it('écrit le repas, puis les lignes de stock dans l’ordre de leur Ingrédient, quel que soit celui de la déclaration', async () => {
    const lait = ecriture('ingredient-lait');
    const farine = ecriture('ingredient-farine');
    const oeuf = ecriture('ingredient-oeuf');

    const premiere = baseQuiNote();
    await new CookedMealRepository(premiere.prisma).declarer(
      'repas-1',
      [],
      [lait, oeuf, farine],
    );
    const seconde = baseQuiNote();
    await new CookedMealRepository(seconde.prisma).declarer(
      'repas-2',
      [],
      [oeuf, farine, lait],
    );

    const attendu = [
      'repas',
      'ingredient-farine',
      'ingredient-lait',
      'ingredient-oeuf',
    ];
    expect(premiere.ordre).toEqual(attendu);
    expect(seconde.ordre).toEqual(attendu);
  });

  it('ne réordonne pas les écritures qu’on lui passe', async () => {
    const ecritures = [ecriture('b'), ecriture('a')];
    await new CookedMealRepository(baseQuiNote().prisma).declarer(
      'repas-1',
      [],
      ecritures,
    );
    expect(ecritures.map(({ ingredientId }) => ingredientId)).toEqual([
      'b',
      'a',
    ]);
  });
});
