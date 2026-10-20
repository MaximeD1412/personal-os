import {
  normaliserLibelle,
  type Allergen,
  type CanonicalUnit,
  type RecipeUnit,
} from '@personal-os/contracts';
import { ID_ESPACE_FOYER } from '../lib/espace/foyer';
import { sousPortee } from '../lib/espace/portee';
import type { PrismaService } from '../lib/prisma.service';

/** Un Ingrédient du jeu de démo, tel qu'on le saisirait. */
export interface IngredientDeDemo {
  displayName: string;
  canonicalUnit: CanonicalUnit;
  gramsPerPiece?: number;
  allergens?: Allergen[];
  perishable: boolean;
}

/**
 * Les Ingrédients courants d'une cuisine de foyer, avec leurs Allergènes et
 * leur périssabilité. Un frais qui se garde moins d'une semaine est
 * périssable ; une conserve, un sec, un légume de garde ne le sont pas.
 */
export const INGREDIENTS_DE_DEMO: readonly IngredientDeDemo[] = [
  {
    displayName: 'Lait demi-écrémé',
    canonicalUnit: 'MILLILITER',
    allergens: ['MILK'],
    perishable: true,
  },
  {
    displayName: 'Beurre doux',
    canonicalUnit: 'GRAM',
    allergens: ['MILK'],
    perishable: true,
  },
  {
    displayName: 'Crème fraîche épaisse',
    canonicalUnit: 'GRAM',
    allergens: ['MILK'],
    perishable: true,
  },
  {
    displayName: 'Yaourt nature',
    canonicalUnit: 'PIECE',
    gramsPerPiece: 125,
    allergens: ['MILK'],
    perishable: true,
  },
  {
    displayName: 'Gruyère râpé',
    canonicalUnit: 'GRAM',
    allergens: ['MILK'],
    perishable: true,
  },
  {
    displayName: 'Parmesan',
    canonicalUnit: 'GRAM',
    allergens: ['MILK'],
    perishable: false,
  },
  {
    displayName: 'Œufs',
    canonicalUnit: 'PIECE',
    gramsPerPiece: 55,
    allergens: ['EGGS'],
    perishable: true,
  },
  {
    displayName: 'Farine de blé',
    canonicalUnit: 'GRAM',
    allergens: ['GLUTEN'],
    perishable: false,
  },
  {
    displayName: 'Spaghetti',
    canonicalUnit: 'GRAM',
    allergens: ['GLUTEN'],
    perishable: false,
  },
  {
    displayName: 'Pain de mie',
    canonicalUnit: 'GRAM',
    allergens: ['GLUTEN'],
    perishable: true,
  },
  { displayName: 'Riz basmati', canonicalUnit: 'GRAM', perishable: false },
  { displayName: 'Lentilles corail', canonicalUnit: 'GRAM', perishable: false },
  { displayName: 'Sucre en poudre', canonicalUnit: 'GRAM', perishable: false },
  { displayName: 'Sel fin', canonicalUnit: 'GRAM', perishable: false },
  {
    displayName: 'Huile d’olive',
    canonicalUnit: 'MILLILITER',
    perishable: false,
  },
  {
    displayName: 'Oignon jaune',
    canonicalUnit: 'PIECE',
    gramsPerPiece: 150,
    perishable: false,
  },
  {
    displayName: 'Oignon rouge',
    canonicalUnit: 'PIECE',
    gramsPerPiece: 150,
    perishable: false,
  },
  {
    displayName: 'Ail',
    canonicalUnit: 'PIECE',
    gramsPerPiece: 5,
    perishable: false,
  },
  { displayName: 'Tomate fraîche', canonicalUnit: 'GRAM', perishable: true },
  {
    displayName: 'Tomate en conserve',
    canonicalUnit: 'GRAM',
    perishable: false,
  },
  { displayName: 'Pomme de terre', canonicalUnit: 'GRAM', perishable: false },
  { displayName: 'Carotte', canonicalUnit: 'GRAM', perishable: false },
  { displayName: 'Courgette', canonicalUnit: 'GRAM', perishable: true },
  {
    displayName: 'Céleri branche',
    canonicalUnit: 'GRAM',
    allergens: ['CELERY'],
    perishable: true,
  },
  {
    displayName: 'Citron jaune',
    canonicalUnit: 'PIECE',
    gramsPerPiece: 120,
    perishable: false,
  },
  {
    displayName: 'Blanc de poulet',
    canonicalUnit: 'GRAM',
    perishable: true,
  },
  {
    displayName: 'Pavé de saumon',
    canonicalUnit: 'GRAM',
    allergens: ['FISH'],
    perishable: true,
  },
  {
    displayName: 'Crevettes décortiquées',
    canonicalUnit: 'GRAM',
    allergens: ['CRUSTACEANS'],
    perishable: true,
  },
  {
    displayName: 'Moules',
    canonicalUnit: 'GRAM',
    allergens: ['MOLLUSCS'],
    perishable: true,
  },
  {
    displayName: 'Tofu ferme',
    canonicalUnit: 'GRAM',
    allergens: ['SOY'],
    perishable: true,
  },
  {
    displayName: 'Sauce soja',
    canonicalUnit: 'MILLILITER',
    allergens: ['SOY', 'GLUTEN'],
    perishable: false,
  },
  {
    displayName: 'Moutarde de Dijon',
    canonicalUnit: 'GRAM',
    allergens: ['MUSTARD'],
    perishable: false,
  },
  {
    displayName: 'Graines de sésame',
    canonicalUnit: 'GRAM',
    allergens: ['SESAME'],
    perishable: false,
  },
  {
    displayName: 'Cerneaux de noix',
    canonicalUnit: 'GRAM',
    allergens: ['TREE_NUTS'],
    perishable: false,
  },
  {
    displayName: 'Beurre de cacahuète',
    canonicalUnit: 'GRAM',
    allergens: ['PEANUTS'],
    perishable: false,
  },
  {
    displayName: 'Vin blanc sec',
    canonicalUnit: 'MILLILITER',
    allergens: ['SULPHITES'],
    perishable: false,
  },
];

