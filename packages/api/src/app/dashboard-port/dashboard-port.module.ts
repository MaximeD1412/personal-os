import { Module } from '@nestjs/common';
import { SummaryRegistry } from './summary.registry';

/**
 * Le port du tableau de bord, et rien d'autre : ni contrôleur, ni domaine.
 *
 * Il est importé par le tableau de bord **et** par chaque module qui s'y
 * résume. Les flèches pointent toutes vers lui, et le tableau de bord ignore
 * jusqu'à l'existence des modules qu'il affiche (ADR 0011).
 */
@Module({
  providers: [SummaryRegistry],
  exports: [SummaryRegistry],
})
export class DashboardPortModule {}
