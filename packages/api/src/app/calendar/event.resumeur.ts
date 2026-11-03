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
import { EventRepository } from './event.repository';
import { EventService } from './event.service';

const MINUTE_MS = 60 * 1000;

/**
 * Le délai d'une Échéance qui ne porte pas de rappel : elle se signale dans
 * les sept jours qui la précèdent.
 */
const SANS_RAPPEL_MS = 7 * 24 * 60 * MINUTE_MS;

/**
 * Le Calendrier tel qu'il se résume au tableau de bord (ADR 0011) : chaque
 * occurrence d'Échéance dont le délai de rappel est atteint (ADR 0017), ou,
 * sans rappel, qui tombe dans les sept jours. Une Échéance passée, ou qui
 * n'en est plus une, cesse d'être signalée : rien n'est à cocher.
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
    private readonly depot: EventRepository,
    private readonly registre: SummaryRegistry,
  ) {}

  onModuleInit(): void {
    this.registre.enregistrer(this);
  }

  async resumer(maintenant: Date): Promise<ModuleSummary> {
    // La période s'étend jusqu'à la plus lointaine Échéance qui puisse déjà
    // se signaler : un rappel peut précéder de plus de sept jours.
    const plusLongRappel = (await this.depot.plusLongRappelDEcheance()) ?? 0;
    const horizon = Math.max(SANS_RAPPEL_MS, plusLongRappel * MINUTE_MS);
    const occurrences = await this.evenements.lister({
      from: maintenant.toISOString(),
      to: new Date(maintenant.getTime() + horizon).toISOString(),
    });

    return {
      module: SOURCE_CALENDRIER,
      indicators: [],
      signals: occurrences
        .filter(estEcheance)
        .filter((occurrence) => rappelAtteint(occurrence, maintenant))
        .map(echeance),
    };
  }
}

/**
 * Le rappel est atteint entre l'instant qu'il précède l'occurrence et son
 * début. La période rend aussi ce qui la rencontre déjà commencé : une
 * Échéance dont l'heure est passée n'est plus à venir.
 */
function rappelAtteint(
  { startsAt, reminderLeadMinutes }: EventOccurrence,
  maintenant: Date,
): boolean {
  const debut = Date.parse(startsAt);
  const delai =
    reminderLeadMinutes === null
      ? SANS_RAPPEL_MS
      : reminderLeadMinutes * MINUTE_MS;

  return debut >= maintenant.getTime() && debut - delai <= maintenant.getTime();
}

/**
 * Le lien porte le mois, à Paris, où l'occurrence commence : le Calendrier ne
 * lit qu'un mois à la fois, et c'est dans celui-là que le formulaire la
 * retrouve. Une occurrence de série se désigne en plus par l'instant où la
 * règle la place, qui ne bouge pas quand une exception la déplace.
 */
function echeance(occurrence: EventOccurrence): Signal {
  const { eventId, originalStart, isRecurring, startsAt } = occurrence;
  const jour = aujourdhui(FUSEAU, new Date(startsAt));
  const parametres = new URLSearchParams({ mois: jour.slice(0, 7) });
  if (isRecurring) {
    parametres.set('occurrence', originalStart);
  }

  return {
    kind: 'calendar.deadline_due',
    ref: isRecurring ? `${eventId}@${originalStart}` : eventId,
    label: `Échéance : ${occurrence.title}`,
    dueOn: jour,
    link: `/calendrier/evenements/${eventId}?${parametres.toString()}`,
  };
}
