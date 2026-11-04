import { Module } from '@nestjs/common';
import { AgendaPortModule } from '../agenda-port/agenda-port.module';
import { TrainingSessionAgendaContributor } from './training-session-agenda.contributor';
import { TrainingSessionController } from './training-session.controller';
import { TrainingSessionRepository } from './training-session.repository';
import { TrainingSessionService } from './training-session.service';

/**
 * Le Sport : les Séances, prévu et réalisé sur le même objet (ADR 0022).
 * L'Objectif arrive avec SPORT-2.
 *
 * Il importe le port de l'Agenda pour s'y présenter ; l'Agenda ne sait rien de
 * lui (ADR 0011).
 */
@Module({
  imports: [AgendaPortModule],
  controllers: [TrainingSessionController],
  providers: [
    TrainingSessionService,
    TrainingSessionRepository,
    TrainingSessionAgendaContributor,
  ],
})
export class TrainingModule {}
