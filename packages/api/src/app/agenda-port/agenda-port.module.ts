import { Module } from '@nestjs/common';
import { AgendaRegistry } from './agenda.registry';

/**
 * Le port de l'Agenda, et rien d'autre : ni contrôleur, ni domaine.
 *
 * Il est importé par l'Agenda **et** par chaque module qui s'y présente. C'est
 * ce qui laisse les flèches pointer toutes dans le même sens — vers le port —
 * et l'Agenda ignorer jusqu'à l'existence de ses contributeurs (ADR 0011).
 */
@Module({
  providers: [AgendaRegistry],
  exports: [AgendaRegistry],
})
export class AgendaPortModule {}
