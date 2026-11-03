import type {
  EventExceptionRecord,
  EventRecord,
  EventRepository,
  EventWrite,
} from './event.repository';
import { EventService } from './event.service';

const DEBUT = '2026-09-14T09:30:00.000Z';

/** Un dépôt qui se contente de rendre ce qu'on lui a demandé d'écrire. */
function depotComplaisant(): {
  repository: EventRepository;
  ecrit: () => EventWrite;
} {
  let dernier: EventWrite;

  const repository = {
    creer: (saisie: EventWrite) => {
      dernier = saisie;
      return Promise.resolve({
        id: 'event-1',
        ...saisie,
        createdAt: new Date(DEBUT),
      });
    },
    modifier: (_id: string, saisie: Partial<EventWrite>) => {
      dernier = saisie as EventWrite;
      return Promise.resolve({
        id: 'event-1',
        title: 'inchangé',
        startsAt: new Date(DEBUT),
        endsAt: null,
        category: 'OTHER' as const,
        reminderLeadMinutes: null,
        recurrence: null,
        scopeId: 'espace-a',
        createdAt: new Date(DEBUT),
        ...saisie,
      });
    },
  } as unknown as EventRepository;

  return { repository, ecrit: () => dernier };
}

/** Une règle métier violée : son code, en 422 (ADR 0030). */
const REGLE = (code: string) => ({ code, status: 422 });

const SAISIE_MINIMALE = {
  title: 'Dentiste',
  startsAt: DEBUT,
  category: 'APPOINTMENT' as const,
  scopeId: 'espace-a',
};

