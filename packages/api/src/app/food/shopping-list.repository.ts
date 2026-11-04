import { Injectable } from '@nestjs/common';
import type {
  CanonicalUnit,
  MealPlanStatus,
  RecipeUnit,
  ShoppingListItemOrigin,
  ShoppingListStatus,
} from '@personal-os/contracts';
import { ID_ESPACE_FOYER, PrismaService } from '@personal-os/database';
import type { LigneDeStock } from './stock/recaler';

interface Decimal {
  toNumber(): number;
  toString(): string;
}

export interface ShoppingListItemRecord {
  id: string;
  ingredient: {
    id: string;
    displayName: string;
    canonicalUnit: CanonicalUnit;
    perishable: boolean;
  } | null;
  label: string | null;
  quantity: Decimal | null;
  unit: CanonicalUnit | null;
  productId: string | null;
  packages: number | null;
  packageQuantity: Decimal | null;
  packageLabel: string | null;
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

/** Un Ingrédient tel que la consolidation le lit, et son Produit préféré. */
export interface IngredientAConsoliderRecord {
  id: string;
  name: string;
  displayName: string;
  canonicalUnit: CanonicalUnit;
  gramsPerPiece: Decimal | null;
  preferredProduct: {
    id: string;
    packageQuantity: Decimal;
    packageLabel: string;
  } | null;
}

/**
 * Un planning et ses repas approuvés, avec ce que leurs recettes demandent, et
 * le Repas cuisiné de chacun s'il l'est déjà.
 */
export interface PlanningAConsoliderRecord {
  id: string;
  status: MealPlanStatus;
  entries: {
    id: string;
    cookedMeal: { id: string } | null;
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

/** Les listes d'un planning lues par un complément : toutes, et les ouvertes. */
export interface ListesLues {
  toutes: readonly string[];
  ouvertes: readonly string[];
}

/**
 * Ce qu'une production ou un ajout pose sur un article : les quantités en
 * texte, sans flottant. Un conditionnement n'existe qu'à la production.
 */
export interface ShoppingListItemWrite {
  ingredientId: string | null;
  label: string | null;
  quantity: string | null;
  unit: CanonicalUnit | null;
  productId?: string;
  packages?: number;
  packageQuantity?: string;
  packageLabel?: string;
}

const CHAMPS_DE_L_ARTICLE = {
  id: true,
  ingredient: {
    select: {
      id: true,
      displayName: true,
      canonicalUnit: true,
      perishable: true,
    },
  },
  label: true,
  quantity: true,
  unit: true,
  productId: true,
  packages: true,
  packageQuantity: true,
  packageLabel: true,
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

/** Une ligne de stock telle qu'elle se lit et s'écrit : la quantité en texte, sans flottant. */
export interface LigneDeStockEcrite {
  quantity: string;
  expiresOn: string | null;
}

/**
 * Ce que la clôture fait à la ligne de stock d'un Ingrédient. `avant` est
 * l'état lu, aucun si la ligne n'existait pas : l'écriture n'a lieu que si la
 * ligne l'a encore.
 */
export interface AchatEcrit {
  ingredientId: string;
  avant: LigneDeStockEcrite | null;
  apres: LigneDeStockEcrite;
}

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
            id: true,
            cookedMeal: { select: { id: true } },
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
                        preferredProduct: {
                          select: {
                            id: true,
                            packageQuantity: true,
                            packageLabel: true,
                          },
                        },
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

  /** Les articles de chaque liste déjà produite pour ce planning, ouverte ou close. */
  listesDuPlanning(mealPlanId: string): Promise<
    {
      id: string;
      status: ShoppingListStatus;
      items: {
        ingredientId: string | null;
        quantity: Decimal | null;
        unit: CanonicalUnit | null;
        origin: ShoppingListItemOrigin;
        packages: number | null;
        packageQuantity: Decimal | null;
      }[];
    }[]
  > {
    return this.prisma.shoppingList.findMany({
      where: { mealPlanId },
      select: {
        id: true,
        status: true,
        items: {
          select: {
            ingredientId: true,
            quantity: true,
            unit: true,
            origin: true,
            packages: true,
            packageQuantity: true,
          },
        },
      },
    });
  }

  /**
   * Ce qui, dans un planning, change avec le stock : ses listes encore
   * ouvertes (une clôture monte son achat au stock) et ses repas déjà
   * cuisinés (un repas cuisiné en consomme).
   */
  async etatDuPlanning(
    mealPlanId: string,
  ): Promise<{ listesOuvertes: Set<string>; repasCuisines: Set<string> }> {
    const listes = await this.prisma.shoppingList.findMany({
      where: { mealPlanId, status: 'OPEN' },
      select: { id: true },
    });
    const repas = await this.prisma.cookedMeal.findMany({
      where: { mealPlanEntry: { mealPlanId } },
      select: { mealPlanEntryId: true },
    });
    return {
      listesOuvertes: new Set(listes.map(({ id }) => id)),
      repasCuisines: new Set(
        repas.map(({ mealPlanEntryId }) => mealPlanEntryId),
      ),
    };
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

  /** Les lignes de stock de ces Ingrédients, par Ingrédient, péremption comprise. */
  async lignesDeStock(
    ingredientIds: readonly string[],
  ): Promise<Map<string, LigneDeStock>> {
    const lignes = await this.prisma.pantryItem.findMany({
      where: { ingredientId: { in: [...ingredientIds] } },
      select: { ingredientId: true, quantity: true, expiresOn: true },
    });
    return new Map(
      lignes.map(({ ingredientId, quantity, expiresOn }) => [
        ingredientId,
        {
          quantite: quantity.toString(),
          expireLe: expiresOn?.toISOString().slice(0, 10) ?? null,
        },
      ]),
    );
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
   *
   * Un complément nomme les listes dont il a calculé l'écart, et celles qu'il
   * a lues ouvertes (`listesLues`). Une fois le verrou pris, une seconde
   * écriture, qui lit donc ce qui a été commité avant elle, échoue si une
   * autre liste est apparue depuis, ou si l'une des listes lues ouvertes a été
   * close : deux compléments simultanés ne portent jamais deux fois le même
   * manque, et l'achat d'une clôture n'est jamais compté deux fois, au stock
   * et sur la liste.
   */
  async produire(
    planId: string,
    articles: readonly ShoppingListItemWrite[],
    listesLues?: ListesLues,
  ): Promise<ShoppingListRecord> {
    const verrou = this.prisma.mealPlan.update({
      where: { id: planId, status: 'STOPPED' },
      data: { status: 'STOPPED' },
      select: { id: true },
    });
    const sansAutreListe =
      listesLues === undefined
        ? []
        : [
            this.prisma.mealPlan.update({
              where: {
                id: planId,
                AND: [
                  {
                    shoppingLists: {
                      every: { id: { in: [...listesLues.toutes] } },
                    },
                  },
                  {
                    shoppingLists: {
                      none: {
                        id: { in: [...listesLues.ouvertes] },
                        status: 'CLOSED',
                      },
                    },
                  },
                ],
              },
              data: { status: 'STOPPED' },
              select: { id: true },
            }),
          ];
    const resultats = await this.prisma.$transaction([
      verrou,
      ...sansAutreListe,
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
    return resultats[resultats.length - 1] as ShoppingListRecord;
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

  /**
   * Clôt la liste et monte le stock de ses achats, dans une seule transaction
   * qui s'ouvre sur l'écriture de la liste **ouverte** : une seconde clôture
   * attend la première, puis échoue (P2025), avant d'avoir touché au stock.
   *
   * Les achats ont été comptés sur l'état lu de la liste et du stock ; la
   * transaction échoue (P2025, ou P2002 pour une ligne créée entre-temps) si
   * cet état a changé, et le service recommence sur l'état relu. La liste
   * garde les articles qu'on lui a lus, ni plus ni moins, et chacun l'état
   * coché qu'on lui a lu : un article ajouté, retiré, coché ou décoché entre
   * la lecture et la clôture la fait échouer. Chaque ligne de stock
   * garde l'état lu, ou n'existe toujours pas.
   *
   * Les lignes de stock s'écrivent dans l'ordre de leur Ingrédient, comme pour
   * un Repas cuisiné : deux écritures simultanées de plusieurs lignes les
   * verrouillent dans le même ordre, et l'une attend l'autre.
   */
  async cloturer(
    listeId: string,
    articlesLus: readonly { id: string; checked: boolean }[],
    achats: readonly AchatEcrit[],
  ): Promise<ShoppingListRecord> {
    const [liste] = await this.prisma.$transaction([
      this.prisma.shoppingList.update({
        where: { id: listeId, status: 'OPEN' },
        data: { status: 'CLOSED', closedAt: new Date() },
        include: AVEC_LES_ARTICLES,
      }),
      // Sous le verrou de la liste, plus aucun article ne s'y ajoute : elle ne
      // doit en compter aucun qu'on n'ait lu.
      this.prisma.shoppingList.update({
        where: {
          id: listeId,
          items: { every: { id: { in: articlesLus.map(({ id }) => id) } } },
        },
        data: { status: 'CLOSED' },
        select: { id: true },
      }),
      ...articlesLus.map(({ id, checked }) =>
        this.prisma.shoppingListItem.update({
          where: { id, shoppingListId: listeId, checked },
          data: { checked },
          select: { id: true },
        }),
      ),
      ...[...achats]
        .sort((a, b) =>
          a.ingredientId < b.ingredientId
            ? -1
            : a.ingredientId > b.ingredientId
              ? 1
              : 0,
        )
        .map(({ ingredientId, avant, apres }) => {
          const ligne = {
            quantity: apres.quantity,
            expiresOn: versLaBase(apres.expiresOn),
          };
          return avant === null
            ? this.prisma.pantryItem.create({
                data: { scopeId: ID_ESPACE_FOYER, ingredientId, ...ligne },
                select: { id: true },
              })
            : this.prisma.pantryItem.update({
                where: {
                  scopeId_ingredientId: {
                    scopeId: ID_ESPACE_FOYER,
                    ingredientId,
                  },
                  quantity: avant.quantity,
                  expiresOn: versLaBase(avant.expiresOn),
                },
                data: ligne,
                select: { id: true },
              });
        }),
    ]);
    return liste;
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

/** Un jour civil part en base comme le minuit UTC de ce jour, que `DATE` garde tel quel. */
function versLaBase(jour: string | null): Date | null {
  return jour === null ? null : new Date(`${jour}T00:00:00Z`);
}
