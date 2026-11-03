import { Injectable } from '@nestjs/common';
import {
  zRejectedSlot,
  type MealMoment,
  type MealPlanEntryDecision,
  type MealPlanStatus,
  type RejectedSlot,
} from '@personal-os/contracts';
import { ID_ESPACE_FOYER, PrismaService } from '@personal-os/database';

export interface MealPlanEntryRecord {
  id: string;
  mealPlanId: string;
  day: string;
  moment: MealMoment;
  recipe: { id: string; title: string } | null;
  title: string | null;
  participantIds: string[];
  guestCount: number;
  decision: MealPlanEntryDecision;
  createdAt: Date;
}

/** Un Tour de génération, sans ses repas : ceux-ci sont au planning. */
export interface GenerationRoundRecord {
  id: string;
  number: number;
  traceId: string | null;
  rejected: RejectedSlot[];
  createdAt: Date;
}

export interface MealPlanRecord {
  id: string;
  week: string;
  status: MealPlanStatus;
  /** Grandit à chaque écriture : un Tour de génération écrit sur celle qu'il a lue. */
  version: number;
  entries: MealPlanEntryRecord[];
  /** Ses Tours de génération, dans leur ordre. */
  rounds: GenerationRoundRecord[];
  createdAt: Date;
}

/** Ce qu'une écriture pose sur un Repas planifié. */
export interface MealPlanEntryWrite {
  day: string;
  moment: MealMoment;
  recipeId: string | null;
  title: string | null;
  participantIds: string[];
  guestCount: number;
}

/** Les repas dans l'ordre de la semaine : par jour, le déjeuner avant le dîner. */
export const ORDRE_DES_REPAS = [
  { day: 'asc' as const },
  { moment: 'asc' as const },
  { createdAt: 'asc' as const },
];

export const CHAMPS_DU_REPAS = {
  id: true,
  mealPlanId: true,
  day: true,
  moment: true,
  title: true,
  participantIds: true,
  guestCount: true,
  decision: true,
  createdAt: true,
  recipe: { select: { id: true, title: true } },
};

export const CHAMPS_DU_TOUR = {
  id: true,
  number: true,
  traceId: true,
  rejected: true,
  createdAt: true,
};

const AVEC_LES_REPAS = {
  entries: { orderBy: ORDRE_DES_REPAS, select: CHAMPS_DU_REPAS },
  rounds: { orderBy: { number: 'asc' as const }, select: CHAMPS_DU_TOUR },
};

/**
 * Aucun filtre d'Espace n'apparaît ici : la garde (ADR 0028) borne chaque
 * lecture et chaque écriture à l'Espace foyer, seul que la Cuisine accepte.
 *
 * Chaque écriture d'un repas s'ouvre, dans une transaction, sur l'écriture de
 * son planning **ouvert** : elle verrouille sa rangée jusqu'au commit, et
 * échoue si le planning est arrêté. Un arrêt simultané passe avant ou après,
 * jamais entre la vérification et l'écriture.
 */
