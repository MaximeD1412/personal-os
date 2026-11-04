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
import type { TrainingGoal } from '@personal-os/contracts';
import { API_BASE_URL } from '../api-base-url';
import { INTERCEPTEURS } from '../app.config';
import { FormulaireDObjectif } from './formulaire-d-objectif';
import { SEMI } from './objectifs-de-test';

const BASE = 'http://api.test/api';

@Component({ template: '' })
class Ecran {}

describe('FormulaireDObjectif', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'sport/objectifs', component: Ecran },
          { path: 'sport/objectifs/nouveau', component: FormulaireDObjectif },
          {
            path: 'sport/objectifs/:id/modifier',
            component: FormulaireDObjectif,
          },
          { path: 'sport/objectifs/:id', component: Ecran },
        ]),
        provideHttpClient(withInterceptors(INTERCEPTEURS)),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: BASE },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  /** Ouvre l'écran ; une modification reçoit d'abord l'Objectif qu'elle lit. */
  async function ouvrir(url: string, lu?: TrainingGoal) {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    if (lu) {
      TestBed.tick();
      httpMock.expectOne(`${BASE}/training-goals/${lu.id}`).flush(lu);
    }
    await stabiliser(harness);
    return { harness, racine: harness.routeNativeElement as HTMLElement };
  }

  async function stabiliser(harness: RouterTestingHarness): Promise<void> {
    await harness.fixture.whenStable();
    harness.detectChanges();
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
    await stabiliser(harness);
  }

  const ecriture = (method: string, url: string): TestRequest =>
    httpMock.expectOne((r) => r.method === method && r.url === url);

  it('se préremplit par son lien, sans rien enregistrer', async () => {
    const { racine } = await ouvrir(
      '/sport/objectifs/nouveau?title=Marathon%20de%20Paris&date=2027-04-11',
    );

    expect(champ(racine, 'titre').value).toBe('Marathon de Paris');
    expect(champ(racine, 'date').value).toBe('2027-04-11');
    expect(champ(racine, 'intention').value).toBe('');
    httpMock.expectNone(`${BASE}/training-goals`);
  });

  it('crée l’Objectif, puis ouvre son détail', async () => {
    const { harness, racine } = await ouvrir('/sport/objectifs/nouveau');
    saisir(racine, 'titre', 'Semi-marathon de Lyon');
    saisir(racine, 'date', '2099-06-07');
    saisir(racine, 'intention', 'Passer sous 1 h 45');
    await envoyer(harness);

    const requete = ecriture('POST', `${BASE}/training-goals`);
    expect(requete.request.body).toEqual({
      title: 'Semi-marathon de Lyon',
      date: '2099-06-07',
      intent: 'Passer sous 1 h 45',
    });
    requete.flush(SEMI, { status: 201, statusText: 'Created' });
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/sport/objectifs/objectif-semi');
  });

  it('modifie l’Objectif lu, et retire l’intention vidée', async () => {
    const { harness, racine } = await ouvrir(
      `/sport/objectifs/${SEMI.id}/modifier`,
      SEMI,
    );

    expect(champ(racine, 'titre').value).toBe('Semi-marathon de Lyon');
    expect(champ(racine, 'date').value).toBe('2099-06-07');
    saisir(racine, 'intention', '');
    await envoyer(harness);

    const requete = ecriture('PATCH', `${BASE}/training-goals/${SEMI.id}`);
    expect(requete.request.body).toEqual({
      title: 'Semi-marathon de Lyon',
      date: '2099-06-07',
      intent: null,
    });
    requete.flush({ ...SEMI, intent: null });
    await harness.fixture.whenStable();
  });

  it('affiche sous son champ le refus de l’API', async () => {
    const { harness, racine } = await ouvrir('/sport/objectifs/nouveau');
    await envoyer(harness);

    ecriture('POST', `${BASE}/training-goals`).flush(
      {
        status: 400,
        code: 'request.invalid',
        message: 'La requête est invalide.',
        fields: [
          {
            path: 'date',
            code: 'invalid_format',
            message: 'Un jour AAAA-MM-JJ.',
          },
        ],
      },
      { status: 400, statusText: 'Bad Request' },
    );
    await stabiliser(harness);

    expect(racine.textContent).toContain('Un jour AAAA-MM-JJ.');
    expect(champ(racine, 'date').getAttribute('aria-invalid')).toBe('true');
  });
});
