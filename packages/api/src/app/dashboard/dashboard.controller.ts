import { Controller, Get } from '@nestjs/common';
import { ZodResponse } from 'nestjs-zod';
import { Espaces } from '../espace/espaces.decorator';
import { ModuleSummaryDto, TodoDto } from './dashboard.dto';
import { DashboardService } from './dashboard.service';

/**
 * Le tableau de bord n'offre que des lectures : un À faire ne se coche pas, il
 * disparaît quand sa situation change (ADR 0017). Il n'y a donc pas de route
 * d'écriture à interdire.
 *
 * Il déclare les deux Espaces parce qu'il montre tout ce que le Compte peut
 * atteindre, comme l'Agenda. Chaque résumeur reste borné par la même garde
 * (ADR 0028) : l'Échéance personnelle de l'un n'arrive pas chez l'autre.
 *
 * Ses listes sont bornées sans période ni curseur : chaque module ne signale
 * que des situations bornées par leur nature (la semaine en cours, sept jours,
 * trois jours, les listes encore ouvertes).
 */
@Controller('dashboard')
@Espaces('PERSONAL', 'HOUSEHOLD')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('todos')
  @ZodResponse({ status: 200, type: [TodoDto] })
  aFaire() {
    return this.dashboard.aFaire();
  }

  @Get('summaries')
  @ZodResponse({ status: 200, type: [ModuleSummaryDto] })
  resumes() {
    return this.dashboard.resumes();
  }
}
