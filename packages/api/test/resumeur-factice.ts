import { Injectable, Module, type OnModuleInit } from '@nestjs/common';
import type { ModuleSummary, ResumeurDeModule } from '@personal-os/contracts';
import { DashboardPortModule } from '../src/app/dashboard-port/dashboard-port.module';
import { SummaryRegistry } from '../src/app/dashboard-port/summary.registry';

export const MODULE_FACTICE = 'module-factice';

/**
 * Un module qui se résume au tableau de bord sans que le tableau de bord le
 * connaisse.
 *
 * C'est la preuve du critère d'ADR 0011 : il n'existe que dans la campagne de
 * test, aucun fichier de `src/app/dashboard/` ne le nomme, et son À faire
 * apparaît quand même. Il retient l'instant qu'on lui a demandé : c'est celui
 * de l'horloge du tableau de bord.
 */
@Injectable()
export class ResumeurFactice implements ResumeurDeModule, OnModuleInit {
  readonly module = MODULE_FACTICE;
  readonly instants: Date[] = [];

  constructor(private readonly registre: SummaryRegistry) {}

  onModuleInit(): void {
    this.registre.enregistrer(this);
  }

  async resumer(maintenant: Date): Promise<ModuleSummary> {
    this.instants.push(maintenant);

    return {
      module: MODULE_FACTICE,
      indicators: [{ key: 'objets', label: 'Objets factices', value: 3 }],
      signals: [
        {
          kind: `${MODULE_FACTICE}.situation`,
          ref: 'objet-factice-1',
          label: "Une situation d'un module qui n'existe pas",
          dueOn: '2000-01-01',
          link: '/module-factice/objet-factice-1',
        },
      ],
    };
  }
}

@Module({
  imports: [DashboardPortModule],
  providers: [ResumeurFactice],
})
export class ModuleResumeFactice {}
