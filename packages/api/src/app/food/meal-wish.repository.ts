import { Injectable } from '@nestjs/common';
import { ID_ESPACE_FOYER, PrismaService } from '@personal-os/database';

export interface MealWishRecord {
  id: string;
  week: string;
  recipe: { id: string; title: string } | null;
  text: string | null;
  authorId: string;
  createdAt: Date;
}

/** Ce qu'un dépôt écrit : une recette ou un texte, l'autre vide. */
export interface MealWishWrite {
  week: string;
  recipeId: string | null;
  text: string | null;
  authorId: string;
}

const CHAMPS = {
  id: true,
  week: true,
  recipe: { select: { id: true, title: true } },
  text: true,
  authorId: true,
  createdAt: true,
} as const;

/**
 * Aucun filtre d'Espace n'apparaît ici : la garde (ADR 0028) borne chaque
 * lecture et chaque écriture à l'Espace foyer, seul que la Cuisine accepte.
 */
@Injectable()
export class MealWishRepository {
  constructor(private readonly prisma: PrismaService) {}

  async lister(semaine: string): Promise<MealWishRecord[]> {
    const rangees = await this.prisma.mealWish.findMany({
      where: { week: enDate(semaine) },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: CHAMPS,
    });

    return rangees.map(enSouhait);
  }

  async recetteExiste(id: string): Promise<boolean> {
    return (await this.prisma.recipe.count({ where: { id } })) > 0;
  }

  /** La Cuisine vit dans l'Espace foyer : elle le pose elle-même. */
  async deposer({ week, ...souhait }: MealWishWrite): Promise<MealWishRecord> {
    return enSouhait(
      await this.prisma.mealWish.create({
        data: { ...souhait, week: enDate(week), scopeId: ID_ESPACE_FOYER },
        select: CHAMPS,
      }),
    );
  }

  /** Vrai si le Souhait existait, et n'existe plus. */
  async retirer(id: string): Promise<boolean> {
    const { count } = await this.prisma.mealWish.deleteMany({ where: { id } });
    return count > 0;
  }
}

// Un jour civil s'écrit à minuit UTC dans une colonne `date`, qui n'a pas de
// fuseau : il en ressort tel qu'il est entré.
function enDate(jour: string): Date {
  return new Date(`${jour}T00:00:00Z`);
}

function enSouhait({
  week,
  ...rangee
}: Omit<MealWishRecord, 'week'> & { week: Date }): MealWishRecord {
  return { ...rangee, week: week.toISOString().slice(0, 10) };
}
