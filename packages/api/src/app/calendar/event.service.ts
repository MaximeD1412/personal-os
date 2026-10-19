import { Injectable } from '@nestjs/common';
import type {
  Event,
  EventInput,
  EventListQuery,
  EventOccurrence,
  EventUpdate,
} from '@personal-os/contracts';
import { ErreurDEspace } from '@personal-os/database';
import { ErreurMetier, Introuvable } from '../erreurs/erreur-metier';
import {
  EventRepository,
  type EventExceptionRecord,
  type EventRecord,
  type EventWrite,
} from './event.repository';
import { occurrences, type Occurrence } from './recurrence/occurrences';

/**
 * Les saisies arrivent validées par leur schéma (ADR 0030) : il ne reste ici
 * que ce qu'un schéma ne peut pas juger seul. Une période à l'envers, quand
 * l'une de ses bornes est en base ; une modification vide ; un Événement
 * introuvable.
 */
@Injectable()
export class EventService {
  constructor(private readonly repository: EventRepository) {}

  /**
   * Les occurrences de la période, calculées à la lecture depuis la règle et
   * les exceptions de chaque Événement : rien n'est stocké, une règle changée
   * se reflète donc aussitôt. L'Agenda les lit par ici lui aussi.
   */
  async lister(periode: EventListQuery): Promise<EventOccurrence[]> {
    const bornes = { debut: new Date(periode.from), fin: new Date(periode.to) };
    const evenements = await this.repository.listerEntre(
      bornes.debut,
      bornes.fin,
    );
    const exceptions = parEvenement(
      await this.repository.exceptionsDe(evenements.map(({ id }) => id)),
    );

    return evenements
      .flatMap((evenement) =>
        occurrences(evenement, exceptions.get(evenement.id) ?? [], bornes).map(
          (occurrence) => exposerLOccurrence(evenement, occurrence),
        ),
      )
      .sort(
        (gauche, droite) =>
          Date.parse(gauche.startsAt) - Date.parse(droite.startsAt),
      );
  }

  async creer(saisie: EventInput): Promise<Event> {
    const ecriture = enEcriture(saisie);
    verifierLaPeriode(ecriture.startsAt, ecriture.endsAt);

    return exposer(await this.repository.creer(ecriture));
  }

  async modifier(id: string, saisie: EventUpdate): Promise<Event> {
    const changements = enChangements(saisie);

    if (Object.keys(changements).length === 0) {
      throw new ErreurMetier(
        'event.empty_update',
        'La modification ne change rien.',
      );
    }

    await this.verifierLaPeriodeApresCoup(id, changements);

    return exposer(
      await this.introuvableSinon(this.repository.modifier(id, changements)),
    );
  }

  async supprimer(id: string): Promise<void> {
    await this.introuvableSinon(this.repository.supprimer(id));
  }

  /**
   * Une modification qui ne touche qu'une borne de la période ne suffit pas à
   * la juger : l'autre est en base. On relit l'Événement — à travers la garde,
   * donc borné aux Espaces atteignables — plutôt que de laisser passer une fin
   * antérieure au début, que l'Agenda afficherait ensuite à l'envers.
   */
  private async verifierLaPeriodeApresCoup(
    id: string,
    changements: Partial<EventWrite>,
  ): Promise<void> {
    const toucheUneBorne = 'startsAt' in changements || 'endsAt' in changements;

    if (!toucheUneBorne) {
      return;
    }

    const actuel = await this.repository.lire(id);
    if (!actuel) {
      // La rangée est hors de portée ou n'existe pas : c'est la modification
      // elle-même qui répondra « introuvable », comme partout ailleurs.
      return;
    }

    verifierLaPeriode(
      changements.startsAt ?? actuel.startsAt,
      changements.endsAt !== undefined ? changements.endsAt : actuel.endsAt,
    );
  }

  /**
   * Un Événement d'un autre Espace est hors du filtre de la garde : Prisma ne
   * le trouve pas. On répond « introuvable » plutôt qu'« interdit », pour ne
   * pas confirmer son existence à qui aurait deviné son identifiant.
   */
  private async introuvableSinon(
    operation: Promise<EventRecord>,
  ): Promise<EventRecord> {
    try {
      return await operation;
    } catch (erreur) {
      // Un refus de la garde est un défaut ou une intrusion : il doit remonter
      // tel quel. Seule l'absence de rangée devient un « introuvable » ; une
      // panne de base ne doit jamais être déguisée en erreur métier.
      if (erreur instanceof ErreurDEspace) {
        throw erreur;
      }
      if (estAbsencePrisma(erreur)) {
        throw new Introuvable(
          'event.not_found',
          'Aucun Événement de cet identifiant.',
        );
      }
      throw erreur;
    }
  }
}

