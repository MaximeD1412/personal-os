import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import type { Scope } from '@personal-os/contracts';
import { API_BASE_URL } from './api-base-url';
import { App } from './app';
import { EspaceCourant } from './espace-courant';
import { Redirection } from './redirection';

const BASE = 'http://api.test/api';

const PERSONNEL: Scope = {
  id: 'perso',
  kind: 'PERSONAL',
  label: 'Espace de Personne',
};
const FOYER: Scope = { id: 'foyer', kind: 'HOUSEHOLD', label: 'Foyer' };

@Component({ template: '' })
class Ecran {}

describe('App', () => {
  let httpMock: HttpTestingController;
  let redirection: { vers: jest.Mock };

  beforeEach(async () => {
    redirection = { vers: jest.fn() };

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([
          { path: '', pathMatch: 'full', redirectTo: 'agenda' },
          { path: 'agenda', component: Ecran },
          { path: 'calendrier', component: Ecran },
        ]),
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: BASE },
        { provide: Redirection, useValue: redirection },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  async function monter({
    compte = { email: 'moi@exemple.test', displayName: 'Personne Admise' },
    espaces = [PERSONNEL, FOYER],
    apiJoignable = true,
  }: {
    compte?: { email: string; displayName: string | null } | null;
    espaces?: Scope[];
    apiJoignable?: boolean;
  } = {}) {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const moi = httpMock.expectOne(`${BASE}/auth/me`);
    if (compte) {
      moi.flush(compte);
    } else {
      moi.flush(null, { status: 401, statusText: 'Unauthorized' });
    }

    const sante = httpMock.expectOne(`${BASE}/health`);
    if (apiJoignable) {
      sante.flush({
        status: 'ok',
        database: {
          label: 'Personal OS',
          recordedAt: '2026-08-04T08:30:00.000Z',
        },
      });
    } else {
      sante.error(new ProgressEvent('error'));
    }

    httpMock.expectOne(`${BASE}/espaces`).flush(espaces);

    await fixture.whenStable();
    const racine = fixture.nativeElement as HTMLElement;
    return { fixture, racine };
  }

  const texte = (element: HTMLElement) =>
    element.textContent?.replace(/\s+/g, ' ').trim() ?? '';

  /** La Sidebar de bureau : le Rail et le panneau mobile reprennent les mêmes entrées. */
  const sidebar = (racine: HTMLElement) =>
    racine.querySelector('dccm-sidebar:not([variant=rail])') as HTMLElement;

  const entree = (racine: HTMLElement, libelle: string) =>
    [
      ...sidebar(racine).querySelectorAll<HTMLElement>(
        '[data-slot="nav-item"]',
      ),
    ].find((element) => texte(element).startsWith(libelle)) as HTMLElement;

  const segments = (racine: HTMLElement) => [
    ...racine.querySelectorAll<HTMLElement>(
      'dccm-top-bar [data-slot="toggle-group-item"]',
    ),
  ];

  it("dit que l'API est joignable", async () => {
    const { racine } = await monter();

    expect(
      texte(sidebar(racine).querySelector('[role="status"]') as HTMLElement),
    ).toBe('API joignable');
  });

  it("dit que l'API est injoignable quand la sonde échoue", async () => {
    const { racine } = await monter({ apiJoignable: false });

    expect(
      texte(sidebar(racine).querySelector('[role="status"]') as HTMLElement),
    ).toBe('API injoignable');
  });

  it('nomme le compte que la session désigne', async () => {
    const { racine } = await monter();

    expect(
      texte(racine.querySelector('dccm-top-bar') as HTMLElement),
    ).toContain('Personne Admise');
  });

  it("se rabat sur l'adresse quand Authentik ne rend aucun nom", async () => {
    const { racine } = await monter({
      compte: { email: 'moi@exemple.test', displayName: null },
    });

    expect(
      texte(racine.querySelector('dccm-top-bar') as HTMLElement),
    ).toContain('moi@exemple.test');
  });

  it.each([
    ['Agenda', '/agenda'],
    ['Calendrier', '/calendrier'],
  ])("mène à l'écran %s depuis la coque", async (libelle, chemin) => {
    const { racine } = await monter();

    expect(entree(racine, libelle).getAttribute('href')).toBe(chemin);
  });

  it("annonce « À venir » une entrée dont l'écran n'a pas de route, sans lien", async () => {
    const { fixture, racine } = await monter();
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/agenda');

    const finances = entree(racine, 'Finances');
    expect(texte(finances)).toContain('À venir');
    expect(finances.hasAttribute('href')).toBe(false);
    expect(finances.getAttribute('aria-disabled')).toBe('true');

    finances.click();
    await fixture.whenStable();
    expect(router.url).toBe('/agenda');
  });

  it("n'annonce pas d'Accueil tant que sa route ne fait que rediriger", async () => {
    const { racine } = await monter();

    expect(entree(racine, 'Accueil').hasAttribute('href')).toBe(false);
  });

  it("ne propose que les Espaces que l'API renvoie", async () => {
    const { racine } = await monter({ espaces: [PERSONNEL] });

    expect(segments(racine).map(texte)).toEqual(['Mon espace']);
  });

  it("retient l'Espace pré-choisi pour une création", async () => {
    const { fixture, racine } = await monter();
    const courant = TestBed.inject(EspaceCourant);
    expect(segments(racine).map(texte)).toEqual(['Mon espace', 'Foyer']);
    expect(courant.espace()).toEqual(PERSONNEL);

    segments(racine)[1].click();
    await fixture.whenStable();

    expect(courant.espace()).toEqual(FOYER);
  });

  it('ouvre toute la navigation depuis « Plus »', async () => {
    const { fixture, racine } = await monter();

    (racine.querySelector('[data-test="plus"]') as HTMLButtonElement).click();
    await fixture.whenStable();

    const panneau = document.querySelector(
      '[data-slot="sheet-content"]',
    ) as HTMLElement;
    expect(panneau).not.toBeNull();
    expect(texte(panneau)).toContain('Paramètres');
    expect(texte(panneau)).toContain('Personne Admise');
  });

  it('quitte la session côté serveur avant de quitter la page', async () => {
    const { fixture, racine } = await monter();

    (
      racine.querySelector(
        'dccm-top-bar [data-slot="top-bar-logout"]',
      ) as HTMLButtonElement
    ).click();

    httpMock
      .expectOne(`${BASE}/auth/logout`)
      .flush({ endSessionUrl: 'https://auth.test/end-session/' });

    await fixture.whenStable();

    expect(redirection.vers).toHaveBeenCalledWith(
      'https://auth.test/end-session/',
    );
  });
});
