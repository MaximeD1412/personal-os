import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import {
  periodeDeLaSemaine,
  type TrainingSession,
} from '@personal-os/contracts';
import { API_BASE_URL } from '../api-base-url';
import { INTERCEPTEURS } from '../app.config';
import { MANQUEE, NON_PLANIFIEE, PREVUE, REALISEE } from './seances-de-test';
import { semaineCourante } from './semaine';
import { Sport } from './sport';

const BASE = 'http://api.test/api';

@Component({ template: '' })
class Ecran {}

describe('Sport', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'sport', component: Sport },
          { path: 'sport/seances/nouvelle', component: Ecran },
          { path: 'sport/seances/:id', component: Ecran },
        ]),
        provideHttpClient(withInterceptors(INTERCEPTEURS)),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: BASE },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  const lecture = (): TestRequest =>
    httpMock.expectOne(
      ({ method, url }) =>
        method === 'GET' && url === `${BASE}/training-sessions`,
    );

  async function ouvrir(
    url: string,
    seances: TrainingSession[] = [PREVUE, REALISEE, MANQUEE, NON_PLANIFIEE],
  ) {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    const requete = lecture();
    requete.flush(seances);
    await harness.fixture.whenStable();
    harness.detectChanges();
    return { racine: harness.routeNativeElement as HTMLElement, requete };
  }

  const cartes = (racine: HTMLElement) => [
    ...racine.querySelectorAll<HTMLElement>('[data-test="seance"]'),
  ];
  const carte = (racine: HTMLElement, statut: string, rang = 0) =>
    racine.querySelectorAll<HTMLElement>(`[data-statut="${statut}"]`)[rang];
  const lien = (racine: HTMLElement, nom: string) =>
    racine.querySelector(`[data-test="${nom}"]`)?.getAttribute('href');

  describe('La semaine lue', () => {
    it('est celle du lien, du lundi au dimanche à Paris', async () => {
      const { racine, requete } = await ouvrir('/sport?semaine=2026-10-19');
      const periode = periodeDeLaSemaine('2026-10-19');

      expect(requete.request.params.get('from')).toBe(periode.from);
      expect(requete.request.params.get('to')).toBe(periode.to);
      expect(
        racine.querySelector('[data-test="semaine"]')?.textContent,
      ).toContain('Semaine du 19 au 25 octobre 2026');
    });

    it("est la semaine en cours quand le lien n'en désigne pas une", async () => {
      const { requete } = await ouvrir('/sport?semaine=2026-10-21', []);

      expect(requete.request.params.get('from')).toBe(
        periodeDeLaSemaine(semaineCourante()).from,
      );
    });

    it('se déplace d’une semaine à la fois', async () => {
      const { racine } = await ouvrir('/sport?semaine=2026-10-19');

      expect(lien(racine, 'semaine-precedente')).toBe(
        '/sport?semaine=2026-10-12',
      );
      expect(lien(racine, 'semaine-suivante')).toBe(
        '/sport?semaine=2026-10-26',
      );
    });
  });

  describe('Une Séance de la liste', () => {
    it('se range dans le temps, avec son statut', async () => {
      const { racine } = await ouvrir('/sport?semaine=2026-10-19');

      expect(
        cartes(racine).map((element) =>
          element.querySelector('[data-test="statut"]')?.textContent?.trim(),
        ),
      ).toEqual(['Prévue', 'Réalisée', 'Manquée', 'Réalisée']);
    });

    it('lit l’écart entre le prévu et le réalisé, champ par champ', async () => {
      const { racine } = await ouvrir('/sport?semaine=2026-10-19');
      const mesures = [
        ...carte(racine, 'DONE').querySelectorAll('[data-test="mesure"]'),
      ].map((mesure) => mesure.textContent?.replace(/\s+/g, ' ').trim());

      expect(mesures).toEqual([
        'Distance 11,2 km (+1,2 km) Prévu : 10 km',
        'Durée 1 h 04 (+4 min) Prévu : 1 h 00',
        'Allure 5:43 /km (−17 s) Prévu : 6:00 /km',
      ]);
    });

    it('garde son prévu une fois manquée', async () => {
      const { racine } = await ouvrir('/sport?semaine=2026-10-19');
      const manquee = carte(racine, 'MISSED');

      expect(manquee.textContent).toContain('1,5 km');
      expect(manquee.textContent).toContain('30 min');
      expect(
        manquee.querySelector('[data-test="saisir-le-realise"]'),
      ).toBeNull();
    });

    it('se signale non planifiée quand elle est née réalisée, sans prévu', async () => {
      const { racine } = await ouvrir('/sport?semaine=2026-10-19');

      expect(
        carte(racine, 'DONE', 0).querySelector('[data-test="non-planifiee"]'),
      ).toBeNull();
      expect(
        carte(racine, 'DONE', 1).querySelector('[data-test="non-planifiee"]'),
      ).not.toBeNull();
    });

    it('s’ouvre, et offre de saisir le réalisé tant qu’elle est prévue', async () => {
      const { racine } = await ouvrir('/sport?semaine=2026-10-19');
      const prevue = carte(racine, 'PLANNED');

      expect(lien(prevue, 'titre')).toBe('/sport/seances/seance-prevue');
      expect(lien(prevue, 'saisir-le-realise')).toBe(
        '/sport/seances/seance-prevue',
      );
      expect(
        carte(racine, 'DONE').querySelector('[data-test="saisir-le-realise"]'),
      ).toBeNull();
    });
  });

  it('mène à la saisie d’une séance prévue, ou d’une sortie non planifiée', async () => {
    const { racine } = await ouvrir('/sport?semaine=2026-10-19', []);

    expect(lien(racine, 'nouvelle-seance')).toBe('/sport/seances/nouvelle');
    expect(lien(racine, 'sortie-non-planifiee')).toBe(
      '/sport/seances/nouvelle?status=DONE',
    );
    expect(cartes(racine)).toEqual([]);
  });
});
