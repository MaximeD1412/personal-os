import { Module } from '@nestjs/common';
import { DashboardPortModule } from '../dashboard-port/dashboard-port.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { Horloge } from './horloge';

/**
 * Le tableau de bord n'importe que son port. Aucun module de domaine ne figure
 * ici, et un test structurel vérifie qu'aucun n'y entrera : c'est à cette
 * condition qu'ajouter un résumeur ne modifie pas le tableau de bord
 * (ADR 0011).
 */
@Module({
  imports: [DashboardPortModule],
  controllers: [DashboardController],
  providers: [DashboardService, Horloge],
})
export class DashboardModule {}
