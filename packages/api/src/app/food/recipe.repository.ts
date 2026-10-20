import { Injectable } from '@nestjs/common';
import type {
  RecipeLineInput,
  RecipeSource,
  RecipeUnit,
} from '@personal-os/contracts';
import { ID_ESPACE_FOYER, PrismaService } from '@personal-os/database';

export interface RecipeLineRecord {
  id: string;
  ingredient: { id: string; displayName: string };
  quantity: number;
  unit: RecipeUnit;
}

export interface RecipeRecord {
  id: string;
  title: string;
  servings: number;
  steps: string[];
  source: RecipeSource;
  lines: RecipeLineRecord[];
  createdAt: Date;
  updatedAt: Date;
}

/** Ce qu'une écriture pose sur la recette elle-même, hors de ses lignes. */
export interface RecipeWrite {
  title: string;
  servings: number;
  steps: string[];
}

/** La rangée telle que Prisma la rend : la quantité y est un décimal. */
type RangeeRecette = Omit<RecipeRecord, 'lines'> & {
  lines: (Omit<RecipeLineRecord, 'quantity'> & {
    quantity: { toNumber(): number };
  })[];
};

/** Les lignes dans leur ordre, chacune avec le libellé de son Ingrédient. */
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
 * Une ligne ne s'écrit qu'en création imbriquée sous sa recette : elle en
 * reçoit l'Espace, et la clé étrangère qui les relie le vérifie.
 */
@Injectable()
export class RecipeRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Les recettes dont le titre contient chacun des mots, toutes sans mots. */
  async lister(mots: readonly string[]): Promise<RecipeRecord[]> {
    const rangees = await this.prisma.recipe.findMany({
      where: {
        AND: mots.map((mot) => ({
          title: { contains: mot, mode: 'insensitive' as const },
        })),
      },
      orderBy: [{ title: 'asc' }, { createdAt: 'asc' }],
      include: AVEC_LES_LIGNES,
    });

    return rangees.map(enRecette);
  }

  async lire(id: string): Promise<RecipeRecord | null> {
    const rangee = await this.prisma.recipe.findUnique({
      where: { id },
      include: AVEC_LES_LIGNES,
    });

    return rangee ? enRecette(rangee) : null;
  }

  /** Les identifiants, parmi ceux-ci, d'Ingrédients du catalogue. */
  async ingredientsConnus(ids: readonly string[]): Promise<Set<string>> {
    const connus = await this.prisma.ingredient.findMany({
      where: { id: { in: [...ids] } },
      select: { id: true },
    });

    return new Set(connus.map(({ id }) => id));
  }

  /**
   * Une recette saisie est manuelle ; la génération posera les siennes
   * (CUISINE-19). La Cuisine vit dans l'Espace foyer : elle le pose elle-même.
   */
  async creer(
    saisie: RecipeWrite,
    lignes: readonly RecipeLineInput[],
  ): Promise<RecipeRecord> {
    return enRecette(
      await this.prisma.recipe.create({
        data: {
          ...saisie,
          source: 'MANUAL',
          scope: { connect: { id: ID_ESPACE_FOYER } },
          lines: { create: enLignes(lignes) },
        },
        include: AVEC_LES_LIGNES,
      }),
    );
  }

  /**
   * Des lignes fournies remplacent toutes les autres, dans une transaction :
   * on supprime, puis on recrée sous la recette, jamais ligne à ligne. Une
   * recette absente fait échouer la modification, et avec elle la
   * suppression des lignes.
   *
   * La transaction s'ouvre en écrivant la recette, ce qui verrouille sa
   * rangée jusqu'au commit : deux remplacements simultanés passent l'un après
   * l'autre. Sans ce verrou, le second supprimerait les lignes qu'il a lues
   * avant le commit du premier, puis buterait sur les nouvelles
   * (`recipeId`, `position`).
   */
  async modifier(
    id: string,
    changements: Partial<RecipeWrite>,
    lignes: readonly RecipeLineInput[] | undefined,
  ): Promise<RecipeRecord> {
    if (!lignes) {
      return enRecette(
        await this.prisma.recipe.update({
          where: { id },
          data: changements,
          include: AVEC_LES_LIGNES,
        }),
      );
    }

    const [, , rangee] = await this.prisma.$transaction([
      this.prisma.recipe.update({
        where: { id },
        data: { updatedAt: new Date() },
        select: { id: true },
      }),
      this.prisma.recipeLine.deleteMany({ where: { recipeId: id } }),
      this.prisma.recipe.update({
        where: { id },
        data: { ...changements, lines: { create: enLignes(lignes) } },
        include: AVEC_LES_LIGNES,
      }),
    ]);

    return enRecette(rangee);
  }

  /**
   * Les lignes suivent leur recette (`onDelete: Cascade`). Un Repas planifié
   * passé (avant `aujourdhui`) garde le titre de la recette à sa place, dans
   * la même transaction ; un repas à venir la retient (`onDelete: NoAction`),
   * et la suppression échoue tout entière, sur une clé étrangère.
   */
  async supprimer(id: string, aujourdhui: string): Promise<void> {
    const recette = await this.prisma.recipe.findUniqueOrThrow({
      where: { id },
      select: { title: true },
    });

    await this.prisma.$transaction([
      this.prisma.mealPlanEntry.updateMany({
        where: {
          recipeId: id,
          day: { lt: new Date(`${aujourdhui}T00:00:00Z`) },
        },
        data: { recipeId: null, title: recette.title },
      }),
      this.prisma.recipe.delete({ where: { id } }),
    ]);
  }
}

/**
 * La position est l'ordre de la saisie. Une ligne ne nomme pas son Espace :
 * elle prend celui de sa recette, par la clé étrangère qu'elles partagent.
 */
function enLignes(lignes: readonly RecipeLineInput[]) {
  return lignes.map(({ ingredientId, quantity, unit }, position) => ({
    ingredientId,
    quantity,
    unit,
    position,
  }));
}

function enRecette(rangee: RangeeRecette): RecipeRecord {
  return {
    id: rangee.id,
    title: rangee.title,
    servings: rangee.servings,
    steps: rangee.steps,
    source: rangee.source,
    lines: rangee.lines.map((ligne) => ({
      id: ligne.id,
      ingredient: ligne.ingredient,
      quantity: ligne.quantity.toNumber(),
      unit: ligne.unit,
    })),
    createdAt: rangee.createdAt,
    updatedAt: rangee.updatedAt,
  };
}
