import { Injectable, type OnModuleInit } from '@nestjs/common';
import {
  aujourdhui,
  estEcheance,
  FUSEAU,
  SOURCE_CALENDRIER,
  type EventOccurrence,
  type ModuleSummary,
  type ResumeurDeModule,
  type Signal,
} from '@personal-os/contracts';
import { SummaryRegistry } from '../dashboard-port/summary.registry';
import { EventService } from './event.service';

/** L'horizon sur lequel une Échéance se signale. */
const HORIZON_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Le Calendrier tel qu'il se résume au tableau de bord (ADR 0011) : chaque
 * occurrence d'Échéance des sept jours qui viennent. Une Échéance passée, ou
 * qui n'en est plus une, cesse d'être signalée : rien n'est à cocher
 * (ADR 0017).
 *
 * Il lit par le même chemin que `GET /events`, et la garde borne la lecture
 * aux Espaces du Compte (ADR 0028) : l'Échéance personnelle de l'un ne
 * parvient pas à l'autre.
 */
@Injectable()
export class EventResumeur implements ResumeurDeModule, OnModuleInit {
  readonly module = SOURCE_CALENDRIER;

  constructor(
    private readonly evenements: EventService,
    private readonly registre: SummaryRegistry,
  ) {}

  onModuleInit(): void {
    this.registre.enregistrer(this);
  }

  async resumer(maintenant: Date): Promise<ModuleSummary> {
    const occurrences = await this.evenements.lister({
      from: maintenant.toISOString(),
      to: new Date(maintenant.getTime() + HORIZON_MS).toISOString(),
    });

    return {
      module: SOURCE_CALENDRIER,
      indicators: [],
      signals: occurrences
        .filter(estEcheance)
        // La période rend aussi ce qui la rencontre déjà commencé : une
        // Échéance dont l'heure est passée n'est plus à venir.
        .filter(({ startsAt }) => Date.parse(startsAt) >= maintenant.getTime())
        .map(echeance),
    };
  }
}

/**
 * Une occurrence de série se désigne par l'instant où la règle la place, qui
 * ne bouge pas quand une exception la déplace : c'est ce que le formulaire de
 * l'Événement lit pour l'ouvrir.
 */
function echeance(occurrence: EventOccurrence): Signal {
  const { eventId, originalStart, isRecurring } = occurrence;
  const chemin = `/calendrier/evenements/${eventId}`;

  return {
    kind: 'calendar.deadline_due',
    ref: isRecurring ? `${eventId}@${originalStart}` : eventId,
    label: `Échéance : ${occurrence.title}`,
    dueOn: aujourdhui(FUSEAU, new Date(occurrence.startsAt)),
    link: isRecurring
      ? `${chemin}?occurrence=${encodeURIComponent(originalStart)}`
      : chemin,
  };
}
