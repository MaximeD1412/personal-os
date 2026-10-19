import {
  CHAMPS_D_ENTREE_D_AGENDA,
  SOURCE_CALENDRIER,
} from '@personal-os/contracts';
import { AgendaRegistry } from '../agenda-port/agenda.registry';
import { EventAgendaContributor } from './event-agenda.contributor';
import type {
  EventExceptionRecord,
  EventRecord,
  EventRepository,
} from './event.repository';
import { EventService } from './event.service';

const DENTISTE: EventRecord = {
  id: 'event-1',
  title: 'Dentiste',
  startsAt: new Date('2026-09-14T09:30:00.000Z'),
  endsAt: null,
  category: 'APPOINTMENT',
  reminderLeadMinutes: 60,
  recurrence: null,
  scopeId: 'espace-a',
  createdAt: new Date('2026-08-27T08:00:00.000Z'),
};

const VACANCES: EventRecord = {
  ...DENTISTE,
  id: 'event-2',
  title: 'Vacances',
  startsAt: new Date('2026-08-01T00:00:00.000Z'),
  endsAt: new Date('2026-08-15T00:00:00.000Z'),
  category: 'OTHER',
  reminderLeadMinutes: null,
};

describe("Le Calendrier, présenté à l'Agenda", () => {
  let registre: AgendaRegistry;
  let bornes: { debut: Date; fin: Date } | null;

  const depot = (
    evenements: EventRecord[],
    exceptions: EventExceptionRecord[],
  ) =>
    ({
      listerEntre: async (debut: Date, fin: Date) => {
        bornes = { debut, fin };
        return evenements;
      },
      exceptionsDe: async () => exceptions,
    }) as unknown as EventRepository;

  const contributeur = (
    evenements: EventRecord[],
    exceptions: EventExceptionRecord[] = [],
  ) =>
    new EventAgendaContributor(
      new EventService(depot(evenements, exceptions)),
      registre,
    );

  beforeEach(() => {
    registre = new AgendaRegistry();
    bornes = null;
  });

  it("s'enregistre lui-même auprès de l'Agenda", () => {
    contributeur([]).onModuleInit();

    expect(registre.tous().map(({ source }) => source)).toEqual([
      SOURCE_CALENDRIER,
    ]);
  });

  it("rend une référence à l'Événement, et rien de ses attributs métier", async () => {
    const [entree] = await contributeur([DENTISTE]).lister({
      from: '2026-09-01T00:00:00.000Z',
      to: '2026-09-30T23:59:59.999Z',
    });

    expect(entree).toEqual({
      source: SOURCE_CALENDRIER,
      sourceId: 'event-1',
      title: 'Dentiste',
      startsAt: '2026-09-14T09:30:00.000Z',
      endsAt: null,
      status: 'PLANNED',
    });
    expect(Object.keys(entree).sort()).toEqual(
      [...CHAMPS_D_ENTREE_D_AGENDA].sort(),
    );
  });

  it("garde la fin d'un Événement qui en a une", async () => {
    const [entree] = await contributeur([VACANCES]).lister({
      from: '2026-08-01T00:00:00.000Z',
      to: '2026-08-31T23:59:59.999Z',
    });

    expect(entree.endsAt).toBe('2026-08-15T00:00:00.000Z');
  });

  it("rend chaque occurrence d'une série, exceptions appliquées, toutes vers l'Événement", async () => {
    const chaqueLundi: EventRecord = {
      ...DENTISTE,
      id: 'event-3',
      title: 'Piscine',
      startsAt: new Date('2026-09-07T16:00:00.000Z'),
      recurrence: { freq: 'WEEKLY', interval: 1 },
    };

    const entrees = await contributeur(
      [chaqueLundi],
      [
        {
          eventId: 'event-3',
          originalStart: new Date('2026-09-21T16:00:00.000Z'),
          kind: 'CANCELLED',
          startsAt: null,
          endsAt: null,
          title: null,
        },
      ],
    ).lister({
      from: '2026-09-13T22:00:00.000Z',
      to: '2026-09-30T21:59:59.999Z',
    });

    expect(
      entrees.map(({ sourceId, startsAt }) => [sourceId, startsAt]),
    ).toEqual([
      ['event-3', '2026-09-14T16:00:00.000Z'],
      ['event-3', '2026-09-28T16:00:00.000Z'],
    ]);
  });

  it('ne demande au dépôt que la période reçue', async () => {
    await contributeur([]).lister({
      from: '2026-09-01T00:00:00.000Z',
      to: '2026-09-30T23:59:59.999Z',
    });

    expect(bornes).toEqual({
      debut: new Date('2026-09-01T00:00:00.000Z'),
      fin: new Date('2026-09-30T23:59:59.999Z'),
    });
  });
});
