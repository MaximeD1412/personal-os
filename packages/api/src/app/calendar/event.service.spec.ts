import type { EventRepository, EventWrite } from './event.repository';
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
    it("refuse une fin antérieure au début", async () => {
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
    it("ne touche que les champs présents dans la saisie", async () => {
      const { repository, ecrit } = depotComplaisant();
      const service = new EventService(repository);

      await service.modifier('event-1', { title: 'Précisé' });

      expect(Object.keys(ecrit())).toEqual(['title']);
    });

    it("refuse une modification qui ne change rien", async () => {
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
          scopeId: 'espace-a',
          createdAt: new Date(DEBUT),
        });
      const service = new EventService(repository);

      await expect(
        service.modifier('event-1', { endsAt: '2026-07-20T00:00:00.000Z' }),
      ).rejects.toMatchObject(REGLE('event.period_reversed'));
    });

    it("ne relit rien quand la modification ne touche aucune borne", async () => {
      const { repository } = depotComplaisant();
      repository.lire = jest.fn();
      const service = new EventService(repository);

      await service.modifier('event-1', { title: 'Précisé' });

      expect(repository.lire).not.toHaveBeenCalled();
    });

    it("laisse retirer un rappel en le nommant vide", async () => {
      const { repository, ecrit } = depotComplaisant();
      const service = new EventService(repository);

      await service.modifier('event-1', { reminderLeadMinutes: null });

      expect(ecrit().reminderLeadMinutes).toBeNull();
    });
  });

  describe("Ce qui remonte du dépôt", () => {
    it('ne transforme pas une panne de base en 404', async () => {
      const panne = new Error('base indisponible');
      const repository = {
        modifier: () => Promise.reject(panne),
      } as unknown as EventRepository;
      const service = new EventService(repository);

      await expect(
        service.modifier('event-1', { title: 'x' }),
      ).rejects.toBe(panne);
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
