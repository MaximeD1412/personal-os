import { Injectable } from '@nestjs/common';
import type {
  TrainingGoalProgress,
  TrainingSessionStatus,
} from '@personal-os/contracts';
import { PrismaService } from '@personal-os/database';

export interface TrainingGoalRecord {
  id: string;
  title: string;
  /** Le jour de la course, `YYYY-MM-DD`. */
  date: string;
  intent: string | null;
  progress: TrainingGoalProgress;
  scopeId: string;
  createdAt: Date;
}

/** Ce qu'une écriture pose : le titre, le jour, l'intention, et l'Espace à la création. */
export interface TrainingGoalWrite {
  title: string;
  date: string;
  intent: string | null;
  scopeId: string;
}

interface RangeeDObjectif {
  id: string;
  title: string;
  date: Date;
  intent: string | null;
  scopeId: string;
  createdAt: Date;
}

/**
 * Aucun filtre par Espace n'apparaît ici : la garde ajoute le sien à toutes
 * ces requêtes, Séances comptées comprises, et c'est elle qui fait qu'un
 * Compte ne voit que ses Objectifs (ADR 0016, 0028).
 */
@Injectable()
export class TrainingGoalRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Tous les Objectifs, du plus proche au plus lointain. */
  async lister(): Promise<TrainingGoalRecord[]> {
    return this.avecAvancement(
      await this.prisma.trainingGoal.findMany({
        orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      }),
    );
  }

  async lire(id: string): Promise<TrainingGoalRecord | null> {
    const objectif = await this.prisma.trainingGoal.findUnique({
      where: { id },
    });
    return objectif
      ? ((await this.avecAvancement([objectif]))[0] ?? null)
      : null;
  }

  async creer(saisie: TrainingGoalWrite): Promise<TrainingGoalRecord> {
    const objectif = await this.prisma.trainingGoal.create({
      data: { ...saisie, date: enDate(saisie.date) },
    });
    return { ...enObjectif(objectif), progress: AUCUNE_SEANCE };
  }

  /** Écrit les changements ; rend l'Objectif écrit, ou rien s'il n'est plus là. */
  async modifier(
    id: string,
    { date, ...changements }: Partial<Omit<TrainingGoalWrite, 'scopeId'>>,
  ): Promise<TrainingGoalRecord | null> {
    const { count } = await this.prisma.trainingGoal.updateMany({
      where: { id },
      data: {
        ...changements,
        ...(date === undefined ? {} : { date: enDate(date) }),
      },
    });
    return count > 0 ? this.lire(id) : null;
  }

  /**
   * Vrai si l'Objectif existait, et n'existe plus. Ses Séances restent : elles
   * perdent leur lien dans la même transaction, avant que l'Objectif parte (la
   * base refuse de supprimer un Objectif encore cité).
   */
  async supprimer(id: string): Promise<boolean> {
    const [, { count }] = await this.prisma.$transaction([
      this.prisma.trainingSession.updateMany({
        where: { goalId: id },
        data: { goalId: null },
      }),
      this.prisma.trainingGoal.deleteMany({ where: { id } }),
    ]);
    return count > 0;
  }

  /** L'avancement de chaque Objectif : ses Séances comptées par statut. */
  private async avecAvancement(
    objectifs: RangeeDObjectif[],
  ): Promise<TrainingGoalRecord[]> {
    const seances = await this.prisma.trainingSession.findMany({
      where: { goalId: { in: objectifs.map(({ id }) => id) } },
      select: { goalId: true, status: true },
    });

    return objectifs.map((objectif) => ({
      ...enObjectif(objectif),
      progress: compter(
        seances
          .filter(({ goalId }) => goalId === objectif.id)
          .map(({ status }) => status),
      ),
    }));
  }
}

const AUCUNE_SEANCE: TrainingGoalProgress = { done: 0, missed: 0, planned: 0 };

const COMPTE: Record<TrainingSessionStatus, keyof TrainingGoalProgress> = {
  DONE: 'done',
  MISSED: 'missed',
  PLANNED: 'planned',
};

function compter(statuts: TrainingSessionStatus[]): TrainingGoalProgress {
  const avancement = { ...AUCUNE_SEANCE };
  for (const statut of statuts) {
    avancement[COMPTE[statut]] += 1;
  }
  return avancement;
}

// Un jour civil s'écrit à minuit UTC dans une colonne `date`, qui n'a pas de
// fuseau : il en ressort tel qu'il est entré.
function enDate(jour: string): Date {
  return new Date(`${jour}T00:00:00Z`);
}

function enObjectif({
  date,
  ...rangee
}: RangeeDObjectif): Omit<TrainingGoalRecord, 'progress'> {
  return { ...rangee, date: date.toISOString().slice(0, 10) };
}
