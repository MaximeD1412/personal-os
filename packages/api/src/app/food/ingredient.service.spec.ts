import type {
  IngredientRecord,
  IngredientRepository,
  IngredientWrite,
} from './ingredient.repository';
import { IngredientService } from './ingredient.service';

const CITRON: IngredientRecord = {
  id: 'ingredient-1',
  name: 'citron',
  displayName: 'Citron',
  canonicalUnit: 'PIECE',
  gramsPerPiece: 120,
  allergens: [],
  perishable: true,
  createdAt: new Date('2026-10-19T08:00:00.000Z'),
};

/** Un dépôt qui garde un seul Ingrédient, et note ce qu'on lui demande. */
function depot(enBase: IngredientRecord | null = CITRON) {
  const appels: {
    lister?: readonly string[];
    ecrit?: Partial<IngredientWrite>;
  } = {};

  const repository = {
    lister: (mots: readonly string[]) => {
      appels.lister = mots;
      return Promise.resolve([]);
    },
    lire: () => Promise.resolve(enBase),
    creer: (saisie: IngredientWrite) => {
      appels.ecrit = saisie;
      return Promise.resolve({ ...CITRON, ...saisie });
    },
    modifier: (_id: string, saisie: Partial<IngredientWrite>) => {
      appels.ecrit = saisie;
      return Promise.resolve({ ...CITRON, ...saisie });
    },
  } as unknown as IngredientRepository;

  return { service: new IngredientService(repository), appels };
}

/** Une règle métier violée : son code, en 422 (ADR 0030). */
const REGLE = (code: string) => ({ code, status: 422 });

describe('IngredientService', () => {
  describe('La recherche', () => {
    it('cherche chaque mot de `q`, normalisé comme le nom', async () => {
      const { service, appels } = depot();

      await service.lister({ q: '  Crème   FRAÎCHE. ' });

      expect(appels.lister).toEqual(['creme', 'fraiche']);
    });

    it('lit tout le catalogue sans `q`, ou avec un `q` sans mot', async () => {
      const { service, appels } = depot();

      await service.lister({});
      expect(appels.lister).toEqual([]);

      await service.lister({ q: ' ?! ' });
      expect(appels.lister).toEqual([]);
    });
  });

  describe('Le nom', () => {
    it('se déduit du libellé, à la création comme à la modification', async () => {
      const { service, appels } = depot();

      await service.creer({
        displayName: 'Citron Vert',
        canonicalUnit: 'PIECE',
        gramsPerPiece: null,
        allergens: [],
        perishable: true,
      });
      expect(appels.ecrit).toMatchObject({ name: 'citron vert' });

      await service.modifier(CITRON.id, { displayName: 'Citron jaune' });
      expect(appels.ecrit).toEqual({
        displayName: 'Citron jaune',
        name: 'citron jaune',
      });
    });
  });

  describe('Le poids à la pièce', () => {
    it('refuse de passer en millilitres un Ingrédient qui en a un en base', async () => {
      const { service } = depot();

      await expect(
        service.modifier(CITRON.id, { canonicalUnit: 'MILLILITER' }),
      ).rejects.toMatchObject(REGLE('food.grams_per_piece_not_applicable'));
    });

    it('refuse un poids à la pièce sur un Ingrédient en base compté en millilitres', async () => {
      const { service } = depot({
        ...CITRON,
        canonicalUnit: 'MILLILITER',
        gramsPerPiece: null,
      });

      await expect(
        service.modifier(CITRON.id, { gramsPerPiece: 30 }),
      ).rejects.toMatchObject(REGLE('food.grams_per_piece_not_applicable'));
    });

    it('accepte le passage en millilitres qui retire le poids dans la même saisie', async () => {
      const { service, appels } = depot();

      await service.modifier(CITRON.id, {
        canonicalUnit: 'MILLILITER',
        gramsPerPiece: null,
      });

      expect(appels.ecrit).toEqual({
        canonicalUnit: 'MILLILITER',
        gramsPerPiece: null,
      });
    });

    it('traduit en règle le refus de la base quand une saisie simultanée a changé l’Ingrédient lu', async () => {
      // Lu en grammes sans poids, l'Ingrédient est passé en millilitres
      // entre la lecture et l'écriture : la contrainte de la base refuse.
      const { service } = depot({
        ...CITRON,
        canonicalUnit: 'GRAM',
        gramsPerPiece: null,
      });
      const refus = Object.assign(new Error('Database error'), {
        code: 'P2039',
        meta: {
          driverAdapterError: {
            cause: {
              originalCode: '23514',
              originalMessage:
                'new row for relation "Ingredient" violates check constraint "Ingredient_gramsPerPiece_unit_check"',
            },
          },
        },
      });
      (
        service as unknown as {
          repository: { modifier: () => Promise<never> };
        }
      ).repository.modifier = () => Promise.reject(refus);

      await expect(
        service.modifier(CITRON.id, { gramsPerPiece: 100 }),
      ).rejects.toMatchObject(REGLE('food.grams_per_piece_not_applicable'));
    });
  });

  it('refuse une modification vide, avant même de lire la base', async () => {
    const { service } = depot(null);

    await expect(service.modifier(CITRON.id, {})).rejects.toMatchObject(
      REGLE('food.ingredient_empty_update'),
    );
  });

  it('répond « introuvable » à la modification d’un Ingrédient absent', async () => {
    const { service } = depot(null);

    await expect(
      service.modifier(CITRON.id, { perishable: false }),
    ).rejects.toMatchObject({ code: 'food.ingredient_not_found', status: 404 });
  });
});
