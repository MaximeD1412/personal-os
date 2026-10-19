import { Injectable } from '@nestjs/common';
import type { EventCategory, Recurrence } from '@personal-os/contracts';
import { DbNull, PrismaService } from '@personal-os/database';
import type { ExceptionDOccurrence } from './recurrence/occurrences';

export interface EventRecord {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date | null;
  category: EventCategory;
  reminderLeadMinutes: number | null;
  recurrence: Recurrence | null;
  scopeId: string;
  createdAt: Date;
}

/** Ce qu'une écriture pose : la saisie du contrat, ses instants devenus des `Date`. */
export interface EventWrite {
  title: string;
  startsAt: Date;
  endsAt: Date | null;
  category: EventCategory;
  reminderLeadMinutes: number | null;
  recurrence: Recurrence | null;
  scopeId: string;
}

/** Une exception, rattachée à l'Événement dont elle vise une occurrence. */
export interface EventExceptionRecord extends ExceptionDOccurrence {
  eventId: string;
}

/** La rangée telle que Prisma la rend : la règle n'y est qu'un JSON. */
type RangeeEvenement = Omit<EventRecord, 'recurrence'> & {
  recurrence: unknown;
};

/**
 * Aucun filtre par Espace n'apparaît ici, et c'est la preuve que le mécanisme
 * central fonctionne : la garde ajoute le sien à toutes ces requêtes.
 * En trouver un à la main signalerait qu'elle a été contournée (ADR 0016).
 */
@Injectable()
export class EventRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Les Événements qui **peuvent** avoir une occurrence dans la période. Le
   * tri fin revient au moteur des occurrences ; la requête n'écarte que ce
   * qui ne peut pas la rencontrer :
   *
   * - un Événement sans règle qui la rencontre lui-même (et non qui y
   *   commence : des vacances entamées en juillet appartiennent bien à
   *   l'agenda du mois d'août) ;
   * - une série commencée avant sa fin, quelle que soit sa règle ;
   * - une série dont une occurrence a été déplacée avant sa fin, au besoin
   *   avant le début de la série elle-même.
   */
  async listerEntre(debut: Date, fin: Date): Promise<EventRecord[]> {
    const rangees = await this.prisma.event.findMany({
      where: {
        OR: [
          {
            startsAt: { lte: fin },
            OR: [
              { endsAt: { gte: debut } },
              { endsAt: null, startsAt: { gte: debut } },
            ],
          },
          { recurrence: { not: DbNull }, startsAt: { lte: fin } },
          {
            exceptions: {
              some: { kind: 'MODIFIED', startsAt: { lte: fin } },
            },
          },
        ],
      },
      orderBy: { startsAt: 'asc' },
    });

    return rangees.map(enEvenement);
  }

  /** Les exceptions des Événements nommés, lues par la garde comme le reste. */
  exceptionsDe(eventIds: readonly string[]): Promise<EventExceptionRecord[]> {
    if (eventIds.length === 0) {
      return Promise.resolve([]);
    }

    return this.prisma.eventException.findMany({
      where: { eventId: { in: [...eventIds] } },
      select: {
        eventId: true,
        originalStart: true,
        kind: true,
        startsAt: true,
        endsAt: true,
        title: true,
      },
    });
  }

  async lire(id: string): Promise<EventRecord | null> {
    const rangee = await this.prisma.event.findUnique({ where: { id } });

    return rangee ? enEvenement(rangee) : null;
  }

  async creer(saisie: EventWrite): Promise<EventRecord> {
    return enEvenement(
      await this.prisma.event.create({
        data: { ...saisie, recurrence: enJson(saisie.recurrence) },
      }),
    );
  }

  async modifier(
    id: string,
    saisie: Partial<EventWrite>,
  ): Promise<EventRecord> {
    return enEvenement(
      await this.prisma.event.update({
        where: { id },
        data: {
          ...saisie,
          recurrence:
            saisie.recurrence === undefined
              ? undefined
              : enJson(saisie.recurrence),
        },
      }),
    );
  }

  async supprimer(id: string): Promise<EventRecord> {
    return enEvenement(await this.prisma.event.delete({ where: { id } }));
  }
}

/**
 * La règle n'arrive en base que par son schéma (`zRecurrence`), validée à
 * l'entrée : la relire n'a pas à la revalider, et la sortie de chaque route
 * passe de toute façon par le sien (ADR 0030).
 */
function enEvenement(rangee: RangeeEvenement): EventRecord {
  return {
    ...rangee,
    recurrence: (rangee.recurrence as Recurrence | null) ?? null,
  };
}

/** Une règle absente s'écrit en NULL SQL, que Prisma ne prend pas d'un `null` nu. */
function enJson(recurrence: Recurrence | null) {
  return recurrence ?? DbNull;
}
