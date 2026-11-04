import { Injectable } from '@nestjs/common';
import type { BackupRunReport, BackupStatus } from '@personal-os/contracts';
import { PrismaService } from '@personal-os/database';

/** La seule rangée de l'état des sauvegardes. */
const ID = 'backup';

@Injectable()
export class BackupStatusRepository {
  constructor(private readonly prisma: PrismaService) {}

  async lire(): Promise<BackupStatus | null> {
    const rangee = await this.prisma.backupStatus.findUnique({
      where: { id: ID },
    });
    return rangee && versContrat(rangee);
  }

  /**
   * Une réussite efface la dernière erreur ; un échec garde la dernière
   * réussite, qui reste la référence de fraîcheur.
   */
  async enregistrer(rapport: BackupRunReport): Promise<BackupStatus> {
    const finiLe = new Date(rapport.finishedAt);
    const donnees =
      rapport.outcome === 'SUCCEEDED'
        ? { lastSuccessAt: finiLe, lastRunAt: finiLe, lastError: null }
        : { lastRunAt: finiLe, lastError: rapport.error };
    const rangee = await this.prisma.backupStatus.upsert({
      where: { id: ID },
      create: { id: ID, ...donnees },
      update: donnees,
    });
    return versContrat(rangee);
  }
}

function versContrat(rangee: {
  lastSuccessAt: Date | null;
  lastRunAt: Date;
  lastError: string | null;
}): BackupStatus {
  return {
    lastSuccessAt: rangee.lastSuccessAt?.toISOString() ?? null,
    lastRunAt: rangee.lastRunAt.toISOString(),
    lastError: rangee.lastError,
  };
}
