import { Injectable, Module, type OnModuleInit } from '@nestjs/common';
import type { AgendaContributor, AgendaItem } from '@personal-os/contracts';
import { AgendaPortModule } from '../src/app/agenda-port/agenda-port.module';
import { AgendaRegistry } from '../src/app/agenda-port/agenda.registry';

export const SOURCE_FACTICE = 'source-factice';

/**
 * Ce qu'une source inventée dépose dans l'Agenda. Les dates sont volontairement
 * loin de celles des autres campagnes : la base est partagée par toutes.
 */
export const ENTREE_FACTICE: AgendaItem = {
  source: SOURCE_FACTICE,
  sourceId: 'objet-factice-1',
  title: "Un objet daté d'un module qui n'existe pas",
  startsAt: '2028-03-15T08:00:00.000Z',
  endsAt: null,
  status: 'DONE',
};

/**
 * Un module qui se présente à l'Agenda sans que l'Agenda le connaisse.
 *
 * C'est la preuve du critère d'ADR 0011 : il n'existe que dans la campagne de
 * test, aucun fichier de `src/app/agenda/` ne le nomme, et ses entrées
 * apparaissent quand même. Le jour où le Sport s'enregistrera, il n'aura rien
 * à faire de plus que ce que fait ce module-ci.
 */
@Injectable()
export class ContributeurFactice implements AgendaContributor, OnModuleInit {
  readonly source = SOURCE_FACTICE;

  constructor(private readonly agenda: AgendaRegistry) {}

  onModuleInit(): void {
    this.agenda.enregistrer(this);
  }

  async lister(periode: { from: string; to: string }): Promise<AgendaItem[]> {
    const rencontre =
      ENTREE_FACTICE.startsAt >= periode.from &&
      ENTREE_FACTICE.startsAt <= periode.to;

    return rencontre ? [ENTREE_FACTICE] : [];
  }
}

@Module({
  imports: [AgendaPortModule],
  providers: [ContributeurFactice],
})
export class ModuleFactice {}
