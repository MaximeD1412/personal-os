import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBody } from '@nestjs/swagger';
import type { BackupRunReport } from '@personal-os/contracts';
import { ZodResponse, ZodValidationPipe } from 'nestjs-zod';
import { Public } from '../auth/public.decorator';
import { BackupTokenGuard } from './backup-token.guard';
import { BackupRunReportDto, BackupStatusDto } from './backup.dto';
import { BackupStatusRepository } from './backup-status.repository';

/**
 * La route par laquelle l'agent de sauvegarde (`infra/backup`) transmet le
 * résultat de chaque exécution : l'API ne voit pas Restic (ADR 0020).
 *
 * Sans session : l'agent n'est pas un Compte. Le jeton partagé la garde à la
 * place, et l'état est celui de la machine, hors Espace.
 */
@Controller('internal/backup-status')
@Public()
@UseGuards(BackupTokenGuard)
export class BackupStatusController {
  constructor(private readonly etat: BackupStatusRepository) {}

  @Post()
  @HttpCode(200)
  @ApiBody({ type: BackupRunReportDto })
  @ZodResponse({ status: 200, type: BackupStatusDto })
  transmettre(
    @Body(new ZodValidationPipe(BackupRunReportDto)) rapport: BackupRunReport,
  ) {
    return this.etat.enregistrer(rapport);
  }
}
