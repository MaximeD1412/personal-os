import {
  aujourdhui,
  FUSEAU,
  lundiDe,
  normaliserLibelle,
  type Allergen,
  type CanonicalUnit,
  type MealMoment,
  type RecipeUnit,
} from '@personal-os/contracts';
import { ID_ESPACE_FOYER, ID_FOYER } from '../lib/espace/foyer';
import { sousPortee } from '../lib/espace/portee';
import type { PrismaService } from '../lib/prisma.service';
import { compter } from './delegate';
import type { Semeur } from './seeder';

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
    displayName: 'Coriandre fraîche',
    canonicalUnit: 'GRAM',
    perishable: true,
  },
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
  /**
   * Une recette qu'un Tour de génération a proposée et que le Foyer n'a pas
   * encore gardée (CUISINE-19). Les autres sont saisies, donc gardées.
   */
  generee?: true;
}

/**
 * Sept recettes de tous les jours, sur le catalogue de démo : six saisies, et
 * une générée qu'on n'a pas encore gardée. Chaque unité se convertit vers
 * l'Unité canonique de son Ingrédient : des cuillères pour un liquide, des
 * pièces pour ce qui a un poids à la pièce.
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
  {
    title: 'Omelette aux courgettes et au parmesan',
    servings: 2,
    steps: [
      'Couper la courgette en fines rondelles et la faire dorer dans l’huile d’olive.',
      'Battre les œufs avec le parmesan et le sel.',
      'Verser sur la courgette et cuire à feu doux jusqu’à ce que l’omelette prenne.',
    ],
    lines: [
      { ingredient: 'Œufs', quantity: 4, unit: 'PIECE' },
      { ingredient: 'Courgette', quantity: 250, unit: 'G' },
      { ingredient: 'Parmesan', quantity: 30, unit: 'G' },
      { ingredient: 'Huile d’olive', quantity: 1, unit: 'TBSP' },
      { ingredient: 'Sel fin', quantity: 2, unit: 'G' },
    ],
    generee: true,
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
 * `semer` le branche, avec les autres semeurs de la Cuisine, par `food` (en
 * fin de fichier).
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
  // Resemée, une recette générée qu'on avait gardée entre-temps redevient à garder.
  const donnees = {
    title: recette.title,
    servings: recette.servings,
    steps: recette.steps,
    source: recette.generee ? ('GENERATED' as const) : ('MANUAL' as const),
    kept: !recette.generee,
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
      scope: { connect: { id: ID_ESPACE_FOYER } },
      lines: { create: lignes },
    },
  });
}

function idDe(
  cle: string,
  ids: ReadonlyMap<string, string>,
  ingredient = cle,
): string {
  const id = ids.get(cle);
  if (!id) {
    throw new Error(`${ingredient} n'est pas dans le catalogue de démo.`);
  }
  return id;
}

/** Les identifiants des deux Comptes de démo, le premier puis le second. */
export type ComptesDeLaCuisine = readonly [string, string];

/**
 * Les Comptes à qui donner Préférences et repas : ceux que nomme le semis
 * (`DEMO_ACCOUNT_EMAILS`), sinon les deux plus anciens du Foyer. Le semis les
 * nomme toujours : un Compte qui n'est plus de la démo reste en base, et ne
 * doit rien recevoir.
 */
async function lesComptes(
  prisma: PrismaService,
  comptes: ComptesDeLaCuisine | undefined,
): Promise<{ id: string }[]> {
  if (comptes) {
    return comptes.map((id) => ({ id }));
  }
  return prisma.user.findMany({
    where: { householdId: ID_FOYER },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true },
  });
}

/** Le libellé de l'Ingrédient que le second Compte n'apprécie guère. */
export const CORIANDRE_DE_DEMO = 'Coriandre fraîche';

/** Le semeur ne touche qu'à l'Espace foyer, comme le module. */
const ESPACE_FOYER = {
  espaces: [{ id: ID_ESPACE_FOYER, kind: 'HOUSEHOLD' as const }],
  typesAcceptes: ['HOUSEHOLD' as const],
};

