import { Injectable } from '@nestjs/common';
import type {
  CanonicalUnit,
  MealPlanEntryDecision,
  RecipeUnit,
} from '@personal-os/contracts';
import { ID_ESPACE_FOYER, PrismaService } from '@personal-os/database';
import type { LigneDeStock } from './stock/recaler';

/** Ce que la déclaration lit du Repas planifié qu'on dit cuisiné. */
export interface RepasACuisiner {
  decision: MealPlanEntryDecision;
  dejaCuisine: boolean;
}

/** Un Ingrédient déclaré, tel que la conversion et la réponse le lisent. */
export interface IngredientDeclare {
  id: string;
  displayName: string;
  canonicalUnit: CanonicalUnit;
  /** En texte : un décimal exact, sans flottant. */
  gramsPerPiece: string | null;
}

export interface CookedMealRecord {
  id: string;
  mealPlanEntryId: string;
  cookedAt: Date;
  lines: {
    id: string;
    ingredient: { id: string; displayName: string };
    quantity: { toNumber(): number };
    unit: RecipeUnit;
  }[];
}

/** Une ligne déclarée, la quantité en texte : sans flottant jusqu'à la base. */
export interface LigneDeclaree {
  ingredientId: string;
  quantity: string;
  unit: RecipeUnit;
}

/**
 * Le passage d'une ligne de stock d'un état lu à un autre. `avant` est l'état
 * lu : l'écriture n'a lieu que si la ligne l'a encore.
 */
export interface EcritureDeStock {
  ingredientId: string;
  avant: { quantity: string; expiresOn: string | null };
  apres: { quantity: string; expiresOn: string | null };
}

const AVEC_LES_LIGNES = {
  lines: {
    orderBy: { position: 'asc' as const },
    select: {
      id: true,
      quantity: true,
      unit: true,
      ingredient: { select: { id: true, displayName: true } },
    },
  },
};

/**
 * Aucun filtre d'Espace n'apparaît ici : la garde (ADR 0028) borne chaque
 * lecture et chaque écriture à l'Espace foyer, seul que la Cuisine accepte.
 * Les lignes ne s'écrivent qu'en création imbriquée sous leur repas : elles en
 * reçoivent l'Espace, et la clé étrangère qui les relie le vérifie.
 */
@Injectable()
export class CookedMealRepository {
  constructor(private readonly prisma: PrismaService) {}

  async repas(id: string): Promise<RepasACuisiner | null> {
    const rangee = await this.prisma.mealPlanEntry.findUnique({
      where: { id },
      select: { decision: true, cookedMeal: { select: { id: true } } },
    });
    return (
      rangee && {
        decision: rangee.decision,
        dejaCuisine: rangee.cookedMeal !== null,
      }
    );
  }

  async ingredients(ids: readonly string[]): Promise<IngredientDeclare[]> {
    const rangees = await this.prisma.ingredient.findMany({
      where: { id: { in: [...ids] } },
      select: {
        id: true,
        displayName: true,
        canonicalUnit: true,
        gramsPerPiece: true,
      },
    });
    return rangees.map(({ gramsPerPiece, ...ingredient }) => ({
      ...ingredient,
      gramsPerPiece: gramsPerPiece?.toString() ?? null,
    }));
  }

  /** Les lignes de stock de ces Ingrédients, par Ingrédient. */
  async stock(ids: readonly string[]): Promise<Map<string, LigneDeStock>> {
    const lignes = await this.prisma.pantryItem.findMany({
      where: { ingredientId: { in: [...ids] } },
      select: { ingredientId: true, quantity: true, expiresOn: true },
    });
    return new Map(
      lignes.map(({ ingredientId, quantity, expiresOn }) => [
        ingredientId,
        { quantite: quantity.toString(), expireLe: enJour(expiresOn) },
      ]),
    );
  }

  /**
   * Le repas cuisiné et ce qu'il retire du stock, dans une seule transaction.
   * Le repas s'écrit d'abord : une seconde déclaration du même repas attend la
   * première, puis échoue sur son unicité, avant d'avoir touché au stock.
   * Chaque ligne de stock ne s'écrit que si elle a encore l'état lu : une
   * écriture passée entre-temps fait échouer le tout (P2025), et le service
   * recommence sur le stock relu.
   */
  async declarer(
    mealPlanEntryId: string,
    lignes: readonly LigneDeclaree[],
    ecritures: readonly EcritureDeStock[],
  ): Promise<CookedMealRecord> {
    const [repas] = await this.prisma.$transaction([
      this.prisma.cookedMeal.create({
        data: {
          scopeId: ID_ESPACE_FOYER,
          mealPlanEntryId,
          lines: {
            create: lignes.map((ligne, position) => ({ ...ligne, position })),
          },
        },
        select: {
          id: true,
          mealPlanEntryId: true,
          cookedAt: true,
          ...AVEC_LES_LIGNES,
        },
      }),
      ...ecritures.map(({ ingredientId, avant, apres }) =>
        this.prisma.pantryItem.update({
          where: {
            scopeId_ingredientId: { scopeId: ID_ESPACE_FOYER, ingredientId },
            quantity: avant.quantity,
            expiresOn: versLaBase(avant.expiresOn),
          },
          data: {
            quantity: apres.quantity,
            expiresOn: versLaBase(apres.expiresOn),
          },
          select: { id: true },
        }),
      ),
    ]);
    return repas;
  }
}

function enJour(date: Date | null): string | null {
  return date?.toISOString().slice(0, 10) ?? null;
}

/** Un jour civil part en base comme le minuit UTC de ce jour, que `DATE` garde tel quel. */
function versLaBase(jour: string | null): Date | null {
  return jour === null ? null : new Date(`${jour}T00:00:00Z`);
}
