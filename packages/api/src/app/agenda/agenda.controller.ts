import { Controller, Get, Query } from '@nestjs/common';
import { ZodResponse } from 'nestjs-zod';
import { Espaces } from '../espace/espaces.decorator';
import { AgendaItemDto, AgendaPeriodDto } from './agenda.dto';
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
 *
 * La période arrive validée par son schéma (ADR 0030), et chaque entrée
 * repart par le sien : un contributeur qui laisserait passer un attribut
 * métier le verrait retiré ici.
 */
@Controller('agenda')
@Espaces('PERSONAL', 'HOUSEHOLD')
export class AgendaController {
  constructor(private readonly agenda: AgendaService) {}

  @Get()
  @ZodResponse({ status: 200, type: [AgendaItemDto] })
  lister(@Query() periode: AgendaPeriodDto) {
    return this.agenda.lister(periode);
  }
}