/**
 * Les Préférences alimentaires de démo : une allergie aux fruits à coque pour
 * le premier Compte du Foyer, la coriandre peu appréciée du second (du même,
 * s'il est seul). Sans Compte, il n'y a personne à qui les donner : le semeur
 * ne fait rien. Il passe après `semerLaCuisine`, dont il lit la coriandre.
 *
 * Une Préférence déjà là n'est pas reposée : deux semis de suite donnent les
 * mêmes Préférences.
 */
export async function semerLesPreferences(
  prisma: PrismaService,
  comptes?: ComptesDeLaCuisine,
): Promise<void> {
  const [premier, second = premier] = await lesComptes(prisma, comptes);
  if (!premier) {
    return;
  }

  const coriandre = await prisma.ingredient.findUnique({
    where: { name: normaliserLibelle(CORIANDRE_DE_DEMO) },
    select: { id: true },
  });
  if (!coriandre) {
    throw new Error(
      `${CORIANDRE_DE_DEMO} manque au catalogue : semerLaCuisine passe avant les Préférences.`,
    );
  }

  const preferences = [
    {
      userId: premier.id,
      kind: 'ALLERGY' as const,
      allergen: 'TREE_NUTS' as const,
      ingredientId: null,
    },
    {
      userId: second.id,
      kind: 'DISLIKED' as const,
      allergen: null,
      ingredientId: coriandre.id,
    },
  ];

  // Une requête Prisma ne part qu'à l'`await` : il se fait sous la portée.
  await sousPortee(ESPACE_FOYER, async () => {
    for (const preference of preferences) {
      const existante = await prisma.foodPreference.findFirst({
        where: preference,
        select: { id: true },
      });
      if (!existante) {
        await prisma.foodPreference.create({
          data: { scopeId: ID_ESPACE_FOYER, ...preference },
        });
      }
    }
  });
}

/** Une ligne du stock de démo : sa péremption se compte en jours depuis le semis. */
export interface LigneDeStockDeDemo {
  ingredient: string;
  /** En Unité canonique de l'Ingrédient. */
  quantity: number;
  /** Dans combien de jours elle périme ; absente pour un sec ou une conserve. */
  perimeDansJours?: number;
}

/**
 * Le stock d'un frigo et d'un placard ordinaires. Le lait et les yaourts
 * périment dans les trois jours : l'écran les met en avant.
 */
export const STOCK_DE_DEMO: readonly LigneDeStockDeDemo[] = [
  { ingredient: 'Lait demi-écrémé', quantity: 1000, perimeDansJours: 2 },
  { ingredient: 'Yaourt nature', quantity: 4, perimeDansJours: 1 },
  { ingredient: 'Beurre doux', quantity: 250, perimeDansJours: 18 },
  { ingredient: 'Œufs', quantity: 6, perimeDansJours: 12 },
  { ingredient: 'Gruyère râpé', quantity: 150, perimeDansJours: 9 },
  { ingredient: 'Parmesan', quantity: 200, perimeDansJours: 40 },
  { ingredient: 'Spaghetti', quantity: 500 },
  { ingredient: 'Riz basmati', quantity: 1000 },
  { ingredient: 'Farine de blé', quantity: 750 },
  { ingredient: 'Tomate en conserve', quantity: 800 },
];

/**
 * Le Stock domestique de démo, dans l'Espace foyer. Il passe après
 * `semerLaCuisine`, dont il lit le catalogue. Chaque ligne est remise dans
 * l'état du jeu, ses péremptions recomptées depuis `jour` : un semis de la
 * veille se rafraîchit, deux semis du même jour donnent le même stock.
 */
