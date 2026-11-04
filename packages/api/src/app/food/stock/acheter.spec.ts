import { acheter, type ArticleAchete } from './acheter';

const TOMATES = {
  id: 'tomates',
  canonicalUnit: 'GRAM',
  perishable: false,
} as const;
const YAOURTS = {
  id: 'yaourts',
  canonicalUnit: 'PIECE',
  perishable: true,
} as const;

function article(
  id: string,
  champs: Partial<ArticleAchete> = {},
): ArticleAchete {
  return {
    id,
    ingredient: TOMATES,
    quantite: 400,
    unite: 'GRAM',
    coche: true,
    ...champs,
  };
}

/** Le résultat en clair : des décimaux en texte, une égalité sans flottant. */
function enClair(resultat: ReturnType<typeof acheter>) {
  if ('echecs' in resultat) return resultat;
  return resultat.recalages.map(({ ingredientId, avant, apres }) => ({
    ingredientId,
    avant: avant && {
      quantite: avant.quantite.toString(),
      expireLe: avant.expireLe,
    },
    apres: { quantite: apres.quantite.toString(), expireLe: apres.expireLe },
  }));
}

describe('acheter', () => {
  it("ajoute au stock la quantité de la liste d'un article coché", () => {
    expect(
      enClair(
        acheter(
          [article('a')],
          new Map(),
          new Map([['tomates', { quantite: '100', expireLe: null }]]),
        ),
      ),
    ).toEqual([
      {
        ingredientId: 'tomates',
        avant: { quantite: '100', expireLe: null },
        apres: { quantite: '500', expireLe: null },
      },
    ]);
  });

  it('préfère la quantité achetée à celle de la liste, et crée une ligne absente', () => {
    expect(
      enClair(
        acheter(
          [article('a')],
          new Map([['a', { quantiteAchetee: 650.5 }]]),
          new Map(),
        ),
      ),
    ).toEqual([
      {
        ingredientId: 'tomates',
        avant: null,
        apres: { quantite: '650.5', expireLe: null },
      },
    ]);
  });

  it("n'achète ni un article non coché, ni un simple libellé", () => {
    expect(
      enClair(
        acheter(
          [
            article('a', { coche: false }),
            article('b', { ingredient: null, unite: null, quantite: 2 }),
          ],
          new Map([['a', { quantiteAchetee: 300 }]]),
          new Map(),
        ),
      ),
    ).toEqual([]);
  });

  it('additionne deux articles du même Ingrédient sur sa seule ligne, et garde la péremption la plus proche', () => {
    expect(
      enClair(
        acheter(
          [
            article('a', { ingredient: YAOURTS, quantite: 4, unite: 'PIECE' }),
            article('b', { ingredient: YAOURTS, quantite: 2, unite: 'PIECE' }),
          ],
          new Map([
            ['a', { expireLe: '2026-11-20' }],
            ['b', { expireLe: '2026-11-12' }],
          ]),
          new Map([['yaourts', { quantite: '1', expireLe: '2026-11-15' }]]),
        ),
      ),
    ).toEqual([
      {
        ingredientId: 'yaourts',
        avant: { quantite: '1', expireLe: '2026-11-15' },
        apres: { quantite: '7', expireLe: '2026-11-12' },
      },
    ]);
  });

  it('nomme chaque article coché périssable sans péremption, et ne recale rien', () => {
    expect(
      acheter(
        [
          article('a', { ingredient: YAOURTS, quantite: 4, unite: 'PIECE' }),
          article('b'),
          article('c', { ingredient: YAOURTS, quantite: 2, unite: 'PIECE' }),
          article('d', {
            ingredient: YAOURTS,
            quantite: 2,
            unite: 'PIECE',
            coche: false,
          }),
        ],
        new Map([['c', { expireLe: '2026-11-12' }]]),
        new Map(),
      ),
    ).toEqual({ echecs: [{ articleId: 'a', raison: 'peremption_manquante' }] });
  });

  it("demande la quantité achetée d'un article sans quantité, ou dont l'Ingrédient a changé d'unité", () => {
    expect(
      acheter(
        [
          article('a', { quantite: null, unite: null }),
          article('b', { quantite: 3, unite: 'PIECE' }),
          article('c', { quantite: null, unite: null }),
        ],
        new Map([['c', { quantiteAchetee: 200 }]]),
        new Map(),
      ),
    ).toEqual({
      echecs: [
        { articleId: 'a', raison: 'quantite_manquante' },
        { articleId: 'b', raison: 'quantite_manquante' },
      ],
    });
  });

  describe('au conditionnement', () => {
    const deuxBoites = { nombre: 2, contenance: '400' };

    it('monte le stock de la quantité des conditionnements achetés, pas du besoin', () => {
      expect(
        enClair(
          acheter(
            [article('a', { quantite: '700', conditionnement: deuxBoites })],
            new Map(),
            new Map(),
          ),
        ),
      ).toEqual([
        {
          ingredientId: 'tomates',
          avant: null,
          apres: { quantite: '800', expireLe: null },
        },
      ]);
    });

    it('préfère encore la quantité achetée au conditionnement', () => {
      expect(
        enClair(
          acheter(
            [article('a', { conditionnement: deuxBoites })],
            new Map([['a', { quantiteAchetee: '1000' }]]),
            new Map(),
          ),
        ),
      ).toEqual([
        {
          ingredientId: 'tomates',
          avant: null,
          apres: { quantite: '1000', expireLe: null },
        },
      ]);
    });

    it("exige la quantité achetée quand l'Ingrédient a changé d'unité depuis la liste", () => {
      expect(
        acheter(
          [article('a', { unite: 'PIECE', conditionnement: deuxBoites })],
          new Map(),
          new Map(),
        ),
      ).toEqual({
        echecs: [{ articleId: 'a', raison: 'quantite_manquante' }],
      });
    });
  });
});
