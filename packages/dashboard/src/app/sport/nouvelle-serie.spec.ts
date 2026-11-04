import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { valeurAffichee } from '../../testing/hlm-select';
import { API_BASE_URL } from '../api-base-url';
import { INTERCEPTEURS } from '../app.config';
import { NouvelleSerie } from './nouvelle-serie';
import { SEMI } from './objectifs-de-test';
import { PREVUE } from './seances-de-test';

const BASE = 'http://api.test/api';
const SERIE = `${BASE}/training-goals/${SEMI.id}/sessions`;

@Component({ template: '' })
class Ecran {}

describe('NouvelleSerie', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'sport/objectifs/:id', component: Ecran },
          {
            path: 'sport/objectifs/:id/seances/nouvelles',
            component: NouvelleSerie,
          },
        ]),
        provideHttpClient(withInterceptors(INTERCEPTEURS)),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: BASE },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  async function ouvrir(requete = '') {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(
      `/sport/objectifs/${SEMI.id}/seances/nouvelles${requete}`,
    );
    TestBed.tick();
    httpMock.expectOne(`${BASE}/training-goals/${SEMI.id}`).flush(SEMI);
    await stabiliser(harness);
    return { harness, racine: harness.routeNativeElement as HTMLElement };
  }

  async function stabiliser(harness: RouterTestingHarness): Promise<void> {
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  const champ = (racine: HTMLElement, nom: string) =>
    racine.querySelector(`[data-test="${nom}"]`) as HTMLInputElement;

  const jour = (racine: HTMLElement, valeur: string) =>
    racine.querySelector(`[data-jour="${valeur}"]`) as HTMLButtonElement;

  const choisis = (racine: HTMLElement) =>
    Array.from(
      racine.querySelectorAll<HTMLButtonElement>(
        '[data-jour][aria-pressed="true"]',
      ),
    ).map((bouton) => bouton.dataset['jour']);

  function saisir(racine: HTMLElement, nom: string, valeur: string): void {
    const cible = champ(racine, nom);
    cible.value = valeur;
    cible.dispatchEvent(new Event('input'));
  }

  async function envoyer(harness: RouterTestingHarness): Promise<void> {
    const racine = harness.routeNativeElement as HTMLElement;
    (
      racine.querySelector('button[type="submit"]') as HTMLButtonElement
    ).click();
    await stabiliser(harness);
  }

  const creation = (): TestRequest =>
    httpMock.expectOne(({ method, url }) => method === 'POST' && url === SERIE);

  describe('Le lien qui la préremplit', () => {
    it('reprend les jours répétés, la période, l’heure et le prévu, sans rien enregistrer', async () => {
      const { harness, racine } = await ouvrir(
        '?weekdays=TU&weekdays=TH&from=2099-05-01&to=2099-05-31&time=07:15&sport=SWIM&plannedDistanceM=1500',
      );

      expect(choisis(racine)).toEqual(['TU', 'TH']);
      expect(champ(racine, 'du').value).toBe('2099-05-01');
      expect(champ(racine, 'au').value).toBe('2099-05-31');
      expect(champ(racine, 'heure').value).toBe('07:15');
      expect(valeurAffichee(harness.fixture, 'sport')).toBe('Natation');
      expect(champ(racine, 'planned-distance').value).toBe('1,5');
      httpMock.expectNone(SERIE);
    });

    it('finit par défaut au jour de l’Objectif, et signale un jour refusé', async () => {
      const { racine } = await ouvrir('?weekdays=XX&weekdays=SA');

      expect(champ(racine, 'au').value).toBe(SEMI.date);
      expect(choisis(racine)).toEqual(['SA']);
      expect(
        racine.querySelector('[data-test="ignores"]')?.textContent,
      ).toContain('weekdays=XX');
    });
  });

  it('crée la série vers l’Objectif, puis rend son détail', async () => {
    const { harness, racine } = await ouvrir(
      '?weekdays=TH&from=2099-05-01&to=2099-05-31',
    );
    jour(racine, 'TU').click();
    jour(racine, 'SA').click();
    jour(racine, 'SA').click();
    saisir(racine, 'heure', '07:15');
    saisir(racine, 'planned-distance', '8');
    saisir(racine, 'planned-texte', 'Footing');
    await envoyer(harness);

    const requete = creation();
    expect(requete.request.body).toEqual({
      weekdays: ['TU', 'TH'],
      from: '2099-05-01',
      to: '2099-05-31',
      time: '07:15',
      sport: 'RUN',
      plannedDistanceM: 8_000,
      plannedIntent: 'Footing',
    });
    requete.flush([PREVUE, PREVUE], { status: 201, statusText: 'Created' });
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe(`/sport/objectifs/${SEMI.id}`);
  });

  it('refuse d’envoyer un prévu qu’elle ne sait pas lire', async () => {
    const { harness, racine } = await ouvrir('?weekdays=TU&time=07:15');
    saisir(racine, 'planned-distance', 'huit');
    await envoyer(harness);

    httpMock.expectNone(SERIE);
    expect(champ(racine, 'planned-distance').getAttribute('aria-invalid')).toBe(
      'true',
    );
  });

  it('affiche la règle que l’API oppose, telle qu’elle la formule', async () => {
    const { harness, racine } = await ouvrir(
      '?weekdays=TU&time=07:15&plannedDistanceM=8000',
    );
    await envoyer(harness);

    const message =
      'Une série crée au plus 100 Séances : raccourcissez la période ou retirez des jours.';
    creation().flush(
      { status: 422, code: 'training.series_too_long', message },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    await stabiliser(harness);

    expect(racine.textContent).toContain(message);
  });

  it('affiche sous son champ le refus de forme de l’API', async () => {
    const { harness, racine } = await ouvrir(
      '?time=07:15&plannedDistanceM=8000',
    );
    await envoyer(harness);

    creation().flush(
      {
        status: 400,
        code: 'request.invalid',
        message: 'La requête est invalide.',
        fields: [
          {
            path: 'weekdays',
            code: 'too_small',
            message: 'Au moins un jour de la semaine.',
          },
        ],
      },
      { status: 400, statusText: 'Bad Request' },
    );
    await stabiliser(harness);

    expect(racine.textContent).toContain('Au moins un jour de la semaine.');
  });
});
