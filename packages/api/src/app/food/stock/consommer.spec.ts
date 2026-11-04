import { consommer, type IngredientConsomme } from './consommer';

const FARINE: IngredientConsomme = {
  id: 'farine',
  canonicalUnit: 'GRAM',
  gramsPerPiece: null,
};
const LAIT: IngredientConsomme = {
  id: 'lait',
  canonicalUnit: 'MILLILITER',
  gramsPerPiece: null,
};
const OEUF: IngredientConsomme = {
  id: 'oeuf',
  canonicalUnit: 'PIECE',
  gramsPerPiece: 60,
};
const CATALOGUE = new Map([FARINE, LAIT, OEUF].map((i) => [i.id, i]));

/** Le résultat en clair : des décimaux en texte, une égalité sans flottant. */
function enClair(resultat: ReturnType<typeof consommer>) {
  if ('echec' in resultat) return resultat;
  return {
    recalages: resultat.recalages.map(({ ingredientId, avant, apres }) => ({
      ingredientId,
      avant: avant.quantite.toString(),
      apres: apres.quantite.toString(),
      expireLe: apres.expireLe,
    })),
    manques: resultat.manques.map(({ ingredientId, disponible, manque }) => ({
      ingredientId,
      disponible: disponible.toString(),
      manque: manque.toString(),
    })),
  };
}

describe('consommer', () => {
  it("retire du stock les quantités déclarées, converties dans l'Unité canonique", () => {
    const resultat = consommer(
      [
        { ingredientId: 'farine', quantite: 0.25, unite: 'KG' },
        { ingredientId: 'lait', quantite: 2, unite: 'TBSP' },
      ],
      CATALOGUE,
      new Map([
        ['farine', { quantite: '1000', expireLe: '2027-01-10' }],
        ['lait', { quantite: '500', expireLe: '2026-11-05' }],
      ]),
    );

    expect(enClair(resultat)).toEqual({
      recalages: [
        {
          ingredientId: 'farine',
          avant: '1000',
          apres: '750',
          expireLe: '2027-01-10',
        },
        {
          ingredientId: 'lait',
          avant: '500',
          apres: '470',
          expireLe: '2026-11-05',
        },
      ],
      manques: [],
    });
  });

  it('additionne deux lignes du même Ingrédient avant de consommer', () => {
    const resultat = consommer(
      [
        { ingredientId: 'farine', quantite: 200, unite: 'G' },
        { ingredientId: 'farine', quantite: 0.1, unite: 'KG' },
      ],
      CATALOGUE,
      new Map([['farine', { quantite: '1000', expireLe: null }]]),
    );

    expect(enClair(resultat)).toMatchObject({
      recalages: [{ ingredientId: 'farine', apres: '700' }],
      manques: [],
    });
  });

  it('passe des pièces aux grammes par le poids à la pièce', () => {
    expect(
      enClair(
        consommer(
          [{ ingredientId: 'oeuf', quantite: 120, unite: 'G' }],
          CATALOGUE,
          new Map([['oeuf', { quantite: '6', expireLe: '2026-11-10' }]]),
        ),
      ),
    ).toMatchObject({ recalages: [{ ingredientId: 'oeuf', apres: '4' }] });
  });

  it('ramène la ligne à zéro et rend le manque, sans quantité négative', () => {
    const resultat = consommer(
      [{ ingredientId: 'farine', quantite: 500, unite: 'G' }],
      CATALOGUE,
      new Map([['farine', { quantite: '200', expireLe: '2027-01-10' }]]),
    );

    expect(enClair(resultat)).toEqual({
      recalages: [
        { ingredientId: 'farine', avant: '200', apres: '0', expireLe: null },
      ],
      manques: [{ ingredientId: 'farine', disponible: '200', manque: '300' }],
    });
  });

  it("rend tout en manque pour un Ingrédient qui n'est pas en stock, sans lui créer de ligne", () => {
    expect(
      enClair(
        consommer(
          [{ ingredientId: 'lait', quantite: 0.2, unite: 'L' }],
          CATALOGUE,
          new Map(),
        ),
      ),
    ).toEqual({
      recalages: [],
      manques: [{ ingredientId: 'lait', disponible: '0', manque: '200' }],
    });
  });

  it('arrondit la quantité convertie au millième que la base garde', () => {
    // Une pièce de 8,5714285 g : plus fin que le millième.
    const resultat = consommer(
      [{ ingredientId: 'sucre', quantite: 1, unite: 'PIECE' }],
      new Map([
        [
          'sucre',
          { id: 'sucre', canonicalUnit: 'GRAM', gramsPerPiece: '8.5714285' },
        ],
      ]),
      new Map([['sucre', { quantite: '100', expireLe: null }]]),
    );

    expect(enClair(resultat)).toMatchObject({
      recalages: [{ ingredientId: 'sucre', apres: '91.429' }],
    });
  });

  it('échoue sur une ligne qui ne se convertit pas, et dit laquelle', () => {
    expect(
      consommer(
        [
          { ingredientId: 'farine', quantite: 100, unite: 'G' },
          { ingredientId: 'farine', quantite: 1, unite: 'L' },
        ],
        CATALOGUE,
        new Map(),
      ),
    ).toEqual({ echec: { ingredientId: 'farine', raison: 'dimension' } });
  });

  it('échoue sur un Ingrédient absent du catalogue', () => {
    expect(
      consommer(
        [{ ingredientId: 'inconnu', quantite: 1, unite: 'G' }],
        CATALOGUE,
        new Map(),
      ),
    ).toEqual({ echec: { ingredientId: 'inconnu', raison: 'inconnu' } });
  });
});
