import { Injectable, type OnModuleInit } from '@nestjs/common';
import {
  SOURCE_CALENDRIER,
  type AgendaContributor,
  type AgendaItem,
  type AgendaPeriod,
} from '@personal-os/contracts';
import { AgendaRegistry } from '../agenda-port/agenda.registry';
import { EventRepository, type EventRecord } from './event.repository';

/**
 * Le Calendrier tel qu'il se présente à l'Agenda — et le premier des cinq
 * modules à objets datés à le faire (ADR 0011).
 *
 * Il pointe vers le registre, jamais l'inverse : l'Agenda n'importe rien
 * d'ici, et n'a rien à apprendre le jour où le Sport ou les Repas planifiés
 * s'y présenteront à leur tour.
 *
 * Aucun filtre par Espace n'apparaît : le contributeur lit par le dépôt
 * ordinaire, et la garde borne ses requêtes comme partout ailleurs (ADR 0028).
 */
@Injectable()
export class EventAgendaContributor implements AgendaContributor, OnModuleInit {
  readonly source = SOURCE_CALENDRIER;

  constructor(
    private readonly repository: EventRepository,
    private readonly agenda: AgendaRegistry,
  ) {}

  onModuleInit(): void {
    this.agenda.enregistrer(this);
  }

  async lister(periode: AgendaPeriod): Promise<AgendaItem[]> {
    const evenements = await this.repository.listerEntre(
      new Date(periode.from),
      new Date(periode.to),
    );

    return evenements.map(enEntree);
  }
}

/**
 * L'Événement, réduit à une référence. Ni catégorie, ni délai de rappel, ni
 * Espace : l'Agenda affiche des références, pas des objets, et un attribut
 * métier qui passerait ici finirait par en appeler d'autres (ADR 0011).
 *
 * Un Événement n'a pas de statut propre — il n'existe rien qui le déclare
 * réalisé ou manqué —, il est donc toujours prévu.
 */
function enEntree(evenement: EventRecord): AgendaItem {
  return {
    source: SOURCE_CALENDRIER,
    sourceId: evenement.id,
    title: evenement.title,
    startsAt: evenement.startsAt.toISOString(),
    endsAt: evenement.endsAt?.toISOString() ?? null,
    status: 'PLANNED',
  };
}
