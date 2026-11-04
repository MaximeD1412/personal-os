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
import { NouvelleSeance } from './nouvelle-seance';
import { NON_PLANIFIEE, PREVUE } from './seances-de-test';

const BASE = 'http://api.test/api';

@Component({ template: '' })
class Ecran {}

describe('NouvelleSeance', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'sport', component: Ecran },
          { path: 'sport/seances/nouvelle', component: NouvelleSeance },
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
    await harness.navigateByUrl(`/sport/seances/nouvelle${requete}`);
    await harness.fixture.whenStable();
    harness.detectChanges();
    const racine = harness.routeNativeElement as HTMLElement;
    return { harness, racine };
  }

  const champ = (racine: HTMLElement, nom: string) =>
    racine.querySelector(`[data-test="${nom}"]`) as HTMLInputElement;

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
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  const creation = (): TestRequest =>
    httpMock.expectOne(
      ({ method, url }) =>
        method === 'POST' && url === `${BASE}/training-sessions`,
    );

  describe('Le lien qui la préremplit', () => {
    it('reprend le sport et le prévu, sans rien enregistrer', async () => {
      const { harness, racine } = await ouvrir(
        '?sport=SWIM&plannedDistanceM=1500&plannedDurationS=1800',
      );

      expect(valeurAffichee(harness.fixture, 'sport')).toBe('Natation');
      expect(champ(racine, 'planned-distance').value).toBe('1,5');
      expect(champ(racine, 'planned-duree').value).toBe('30');
      httpMock.expectNone(`${BASE}/training-sessions`);
    });

    it('ouvre une sortie non planifiée sur son réalisé, sans prévu', async () => {
      const { racine } = await ouvrir('?status=DONE&actualDistanceM=5000');

      expect(racine.textContent).toContain('Sortie non planifiée');
      expect(champ(racine, 'actual-distance').value).toBe('5');
      expect(champ(racine, 'planned-distance')).toBeNull();
    });

    it('signale une valeur refusée, sans l’appliquer', async () => {
      const { harness, racine } = await ouvrir('?sport=YOGA');

      expect(
        racine.querySelector('[data-test="ignores"]')?.textContent,
      ).toContain('sport=YOGA');
      expect(valeurAffichee(harness.fixture, 'sport')).toBe('Course à pied');
    });
  });

  it('crée une Séance prévue avec son prévu, puis ouvre sa semaine', async () => {
    const { harness, racine } = await ouvrir(
      '?sport=RUN&plannedDistanceM=10000',
    );
    saisir(racine, 'debut', '2026-10-20T07:15');
    saisir(racine, 'planned-duree', '1:00:00');
    saisir(racine, 'planned-texte', 'Footing');
    await envoyer(harness);

    const requete = creation();
    expect(requete.request.body).toEqual({
      startsAt: new Date('2026-10-20T07:15').toISOString(),
      sport: 'RUN',
      status: 'PLANNED',
      plannedDistanceM: 10_000,
      plannedDurationS: 3_600,
      plannedIntent: 'Footing',
    });
    requete.flush(PREVUE, { status: 201, statusText: 'Created' });
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/sport?semaine=2026-10-19');
  });

  it('crée une sortie non planifiée déjà réalisée, sans le prévu saisi', async () => {
    const { harness, racine } = await ouvrir('?plannedDistanceM=10000');
    saisir(racine, 'debut', '2026-10-24T10:00');
    (
      racine.querySelector('[data-test="statut-realisee"]') as HTMLElement
    ).click();
    await harness.fixture.whenStable();
    harness.detectChanges();
    saisir(racine, 'actual-distance', '32');
    saisir(racine, 'actual-duree', '1:15:00');
    await envoyer(harness);

    const requete = creation();
    expect(requete.request.body).toEqual({
      startsAt: new Date('2026-10-24T10:00').toISOString(),
      sport: 'RUN',
      status: 'DONE',
      actualDistanceM: 32_000,
      actualDurationS: 4_500,
    });
    requete.flush(NON_PLANIFIEE, { status: 201, statusText: 'Created' });
    await harness.fixture.whenStable();
  });

  it('refuse d’envoyer un champ qu’elle ne sait pas lire, ni une séance sans date', async () => {
    const { harness, racine } = await ouvrir();
    saisir(racine, 'planned-distance', 'dix');
    await envoyer(harness);

    httpMock.expectNone(`${BASE}/training-sessions`);
    expect(racine.textContent).toContain('La date et l’heure de la séance.');
    expect(champ(racine, 'planned-distance').getAttribute('aria-invalid')).toBe(
      'true',
    );
  });

  it('affiche sous son champ le refus de l’API', async () => {
    const { harness, racine } = await ouvrir();
    saisir(racine, 'debut', '2026-10-20T07:15');
    await envoyer(harness);

    creation().flush(
      {
        status: 400,
        code: 'request.invalid',
        message: 'La requête est invalide.',
        fields: [
          {
            path: 'plannedDistanceM',
            code: 'custom',
            message: 'Une séance prévue a au moins une valeur prévue.',
          },
        ],
      },
      { status: 400, statusText: 'Bad Request' },
    );
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(racine.textContent).toContain(
      'Une séance prévue a au moins une valeur prévue.',
    );
  });
});
