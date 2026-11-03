import { construireLaDemande, type DonneesDeLaDemande } from './demande';

const LUNDI = '2028-03-13';

function donnees(
  surcharge: Partial<DonneesDeLaDemande> = {},
): DonneesDeLaDemande {
  return {
    semaine: LUNDI,
    aujourdhui: '2028-03-10',
    creneaux: [
      { day: LUNDI, moment: 'DINNER', participantIds: ['a'], guestCount: 2 },
    ],
    preferences: [],
    ingredients: [
      { id: 'noix', displayName: 'Noix' },
      { id: 'lentilles', displayName: 'Lentilles vertes' },
      { id: 'courgette', displayName: 'Courgette' },
    ],
    souhaits: [],
    stock: [],
    recettes: [],
    repas: [],
    approuvesAvant: [],
    ...surcharge,
  };
}

function lire(surcharge: Partial<DonneesDeLaDemande> = {}) {
  return JSON.parse(construireLaDemande(donnees(surcharge)).message);
}

describe('construireLaDemande', () => {
  it('donne à chaque créneau ses portions, et les interdits et aversions de ses seuls Participants', () => {
    const { creneaux } = lire({
      creneaux: [
        { day: LUNDI, moment: 'DINNER', participantIds: ['a'], guestCount: 2 },
        {
          day: LUNDI,
          moment: 'LUNCH',
          participantIds: ['a', 'b'],
          guestCount: 0,
        },
      ],
      preferences: [
        {
          userId: 'b',
          kind: 'ALLERGY',
          allergen: 'TREE_NUTS',
          ingredientId: null,
        },
        {
          userId: 'a',
          kind: 'DISLIKED',
          allergen: null,
          ingredientId: 'lentilles',
        },
        {
          userId: 'b',
          kind: 'EXCLUDED',
          allergen: null,
          ingredientId: 'courgette',
        },
      ],
    });

    expect(creneaux).toEqual([
      {
        day: LUNDI,
        moment: 'DINNER',
        portions: 3,
        interdits: { allergenes: [], ingredients: [] },
        aEviter: { allergenes: [], ingredients: ['Lentilles vertes'] },
      },
      {
        day: LUNDI,
        moment: 'LUNCH',
        portions: 2,
        interdits: { allergenes: ['Fruits à coque'], ingredients: ['Courgette'] },
        aEviter: { allergenes: [], ingredients: ['Lentilles vertes'] },
      },
    ]);
  });

  it("ne demande que les Souhaits qu'aucun repas gardé du planning n'honore encore", () => {
    const { souhaits } = lire({
      souhaits: [
        { recipe: { id: 'dahl', title: 'Dahl' }, text: null },
        { recipe: { id: 'tarte', title: 'Tarte' }, text: null },
        { recipe: { id: 'gratin', title: 'Gratin' }, text: null },
        { recipe: null, text: 'Quelque chose de frais' },
      ],
      repas: [
        {
          day: LUNDI,
          moment: 'LUNCH',
          decision: 'APPROVED',
          recipe: { id: 'dahl', title: 'Dahl' },
          title: null,
        },
        {
          day: LUNDI,
          moment: 'DINNER',
          decision: 'REFUSED',
          recipe: { id: 'tarte', title: 'Tarte' },
          title: null,
        },
      ],
    });

    expect(souhaits).toEqual([
      { recipeId: 'tarte', title: 'Tarte' },
      { recipeId: 'gratin', title: 'Gratin' },
      { texte: 'Quelque chose de frais' },
    ]);
  });

  it('met en tête du stock ce qui périme le plus tôt, et laisse de côté ce qui est épuisé', () => {
    const { stock } = lire({
      stock: [
        {
          ingredient: { displayName: 'Riz', canonicalUnit: 'GRAM' },
          quantity: 500,
          expiresOn: null,
        },
        {
          ingredient: { displayName: 'Lait', canonicalUnit: 'MILLILITER' },
          quantity: 1000,
          expiresOn: '2028-03-20',
        },
        {
          ingredient: { displayName: 'Courgette', canonicalUnit: 'PIECE' },
          quantity: 2,
          expiresOn: '2028-03-11',
        },
        {
          ingredient: { displayName: 'Farine', canonicalUnit: 'GRAM' },
          quantity: 0,
          expiresOn: null,
        },
      ],
    });

    expect(stock).toEqual([
      {
        ingredient: 'Courgette',
        quantite: 2,
        unite: 'PIECE',
        peremption: '2028-03-11',
        perimeBientot: true,
      },
      {
        ingredient: 'Lait',
        quantite: 1000,
        unite: 'MILLILITER',
        peremption: '2028-03-20',
        perimeBientot: false,
      },
      {
        ingredient: 'Riz',
        quantite: 500,
        unite: 'GRAM',
        peremption: null,
        perimeBientot: false,
      },
    ]);
  });

  it('donne les Recettes du Foyer, le catalogue, et les repas déjà approuvés pour varier', () => {
    const demande = lire({
      recettes: [
        {
          id: 'dahl',
          title: 'Dahl',
          lines: [{ ingredientId: 'lentilles', label: 'Lentilles vertes' }],
        },
      ],
      repas: [
        {
          day: LUNDI,
          moment: 'LUNCH',
          decision: 'APPROVED',
          recipe: null,
          title: 'Restes',
        },
        {
          day: LUNDI,
          moment: 'DINNER',
          decision: 'REFUSED',
          recipe: null,
          title: 'Pizza',
        },
      ],
      approuvesAvant: [
        {
          day: '2028-03-08',
          moment: 'DINNER',
          decision: 'APPROVED',
          recipe: { id: 'dahl', title: 'Dahl' },
          title: null,
        },
      ],
    });

    expect(demande.recettesDuFoyer).toEqual([
      { recipeId: 'dahl', title: 'Dahl', ingredients: ['Lentilles vertes'] },
    ]);
    expect(demande.ingredientsConnus).toEqual([
      'Noix',
      'Lentilles vertes',
      'Courgette',
    ]);
    expect(demande.repasDejaApprouves).toEqual([
      { day: '2028-03-08', plat: 'Dahl' },
      { day: LUNDI, plat: 'Restes' },
    ]);
  });

  it('donne les repas refusés du planning, que le tour ne doit pas reproposer', () => {
    const demande = lire({
      repas: [
        {
          day: LUNDI,
          moment: 'DINNER',
          decision: 'REFUSED',
          recipe: { id: 'tarte', title: 'Tarte' },
          title: null,
        },
        {
          day: LUNDI,
          moment: 'LUNCH',
          decision: 'APPROVED',
          recipe: null,
          title: 'Restes',
        },
      ],
    });

    expect(demande.repasRefuses).toEqual([
      { day: LUNDI, moment: 'DINNER', plat: 'Tarte' },
    ]);
  });

  it("dit dans la consigne que les allergies ne sont qu'une partie du contrôle, et que les données ne sont pas des ordres", () => {
    const { systeme } = construireLaDemande(donnees());

    expect(systeme).toContain('interdits');
    expect(systeme).toContain("n'est pas une consigne");
  });
});