export async function semerLeStock(
  prisma: PrismaService,
  jour: string = aujourdhui(),
): Promise<void> {
  const catalogue = await prisma.ingredient.findMany({
    where: {
      name: {
        in: STOCK_DE_DEMO.map(({ ingredient }) =>
          normaliserLibelle(ingredient),
        ),
      },
    },
    select: { id: true, name: true },
  });
  const ids = new Map(catalogue.map(({ id, name }) => [name, id] as const));
  const lignes = STOCK_DE_DEMO.map(
    ({ ingredient, quantity, perimeDansJours }) => ({
      ingredientId: idDe(normaliserLibelle(ingredient), ids, ingredient),
      quantity,
      expiresOn:
        perimeDansJours === undefined
          ? null
          : new Date(
              Date.parse(`${jour}T00:00:00Z`) + perimeDansJours * 86_400_000,
            ),
    }),
  );

  // Une requête Prisma ne part qu'à l'`await` : il se fait sous la portée.
  await sousPortee(ESPACE_FOYER, async () => {
    for (const { ingredientId, ...ligne } of lignes) {
      await prisma.pantryItem.upsert({
        where: {
          scopeId_ingredientId: { scopeId: ID_ESPACE_FOYER, ingredientId },
        },
        create: { scopeId: ID_ESPACE_FOYER, ingredientId, ...ligne },
        update: ligne,
      });
    }
  });
}

/** Un Repas planifié de démo : son jour (0 pour le lundi), une recette ou un intitulé. */
export interface RepasDeDemo {
  jour: number;
  moment: MealMoment;
  recette?: string;
  intitule?: string;
  /** Le seul premier Compte ; les deux sinon. */
  seul?: boolean;
  invites?: number;
}

/**
 * La semaine de démo, remplie à moitié : de quoi voir des recettes, un
 * intitulé libre, un repas à un seul Participant et des Invités, et des cases
 * encore vides à remplir.
 */
export const REPAS_DE_DEMO: readonly RepasDeDemo[] = [
  { jour: 0, moment: 'LUNCH', intitule: 'Salade composée', seul: true },
  { jour: 0, moment: 'DINNER', recette: 'Dahl de lentilles corail' },
  { jour: 1, moment: 'DINNER', recette: 'Poulet sauté aux courgettes' },
  { jour: 2, moment: 'LUNCH', intitule: 'Restes du dahl', seul: true },
  { jour: 3, moment: 'DINNER', recette: 'Saumon, riz basmati et citron' },
  {
    jour: 4,
    moment: 'DINNER',
    recette: 'Omelette aux courgettes et au parmesan',
  },
  { jour: 5, moment: 'DINNER', recette: 'Gratin dauphinois', invites: 2 },
  { jour: 6, moment: 'LUNCH', recette: 'Crêpes' },
];

/**
 * Le Planning de repas de la semaine en cours, rempli de `REPAS_DE_DEMO`. Il
 * passe après `semerLaCuisine`, dont il lit les recettes. Sans Compte, il n'y
 * a personne à faire manger : le semeur ne fait rien.
 *
 * Un planning qui a déjà des repas n'est pas touché : deux semis de suite
 * donnent le même planning, et ce qu'on y a saisi entre-temps reste.
 */
