import { Module } from '@nestjs/common';
import { AgendaPortModule } from '../agenda-port/agenda-port.module';
import { AgendaController } from './agenda.controller';
import { AgendaService } from './agenda.service';

/**
 * L'Agenda n'importe que le port. Aucun module de domaine ne figure ici, et un
 * test structurel vérifie qu'aucun n'y entrera : c'est à cette condition
 * qu'ajouter une source ne modifie pas l'Agenda (ADR 0011).
 */
@Module({
  imports: [AgendaPortModule],
  controllers: [AgendaController],
  providers: [AgendaService],
})
export class AgendaModule {}
