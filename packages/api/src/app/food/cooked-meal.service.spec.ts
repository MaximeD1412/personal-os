import type { CookedMealInput } from '@personal-os/contracts';
import type { CookedMealRepository } from './cooked-meal.repository';
import { CookedMealService } from './cooked-meal.service';

const SAISIE: CookedMealInput = {
  mealPlanEntryId: 'repas-1',
  lines: [{ ingredientId: 'farine', quantity: 50, unit: 'G' }],
};

/**
 * Un dépôt devant un repas approuvé et 1 000 g de farine en stock, dont
 * l'écriture rejette d'abord les erreurs données, une par essai.
 */
function depot(...rejets: unknown[]): {
  repository: CookedMealRepository;
  essais: () => number;
} {
  let essais = 0;
  const repository = {
    repas: () => Promise.resolve({ decision: 'APPROVED', dejaCuisine: false }),
    ingredients: () =>
      Promise.resolve([
        {
          id: 'farine',
          displayName: 'Farine',
          canonicalUnit: 'GRAM',
          gramsPerPiece: null,
        },
      ]),
    stock: () =>
      Promise.resolve(
        new Map([['farine', { quantite: '1000', expireLe: null }]]),
      ),
    declarer: () => {
      const rejet = rejets[essais++];
      return rejet === undefined
        ? Promise.resolve({
            id: 'cuisine-1',
            mealPlanEntryId: 'repas-1',
            cookedAt: new Date('2026-11-03T19:00:00.000Z'),
            lines: [],
          })
        : Promise.reject(rejet);
    },
  };
  return {
    repository: repository as unknown as CookedMealRepository,
    essais: () => essais,
  };
}

describe('CookedMealService.declarer', () => {
  it('recommence sur le stock relu après une écriture concurrente', async () => {
    const { repository, essais } = depot({ code: 'P2025' }, { code: 'P2025' });

    await expect(
      new CookedMealService(repository).declarer(SAISIE),
    ).resolves.toMatchObject({ id: 'cuisine-1' });
    expect(essais()).toBe(3);
  });

  it('renonce après cinq essais, en food.pantry_busy', async () => {
    const { repository, essais } = depot(
      ...Array.from({ length: 5 }, () => ({ code: 'P2025' })),
    );

    await expect(
      new CookedMealService(repository).declarer(SAISIE),
    ).rejects.toMatchObject({ code: 'food.pantry_busy', status: 422 });
    expect(essais()).toBe(5);
  });

  it('ne recommence pas sur une autre erreur de la base', async () => {
    const panne = { code: 'P2039' };
    const { repository, essais } = depot(panne);

    await expect(
      new CookedMealService(repository).declarer(SAISIE),
    ).rejects.toBe(panne);
    expect(essais()).toBe(1);
  });
});
