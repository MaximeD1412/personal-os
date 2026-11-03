import { Injectable } from '@nestjs/common';
import type {
  CanonicalUnit,
  MealPlanStatus,
  RecipeUnit,
  ShoppingListItemOrigin,
  ShoppingListStatus,
} from '@personal-os/contracts';
import { ID_ESPACE_FOYER, PrismaService } from '@personal-os/database';

interface Decimal {
  toNumber(): number;
  toString(): string;
}

export interface ShoppingListItemRecord {
  id: string;
  ingredient: { id: string; displayName: string } | null;
  label: string | null;
  quantity: Decimal | null;
  unit: CanonicalUnit | null;
  origin: ShoppingListItemOrigin;
  checked: boolean;
  position: number;
}

export interface ShoppingListRecord {
  id: string;
  mealPlan: { id: string; week: Date } | null;
  status: ShoppingListStatus;
  producedAt: Date;
  closedAt: Date | null;
  items: ShoppingListItemRecord[];
}

/** Un Ingrédient tel que la consolidation le lit. */
export interface IngredientAConsoliderRecord {
  id: string;
  name: string;
  displayName: string;
  canonicalUnit: CanonicalUnit;
  gramsPerPiece: Decimal | null;
}

/** Un planning et ses repas approuvés, avec ce que leurs recettes demandent. */
export interface PlanningAConsoliderRecord {
  id: string;
  status: MealPlanStatus;
  entries: {
    participantIds: string[];
    guestCount: number;
    recipe: {
      id: string;
      servings: number;
      lines: {
        quantity: Decimal;
        unit: RecipeUnit;
        ingredient: IngredientAConsoliderRecord;
      }[];
    } | null;
  }[];
}

/** Ce qu'une production ou un ajout pose sur un article : la quantité en texte, sans flottant. */
export interface ShoppingListItemWrite {
  ingredientId: string | null;
  label: string | null;
  quantity: string | null;
  unit: CanonicalUnit | null;
}

const CHAMPS_DE_L_ARTICLE = {
  id: true,
  ingredient: { select: { id: true, displayName: true } },
  label: true,
  quantity: true,
  unit: true,
  origin: true,
  checked: true,
  position: true,
} as const;

const AVEC_LES_ARTICLES = {
  mealPlan: { select: { id: true, week: true } },
  items: {
    orderBy: { position: 'asc' as const },
    select: CHAMPS_DE_L_ARTICLE,
  },
} as const;

/** Combien de fois un ajout reprend son rang quand un ajout simultané l'a pris. */
const ESSAIS_D_AJOUT = 5;

/**
 * Aucun filtre d'Espace n'apparaît ici : la garde (ADR 0028) borne chaque
 * lecture et chaque écriture à l'Espace foyer, seul que la Cuisine accepte.
 *
 * Chaque écriture sur une liste s'ouvre, dans une transaction, sur l'écriture
 * de la liste **ouverte** : elle verrouille sa rangée jusqu'au commit, et
 * échoue si la liste est close. Une clôture simultanée (CUISINE-10) passe
 * avant ou après, jamais entre la vérification et l'écriture.
 */
