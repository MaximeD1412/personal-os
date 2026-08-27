import { Module } from '@nestjs/common';
import { EventController } from './event.controller';
import { EventRepository } from './event.repository';
import { EventService } from './event.service';

/** Le Calendrier : le module qui possède les Événements, et rien d'autre. */
@Module({
  controllers: [EventController],
  providers: [EventService, EventRepository],
})
export class CalendarModule {}
