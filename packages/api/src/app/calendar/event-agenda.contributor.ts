import { Injectable, type OnModuleInit } from '@nestjs/common';
import {
  SOURCE_CALENDRIER,
  type AgendaContributor,
  type AgendaItem,
  type AgendaPeriod,
  type EventOccurrence,
} from '@personal-os/contracts';
import { AgendaRegistry } from '../agenda-port/agenda.registry';
import { EventService } from './event.service';

/**
 * Le Calendrier tel qu'il se présente à l'Agenda — et le premier des cinq
 * modules à objets datés à le faire (ADR 0011).
 *
 * Il pointe vers le registre, jamais l'inverse : l'Agenda n'importe rien
 * d'ici, et n'a rien à apprendre le jour où le Sport ou les Repas planifiés
 * s'y présenteront à leur tour.
 *
 * Il lit par le même chemin que `GET /events` : les occurrences de la
 * période, calculées depuis la règle et les exceptions de chaque Événement.
 * Aucun filtre par Espace n'apparaît : la garde borne les requêtes du dépôt
 * comme partout ailleurs (ADR 0028).
 */
@Injectable()
export class EventAgendaContributor implements AgendaContributor, OnModuleInit {
  readonly source = SOURCE_CALENDRIER;

  constructor(
    private readonly evenements: EventService,
    private readonly agenda: AgendaRegistry,
  ) {}

  onModuleInit(): void {
    this.agenda.enregistrer(this);
  }

  async lister(periode: AgendaPeriod): Promise<AgendaItem[]> {
    const occurrences = await this.evenements.lister(periode);

    return occurrences.map(enEntree);
  }
}

/**
 * L'occurrence, réduite à une référence à son Événement : chaque occurrence
 * d'une série renvoie à la même, puisque c'est elle qu'on ouvre pour la
 * modifier. Ni catégorie, ni délai de rappel, ni Espace, ni règle : l'Agenda
 * affiche des références, pas des objets, et un attribut métier qui passerait
 * ici finirait par en appeler d'autres (ADR 0011).
 *
 * Un Événement n'a pas de statut propre — il n'existe rien qui le déclare
 * réalisé ou manqué —, il est donc toujours prévu.
 */
function enEntree(occurrence: EventOccurrence): AgendaItem {
  return {
    source: SOURCE_CALENDRIER,
    sourceId: occurrence.eventId,
    title: occurrence.title,
    startsAt: occurrence.startsAt,
    endsAt: occurrence.endsAt,
    status: 'PLANNED',
  };
}
