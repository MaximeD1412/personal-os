import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { AgendaItem } from '@personal-os/contracts';
import { fenetreDe } from '../testing/largeur';
import { Agenda } from './agenda';
import { API_BASE_URL } from './api-base-url';
import { INTERCEPTEURS } from './app.config';

const BASE = 'http://api.test/api';

/** Mercredi 16 septembre 2026, à Paris : la semaine du 14 au 20. */
const MAINTENANT = new Date('2026-09-16T10:00:00.000Z');

const DENTISTE: AgendaItem = {
  source: 'calendar',
  sourceId: 'event-1',
  title: 'Dentiste',
  startsAt: '2026-09-14T09:30:00.000Z',
  endsAt: null,
  status: 'PLANNED',
};

/** Une source d'un module que le tableau de bord ne connaît pas encore. */
const SEANCE: AgendaItem = {
  source: 'sport',
  sourceId: 'seance-1',
  title: 'Sortie longue 14 km',
  startsAt: '2026-09-15T16:30:00.000Z',
  endsAt: '2026-09-15T17:45:00.000Z',
  status: 'DONE',
};

const VACANCES: AgendaItem = {
  source: 'calendar',
  sourceId: 'event-2',
  title: 'Vacances',
  startsAt: '2026-09-20T00:00:00.000Z',
  endsAt: '2026-09-27T00:00:00.000Z',
  status: 'PLANNED',
};

/** Commencé le jeudi d'avant : l'API la rend, car elle rencontre la semaine. */
const DEMENAGEMENT: AgendaItem = {
  source: 'calendar',
  sourceId: 'event-3',
  title: 'Déménagement',
  startsAt: '2026-09-10T07:00:00.000Z',
  endsAt: '2026-09-17T18:00:00.000Z',
  status: 'PLANNED',
};

