import {
  normaliserLibelle,
  type Allergen,
  type CanonicalUnit,
} from '@personal-os/contracts';
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

/**
 * Le semeur de la Cuisine : le catalogue d'Ingrédients, global, hors Espace.
 * Il retrouve chaque Ingrédient par son nom normalisé et le remet dans l'état
 * du jeu : deux semis de suite donnent le même catalogue.
 *
 * Le point d'entrée commun des semeurs (`semer`, `SEMEURS`) est INFRA-6 : ce
 * semeur s'y branche tel quel.
 */
export async function semerLaCuisine(prisma: PrismaService): Promise<void> {
  for (const ingredient of INGREDIENTS_DE_DEMO) {
    const donnees = {
      displayName: ingredient.displayName,
      canonicalUnit: ingredient.canonicalUnit,
      gramsPerPiece: ingredient.gramsPerPiece ?? null,
      allergens: ingredient.allergens ?? [],
      perishable: ingredient.perishable,
    };
    const name = normaliserLibelle(ingredient.displayName);

    await prisma.ingredient.upsert({
      where: { name },
      create: { name, ...donnees },
      update: donnees,
    });
  }
}
