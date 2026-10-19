import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiNoContentResponse } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';
import { Espaces } from '../espace/espaces.decorator';
import {
  EventDto,
  EventInputDto,
  EventListQueryDto,
  EventOccurrenceDto,
  EventUpdateDto,
} from './event.dto';
import { EventService } from './event.service';

/**
 * Le Calendrier accepte les deux Espaces : un rendez-vous médical et des
 * vacances communes ne relèvent pas de la même règle. C'est à la création
 * qu'on choisit, jamais déduit d'un contexte (ADR 0014).
 *
 * Chaque entrée est validée par son schéma avant d'arriver ici, et chaque
 * réponse passe par le sien en sortant (ADR 0030) : le service ne reçoit que
 * des saisies conformes, et ne garde que les règles métier.
 */
@Controller('events')
@Espaces('PERSONAL', 'HOUSEHOLD')
export class EventController {
  constructor(private readonly evenements: EventService) {}

  /** Les occurrences de la période, et non les Événements : une série en a plusieurs. */
  @Get()
  @ZodResponse({ status: 200, type: [EventOccurrenceDto] })
  lister(@Query() periode: EventListQueryDto) {
    return this.evenements.lister(periode);
  }

  @Post()
  @ZodResponse({ status: 201, type: EventDto })
  creer(@Body() saisie: EventInputDto) {
    return this.evenements.creer(saisie);
  }

  @Patch(':id')
  @ZodResponse({ status: 200, type: EventDto })
  modifier(@Param('id') id: string, @Body() saisie: EventUpdateDto) {
    return this.evenements.modifier(id, saisie);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiNoContentResponse()
  supprimer(@Param('id') id: string): Promise<void> {
    return this.evenements.supprimer(id);
  }
}
