import { Injectable } from '@nestjs/common';
import type {
  TrainingSessionStatus,
  TrainingSport,
} from '@personal-os/contracts';
import { PrismaService } from '@personal-os/database';

export interface TrainingSessionRecord {
  id: string;
  startsAt: Date;
  sport: TrainingSport;
  status: TrainingSessionStatus;
  plannedDistanceM: number | null;
  plannedDurationS: number | null;
  plannedIntent: string | null;
  actualDistanceM: number | null;
  actualDurationS: number | null;
  actualNotes: string | null;
  goalId: string | null;
  scopeId: string;
  createdAt: Date;
}

/** Ce qu'une écriture pose : tout sauf l'identité et la date de création. */
export type TrainingSessionWrite = Omit<
  TrainingSessionRecord,
  'id' | 'createdAt' | 'goalId'
>;

/**
 * Aucun filtre par Espace n'apparaît ici : la garde ajoute le sien à toutes
 * ces requêtes, et c'est elle qui fait qu'un Compte ne voit que ses Séances
 * (ADR 0016, 0028).
 */
@Injectable()
export class TrainingSessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Les Séances qui commencent dans la période, de la plus tôt à la plus tard. */
  listerEntre(debut: Date, fin: Date): Promise<TrainingSessionRecord[]> {
    return this.prisma.trainingSession.findMany({
      where: { startsAt: { gte: debut, lte: fin } },
      orderBy: [{ startsAt: 'asc' }, { createdAt: 'asc' }],
    });
  }

  /** Les Séances qui préparent un Objectif, de la plus tôt à la plus tard. */
  listerDeLObjectif(goalId: string): Promise<TrainingSessionRecord[]> {
    return this.prisma.trainingSession.findMany({
      where: { goalId },
      orderBy: [{ startsAt: 'asc' }, { createdAt: 'asc' }],
    });
  }

  lire(id: string): Promise<TrainingSessionRecord | null> {
    return this.prisma.trainingSession.findUnique({ where: { id } });
  }

  creer(saisie: TrainingSessionWrite): Promise<TrainingSessionRecord> {
    return this.prisma.trainingSession.create({ data: saisie });
  }

  /**
   * Crée les Séances d'une série en une écriture : toutes, ou aucune. Elles
   * reviennent de la plus tôt à la plus tard.
   */
  async creerPlusieurs(
    saisies: (TrainingSessionWrite & { goalId: string })[],
  ): Promise<TrainingSessionRecord[]> {
    const seances = await this.prisma.trainingSession.createManyAndReturn({
      data: saisies,
    });
    return seances.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  }

  /**
   * Écrit les changements si la Séance a toujours le statut lu : une
   * transition concurrente l'emporte, et rien ne s'écrit sur un statut qui
   * n'est plus le bon (ADR 0022). Rend la Séance écrite, ou rien.
   */
  async modifier(
    id: string,
    depuis: TrainingSessionStatus,
    changements: Partial<TrainingSessionWrite>,
  ): Promise<TrainingSessionRecord | null> {
    const { count } = await this.prisma.trainingSession.updateMany({
      where: { id, status: depuis },
      data: changements,
    });

    return count > 0 ? this.lire(id) : null;
  }
}