@Injectable()
export class MealPlanRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Le planning d'une semaine, créé vide s'il n'existe pas. Deux premières
   * lectures simultanées se disputent la même semaine : la perdante relit
   * celui que l'autre vient de créer.
   */
  async lireOuCreer(semaine: string): Promise<MealPlanRecord> {
    const week = enDate(semaine);
    const existant = await this.prisma.mealPlan.findFirst({
      where: { week },
      include: AVEC_LES_REPAS,
    });
    if (existant) {
      return enPlanning(existant);
    }

    try {
      return enPlanning(
        await this.prisma.mealPlan.create({
          data: { week, scopeId: ID_ESPACE_FOYER },
          include: AVEC_LES_REPAS,
        }),
      );
    } catch (erreur) {
      if (codePrisma(erreur) !== 'P2002') {
        throw erreur;
      }
      return enPlanning(
        await this.prisma.mealPlan.findFirstOrThrow({
          where: { week },
          include: AVEC_LES_REPAS,
        }),
      );
    }
  }

  async lire(id: string): Promise<MealPlanRecord | null> {
    const rangee = await this.prisma.mealPlan.findUnique({
      where: { id },
      include: AVEC_LES_REPAS,
    });

    return rangee ? enPlanning(rangee) : null;
  }

  /** Les Repas planifiés approuvés dont le jour est entre ces deux-là, inclus. */
  async approuvesEntre(
    premier: string,
    dernier: string,
  ): Promise<MealPlanEntryRecord[]> {
    const rangees = await this.prisma.mealPlanEntry.findMany({
      where: {
        decision: 'APPROVED',
        day: { gte: enDate(premier), lte: enDate(dernier) },
      },
      orderBy: ORDRE_DES_REPAS,
      select: CHAMPS_DU_REPAS,
    });

    return rangees.map(enRepas);
  }

  /** Les identifiants, parmi ceux-ci, de Comptes du Foyer de ce Compte. */
  /**
   * Le planning d'une semaine et les jours de ses repas encore proposés, dans
   * l'ordre de la semaine. Rien n'est créé : un planning absent n'attend rien.
   */
  async proposesDeLaSemaine(
    semaine: string,
  ): Promise<{ id: string; jours: string[] } | null> {
    const rangee = await this.prisma.mealPlan.findFirst({
      where: { week: enDate(semaine) },
      select: {
        id: true,
        entries: {
          where: { decision: 'PROPOSED' },
          orderBy: ORDRE_DES_REPAS,
          select: { day: true },
        },
      },
    });

    return rangee
      ? { id: rangee.id, jours: rangee.entries.map(({ day }) => enJour(day)) }
      : null;
  }

  async membresDuFoyer(
    ids: readonly string[],
    compteId: string,
  ): Promise<Set<string>> {
    const membres = await this.prisma.user.findMany({
      where: {
        id: { in: [...ids] },
        household: { members: { some: { id: compteId } } },
      },
      select: { id: true },
    });

    return new Set(membres.map(({ id }) => id));
  }

  async recetteExiste(id: string): Promise<boolean> {
    return (await this.prisma.recipe.count({ where: { id } })) > 0;
  }

  /** Un repas saisi à la main est approuvé d'emblée. */
  async ajouter(
    planId: string,
    repas: MealPlanEntryWrite,
  ): Promise<MealPlanEntryRecord> {
    const [, rangee] = await this.prisma.$transaction([
      this.verrouillerOuvert(planId),
      this.prisma.mealPlanEntry.create({
        data: {
          ...repas,
          day: enDate(repas.day),
          decision: 'APPROVED',
          mealPlanId: planId,
          scopeId: ID_ESPACE_FOYER,
        },
        select: CHAMPS_DU_REPAS,
      }),
    ]);

    return enRepas(rangee);
  }

  async modifier(
    planId: string,
    id: string,
    changements: Partial<MealPlanEntryWrite>,
  ): Promise<MealPlanEntryRecord> {
    const [, rangee] = await this.prisma.$transaction([
      this.verrouillerOuvert(planId),
      this.prisma.mealPlanEntry.update({
        where: { id, mealPlanId: planId },
        data: {
          ...changements,
          ...(changements.day ? { day: enDate(changements.day) } : {}),
        },
        select: CHAMPS_DU_REPAS,
      }),
    ]);

    return enRepas(rangee);
  }

  async supprimer(planId: string, id: string): Promise<void> {
    await this.prisma.$transaction([
      this.verrouillerOuvert(planId),
      this.prisma.mealPlanEntry.delete({ where: { id, mealPlanId: planId } }),
    ]);
  }

  /**
   * Seul un repas encore proposé se décide, dans la même écriture : deux
   * décisions simultanées ne passent pas toutes les deux.
   */
  async decider(
    planId: string,
    id: string,
    decision: MealPlanEntryDecision,
  ): Promise<MealPlanEntryRecord> {
    const [, rangee] = await this.prisma.$transaction([
      this.verrouillerOuvert(planId),
      this.prisma.mealPlanEntry.update({
        where: { id, mealPlanId: planId, decision: 'PROPOSED' },
        data: { decision },
        select: CHAMPS_DU_REPAS,
      }),
    ]);

    return enRepas(rangee);
  }

  /**
   * L'arrêt n'a lieu que si le planning est ouvert et sans repas proposé, dans
   * la même écriture : rien ne s'intercale entre la vérification et l'arrêt.
   * Elle verrouille le planning avant que ses refusés soient retirés : un repas
   * refusé entre-temps ne survit pas à l'arrêt.
   */
  async arreter(id: string): Promise<MealPlanRecord> {
    const [, , rangee] = await this.prisma.$transaction([
      this.prisma.mealPlan.update({
        where: {
          id,
          status: 'OPEN',
          entries: { none: { decision: 'PROPOSED' } },
        },
        data: { status: 'STOPPED', version: { increment: 1 } },
        select: { id: true },
      }),
      this.prisma.mealPlanEntry.deleteMany({
        where: { mealPlanId: id, decision: 'REFUSED' },
      }),
      this.prisma.mealPlan.findUniqueOrThrow({
        where: { id },
        include: AVEC_LES_REPAS,
      }),
    ]);

    return enPlanning(rangee);
  }

  async rouvrir(id: string): Promise<MealPlanRecord> {
    return enPlanning(
      await this.prisma.mealPlan.update({
        where: { id, status: 'STOPPED' },
        data: { status: 'OPEN', version: { increment: 1 } },
        include: AVEC_LES_REPAS,
      }),
    );
  }

  /**
   * Le verrou de la rangée, et sa version qui grandit : un Tour de génération
   * en cours sait que le planning a changé sous lui.
   */
  verrouillerOuvert(id: string) {
    return this.prisma.mealPlan.update({
      where: { id, status: 'OPEN' },
      data: { version: { increment: 1 } },
      select: { id: true },
    });
  }
}

