import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import type { TrainingGoal } from '@personal-os/contracts';
import { API_BASE_URL } from '../api-base-url';
import { INTERCEPTEURS } from '../app.config';
import { Objectifs } from './objectifs';
import { PASSE, SEMI, TRIATHLON } from './objectifs-de-test';

const BASE = 'http://api.test/api';

describe('Objectifs', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'sport/objectifs', component: Objectifs }]),
        provideHttpClient(withInterceptors(INTERCEPTEURS)),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: BASE },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  async function ouvrir(objectifs: TrainingGoal[]) {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/sport/objectifs');
    httpMock.expectOne(`${BASE}/training-goals`).flush(objectifs);
    await harness.fixture.whenStable();
    harness.detectChanges();
    return harness.routeNativeElement as HTMLElement;
  }

  const lignes = (racine: HTMLElement) =>
    Array.from(
      racine.querySelectorAll<HTMLAnchorElement>('[data-test="objectif"]'),
    );

  it('liste chaque Objectif avec son avancement et son échéance, vers son détail', async () => {
    const racine = await ouvrir([SEMI, TRIATHLON, PASSE]);

    const [semi, triathlon, passe] = lignes(racine);
    expect(lignes(racine)).toHaveLength(3);
    expect(semi.textContent).toContain('Semi-marathon de Lyon');
    expect(semi.textContent).toContain('Passer sous 1 h 45');
    expect(semi.getAttribute('href')).toBe('/sport/objectifs/objectif-semi');
    expect(
      semi.querySelector('[data-test="avancement"]')?.textContent,
    ).toContain('3 / 6 faites');
    expect(semi.querySelector('hlm-progress')).not.toBeNull();
    expect(semi.querySelector('[data-test="echeance"]')?.textContent).toContain(
      'Dans',
    );

    expect(triathlon.textContent).toContain('Aucune séance');
    expect(triathlon.querySelector('hlm-progress')).toBeNull();
    expect(
      passe.querySelector('[data-test="echeance"]')?.textContent?.trim(),
    ).toBe('Passé');
  });

  it('invite à créer un premier Objectif quand il n’y en a aucun', async () => {
    const racine = await ouvrir([]);

    expect(lignes(racine)).toHaveLength(0);
    expect(racine.textContent).toContain('Aucun objectif pour l’instant');
    expect(
      racine
        .querySelector('[data-test="nouvel-objectif"]')
        ?.getAttribute('href'),
    ).toBe('/sport/objectifs/nouveau');
  });
});
