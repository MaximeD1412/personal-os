import { Module } from '@nestjs/common';
import { AgendaPortModule } from '../agenda-port/agenda-port.module';
import { TrainingGoalController } from './training-goal.controller';
import { TrainingGoalRepository } from './training-goal.repository';
import { TrainingGoalService } from './training-goal.service';
import { TrainingSessionAgendaContributor } from './training-session-agenda.contributor';
import { TrainingSessionController } from './training-session.controller';
import { TrainingSessionRepository } from './training-session.repository';
import { TrainingSessionService } from './training-session.service';

/**
 * Le Sport : les Séances, prévu et réalisé sur le même objet, et les
 * Objectifs vers lesquels elles mènent (ADR 0022).
 *
 * Il importe le port de l'Agenda pour s'y présenter ; l'Agenda ne sait rien de
 * lui (ADR 0011).
 */
@Module({
  imports: [AgendaPortModule],
  controllers: [TrainingSessionController, TrainingGoalController],
  providers: [
    TrainingSessionService,
    TrainingSessionRepository,
    TrainingSessionAgendaContributor,
    TrainingGoalService,
    TrainingGoalRepository,
  ],
})
export class TrainingModule {}
