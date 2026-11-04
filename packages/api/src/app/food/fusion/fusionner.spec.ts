import { ErreurMetier } from '../../erreurs/erreur-metier';
import { fusionner, type IngredientAFusionner } from './fusionner';

const DOUBLON: IngredientAFusionner = {
  id: 'doublon',
  name: 'noix de cajou grillees',
  canonicalUnit: 'GRAM',
  preferredProductId: null,
  stock: null,
  preferences: [],
};

const CONSERVE: IngredientAFusionner = {
  id: 'conserve',
  name: 'noix de cajou',
  canonicalUnit: 'GRAM',
  preferredProductId: null,
  stock: null,
  preferences: [],
};

function codeDe(geste: () => unknown): string | undefined {
  try {
    geste();
  } catch (erreur) {
    if (erreur instanceof ErreurMetier) return erreur.code;
    throw erreur;
  }
  return undefined;
}

describe('fusionner', () => {
  it('refuse de fusionner un Ingrédient avec lui-même', () => {
    expect(codeDe(() => fusionner(CONSERVE, CONSERVE))).toBe(
      'food.merge_same_ingredient',
    );
  });

  it('refuse deux Unités canoniques différentes', () => {
    expect(
      codeDe(() =>
        fusionner({ ...DOUBLON, canonicalUnit: 'MILLILITER' }, CONSERVE),
      ),
    ).toBe('food.merge_unit_mismatch');
  });

  it("garde le nom du doublon comme Alias de l'Ingrédient conservé", () => {
    expect(fusionner(DOUBLON, CONSERVE).alias).toBe('noix de cajou grillees');
  });

  describe('le stock', () => {
    it("n'écrit rien quand le doublon n'est pas en stock", () => {
      expect(
        fusionner(DOUBLON, {
          ...CONSERVE,
          stock: { quantite: '200', expireLe: null },
        }).stock,
      ).toEqual({ type: 'AUCUN' });
    });

    it("reprend la ligne du doublon quand le conservé n'en a pas", () => {
      const ligne = { quantite: '300', expireLe: '2026-11-20' };

      expect(fusionner({ ...DOUBLON, stock: ligne }, CONSERVE).stock).toEqual({
        type: 'REPRENDRE',
        avant: ligne,
      });
    });

    it('additionne les deux lignes et garde la péremption la plus proche', () => {
      const duDoublon = { quantite: '300.5', expireLe: '2026-11-20' };
      const duConserve = { quantite: '200', expireLe: '2026-12-10' };

      const { stock } = fusionner(
        { ...DOUBLON, stock: duDoublon },
        { ...CONSERVE, stock: duConserve },
      );

      expect(stock).toMatchObject({
        type: 'ADDITIONNER',
        duDoublon,
        duConserve,
      });
      expect(
        stock.type === 'ADDITIONNER' && {
          quantite: stock.apres.quantite.toString(),
          expireLe: stock.apres.expireLe,
        },
      ).toEqual({ quantite: '500.5', expireLe: '2026-11-20' });
    });
  });

  describe('les Préférences', () => {
    it('supprime celles du doublon que le conservé a déjà, et repointe les autres', () => {
      const plan = fusionner(
        {
          ...DOUBLON,
          preferences: [
            { id: 'p1', userId: 'a', kind: 'DISLIKED' },
            { id: 'p2', userId: 'a', kind: 'EXCLUDED' },
            { id: 'p3', userId: 'b', kind: 'DISLIKED' },
          ],
        },
        {
          ...CONSERVE,
          preferences: [{ id: 'p4', userId: 'a', kind: 'DISLIKED' }],
        },
      );

      expect(plan.preferencesEnDouble).toEqual(['p1']);
      expect(plan.comptesTouches).toEqual(['a', 'b']);
    });

    it("ne touche aucun Compte quand le doublon n'a pas de Préférence", () => {
      expect(fusionner(DOUBLON, CONSERVE).comptesTouches).toEqual([]);
    });
  });

  describe('le Produit préféré', () => {
    it('garde celui du conservé', () => {
      expect(
        fusionner(
          { ...DOUBLON, preferredProductId: 'brique' },
          { ...CONSERVE, preferredProductId: 'boite' },
        ).produitPrefere,
      ).toBe('boite');
    });

    it("reprend celui du doublon quand le conservé n'en a pas", () => {
      expect(
        fusionner({ ...DOUBLON, preferredProductId: 'brique' }, CONSERVE)
          .produitPrefere,
      ).toBe('brique');
    });
  });
});
