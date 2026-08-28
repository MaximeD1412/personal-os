import { Controller, Get, Query } from '@nestjs/common';
import type { AgendaItem, AgendaPeriod } from '@personal-os/contracts';
import { Espaces } from '../espace/espaces.decorator';
import { AgendaService } from './agenda.service';

/**
 * L'Agenda n'offre qu'une lecture, et c'est la décision : déplacer une Séance
 * se fait dans le module Sport, pas ici (ADR 0011). L'absence de verbe
 * d'écriture est la garantie — il n'y a pas de route à interdire.
 *
 * Il déclare les deux Espaces parce qu'il montre tout ce que le Compte peut
 * atteindre. Rien ne s'écrit derrière cette déclaration : elle ne fait
 * qu'ouvrir la lecture aux Espaces du Compte, et chaque contributeur reste
 * borné par la même garde (ADR 0028).
 */
@Controller('agenda')
@Espaces('PERSONAL', 'HOUSEHOLD')
export class AgendaController {
  constructor(private readonly agenda: AgendaService) {}

  @Get()
  lister(@Query() periode: Partial<AgendaPeriod>): Promise<AgendaItem[]> {
    return this.agenda.lister(periode);
  }
}