describe('EventService', () => {
  describe('La période', () => {
    it('refuse une fin antérieure au début', async () => {
      const { repository } = depotComplaisant();
      const service = new EventService(repository);

      await expect(
        service.creer({
          ...SAISIE_MINIMALE,
          endsAt: '2026-09-14T08:00:00.000Z',
        }),
      ).rejects.toMatchObject(REGLE('event.period_reversed'));
    });

    it('accepte une fin égale au début', async () => {
      const { repository } = depotComplaisant();
      const service = new EventService(repository);

      await expect(
        service.creer({ ...SAISIE_MINIMALE, endsAt: DEBUT }),
      ).resolves.toMatchObject({ endsAt: DEBUT });
    });
  });

  describe('Le rappel, qui est un délai', () => {
    it('accepte un délai entier de minutes', async () => {
      const { repository, ecrit } = depotComplaisant();
      const service = new EventService(repository);

      await service.creer({ ...SAISIE_MINIMALE, reminderLeadMinutes: 1_440 });

      expect(ecrit().reminderLeadMinutes).toBe(1_440);
    });

    it("laisse l'Événement sans rappel quand aucun n'est donné", async () => {
      const { repository, ecrit } = depotComplaisant();
      const service = new EventService(repository);

      await service.creer(SAISIE_MINIMALE);

      expect(ecrit().reminderLeadMinutes).toBeNull();
    });
  });

  describe('La modification', () => {
    it('ne touche que les champs présents dans la saisie', async () => {
      const { repository, ecrit } = depotComplaisant();
      const service = new EventService(repository);

      await service.modifier('event-1', { title: 'Précisé' });

      expect(Object.keys(ecrit())).toEqual(['title']);
    });

    it('refuse une modification qui ne change rien', async () => {
      const { repository } = depotComplaisant();
      const service = new EventService(repository);

      await expect(service.modifier('event-1', {})).rejects.toMatchObject(
        REGLE('event.empty_update'),
      );
    });

    it("juge la période sur l'Événement relu, pas sur la seule saisie", async () => {
      const { repository } = depotComplaisant();
      // Une fin seule ne dit rien : le début est en base, et c'est lui qui
      // rend la période absurde.
      repository.lire = () =>
        Promise.resolve({
          id: 'event-1',
          title: 'Vacances',
          startsAt: new Date('2026-08-01T00:00:00.000Z'),
          endsAt: new Date('2026-08-15T00:00:00.000Z'),
          category: 'OTHER',
          reminderLeadMinutes: null,
          recurrence: null,
          scopeId: 'espace-a',
          createdAt: new Date(DEBUT),
        });
      const service = new EventService(repository);

      await expect(
        service.modifier('event-1', { endsAt: '2026-07-20T00:00:00.000Z' }),
      ).rejects.toMatchObject(REGLE('event.period_reversed'));
    });

    it('ne relit rien quand la modification ne touche aucune borne', async () => {
      const { repository } = depotComplaisant();
      repository.lire = jest.fn();
      const service = new EventService(repository);

      await service.modifier('event-1', { title: 'Précisé' });

      expect(repository.lire).not.toHaveBeenCalled();
    });

    it('laisse retirer un rappel en le nommant vide', async () => {
      const { repository, ecrit } = depotComplaisant();
      const service = new EventService(repository);

      await service.modifier('event-1', { reminderLeadMinutes: null });

      expect(ecrit().reminderLeadMinutes).toBeNull();
    });
  });

  describe('La récurrence', () => {
    it("laisse l'Événement sans règle quand aucune n'est donnée", async () => {
      const { repository, ecrit } = depotComplaisant();
      const service = new EventService(repository);

      await expect(service.creer(SAISIE_MINIMALE)).resolves.toMatchObject({
        recurrence: null,
      });
      expect(ecrit().recurrence).toBeNull();
    });

    it('pose la règle donnée, et la rend', async () => {
      const { repository, ecrit } = depotComplaisant();
      const service = new EventService(repository);
      const chaqueLundi = { freq: 'WEEKLY' as const, interval: 1, count: 10 };

      await expect(
        service.creer({ ...SAISIE_MINIMALE, recurrence: chaqueLundi }),
      ).resolves.toMatchObject({ recurrence: chaqueLundi });
      expect(ecrit().recurrence).toEqual(chaqueLundi);
    });

    it('laisse retirer une règle en la nommant vide', async () => {
      const { repository, ecrit } = depotComplaisant();
      const service = new EventService(repository);

      await service.modifier('event-1', { recurrence: null });

      expect(ecrit()).toEqual({ recurrence: null });
    });
  });

  describe('La lecture, en occurrences', () => {
    const POINT: EventRecord = {
      id: 'event-1',
      title: 'Point du lundi',
      startsAt: new Date('2026-09-14T07:00:00.000Z'),
      endsAt: new Date('2026-09-14T07:30:00.000Z'),
      category: 'OTHER',
      reminderLeadMinutes: 15,
      recurrence: { freq: 'WEEKLY', interval: 1 },
      scopeId: 'espace-a',
      createdAt: new Date(DEBUT),
    };
    const DENTISTE: EventRecord = {
      ...POINT,
      id: 'event-2',
      title: 'Dentiste',
      startsAt: new Date('2026-09-16T08:00:00.000Z'),
      endsAt: null,
      category: 'APPOINTMENT',
      recurrence: null,
    };

    function depotDeLecture(
      evenements: EventRecord[],
      exceptions: EventExceptionRecord[] = [],
    ) {
      const demandees: (readonly string[])[] = [];
      const repository = {
        listerEntre: () => Promise.resolve(evenements),
        exceptionsDe: (ids: readonly string[]) => {
          demandees.push(ids);
          return Promise.resolve(
            exceptions.filter(({ eventId }) => ids.includes(eventId)),
          );
        },
      } as unknown as EventRepository;

      return { repository, demandees };
    }

    const DU_14_AU_27 = {
      from: '2026-09-13T22:00:00.000Z',
      to: '2026-09-27T21:59:59.999Z',
    };

    it('rend chaque occurrence, avec son Événement, son identité et sa série', async () => {
      const { repository } = depotDeLecture([POINT]);
      const service = new EventService(repository);

      await expect(service.lister(DU_14_AU_27)).resolves.toEqual([
        {
          eventId: 'event-1',
          originalStart: '2026-09-14T07:00:00.000Z',
          isRecurring: true,
          title: 'Point du lundi',
          startsAt: '2026-09-14T07:00:00.000Z',
          endsAt: '2026-09-14T07:30:00.000Z',
          category: 'OTHER',
          reminderLeadMinutes: 15,
          recurrence: { freq: 'WEEKLY', interval: 1 },
          scopeId: 'espace-a',
        },
        expect.objectContaining({
          eventId: 'event-1',
          originalStart: '2026-09-21T07:00:00.000Z',
          startsAt: '2026-09-21T07:00:00.000Z',
        }),
      ]);
    });

    it("rend un Événement sans règle en une occurrence qui n'est pas récurrente", async () => {
      const { repository } = depotDeLecture([DENTISTE]);
      const service = new EventService(repository);

      await expect(service.lister(DU_14_AU_27)).resolves.toEqual([
        expect.objectContaining({
          eventId: 'event-2',
          originalStart: '2026-09-16T08:00:00.000Z',
          isRecurring: false,
          recurrence: null,
        }),
      ]);
    });

    it('applique à chaque série ses exceptions, et range le tout par début', async () => {
      const { repository, demandees } = depotDeLecture(
        [POINT, DENTISTE],
        [
          {
            eventId: 'event-1',
            originalStart: new Date('2026-09-14T07:00:00.000Z'),
            kind: 'CANCELLED',
            startsAt: null,
            endsAt: null,
            title: null,
          },
          {
            eventId: 'event-1',
            originalStart: new Date('2026-09-21T07:00:00.000Z'),
            kind: 'MODIFIED',
            startsAt: new Date('2026-09-15T12:00:00.000Z'),
            endsAt: null,
            title: 'Point avancé',
          },
        ],
      );
      const service = new EventService(repository);

      const rendues = await service.lister(DU_14_AU_27);

      expect(
        rendues.map(({ eventId, title, startsAt }) => [
          eventId,
          title,
          startsAt,
        ]),
      ).toEqual([
        ['event-1', 'Point avancé', '2026-09-15T12:00:00.000Z'],
        ['event-2', 'Dentiste', '2026-09-16T08:00:00.000Z'],
      ]);
      expect(demandees).toEqual([['event-1', 'event-2']]);
    });
  });

  describe('Ce qui remonte du dépôt', () => {
    it('ne transforme pas une panne de base en 404', async () => {
      const panne = new Error('base indisponible');
      const repository = {
        modifier: () => Promise.reject(panne),
      } as unknown as EventRepository;
      const service = new EventService(repository);

      await expect(service.modifier('event-1', { title: 'x' })).rejects.toBe(
        panne,
      );
    });

    it('transforme uniquement une absence Prisma en 404', async () => {
      const absence = Object.assign(new Error('not found'), { code: 'P2025' });
      const repository = {
        modifier: () => Promise.reject(absence),
      } as unknown as EventRepository;
      const service = new EventService(repository);

      await expect(
        service.modifier('event-1', { title: 'x' }),
      ).rejects.toMatchObject({ code: 'event.not_found', status: 404 });
    });
  });
});
