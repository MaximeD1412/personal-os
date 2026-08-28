import { Module } from '@nestjs/common';
import { AgendaPortModule } from '../agenda-port/agenda-port.module';
import { EventAgendaContributor } from './event-agenda.contributor';
import { EventController } from './event.controller';
import { EventRepository } from './event.repository';
import { EventService } from './event.service';

/**
 * Le Calendrier : le module qui possède les Événements, et rien d'autre.
 *
 * Il importe le port de l'Agenda pour s'y présenter. La flèche part d'ici :
 * l'Agenda, lui, ne sait rien du Calendrier (ADR 0011).
 */
@Module({
  imports: [AgendaPortModule],
  controllers: [EventController],
  providers: [EventService, EventRepository, EventAgendaContributor],
})
export class CalendarModule {}
