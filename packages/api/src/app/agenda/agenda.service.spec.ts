import { BadRequestException } from '@nestjs/common';
import type {
  AgendaContributor,
  AgendaItem,
  AgendaPeriod,
} from '@personal-os/contracts';
import { AgendaRegistry } from '../agenda-port/agenda.registry';
import { AgendaService } from './agenda.service';

const SEPTEMBRE: AgendaPeriod = {
  from: '2026-09-01T00:00:00.000Z',
  to: '2026-09-30T23:59:59.999Z',
};

/**
 * Un contributeur de test. Qu'il ne soit d'aucun module réel est le sujet :
 * l'Agenda ne connaît aucun domaine, et deux sources inventées ici suffisent
 * à l'exercer.
 */
function contributeur(
  source: string,
  entrees: readonly Partial<AgendaItem>[],
): AgendaContributor & { demandes: AgendaPeriod[] } {
  const demandes: AgendaPeriod[] = [];

  return {
    source,
    demandes,
    lister: async (periode) => {
      demandes.push(periode);
      return entrees.map((entree) => ({
        source,
        sourceId: 'sans-importance',
        title: 'Sans titre',
        startsAt: SEPTEMBRE.from,
        endsAt: null,
        status: 'PLANNED',
        ...entree,
      }));
    },
  };
}

describe('Agenda', () => {
  let registre: AgendaRegistry;
  let agenda: AgendaService;

  beforeEach(() => {
    registre = new AgendaRegistry();
    agenda = new AgendaService(registre);
  });

  it('fusionne les entrées de tous les contributeurs, par date de début', async () => {
    registre.enregistrer(
      contributeur('sport', [
        {
          sourceId: 's-1',
          title: 'Sortie longue',
          startsAt: '2026-09-12T07:00:00.000Z',
        },
      ]),
    );
    registre.enregistrer(
      contributeur('calendar', [
        {
          sourceId: 'e-1',
          title: 'Dentiste',
          startsAt: '2026-09-04T09:30:00.000Z',
        },
        {
          sourceId: 'e-2',
          title: 'Vacances',
          startsAt: '2026-09-20T00:00:00.000Z',
        },
      ]),
    );

    const entrees = await agenda.lister(SEPTEMBRE);

    expect(entrees.map(({ title }) => title)).toEqual([
      'Dentiste',
      'Sortie longue',
      'Vacances',
    ]);
  });

  /*
   * Une source est l'identité d'un module. Deux modules qui la partagent en
   * éclipseraient un — et le front, qui s'en sert pour renvoyer vers le module
   * d'origine, enverrait au mauvais. Mieux vaut refuser au démarrage.
   */
  it('refuse deux contributeurs de la même source', () => {
    registre.enregistrer(contributeur('calendar', []));

    expect(() => registre.enregistrer(contributeur('calendar', []))).toThrow(
      /calendar/,
    );
  });

  describe('La période, toujours donnée', () => {
    it('refuse une demande à qui il manque une borne', async () => {
      await expect(agenda.lister({ from: SEPTEMBRE.from })).rejects.toThrow(
        BadRequestException,
      );
      await expect(agenda.lister({ to: SEPTEMBRE.to })).rejects.toThrow(
        BadRequestException,
      );
    });

    it("refuse une borne qui n'est pas une date ISO-8601", async () => {
      await expect(
        agenda.lister({ from: 'hier', to: SEPTEMBRE.to }),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuse une période qui finit avant de commencer', async () => {
      await expect(
        agenda.lister({ from: SEPTEMBRE.to, to: SEPTEMBRE.from }),
      ).rejects.toThrow(BadRequestException);
    });

    it('passe la période telle quelle à chaque contributeur', async () => {
      const sport = contributeur('sport', []);
      registre.enregistrer(sport);

      await agenda.lister(SEPTEMBRE);

      expect(sport.demandes).toEqual([SEPTEMBRE]);
    });
  });
});
