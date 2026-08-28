import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { AgendaItem } from '@personal-os/contracts';
import { Agenda } from './agenda';
import { API_BASE_URL } from './api-base-url';

const BASE = 'http://api.test/api';

const DENTISTE: AgendaItem = {
  source: 'calendar',
  sourceId: 'event-1',
  title: 'Dentiste',
  startsAt: '2026-09-14T09:30:00.000Z',
  endsAt: null,
  status: 'PLANNED',
};

const VACANCES: AgendaItem = {
  source: 'calendar',
  sourceId: 'event-2',
  title: 'Vacances',
  startsAt: '2026-09-20T00:00:00.000Z',
  endsAt: '2026-09-27T00:00:00.000Z',
  status: 'PLANNED',
};

/** Une source d'un module que le tableau de bord ne connaît pas encore. */
const SEANCE: AgendaItem = {
  source: 'sport',
  sourceId: 'seance-1',
  title: 'Sortie longue 14 km',
  startsAt: '2026-09-15T07:00:00.000Z',
  endsAt: null,
  status: 'DONE',
};

describe('Agenda', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Agenda],
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_BASE_URL, useValue: BASE },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  async function monter(entrees: AgendaItem[] = [DENTISTE, SEANCE, VACANCES]) {
    const fixture = TestBed.createComponent(Agenda);
    fixture.detectChanges();

    demande().flush(entrees);

    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  function demande(): TestRequest {
    return httpMock.expectOne(
      ({ url, method }) => url === `${BASE}/agenda` && method === 'GET',
    );
  }

  const element = (fixture: { nativeElement: unknown }) =>
    fixture.nativeElement as HTMLElement;

  const entrees = (fixture: { nativeElement: unknown }) => [
    ...element(fixture).querySelectorAll('[data-test="entree"]'),
  ];

  describe('La période demandée', () => {
    it("borne toujours sa demande, et ne l'ouvre jamais", async () => {
      const fixture = TestBed.createComponent(Agenda);
      fixture.detectChanges();

      const requete = demande();
      const from = requete.request.params.get('from');
      const to = requete.request.params.get('to');

      expect(from).not.toBeNull();
      expect(to).not.toBeNull();
      expect(new Date(to as string).getTime()).toBeGreaterThan(
        new Date(from as string).getTime(),
      );

      requete.flush([]);
      await fixture.whenStable();
    });

    it('relit la période quand on la déplace', async () => {
      const fixture = await monter();
      const racine = element(fixture);

      const debut = racine.querySelector(
        '[data-test="du"]',
      ) as HTMLInputElement;
      debut.value = '2027-01-01';
      debut.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      const requete = demande();
      expect(new Date(requete.request.params.get('from') as string)).toEqual(
        new Date('2027-01-01T00:00'),
      );

      requete.flush([]);
      await fixture.whenStable();
      fixture.detectChanges();

      expect(racine.textContent).toContain('Rien');
    });
  });

  describe("Ce que l'Agenda montre", () => {
    it('affiche les entrées de toutes les sources, dans le temps', async () => {
      const fixture = await monter();

      expect(entrees(fixture).map((ligne) => ligne.textContent)).toEqual([
        expect.stringContaining('Dentiste'),
        expect.stringContaining('Sortie longue 14 km'),
        expect.stringContaining('Vacances'),
      ]);
    });

    it("montre la fin d'une entrée qui en a une, et rien sinon", async () => {
      const [dentiste, , vacances] = entrees(await monter());

      expect(dentiste.querySelector('[data-test="fin"]')).toBeNull();
      expect(vacances.querySelector('[data-test="fin"]')).not.toBeNull();
    });

    it('le dit quand la période ne porte rien', async () => {
      expect(element(await monter([])).textContent).toContain('Rien');
    });
  });

  describe("L'Agenda est en lecture seule", () => {
    it("n'offre aucun geste d'écriture sur une entrée", async () => {
      for (const ligne of entrees(await monter())) {
        expect(ligne.querySelector('button')).toBeNull();
        expect(ligne.querySelector('input')).toBeNull();
        expect(ligne.querySelector('form')).toBeNull();
      }
    });

    it("renvoie chaque entrée vers son module d'origine", async () => {
      const [dentiste] = entrees(await monter());
      const lien = dentiste.querySelector('a') as HTMLAnchorElement;

      expect(lien.getAttribute('href')).toBe('/calendrier?evenement=event-1');
    });

    it("affiche sans lien l'entrée d'un module que l'écran ne connaît pas", async () => {
      const [, seance] = entrees(await monter());

      expect(seance.querySelector('a')).toBeNull();
      expect(seance.textContent).toContain('Sortie longue 14 km');
    });
  });
});