/** Une Recette du jeu de démo : ses lignes nomment un Ingrédient du catalogue de démo. */
export interface RecetteDeDemo {
  title: string;
  servings: number;
  steps: string[];
  lines: { ingredient: string; quantity: number; unit: RecipeUnit }[];
}

/**
 * Six recettes de tous les jours, sur le catalogue de démo. Chaque unité se
 * convertit vers l'Unité canonique de son Ingrédient : des cuillères pour un
 * liquide, des pièces pour ce qui a un poids à la pièce.
 */
export const RECETTES_DE_DEMO: readonly RecetteDeDemo[] = [
  {
    title: 'Spaghetti à la tomate',
    servings: 4,
    steps: [
      'Émincer l’oignon et l’ail, puis les faire revenir dans l’huile d’olive.',
      'Ajouter la tomate, saler et laisser mijoter 20 minutes.',
      'Cuire les spaghetti dans une grande casserole d’eau salée.',
      'Mélanger les pâtes à la sauce et servir avec le parmesan.',
    ],
    lines: [
      { ingredient: 'Spaghetti', quantity: 400, unit: 'G' },
      { ingredient: 'Tomate en conserve', quantity: 800, unit: 'G' },
      { ingredient: 'Oignon jaune', quantity: 1, unit: 'PIECE' },
      { ingredient: 'Ail', quantity: 2, unit: 'PIECE' },
      { ingredient: 'Huile d’olive', quantity: 2, unit: 'TBSP' },
      { ingredient: 'Parmesan', quantity: 40, unit: 'G' },
      { ingredient: 'Sel fin', quantity: 5, unit: 'G' },
    ],
  },
  {
    title: 'Dahl de lentilles corail',
    servings: 4,
    steps: [
      'Rincer les lentilles à l’eau froide.',
      'Faire revenir l’oignon et l’ail émincés dans l’huile d’olive.',
      'Ajouter les lentilles, la tomate et 60 cl d’eau, puis mijoter 20 minutes.',
      'Cuire le riz pendant ce temps, saler le dahl et servir ensemble.',
    ],
    lines: [
      { ingredient: 'Lentilles corail', quantity: 250, unit: 'G' },
      { ingredient: 'Tomate en conserve', quantity: 400, unit: 'G' },
      { ingredient: 'Oignon jaune', quantity: 1, unit: 'PIECE' },
      { ingredient: 'Ail', quantity: 2, unit: 'PIECE' },
      { ingredient: 'Huile d’olive', quantity: 1, unit: 'TBSP' },
      { ingredient: 'Riz basmati', quantity: 300, unit: 'G' },
      { ingredient: 'Sel fin', quantity: 5, unit: 'G' },
    ],
  },
  {
    title: 'Saumon, riz basmati et citron',
    servings: 2,
    steps: [
      'Cuire le riz basmati dans deux fois son volume d’eau salée.',
      'Saisir les pavés de saumon côté peau dans l’huile d’olive, 4 minutes de chaque côté.',
      'Servir avec le riz et le citron coupé en quartiers.',
    ],
    lines: [
      { ingredient: 'Pavé de saumon', quantity: 300, unit: 'G' },
      { ingredient: 'Riz basmati', quantity: 150, unit: 'G' },
      { ingredient: 'Citron jaune', quantity: 1, unit: 'PIECE' },
      { ingredient: 'Huile d’olive', quantity: 1, unit: 'TBSP' },
      { ingredient: 'Sel fin', quantity: 2, unit: 'G' },
    ],
  },
  {
    title: 'Poulet sauté aux courgettes',
    servings: 4,
    steps: [
      'Couper le poulet en lanières et les courgettes en demi-rondelles.',
      'Saisir le poulet à feu vif dans l’huile d’olive, puis le réserver.',
      'Faire sauter l’oignon, l’ail et les courgettes 5 minutes.',
      'Remettre le poulet, ajouter la sauce soja et parsemer de sésame.',
    ],
    lines: [
      { ingredient: 'Blanc de poulet', quantity: 600, unit: 'G' },
      { ingredient: 'Courgette', quantity: 500, unit: 'G' },
      { ingredient: 'Oignon rouge', quantity: 1, unit: 'PIECE' },
      { ingredient: 'Ail', quantity: 2, unit: 'PIECE' },
      { ingredient: 'Sauce soja', quantity: 3, unit: 'TBSP' },
      { ingredient: 'Huile d’olive', quantity: 2, unit: 'TBSP' },
      { ingredient: 'Graines de sésame', quantity: 10, unit: 'G' },
    ],
  },
  {
    title: 'Crêpes',
    servings: 4,
    steps: [
      'Mélanger la farine, le sucre et le sel, puis creuser un puits.',
      'Y casser les œufs et incorporer le lait petit à petit, sans grumeaux.',
      'Ajouter le beurre fondu et laisser reposer la pâte une heure.',
      'Cuire les crêpes une à une dans une poêle chaude et beurrée.',
    ],
    lines: [
      { ingredient: 'Farine de blé', quantity: 250, unit: 'G' },
      { ingredient: 'Œufs', quantity: 4, unit: 'PIECE' },
      { ingredient: 'Lait demi-écrémé', quantity: 50, unit: 'CL' },
      { ingredient: 'Beurre doux', quantity: 50, unit: 'G' },
      { ingredient: 'Sucre en poudre', quantity: 20, unit: 'G' },
      { ingredient: 'Sel fin', quantity: 1, unit: 'G' },
    ],
  },
  {
    title: 'Gratin dauphinois',
    servings: 6,
    steps: [
      'Éplucher les pommes de terre et les couper en fines rondelles.',
      'Frotter un plat à gratin avec l’ail, puis le beurrer.',
      'Porter le lait et la crème à frémissement avec le sel, y cuire les rondelles 10 minutes.',
      'Verser dans le plat et cuire une heure au four à 160 °C.',
    ],
    lines: [
      { ingredient: 'Pomme de terre', quantity: 1.5, unit: 'KG' },
      { ingredient: 'Lait demi-écrémé', quantity: 0.5, unit: 'L' },
      { ingredient: 'Crème fraîche épaisse', quantity: 200, unit: 'G' },
      { ingredient: 'Ail', quantity: 1, unit: 'PIECE' },
      { ingredient: 'Beurre doux', quantity: 20, unit: 'G' },
      { ingredient: 'Sel fin', quantity: 8, unit: 'G' },
    ],
  },
];