@Injectable()
export class ShoppingListRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Les listes d'un statut, les plus récentes d'abord. */
  lister(status: ShoppingListStatus): Promise<ShoppingListRecord[]> {
    return this.prisma.shoppingList.findMany({
      where: { status },
      orderBy: [{ producedAt: 'desc' }, { id: 'desc' }],
      include: AVEC_LES_ARTICLES,
    });
  }

  lire(id: string): Promise<ShoppingListRecord | null> {
    return this.prisma.shoppingList.findUnique({
      where: { id },
      include: AVEC_LES_ARTICLES,
    });
  }

  /** Les repas approuvés d'un planning, et les recettes qu'ils cuisinent. */
  planningAConsolider(id: string): Promise<PlanningAConsoliderRecord | null> {
    return this.prisma.mealPlan.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        entries: {
          where: { decision: 'APPROVED' },
          select: {
            participantIds: true,
            guestCount: true,
            recipe: {
              select: {
                id: true,
                servings: true,
                lines: {
                  orderBy: { position: 'asc' },
                  select: {
                    quantity: true,
                    unit: true,
                    ingredient: {
                      select: {
                        id: true,
                        name: true,
                        displayName: true,
                        canonicalUnit: true,
                        gramsPerPiece: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  /** Le Stock domestique de ces Ingrédients, en Unité canonique. */
  stockDe(
    ingredientIds: readonly string[],
  ): Promise<{ ingredientId: string; quantity: Decimal }[]> {
    return this.prisma.pantryItem.findMany({
      where: { ingredientId: { in: [...ingredientIds] } },
      select: { ingredientId: true, quantity: true },
    });
  }

  /** L'Unité canonique d'un Ingrédient du catalogue, ou rien s'il n'y est pas. */
  async uniteDe(ingredientId: string): Promise<CanonicalUnit | null> {
    return (
      (
        await this.prisma.ingredient.findUnique({
          where: { id: ingredientId },
          select: { canonicalUnit: true },
        })
      )?.canonicalUnit ?? null
    );
  }

  /**
   * Fige une liste, ses articles dans leur ordre, dans l'écriture qui
   * verrouille le planning **arrêté** : un planning rouvert entre-temps fait
   * échouer la production entière.
   */
  async produire(
    planId: string,
    articles: readonly ShoppingListItemWrite[],
  ): Promise<ShoppingListRecord> {
    const [, liste] = await this.prisma.$transaction([
      this.prisma.mealPlan.update({
        where: { id: planId, status: 'STOPPED' },
        data: { status: 'STOPPED' },
        select: { id: true },
      }),
      this.prisma.shoppingList.create({
        data: {
          scopeId: ID_ESPACE_FOYER,
          mealPlanId: planId,
          // Un article ne nomme pas son Espace : il prend celui de sa liste,
          // par la clé étrangère qu'ils partagent.
          items: {
            create: articles.map((article, position) => ({
              ...article,
              origin: 'PLAN' as const,
              position,
            })),
          },
        },
        include: AVEC_LES_ARTICLES,
      }),
    ]);
    return liste;
  }

  /**
   * Un ajout prend le rang qui suit le dernier. Deux ajouts simultanés lisent
   * le même : le second bute sur l'unicité du rang, et reprend le suivant.
   */
  async ajouter(
    listeId: string,
    article: ShoppingListItemWrite,
  ): Promise<ShoppingListItemRecord> {
    for (let essai = 1; ; essai++) {
      const { _max } = await this.prisma.shoppingListItem.aggregate({
        where: { shoppingListId: listeId },
        _max: { position: true },
      });
      try {
        const [, rangee] = await this.prisma.$transaction([
          this.verrouillerOuverte(listeId),
          this.prisma.shoppingListItem.create({
            data: {
              ...article,
              origin: 'MANUAL',
              position: (_max.position ?? -1) + 1,
              shoppingListId: listeId,
              scopeId: ID_ESPACE_FOYER,
            },
            select: CHAMPS_DE_L_ARTICLE,
          }),
        ]);
        return rangee;
      } catch (erreur) {
        if (codePrisma(erreur) !== 'P2002' || essai === ESSAIS_D_AJOUT) {
          throw erreur;
        }
      }
    }
  }

  async cocher(
    listeId: string,
    id: string,
    checked: boolean,
  ): Promise<ShoppingListItemRecord> {
    const [, rangee] = await this.prisma.$transaction([
      this.verrouillerOuverte(listeId),
      this.prisma.shoppingListItem.update({
        where: { id, shoppingListId: listeId },
        data: { checked },
        select: CHAMPS_DE_L_ARTICLE,
      }),
    ]);
    return rangee;
  }

  /** Le nombre d'articles supprimés : aucun s'il est absent, ou issu du planning. */
  async supprimerUnAjout(listeId: string, id: string): Promise<number> {
    const [, { count }] = await this.prisma.$transaction([
      this.verrouillerOuverte(listeId),
      this.prisma.shoppingListItem.deleteMany({
        where: { id, shoppingListId: listeId, origin: 'MANUAL' },
      }),
    ]);
    return count;
  }

  /** Une écriture qui ne change rien, sinon le verrou de la rangée. */
  private verrouillerOuverte(id: string) {
    return this.prisma.shoppingList.update({
      where: { id, status: 'OPEN' },
      data: { status: 'OPEN' },
      select: { id: true },
    });
  }
}

export function codePrisma(erreur: unknown): unknown {
  return typeof erreur === 'object' && erreur !== null && 'code' in erreur
    ? erreur.code
    : undefined;
}