describe('Agenda', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    // Seule l'horloge est figée : les minuteries restent réelles, dont
    // `whenStable` a besoin.
    jest.useFakeTimers({
      now: MAINTENANT,
      doNotFake: [
        'nextTick',
        'setImmediate',
        'clearImmediate',
        'setInterval',
        'clearInterval',
        'setTimeout',
        'clearTimeout',
        'queueMicrotask',
        'requestAnimationFrame',
        'cancelAnimationFrame',
        'requestIdleCallback',
        'cancelIdleCallback',
        'performance',
        'hrtime',
      ],
    });
  });

  afterEach(() => {
    httpMock.verify();
    jest.useRealTimers();
  });

  function configurer(largeur: number) {
    TestBed.configureTestingModule({
      imports: [Agenda],
      providers: [
        provideHttpClient(withInterceptors(INTERCEPTEURS)),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_BASE_URL, useValue: BASE },
        fenetreDe(largeur),
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
  }

  async function monter(
    entrees: AgendaItem[] = [DENTISTE, SEANCE, VACANCES],
    largeur = 1280,
  ) {
    configurer(largeur);
    const fixture = TestBed.createComponent(Agenda);
    fixture.detectChanges();
    await servir(fixture, entrees);
    return fixture;
  }

  async function servir(
    fixture: ComponentFixture<Agenda>,
    entrees: AgendaItem[],
  ): Promise<void> {
    await new Promise((fin) => setTimeout(fin));
    TestBed.tick();
    demande().flush(entrees);
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function demande(): TestRequest {
    return httpMock.expectOne(
      ({ url, method }) => url === `${BASE}/agenda` && method === 'GET',
    );
  }

  const racine = (fixture: ComponentFixture<Agenda>) =>
    fixture.nativeElement as HTMLElement;

  const tous = (fixture: ComponentFixture<Agenda>, nom: string) => [
    ...racine(fixture).querySelectorAll<HTMLElement>(`[data-test="${nom}"]`),
  ];

  const un = (fixture: ComponentFixture<Agenda>, nom: string) =>
    racine(fixture).querySelector(`[data-test="${nom}"]`) as HTMLElement;

  async function cliquer(fixture: ComponentFixture<Agenda>, nom: string) {
    un(fixture, nom).click();
    fixture.detectChanges();
    await new Promise((fin) => setTimeout(fin));
    TestBed.tick();
  }

  describe('La semaine affichée', () => {
    it('demande la semaine en cours, du lundi au dimanche à Paris', async () => {
      configurer(1280);
      const fixture = TestBed.createComponent(Agenda);
      fixture.detectChanges();
      await new Promise((fin) => setTimeout(fin));
      TestBed.tick();

      const requete = demande();
      expect(requete.request.params.get('from')).toBe(
        '2026-09-13T22:00:00.000Z',
      );
      expect(requete.request.params.get('to')).toBe('2026-09-20T21:59:59.999Z');
      requete.flush([]);
      await fixture.whenStable();
    });

    it('passe à la semaine suivante, à la précédente, puis revient à aujourd’hui', async () => {
      const fixture = await monter();

      await cliquer(fixture, 'semaine-suivante');
      let requete = demande();
      expect(requete.request.params.get('from')).toBe(
        '2026-09-20T22:00:00.000Z',
      );
      requete.flush([]);
      await fixture.whenStable();
      fixture.detectChanges();
      expect(un(fixture, 'titre-semaine').textContent).toContain(
        '21 au 27 septembre 2026',
      );

      await cliquer(fixture, 'semaine-precedente');
      await cliquer(fixture, 'semaine-precedente');
      requete = httpMock.match(() => true).at(-1) as TestRequest;
      expect(requete.request.params.get('from')).toBe(
        '2026-09-06T22:00:00.000Z',
      );
      requete.flush([]);
      await fixture.whenStable();

      await cliquer(fixture, 'aujourdhui');
      requete = demande();
      expect(requete.request.params.get('from')).toBe(
        '2026-09-13T22:00:00.000Z',
      );
      requete.flush([]);
      await fixture.whenStable();
    });
  });

  describe('À partir de 768 px', () => {
    it('montre sept colonnes, une par jour, avec leur nombre d’entrées', async () => {
      const fixture = await monter();
      const jours = tous(fixture, 'jour');

      expect(jours).toHaveLength(7);
      expect(jours[0].textContent).toContain('lun.');
      expect(jours[0].textContent).toContain('14 sept.');
      expect(jours[0].textContent).toContain('1 entrée');
      expect(jours[2].textContent).toContain('0 entrée');
    });

    it('met en avant le jour courant', async () => {
      const jours = tous(await monter(), 'jour');

      expect(jours.map((jour) => jour.getAttribute('aria-current'))).toEqual([
        null,
        null,
        'date',
        null,
        null,
        null,
        null,
      ]);
    });

    it('range chaque entrée dans le jour où elle commence, à Paris', async () => {
      const jours = tous(await monter(), 'jour');
      const titres = (jour: HTMLElement) =>
        [...jour.querySelectorAll('[data-test="entree"]')].map((entree) =>
          entree.querySelector('h3')?.textContent?.trim(),
        );

      expect(titres(jours[0])).toEqual(['Dentiste']);
      expect(titres(jours[1])).toEqual(['Sortie longue 14 km']);
      expect(titres(jours[6])).toEqual(['Vacances']);
    });

    it('montre le lundi, comme une suite, une entrée commencée avant la semaine', async () => {
      const fixture = await monter([DEMENAGEMENT, DENTISTE]);
      const [lundi] = tous(fixture, 'jour');
      const [demenagement, dentiste] = tous(fixture, 'entree');

      expect(lundi.textContent).toContain('2 entrées');
      expect(demenagement.textContent).toContain('Déménagement');
      expect(demenagement.querySelector('time')?.textContent).toBe(
        'depuis le jeu. 10 sept.',
      );
      expect(dentiste.querySelector('time')?.textContent).toBe('11:30');
    });
  });

  describe('Sous 768 px', () => {
    it('liste les seuls jours qui ont des entrées', async () => {
      const jours = tous(await monter(undefined, 390), 'jour');

      expect(
        jours.map((jour) => jour.querySelector('h2')?.textContent),
      ).toEqual([
        expect.stringContaining('lundi 14 septembre'),
        expect.stringContaining('mardi 15 septembre'),
        expect.stringContaining('dimanche 20 septembre'),
      ]);
    });

    it('ne laisse pas la semaine vide quand sa seule entrée a commencé avant', async () => {
      const fixture = await monter([DEMENAGEMENT], 390);
      const jours = tous(fixture, 'jour');

      expect(jours).toHaveLength(1);
      expect(jours[0].querySelector('h2')?.textContent).toContain(
        'lundi 14 septembre',
      );
      expect(jours[0].textContent).toContain('Déménagement');
    });
  });

  describe('Une entrée', () => {
    it("montre l'heure, le titre et le statut", async () => {
      const [dentiste, seance] = tous(await monter(), 'entree');

      expect(dentiste.textContent).toContain('11:30');
      expect(
        dentiste.querySelector('[data-test="statut"]')?.textContent,
      ).toContain('Prévu');
      expect(
        seance.querySelector('[data-test="statut"]')?.textContent,
      ).toContain('Réalisé');
    });

    it('détaille la période : les heures, ou la fin sur plusieurs jours, rien sans fin', async () => {
      const [dentiste, seance, vacances] = tous(await monter(), 'entree');
      const periode = (entree: HTMLElement) =>
        entree.querySelector('[data-test="periode"]')?.textContent?.trim();

      expect(periode(dentiste)).toBeUndefined();
      expect(periode(seance)).toBe('18:30 – 19:45');
      expect(periode(vacances)).toBe("jusqu'au dim. 27 sept., 02:00");
    });

    it("s'ouvre dans son module, à l'occurrence et au mois où elle commence", async () => {
      const [dentiste] = tous(await monter(), 'entree');
      const lien = dentiste.querySelector('a') as HTMLAnchorElement;

      expect(lien.textContent).toContain('Ouvrir dans Calendrier');
      expect(lien.getAttribute('href')).toBe(
        '/calendrier/evenements/event-1?mois=2026-09&occurrence=2026-09-14T09:30:00.000Z',
      );
    });

    it("s'affiche sans lien quand son module n'a pas d'écran", async () => {
      const [, seance] = tous(await monter(), 'entree');

      expect(seance.querySelector('a')).toBeNull();
      expect(seance.textContent).toContain('sport');
    });

    it("n'offre aucun geste d'écriture", async () => {
      for (const entree of tous(await monter(), 'entree')) {
        expect(entree.querySelector('button')).toBeNull();
        expect(entree.querySelector('input')).toBeNull();
        expect(entree.querySelector('form')).toBeNull();
      }
    });
  });

  describe('La légende et les états', () => {
    it('légende les sources connues', async () => {
      expect(un(await monter(), 'legende').textContent).toContain('Calendrier');
    });

    it('le dit quand la semaine ne porte rien', async () => {
      const fixture = await monter([]);

      expect(
        racine(fixture)
          .querySelector('dccm-state')
          ?.getAttribute('data-status'),
      ).toBe('empty');
      expect(racine(fixture).textContent).toContain(
        'Rien de daté cette semaine',
      );
    });

    it("affiche le message de l'API quand la lecture échoue, et la relance", async () => {
      configurer(1280);
      const fixture = TestBed.createComponent(Agenda);
      fixture.detectChanges();
      await new Promise((fin) => setTimeout(fin));
      TestBed.tick();
      demande().flush(
        {
          status: 500,
          code: 'internal',
          message: "L'Agenda est indisponible.",
        },
        { status: 500, statusText: 'Internal Server Error' },
      );
      await fixture.whenStable();
      fixture.detectChanges();

      expect(racine(fixture).textContent).toContain(
        "L'Agenda est indisponible.",
      );

      const reessayer = [...racine(fixture).querySelectorAll('button')].find(
        (bouton) => bouton.textContent?.includes('Réessayer'),
      ) as HTMLButtonElement;
      reessayer.click();
      await servir(fixture, [DENTISTE]);

      expect(tous(fixture, 'entree')).toHaveLength(1);
    });
  });
});