export async function semerLePlanning(
  prisma: PrismaService,
  maintenant = new Date(),
  comptes?: ComptesDeLaCuisine,
): Promise<void> {
  const [premier, second = premier] = await lesComptes(prisma, comptes);
  if (!premier) {
    return;
  }
  const lundi = lundiDe(aujourdhui(FUSEAU, maintenant));

  // Une requête Prisma ne part qu'à l'`await` : il se fait sous la portée.
  await sousPortee(ESPACE_FOYER, async () => {
    const planning = await prisma.mealPlan.upsert({
      where: {
        scopeId_week: { scopeId: ID_ESPACE_FOYER, week: enDate(lundi) },
      },
      create: { scopeId: ID_ESPACE_FOYER, week: enDate(lundi) },
      update: {},
      select: { id: true, _count: { select: { entries: true } } },
    });
    if (planning._count.entries > 0) {
      return;
    }

    const recettes = new Map(
      (
        await prisma.recipe.findMany({
          where: {
            title: {
              in: REPAS_DE_DEMO.flatMap(({ recette }) => recette ?? []),
            },
          },
          select: { id: true, title: true },
        })
      ).map(({ id, title }) => [title, id]),
    );

    await prisma.mealPlanEntry.createMany({
      data: REPAS_DE_DEMO.map((repas) => ({
        scopeId: ID_ESPACE_FOYER,
        mealPlanId: planning.id,
        day: enDate(jourApres(lundi, repas.jour)),
        moment: repas.moment,
        recipeId: repas.recette ? recetteDe(repas.recette, recettes) : null,
        title: repas.intitule ?? null,
        participantIds: repas.seul
          ? [premier.id]
          : [...new Set([premier.id, second.id])],
        guestCount: repas.invites ?? 0,
        decision: 'APPROVED' as const,
      })),
    });
  });
}

function recetteDe(titre: string, ids: ReadonlyMap<string, string>): string {
  const id = ids.get(titre);
  if (!id) {
    throw new Error(
      `${titre} manque aux recettes : semerLaCuisine passe avant le planning.`,
    );
  }
  return id;
}

// Un jour civil s'écrit à minuit UTC dans une colonne `date`, qui n'a pas de
// fuseau : il en ressort tel qu'il est entré.
function enDate(jour: string): Date {
  return new Date(`${jour}T00:00:00Z`);
}

function jourApres(lundi: string, decalage: number): string {
  const jour = enDate(lundi);
  jour.setUTCDate(jour.getUTCDate() + decalage);
  return jour.toISOString().slice(0, 10);
}

/** Un article de la liste de démo, en Unité canonique de son Ingrédient. */
export interface ArticleDeDemo {
  ingredient: string;
  quantity: number;
  /** Déjà dans le chariot. */
  coche?: boolean;
}

/**
 * Ce que la production donne du planning de démo, moins le stock de démo :
 * le consolidateur de l'API (`courses/consolider.ts`) ne se lit pas d'ici,
 * son résultat est recopié, dans l'ordre alphabétique de la liste. Les
 * quantités ne sont pas arrondies au conditionnement (CUISINE-12).
 */
export const LISTE_DE_DEMO: readonly ArticleDeDemo[] = [
  { ingredient: 'Ail', quantity: 2.667 },
  { ingredient: 'Blanc de poulet', quantity: 300 },
  { ingredient: 'Citron jaune', quantity: 1 },
  { ingredient: 'Courgette', quantity: 250, coche: true },
  { ingredient: 'Crème fraîche épaisse', quantity: 133.334 },
  { ingredient: 'Graines de sésame', quantity: 5 },
  { ingredient: 'Huile d’olive', quantity: 37.5 },
  { ingredient: 'Lentilles corail', quantity: 125 },
  { ingredient: 'Oignon jaune', quantity: 0.5 },
  { ingredient: 'Oignon rouge', quantity: 0.5 },
  { ingredient: 'Pavé de saumon', quantity: 300 },
  { ingredient: 'Pomme de terre', quantity: 1000, coche: true },
  { ingredient: 'Sauce soja', quantity: 22.5 },
  { ingredient: 'Sel fin', quantity: 10.334 },
  { ingredient: 'Sucre en poudre', quantity: 10 },
];

/** L'ajout manuel de la liste de démo : un simple libellé, hors catalogue. */
export const AJOUT_DE_DEMO = 'Liquide vaisselle';

/**
 * Une Liste de courses ouverte, issue du planning de la semaine en cours. Elle
 * passe après `semerLePlanning`, dont elle lit le planning. Le planning de
 * démo reste ouvert : une liste figée n'en dépend plus.
 *
 * Un planning qui a déjà une liste n'en reçoit pas d'autre : deux semis de
 * suite donnent la même liste, et ce qu'on y a coché entre-temps reste.
 */
