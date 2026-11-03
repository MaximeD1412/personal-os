import {
  consolider,
  type IngredientAConsolider,
  type RecetteAConsolider,
} from './consolider';

const farine: IngredientAConsolider = {
  id: 'farine',
  canonicalUnit: 'GRAM',
  gramsPerPiece: null,
};
const lait: IngredientAConsolider = {
  id: 'lait',
  canonicalUnit: 'MILLILITER',
  gramsPerPiece: null,
};

const crepes: RecetteAConsolider = {
  id: 'crepes',
  servings: 4,
  lignes: [
    { ingredientId: 'farine', quantite: 250, unite: 'G' },
    { ingredientId: 'lait', quantite: '0.5', unite: 'L' },
  ],
};
const gaufres: RecetteAConsolider = {
  id: 'gaufres',
  servings: 4,
  lignes: [{ ingredientId: 'farine', quantite: '0.3', unite: 'KG' }],
};

/** Les articles en clair : chaque quantité en texte, une égalité de décimaux sans flottant. */
function articlesDe(resultat: ReturnType<typeof consolider>) {
  if (!('articles' in resultat)) {
    throw new Error(`La consolidation a échoué : ${JSON.stringify(resultat)}`);
  }
  return resultat.articles.map(({ ingredientId, quantite }) => ({
    ingredientId,
    quantite: quantite.toString(),
  }));
}

