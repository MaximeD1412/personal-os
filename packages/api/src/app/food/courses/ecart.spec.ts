import { ecart, type ArticleDeListe } from './ecart';

/** Un article issu du planning, en Unité canonique. */
function duPlanning(
  ingredientId: string,
  quantite: number | string,
  unite: ArticleDeListe['unite'] = 'GRAM',
): ArticleDeListe {
  return { ingredientId, quantite, unite, origin: 'PLAN' };
}

/** Les manquants en clair : chaque quantité en texte, sans flottant. */
function manquantsDe(resultat: ReturnType<typeof ecart>) {
  return resultat.manquants.map(({ ingredientId, quantite }) => ({
    ingredientId,
    quantite: quantite.toString(),
  }));
}

describe('ecart', () => {
  it('signale exactement ce que le besoin actuel demande au-delà des listes du planning', () => {
    const resultat = ecart(
      [
        { ingredientId: 'farine', quantite: '550', unite: 'GRAM' },
        { ingredientId: 'oeufs', quantite: '6', unite: 'PIECE' },
        { ingredientId: 'lait', quantite: '500', unite: 'MILLILITER' },
      ],
      [
        {
          articles: [
            duPlanning('farine', 300),
            duPlanning('lait', 500, 'MILLILITER'),
          ],
        },
      ],
    );

    expect(manquantsDe(resultat)).toEqual([
      { ingredientId: 'farine', quantite: '250' },
      { ingredientId: 'oeufs', quantite: '6' },
    ]);
  });

  it('additionne les listes du planning, de complément comprises, et ne signale aucun excédent', () => {
    const resultat = ecart(
      [
        { ingredientId: 'farine', quantite: '550', unite: 'GRAM' },
        { ingredientId: 'sucre', quantite: '100', unite: 'GRAM' },
      ],
      [
        { articles: [duPlanning('farine', 300), duPlanning('sucre', 400)] },
        { articles: [duPlanning('farine', '250')] },
      ],
    );

    expect(manquantsDe(resultat)).toEqual([]);
  });

  it("ne compte pas un ajout manuel : il n'a pas été tiré du planning", () => {
    const resultat = ecart(
      [{ ingredientId: 'farine', quantite: '500', unite: 'GRAM' }],
      [
        {
          articles: [
            duPlanning('farine', 200),
            {
              ingredientId: 'farine',
              quantite: 300,
              unite: 'GRAM',
              origin: 'MANUAL',
            },
            { ingredientId: null, quantite: 2, unite: null, origin: 'MANUAL' },
          ],
        },
      ],
    );

    expect(manquantsDe(resultat)).toEqual([
      { ingredientId: 'farine', quantite: '300' },
    ]);
  });

  it("ne compte pas un article figé dans une autre unité que l'Unité canonique actuelle", () => {
    const resultat = ecart(
      [{ ingredientId: 'oeufs', quantite: '6', unite: 'PIECE' }],
      [
        {
          articles: [
            duPlanning('oeufs', 300, 'GRAM'),
            duPlanning('oeufs', 2, 'PIECE'),
          ],
        },
      ],
    );

    expect(manquantsDe(resultat)).toEqual([
      { ingredientId: 'oeufs', quantite: '4' },
    ]);
  });

  it('compte comme couvert ce que les conditionnements prévus contiennent, au-delà du besoin figé', () => {
    // 700 g ont donné deux boîtes de 400 g : un passage à 750 g reste couvert.
    const resultat = ecart(
      [
        { ingredientId: 'tomates', quantite: '750', unite: 'GRAM' },
        { ingredientId: 'mais', quantite: '900', unite: 'GRAM' },
      ],
      [
        {
          articles: [
            {
              ...duPlanning('tomates', 700),
              conditionnements: 2,
              contenance: 400,
            },
            {
              ...duPlanning('mais', 300),
              conditionnements: 1,
              contenance: '400',
            },
          ],
        },
      ],
    );

    expect(manquantsDe(resultat)).toEqual([
      { ingredientId: 'mais', quantite: '500' },
    ]);
  });
});
