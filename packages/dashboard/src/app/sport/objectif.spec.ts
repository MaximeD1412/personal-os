import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import type { TrainingGoal, TrainingSession } from '@personal-os/contracts';
import { DccmConfirm } from '@personal-os/ui/dccm';
import { API_BASE_URL } from '../api-base-url';
import { INTERCEPTEURS } from '../app.config';
import { Objectif } from './objectif';
import { SEMI, TRIATHLON } from './objectifs-de-test';
import { MANQUEE, PREVUE, REALISEE } from './seances-de-test';

const BASE = 'http://api.test/api';

@Component({ template: '' })
class Ecran {}

const liee = (seance: TrainingSession): TrainingSession => ({
  ...seance,
  goalId: SEMI.id,
});

describe('Objectif', () => {
  let httpMock: HttpTestingController;
  let confirmation: { confirm: jest.Mock };

  beforeEach(async () => {
    confirmation = { confirm: jest.fn().mockResolvedValue(true) };

    await TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'sport/objectifs', component: Ecran },
          { path: 'sport/objectifs/:id', component: Objectif },
        ]),
        provideHttpClient(withInterceptors(INTERCEPTEURS)),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: BASE },
        { provide: DccmConfirm, useValue: confirmation },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  async function ouvrir(objectif: TrainingGoal, seances: TrainingSession[]) {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(`/sport/objectifs/${objectif.id}`);
    TestBed.tick();
    httpMock.expectOne(`${BASE}/training-goals/${objectif.id}`).flush(objectif);
    httpMock
      .expectOne(`${BASE}/training-goals/${objectif.id}/sessions`)
      .flush(seances);
    await stabiliser(harness);
    return { harness, racine: harness.routeNativeElement as HTMLElement };
  }

  async function stabiliser(harness: RouterTestingHarness): Promise<void> {
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  const texte = (racine: HTMLElement, nom: string) =>
    racine.querySelector(`[data-test="${nom}"]`)?.textContent?.trim();

  it('montre l’avancement : faites, manquées et à venir', async () => {
    const { racine } = await ouvrir(SEMI, []);

    expect(racine.textContent).toContain('Semi-marathon de Lyon');
    expect(texte(racine, 'intention')).toBe('Passer sous 1 h 45');
    expect(texte(racine, 'faites')).toBe('3 / 6 faites');
    expect(texte(racine, 'nombre-faites')).toBe('3');
    expect(texte(racine, 'nombre-manquees')).toBe('1');
    expect(texte(racine, 'nombre-a-venir')).toBe('2');
  });

  it('liste les Séances liées, chacune vers son écran, avec son statut', async () => {
    const { racine } = await ouvrir(SEMI, [
      liee(PREVUE),
      liee(REALISEE),
      liee(MANQUEE),
    ]);

    const seances = Array.from(
      racine.querySelectorAll<HTMLAnchorElement>('[data-test="seance"]'),
    );
    expect(seances).toHaveLength(3);
    expect(seances[0].getAttribute('href')).toBe(
      '/sport/seances/seance-prevue',
    );
    expect(seances[0].textContent).toContain('07:15');
    expect(seances[1].textContent).toContain('Réalisée');
    expect(seances[2].textContent).toContain('Manquée');
  });

  it('propose la série quand aucune Séance n’y mène', async () => {
    const { racine } = await ouvrir(TRIATHLON, []);

    expect(racine.textContent).toContain('Aucune séance vers cet objectif');
    expect(
      racine
        .querySelector('[data-test="creer-la-serie"]')
        ?.getAttribute('href'),
    ).toBe('/sport/objectifs/objectif-triathlon/seances/nouvelles');
  });

  it('se supprime après confirmation, puis rend la liste', async () => {
    const { harness, racine } = await ouvrir(SEMI, []);
    (
      racine.querySelector('[data-test="supprimer"]') as HTMLButtonElement
    ).click();
    await stabiliser(harness);

    expect(confirmation.confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining('Semi-marathon de Lyon'),
        destructive: true,
      }),
    );
    const suppression = httpMock.expectOne(
      ({ method, url }) =>
        method === 'DELETE' && url === `${BASE}/training-goals/${SEMI.id}`,
    );
    suppression.flush(null, { status: 204, statusText: 'No Content' });
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/sport/objectifs');
  });

  it('ne supprime rien quand la confirmation est refusée', async () => {
    confirmation.confirm.mockResolvedValue(null);
    const { harness, racine } = await ouvrir(SEMI, []);
    (
      racine.querySelector('[data-test="supprimer"]') as HTMLButtonElement
    ).click();
    await stabiliser(harness);

    expect(confirmation.confirm).toHaveBeenCalled();
    httpMock.expectNone(`${BASE}/training-goals/${SEMI.id}`);
  });
});