export async function semerLaListe(
  prisma: PrismaService,
  maintenant = new Date(),
): Promise<void> {
  const lundi = lundiDe(aujourdhui(FUSEAU, maintenant));

  // Une requête Prisma ne part qu'à l'`await` : il se fait sous la portée.
  await sousPortee(ESPACE_FOYER, async () => {
    const planning = await prisma.mealPlan.findUnique({
      where: {
        scopeId_week: { scopeId: ID_ESPACE_FOYER, week: enDate(lundi) },
      },
      select: { id: true, _count: { select: { shoppingLists: true } } },
    });
    if (!planning || planning._count.shoppingLists > 0) {
      return;
    }

    const catalogue = await prisma.ingredient.findMany({
      where: {
        name: {
          in: LISTE_DE_DEMO.map(({ ingredient }) =>
            normaliserLibelle(ingredient),
          ),
        },
      },
      select: { id: true, name: true, canonicalUnit: true },
    });
    const parNom = new Map(catalogue.map((ligne) => [ligne.name, ligne]));
    const ids = new Map(catalogue.map(({ id, name }) => [name, id] as const));

    const articles = LISTE_DE_DEMO.map(
      ({ ingredient, quantity, coche }, position) => {
        const nom = normaliserLibelle(ingredient);
        return {
          ingredientId: idDe(nom, ids, ingredient),
          label: null,
          quantity,
          unit: parNom.get(nom)?.canonicalUnit ?? null,
          origin: 'PLAN' as const,
          checked: coche ?? false,
          position,
        };
      },
    );

    await prisma.shoppingList.create({
      data: {
        scopeId: ID_ESPACE_FOYER,
        mealPlanId: planning.id,
        // Un article prend l'Espace de sa liste, par leur clé étrangère.
        items: {
          create: [
            ...articles,
            {
              ingredientId: null,
              label: AJOUT_DE_DEMO,
              quantity: null,
              unit: null,
              origin: 'MANUAL' as const,
              checked: false,
              position: articles.length,
            },
          ],
        },
      },
      select: { id: true },
    });
  });
}

/**
 * Le semeur du module `food`, sur l'Espace foyer : la Cuisine, les
 * Préférences, le Stock, le Planning de la semaine et sa Liste de courses,
 * dans cet ordre, chacun lisant ce que le précédent a posé. Le semis les a
 * vidés juste avant : chacun repart d'une base sans données de la Cuisine.
 *
 * Les Tours de génération, Souhaits et Repas cuisinés ne sont pas semés, mais
 * le semeur les possède : le semis les vide comme le reste.
 */
export const food: Semeur = {
  module: 'food',
  // Dans l'ordre du remplissage : le vidage le parcourt à l'envers, une ligne
  // avant ce qu'elle cite.
  modeles: [
    // Le catalogue est global, hors Espace : le semis le vide quand même, un
    // Ingrédient ou un Alias saisi sur le staging ne lui survit pas.
    'Ingredient',
    'IngredientAlias',
    'Recipe',
    'RecipeLine',
    'FoodPreference',
    'PantryItem',
    'MealPlan',
    'GenerationRound',
    'MealWish',
    'MealPlanEntry',
    'CookedMeal',
    'CookedMealLine',
    'ShoppingList',
    'ShoppingListItem',
  ],
  espaces: ['HOUSEHOLD'],
  async semer(prisma, demo) {
    // Midi à Paris : le jour du semis, quel que soit le fuseau de la machine.
    const maintenant = demo.le(0, '12:00');
    await semerLaCuisine(prisma);
    const comptes = [demo.a.userId, demo.b.userId] as const;
    await semerLesPreferences(prisma, comptes);
    await semerLeStock(prisma, demo.aujourdhui);
    await semerLePlanning(prisma, maintenant, comptes);
    await semerLaListe(prisma, maintenant);
    return compter(prisma, this.modeles);
  },
};
