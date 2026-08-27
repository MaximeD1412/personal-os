import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import type { Event, EventInput, EventUpdate } from '@personal-os/contracts';
import { Espaces } from '../espace/espaces.decorator';
import { EventService } from './event.service';

/**
 * Le Calendrier accepte les deux Espaces : un rendez-vous médical et des
 * vacances communes ne relèvent pas de la même règle. C'est à la création
 * qu'on choisit, jamais déduit d'un contexte (ADR 0014).
 */
@Controller('events')
@Espaces('PERSONAL', 'HOUSEHOLD')
export class EventController {
  constructor(private readonly evenements: EventService) {}

  @Get()
  lister(): Promise<Event[]> {
    return this.evenements.lister();
  }

  @Post()
  creer(@Body() saisie: Partial<EventInput>): Promise<Event> {
    return this.evenements.creer(saisie);
  }

  @Patch(':id')
  modifier(
    @Param('id') id: string,
    @Body() saisie: EventUpdate,
  ): Promise<Event> {
    return this.evenements.modifier(id, saisie);
  }

  @Delete(':id')
  @HttpCode(204)
  supprimer(@Param('id') id: string): Promise<void> {
    return this.evenements.supprimer(id);
  }
}