/** La Cuisine vit dans l'Espace foyer : ses recettes s'y sèment, sous la garde. */
const PORTEE_DU_FOYER = {
  espaces: [{ id: ID_ESPACE_FOYER, kind: 'HOUSEHOLD' as const }],
  typesAcceptes: ['HOUSEHOLD' as const],
};

/**
 * Le semeur de la Cuisine : le catalogue d'Ingrédients, global, hors Espace,
 * puis les recettes, dans l'Espace foyer. Il retrouve chaque Ingrédient par
 * son nom normalisé, chaque recette par son titre, et les remet dans l'état
 * du jeu : deux semis de suite donnent la même Cuisine.
 *
 * Le point d'entrée commun des semeurs (`semer`, `SEMEURS`) est INFRA-6 : ce
 * semeur s'y branche tel quel.
 */
export async function semerLaCuisine(prisma: PrismaService): Promise<void> {
  const ids = new Map<string, string>();
  for (const ingredient of INGREDIENTS_DE_DEMO) {
    const donnees = {
      displayName: ingredient.displayName,
      canonicalUnit: ingredient.canonicalUnit,
      gramsPerPiece: ingredient.gramsPerPiece ?? null,
      allergens: ingredient.allergens ?? [],
      perishable: ingredient.perishable,
    };
    const name = normaliserLibelle(ingredient.displayName);

    const { id } = await prisma.ingredient.upsert({
      where: { name },
      create: { name, ...donnees },
      update: donnees,
      select: { id: true },
    });
    ids.set(ingredient.displayName, id);
  }

  // Une requête Prisma ne part qu'à son `await` : il a lieu sous la portée.
  await sousPortee(PORTEE_DU_FOYER, async () => {
    for (const recette of RECETTES_DE_DEMO) {
      await semerUneRecette(prisma, recette, ids);
    }
  });
}