describe('consolider', () => {
  it('additionne en Unité canonique un Ingrédient que deux recettes donnent en unités différentes', () => {
    const resultat = consolider(
      [
        { recipeId: 'crepes', portions: 4 },
        { recipeId: 'gaufres', portions: 4 },
      ],
      [crepes, gaufres],
      [],
      [farine, lait],
    );

    expect(articlesDe(resultat)).toEqual([
      { ingredientId: 'farine', quantite: '550' },
      { ingredientId: 'lait', quantite: '500' },
    ]);
  });

  it('met les quantités à l’échelle des portions du repas', () => {
    const resultat = consolider(
      [{ recipeId: 'crepes', portions: 6 }],
      [crepes],
      [],
      [farine, lait],
    );

    expect(articlesDe(resultat)).toEqual([
      { ingredientId: 'farine', quantite: '375' },
      { ingredientId: 'lait', quantite: '750' },
    ]);
  });

  it('arrondit au millième supérieur ce qui reste à acheter, après un calcul exact', () => {
    const resultat = consolider(
      [
        { recipeId: 'crepes', portions: 1 },
        { recipeId: 'crepes', portions: 2 },
      ],
      [{ ...crepes, servings: 7 }],
      [],
      [farine, lait],
    );

    // 250 × 3 / 7 = 107,142857… ; 500 × 3 / 7 = 214,285714…
    expect(articlesDe(resultat)).toEqual([
      { ingredientId: 'farine', quantite: '107.143' },
      { ingredientId: 'lait', quantite: '214.286' },
    ]);
  });

  it('déduit le Stock domestique, et un besoin couvert ne donne pas d’article', () => {
    const resultat = consolider(
      [{ recipeId: 'crepes', portions: 4 }],
      [crepes],
      [
        { ingredientId: 'farine', quantite: '100' },
        { ingredientId: 'lait', quantite: '1000' },
      ],
      [farine, lait],
    );

    expect(articlesDe(resultat)).toEqual([
      { ingredientId: 'farine', quantite: '150' },
    ]);
  });

  it('un besoin couvert tout juste ne donne pas d’article', () => {
    const resultat = consolider(
      [{ recipeId: 'gaufres', portions: 4 }],
      [gaufres],
      [{ ingredientId: 'farine', quantite: '300' }],
      [farine],
    );

    expect(articlesDe(resultat)).toEqual([]);
  });

  it('un stock égal à la somme exacte de besoins fractionnaires ne donne pas d’article', () => {
    const sel: IngredientAConsolider = {
      id: 'sel',
      canonicalUnit: 'GRAM',
      gramsPerPiece: null,
    };
    const soupe: RecetteAConsolider = {
      id: 'soupe',
      servings: 3,
      lignes: [{ ingredientId: 'sel', quantite: 5, unite: 'G' }],
    };
    // 5/3 + 5/3 + 5/3 = 5 : arrondir chaque tiers laisserait un résidu à acheter.
    const resultat = consolider(
      [1, 1, 1].map((portions) => ({ recipeId: 'soupe', portions })),
      [soupe],
      [{ ingredientId: 'sel', quantite: '5' }],
      [sel],
    );

    expect(articlesDe(resultat)).toEqual([]);
  });

  it('reste exact à travers le poids à la pièce', () => {
    const oeuf: IngredientAConsolider = {
      id: 'oeuf',
      canonicalUnit: 'PIECE',
      gramsPerPiece: '60',
    };
    const cake: RecetteAConsolider = {
      id: 'cake',
      servings: 1,
      lignes: [{ ingredientId: 'oeuf', quantite: 20, unite: 'G' }],
    };
    // 20/60 × 3 = 1 pièce tout juste, que le stock couvre.
    const resultat = consolider(
      [1, 1, 1].map((portions) => ({ recipeId: 'cake', portions })),
      [cake],
      [{ ingredientId: 'oeuf', quantite: '1' }],
      [oeuf],
    );

    expect(articlesDe(resultat)).toEqual([]);
  });

  it('un repas sans recette (un intitulé) ne demande rien', () => {
    const resultat = consolider(
      [
        { recipeId: null, portions: 2 },
        { recipeId: 'gaufres', portions: 2 },
      ],
      [gaufres],
      [],
      [farine],
    );

    expect(articlesDe(resultat)).toEqual([
      { ingredientId: 'farine', quantite: '150' },
    ]);
  });

  it('passe des pièces aux grammes par le poids à la pièce', () => {
    const oeufEnGrammes: IngredientAConsolider = {
      id: 'oeuf',
      canonicalUnit: 'GRAM',
      gramsPerPiece: '60',
    };
    const resultat = consolider(
      [{ recipeId: 'omelette', portions: 2 }],
      [
        {
          id: 'omelette',
          servings: 1,
          lignes: [{ ingredientId: 'oeuf', quantite: 3, unite: 'PIECE' }],
        },
      ],
      [],
      [oeufEnGrammes],
    );

    expect(articlesDe(resultat)).toEqual([
      { ingredientId: 'oeuf', quantite: '360' },
    ]);
  });

  describe('une conversion impossible', () => {
    const oeuf: IngredientAConsolider = {
      id: 'oeuf',
      canonicalUnit: 'PIECE',
      gramsPerPiece: null,
    };
    const pain: RecetteAConsolider = {
      id: 'pain',
      servings: 2,
      lignes: [
        { ingredientId: 'farine', quantite: 2, unite: 'TBSP' },
        { ingredientId: 'oeuf', quantite: 120, unite: 'G' },
        { ingredientId: 'lait', quantite: 20, unite: 'CL' },
      ],
    };

    it('fait échouer l’ensemble et nomme chaque Ingrédient en cause, une fois', () => {
      const resultat = consolider(
        [
          { recipeId: 'crepes', portions: 4 },
          { recipeId: 'pain', portions: 2 },
          { recipeId: 'pain', portions: 4 },
        ],
        [crepes, pain],
        [],
        [farine, lait, oeuf],
      );

      expect(resultat).toEqual({
        echecs: [
          { ingredientId: 'farine', raison: 'dimension' },
          { ingredientId: 'oeuf', raison: 'facteur_manquant' },
        ],
      });
    });
  });

  it('refuse un repas dont la recette manque aux données', () => {
    expect(() =>
      consolider([{ recipeId: 'inconnue', portions: 2 }], [], [], []),
    ).toThrow(RangeError);
  });
});
