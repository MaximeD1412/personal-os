import { ID_ESPACE_FOYER } from '@personal-os/database';
import type {
  FoodPreferenceRecord,
  FoodPreferenceRepository,
  FoodPreferenceWrite,
} from './food-preference.repository';
import { FoodPreferenceService } from './food-preference.service';

const CREEE_LE = new Date('2026-10-20T08:00:00.000Z');

/** Un dépôt qui accepte tout, et note ce qu'on lui demande d'écrire. */
function depot(
  creation: (saisie: FoodPreferenceWrite) => Promise<FoodPreferenceRecord>,
) {
  const appels: { ecrit?: FoodPreferenceWrite } = {};
  const repository = {
    duMemeFoyer: () => Promise.resolve(true),
    ingredientExiste: () => Promise.resolve(true),
    creer: (saisie: FoodPreferenceWrite) => {
      appels.ecrit = saisie;
      return creation(saisie);
    },
  } as unknown as FoodPreferenceRepository;

  return { service: new FoodPreferenceService(repository), appels };
}

function enregistree(
  saisie: FoodPreferenceWrite,
): Promise<FoodPreferenceRecord> {
  return Promise.resolve({
    id: 'preference-1',
    ...saisie,
    ingredient: saisie.ingredientId ? { displayName: 'Coriandre' } : null,
    createdAt: CREEE_LE,
  });
}

/** Une règle métier violée : son code, en 422 (ADR 0030). */
const REGLE = (code: string) => ({ code, status: 422 });

describe('FoodPreferenceService', () => {
  it("pose la Préférence dans l'Espace foyer, avec sa seule cible", async () => {
    const { service, appels } = depot(enregistree);

    const preference = await service.creer(
      {
        userId: 'compte-b',
        kind: 'DISLIKED',
        target: 'INGREDIENT',
        ingredientId: 'coriandre',
      },
      'compte-a',
    );

    expect(appels.ecrit).toEqual({
      scopeId: ID_ESPACE_FOYER,
      userId: 'compte-b',
      kind: 'DISLIKED',
      allergen: null,
      ingredientId: 'coriandre',
    });
    expect(preference).toEqual({
      id: 'preference-1',
      userId: 'compte-b',
      kind: 'DISLIKED',
      target: 'INGREDIENT',
      ingredientId: 'coriandre',
      ingredientDisplayName: 'Coriandre',
      createdAt: '2026-10-20T08:00:00.000Z',
    });
  });

  it.each([
    ['P2002', 'food.preference_duplicate'],
    ['P2003', 'food.unknown_ingredient'],
  ])(
    'traduit le refus %s de la base, tranché entre deux saisies simultanées',
    async (codePrisma, code) => {
      const { service } = depot(() =>
        Promise.reject(Object.assign(new Error('refus'), { code: codePrisma })),
      );

      await expect(
        service.creer(
          {
            userId: 'compte-a',
            kind: 'EXCLUDED',
            target: 'INGREDIENT',
            ingredientId: 'porc',
          },
          'compte-a',
        ),
      ).rejects.toMatchObject(REGLE(code));
    },
  );
});