function codePrisma(erreur: unknown): unknown {
  return typeof erreur === 'object' && erreur !== null && 'code' in erreur
    ? erreur.code
    : undefined;
}

// Un jour civil s'écrit à minuit UTC dans une colonne `date`, qui n'a pas de
// fuseau : il en ressort tel qu'il est entré.
export function enDate(jour: string): Date {
  return new Date(`${jour}T00:00:00Z`);
}

function enJour(date: Date): string {
  return date.toISOString().slice(0, 10);
}

type RangeeRepas = Omit<MealPlanEntryRecord, 'day'> & { day: Date };

export function enRepas(rangee: RangeeRepas): MealPlanEntryRecord {
  return { ...rangee, day: enJour(rangee.day) };
}

type RangeeTour = Omit<GenerationRoundRecord, 'rejected'> & {
  rejected: unknown;
};

/**
 * Les créneaux écartés sont écrits par l'API seule, d'après le contrat : ils
 * se relisent par lui, et une rangée qui ne le respecte plus fait une erreur
 * plutôt qu'un créneau inventé.
 */
export function enTour(rangee: RangeeTour): GenerationRoundRecord {
  return { ...rangee, rejected: zRejectedSlot.array().parse(rangee.rejected) };
}

function enPlanning(rangee: {
  id: string;
  week: Date;
  status: MealPlanStatus;
  version: number;
  entries: RangeeRepas[];
  rounds: RangeeTour[];
  createdAt: Date;
}): MealPlanRecord {
  return {
    id: rangee.id,
    week: enJour(rangee.week),
    status: rangee.status,
    version: rangee.version,
    entries: rangee.entries.map(enRepas),
    rounds: rangee.rounds.map(enTour),
    createdAt: rangee.createdAt,
  };
}
