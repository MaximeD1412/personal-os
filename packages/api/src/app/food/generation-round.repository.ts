import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { MealMoment, RejectedSlot } from '@personal-os/contracts';
import { ID_ESPACE_FOYER, PrismaService } from '@personal-os/database';
import type {
  CatalogueDuControle,
  RecetteNouvelle,
} from './generation/controler';
import {
  CHAMPS_DU_REPAS,
  CHAMPS_DU_TOUR,
  enDate,
  enRepas,
  enTour,
  ORDRE_DES_REPAS,
  type GenerationRoundRecord,
  type MealPlanEntryRecord,
} from './meal-plan.repository';

/** Le catalogue du contrôle, avec le libellé qu'on montre au modèle. */
export interface CatalogueDuTour extends CatalogueDuControle {
  ingredients: (CatalogueDuControle['ingredients'][number] & {
    displayName: string;
  })[];
}

/** Un repas proposé par le tour : une Recette du Foyer, ou une nouvelle. */
export interface RepasDuTourAEcrire {
  day: string;
  moment: MealMoment;
  participantIds: readonly string[];
  guestCount: number;
  recette: { recipeId: string } | { nouvelle: RecetteNouvelle };
}

/** Ce qu'un tour écrit, une fois le modèle appelé et ses propositions contrôlées. */
export interface TourAEcrire {
  number: number;
  traceId: string;
  rejected: RejectedSlot[];
  repas: readonly RepasDuTourAEcrire[];
}

export interface GenerationRoundWithEntriesRecord
  extends GenerationRoundRecord {
  entries: MealPlanEntryRecord[];
}

/**
 * Aucun filtre d'Espace n'apparaît ici : la garde (ADR 0028) borne chaque
 * lecture et chaque écriture à l'Espace foyer. `Ingredient` et
 * `IngredientAlias` sont hors Espace, lus sans filtre.
 */
@Injectable()
export class GenerationRoundRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Tout ce que le contrôle compare : les noms, les Alias et les Allergènes de
   * chaque Ingrédient. Le catalogue est borné par nature (quelques centaines
   * d'Ingrédients).
   */
  async catalogue(): Promise<CatalogueDuTour> {
    const [ingredients, alias] = await Promise.all([
      this.prisma.ingredient.findMany({
        select: { id: true, name: true, displayName: true, allergens: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.ingredientAlias.findMany({
        select: { label: true, ingredientId: true },
      }),
    ]);

    return { ingredients, alias };
  }

  /**
   * Le tour en une seule écriture, qui s'ouvre sur le verrou du planning
   * **ouvert et sans repas proposé** : un arrêt ou un autre tour simultané
   * passe avant ou après, jamais entre. Le numéro du tour est unique dans son
   * planning : deux tours lancés ensemble ne passent pas tous les deux.
   *
   * Les repas refusés cèdent leur créneau aux repas du tour, qui sont
   * proposés ; les recettes nouvelles entrent au Foyer, générées.
   */
  async enregistrer(
    planId: string,
    tour: TourAEcrire,
  ): Promise<GenerationRoundWithEntriesRecord> {
    const id = randomUUID();
    const recettes = tour.repas.map(({ recette }) =>
      'recipeId' in recette
        ? { recipeId: recette.recipeId, nouvelle: null }
        : { recipeId: randomUUID(), nouvelle: recette.nouvelle },
    );

    await this.prisma.$transaction([
      this.prisma.mealPlan.update({
        where: {
          id: planId,
          status: 'OPEN',
          entries: { none: { decision: 'PROPOSED' } },
        },
        data: { status: 'OPEN' },
        select: { id: true },
      }),
      this.prisma.generationRound.create({
        data: {
          id,
          mealPlanId: planId,
          scopeId: ID_ESPACE_FOYER,
          number: tour.number,
          traceId: tour.traceId,
          rejected: tour.rejected,
        },
        select: { id: true },
      }),
      this.prisma.mealPlanEntry.deleteMany({
        where: { mealPlanId: planId, decision: 'REFUSED' },
      }),
      ...recettes.flatMap(({ recipeId, nouvelle }) =>
        nouvelle
          ? [
              this.prisma.recipe.create({
                data: {
                  id: recipeId,
                  title: nouvelle.title,
                  servings: nouvelle.servings,
                  steps: nouvelle.steps,
                  source: 'GENERATED',
                  scope: { connect: { id: ID_ESPACE_FOYER } },
                  lines: {
                    create: nouvelle.lignes.map(
                      ({ ingredientId, quantity, unit }, position) => ({
                        ingredientId,
                        quantity,
                        unit,
                        position,
                      }),
                    ),
                  },
                },
                select: { id: true },
              }),
            ]
          : [],
      ),
      this.prisma.mealPlanEntry.createMany({
        data: tour.repas.map((repas, rang) => ({
          mealPlanId: planId,
          scopeId: ID_ESPACE_FOYER,
          generationRoundId: id,
          day: enDate(repas.day),
          moment: repas.moment,
          recipeId: recettes[rang].recipeId,
          title: null,
          participantIds: [...repas.participantIds],
          guestCount: repas.guestCount,
          decision: 'PROPOSED' as const,
        })),
      }),
    ]);

    const rangee = await this.prisma.generationRound.findUniqueOrThrow({
      where: { id },
      select: {
        ...CHAMPS_DU_TOUR,
        entries: { orderBy: ORDRE_DES_REPAS, select: CHAMPS_DU_REPAS },
      },
    });

    return { ...enTour(rangee), entries: rangee.entries.map(enRepas) };
  }
}
