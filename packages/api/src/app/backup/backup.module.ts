import { Module } from '@nestjs/common';
import { DashboardPortModule } from '../dashboard-port/dashboard-port.module';
import { BackupStatusController } from './backup-status.controller';
import { BackupStatusRepository } from './backup-status.repository';
import { BackupResumeur } from './backup.resumeur';

/**
 * L'état des sauvegardes : ce que l'agent de sauvegarde en transmet, et son
 * résumé au tableau de bord (DASH-3). Un module plat (ADR 0016) : la seule
 * règle, la fraîcheur, tient dans le résumeur.
 */
@Module({
  imports: [DashboardPortModule],
  controllers: [BackupStatusController],
  providers: [BackupStatusRepository, BackupResumeur],
})
export class BackupModule {}