/** Les instants du contrat deviennent des `Date` au bord du dépôt. */
function enEcriture(saisie: EventInput): EventWrite {
  return {
    title: saisie.title,
    startsAt: new Date(saisie.startsAt),
    endsAt: saisie.endsAt ? new Date(saisie.endsAt) : null,
    category: saisie.category,
    reminderLeadMinutes: saisie.reminderLeadMinutes ?? null,
    recurrence: saisie.recurrence ?? null,
    scopeId: saisie.scopeId,
  };
}

/**
 * Une modification ne porte que ce qu'elle change : un champ absent n'est pas
 * touché, un champ nommé vide (`endsAt`, `reminderLeadMinutes`) est retiré.
 * Une règle nommée vide est retirée : l'Événement n'a plus lieu qu'une fois.
 * L'Espace n'a pas à être répété ; le nommer déplace l'Événement, et la garde
 * le vérifie (ADR 0028).
 */
function enChangements(saisie: EventUpdate): Partial<EventWrite> {
  const changements: Partial<EventWrite> = {};

  if (saisie.title !== undefined) {
    changements.title = saisie.title;
  }
  if (saisie.startsAt !== undefined) {
    changements.startsAt = new Date(saisie.startsAt);
  }
  if (saisie.endsAt !== undefined) {
    changements.endsAt = saisie.endsAt ? new Date(saisie.endsAt) : null;
  }
  if (saisie.category !== undefined) {
    changements.category = saisie.category;
  }
  if (saisie.reminderLeadMinutes !== undefined) {
    changements.reminderLeadMinutes = saisie.reminderLeadMinutes;
  }
  if (saisie.recurrence !== undefined) {
    changements.recurrence = saisie.recurrence;
  }
  if (saisie.scopeId !== undefined) {
    changements.scopeId = saisie.scopeId;
  }

  return changements;
}

function verifierLaPeriode(startsAt: Date, endsAt: Date | null): void {
  if (endsAt && endsAt.getTime() < startsAt.getTime()) {
    throw new ErreurMetier(
      'event.period_reversed',
      "La fin d'un Événement ne précède pas son début.",
    );
  }
}

function estAbsencePrisma(erreur: unknown): boolean {
  return (
    typeof erreur === 'object' &&
    erreur !== null &&
    'code' in erreur &&
    erreur.code === 'P2025'
  );
}

function exposer(evenement: EventRecord): Event {
  return {
    id: evenement.id,
    title: evenement.title,
    startsAt: evenement.startsAt.toISOString(),
    endsAt: evenement.endsAt?.toISOString() ?? null,
    category: evenement.category,
    reminderLeadMinutes: evenement.reminderLeadMinutes,
    recurrence: evenement.recurrence,
    scopeId: evenement.scopeId,
    createdAt: evenement.createdAt.toISOString(),
  };
}

/**
 * Une occurrence porte ce que l'exception a changé (titre, bornes) et, pour
 * le reste, ce qu'est sa série.
 */
function exposerLOccurrence(
  evenement: EventRecord,
  occurrence: Occurrence,
): EventOccurrence {
  return {
    eventId: evenement.id,
    originalStart: occurrence.originalStart.toISOString(),
    isRecurring: evenement.recurrence !== null,
    title: occurrence.title,
    startsAt: occurrence.startsAt.toISOString(),
    endsAt: occurrence.endsAt?.toISOString() ?? null,
    category: evenement.category,
    reminderLeadMinutes: evenement.reminderLeadMinutes,
    recurrence: evenement.recurrence,
    scopeId: evenement.scopeId,
  };
}

function parEvenement(
  exceptions: EventExceptionRecord[],
): Map<string, EventExceptionRecord[]> {
  const parId = new Map<string, EventExceptionRecord[]>();
  for (const exception of exceptions) {
    parId.set(exception.eventId, [
      ...(parId.get(exception.eventId) ?? []),
      exception,
    ]);
  }

  return parId;
}