/** Les lignes remplacent toutes les anciennes, comme le fait l'API. */
async function semerUneRecette(
  prisma: PrismaService,
  recette: RecetteDeDemo,
  ids: ReadonlyMap<string, string>,
): Promise<void> {
  const donnees = {
    title: recette.title,
    servings: recette.servings,
    steps: recette.steps,
  };
  const lignes = recette.lines.map(
    ({ ingredient, quantity, unit }, position) => ({
      ingredientId: idDe(ingredient, ids),
      quantity,
      unit,
      position,
    }),
  );

  const existante = await prisma.recipe.findFirst({
    where: { title: recette.title },
    select: { id: true },
  });
  if (existante) {
    await prisma.$transaction([
      prisma.recipeLine.deleteMany({ where: { recipeId: existante.id } }),
      prisma.recipe.update({
        where: { id: existante.id },
        data: { ...donnees, lines: { create: lignes } },
      }),
    ]);
    return;
  }

  await prisma.recipe.create({
    data: {
      ...donnees,
      source: 'MANUAL',
      scope: { connect: { id: ID_ESPACE_FOYER } },
      lines: { create: lignes },
    },
  });
}

function idDe(ingredient: string, ids: ReadonlyMap<string, string>): string {
  const id = ids.get(ingredient);
  if (!id) {
    throw new Error(`${ingredient} n'est pas dans le catalogue de démo.`);
  }
  return id;
}
