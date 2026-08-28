import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { API_BASE_URL } from './api-base-url';
import { App } from './app';
import { Redirection } from './redirection';

const BASE = 'http://api.test/api';

describe('App', () => {
  let httpMock: HttpTestingController;
  let redirection: { vers: jest.Mock };

  beforeEach(async () => {
    redirection = { vers: jest.fn() };

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: BASE },
        { provide: Redirection, useValue: redirection },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  async function monter(
    compte: { email: string; displayName: string | null } | null = {
      email: 'moi@exemple.test',
      displayName: 'Personne Admise',
    },
  ) {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const moi = httpMock.expectOne(`${BASE}/auth/me`);
    if (compte) {
      moi.flush(compte);
    } else {
      moi.flush(null, { status: 401, statusText: 'Unauthorized' });
    }

    httpMock.expectOne(`${BASE}/health`).flush({
      status: 'ok',
      database: {
        label: 'Personal OS',
        recordedAt: '2026-08-04T08:30:00.000Z',
      },
    });

    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  const texte = (fixture: { nativeElement: unknown }) =>
    (fixture.nativeElement as HTMLElement).textContent ?? '';

  it("affiche le libellé que l'API a lu en base", async () => {
    expect(texte(await monter())).toContain('Personal OS');
  });

  it('nomme le compte que la session désigne', async () => {
    expect(texte(await monter())).toContain('Personne Admise');
  });

  it("se rabat sur l'adresse quand Authentik ne rend aucun nom", async () => {
    const fixture = await monter({
      email: 'moi@exemple.test',
      displayName: null,
    });

    expect(texte(fixture)).toContain('moi@exemple.test');
  });

  it.each([
    ['vers-agenda', '/agenda'],
    ['vers-calendrier', '/calendrier'],
  ])('donne accès à %s depuis la coque', async (marque, chemin) => {
    const lien = ((await monter()).nativeElement as HTMLElement).querySelector(
      `[data-test="${marque}"]`,
    ) as HTMLAnchorElement;

    expect(lien).not.toBeNull();
    expect(lien.getAttribute('href')).toBe(chemin);
  });

  it('quitte la session côté serveur avant de quitter la page', async () => {
    const fixture = await monter();

    const bouton = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-test="deconnexion"]',
    ) as HTMLButtonElement;
    bouton.click();

    httpMock
      .expectOne(`${BASE}/auth/logout`)
      .flush({ endSessionUrl: 'https://auth.test/end-session/' });

    await fixture.whenStable();

    expect(redirection.vers).toHaveBeenCalledWith(
      'https://auth.test/end-session/',
    );
  });
});
