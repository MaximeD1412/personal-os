import { Injectable, type OnModuleInit } from '@nestjs/common';
import {
  SOURCE_SPORT,
  titreDeSeance,
  type AgendaContributor,
  type AgendaItem,
  type AgendaPeriod,
  type TrainingSession,
} from '@personal-os/contracts';
import { AgendaRegistry } from '../agenda-port/agenda.registry';
import { TrainingSessionService } from './training-session.service';

/**
 * Le Sport tel qu'il se présente à l'Agenda (ADR 0011). Une Séance porte le
 * prévu et le réalisé sur le même objet : l'Agenda n'a jamais à choisir entre
 * deux objets pour le même jour (ADR 0022), et le statut de la Séance est le
 * sien.
 *
 * Il lit par le même chemin que `GET /training-sessions` : la garde borne la
 * lecture à l'Espace personnel du Compte, si bien qu'une Séance n'apparaît que
 * dans l'Agenda de son propriétaire (ADR 0028).
 */
@Injectable()
export class TrainingSessionAgendaContributor
  implements AgendaContributor, OnModuleInit
{
  readonly source = SOURCE_SPORT;

  constructor(
    private readonly seances: TrainingSessionService,
    private readonly agenda: AgendaRegistry,
  ) {}

  onModuleInit(): void {
    this.agenda.enregistrer(this);
  }

  async lister(periode: AgendaPeriod): Promise<AgendaItem[]> {
    return (await this.seances.lister(periode)).map(enEntree);
  }
}

/**
 * La Séance réduite à une référence : ni distance, ni notes, ni allure
 * (ADR 0011). Sa fin est son début plus sa durée, la réalisée quand elle en a
 * une, sinon la prévue.
 */
function enEntree(seance: TrainingSession): AgendaItem {
  const duree = seance.actualDurationS ?? seance.plannedDurationS;

  return {
    source: SOURCE_SPORT,
    sourceId: seance.id,
    title: titreDeSeance(seance),
    startsAt: seance.startsAt,
    endsAt: duree
      ? new Date(Date.parse(seance.startsAt) + duree * 1000).toISOString()
      : null,
    status: seance.status,
  };
}
