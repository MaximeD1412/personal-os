import { Injectable } from '@nestjs/common';
import type { ModuleSummary, Todo } from '@personal-os/contracts';
import { SummaryRegistry } from '../dashboard-port/summary.registry';
import { aFaire } from './a-faire';
import { Horloge } from './horloge';

/**
 * Le tableau de bord : les Résumés de module, et les À faire qu'on en tire.
 *
 * Il n'importe aucun domaine et n'en connaît aucun. Ce qu'il sait des modules,
 * il le tient du registre, et rien d'autre (ADR 0011). Il ne stocke rien :
 * chaque lecture redemande aux modules leur état (ADR 0017).
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly registre: SummaryRegistry,
    private readonly horloge: Horloge,
  ) {}

  /** Les résumés de chaque module, dans l'ordre où ils se sont enregistrés. */
  resumes(): Promise<ModuleSummary[]> {
    const maintenant = this.horloge.maintenant();

    return Promise.all(
      this.registre.tous().map((resumeur) => resumeur.resumer(maintenant)),
    );
  }

  async aFaire(): Promise<Todo[]> {
    return aFaire(await this.resumes());
  }
}
