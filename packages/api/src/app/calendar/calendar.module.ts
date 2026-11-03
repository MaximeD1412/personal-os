import { Module } from '@nestjs/common';
import { AgendaPortModule } from '../agenda-port/agenda-port.module';
import { DashboardPortModule } from '../dashboard-port/dashboard-port.module';
import { EventAgendaContributor } from './event-agenda.contributor';
import { EventController } from './event.controller';
import { EventRepository } from './event.repository';
import { EventResumeur } from './event.resumeur';
import { EventService } from './event.service';

/**
 * Le Calendrier : le module qui possède les Événements, et rien d'autre.
 *
 * Il importe le port de l'Agenda pour s'y présenter, et celui du tableau de
 * bord pour s'y résumer. Les flèches partent d'ici : ni l'Agenda ni le
 * tableau de bord ne savent rien du Calendrier (ADR 0011).
 */
@Module({
  imports: [AgendaPortModule, DashboardPortModule],
  controllers: [EventController],
  providers: [
    EventService,
    EventRepository,
    EventAgendaContributor,
    EventResumeur,
  ],
})
export class CalendarModule {}
