import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { Scope, Trace } from '@personal-os/contracts';
import { API_BASE_URL } from './api-base-url';
import { Traces } from './traces';

const BASE = 'http://api.test/api';

const ESPACES: Scope[] = [
  { id: 'espace-foyer', kind: 'HOUSEHOLD', label: 'Foyer' },
  { id: 'espace-a', kind: 'PERSONAL', label: 'Personne A' },
];

const TRACES: Trace[] = [
  {
    id: 'trace-1',
    label: 'vacances',
    scopeId: 'espace-foyer',
    createdAt: '2026-08-27T08:00:00.000Z',
  },
];

describe('Traces', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Traces],
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: BASE },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  async function monter() {
    const fixture = TestBed.createComponent(Traces);
    fixture.detectChanges();

    httpMock.expectOne(`${BASE}/espaces`).flush(ESPACES);
    httpMock.expectOne(`${BASE}/traces`).flush(TRACES);

    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  const element = (fixture: { nativeElement: unknown }) =>
    fixture.nativeElement as HTMLElement;

  it("nomme l'Espace de chaque Trace, jamais son seul identifiant", async () => {
    const texte = element(await monter()).textContent ?? '';

    expect(texte).toContain('vacances');
    expect(texte).toContain('Foyer');
  });

  it("offre le choix de l'Espace à la création", async () => {
    const options = element(await monter()).querySelectorAll(
      '[data-test="espace"] option',
    );

    expect([...options].map((option) => option.textContent?.trim())).toEqual([
      'Foyer',
      'Personne A',
    ]);
  });

  it("crée la Trace dans l'Espace choisi, et la fait apparaître", async () => {
    const fixture = await monter();
    const racine = element(fixture);

    const libelle = racine.querySelector(
      '[data-test="libelle"]',
    ) as HTMLInputElement;
    libelle.value = 'courses';
    libelle.dispatchEvent(new Event('input'));

    const espace = racine.querySelector(
      '[data-test="espace"]',
    ) as HTMLSelectElement;
    espace.value = 'espace-a';
    espace.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    (racine.querySelector('[data-test="creer"]') as HTMLButtonElement).click();

    const envoi = httpMock.expectOne(`${BASE}/traces`);
    expect(envoi.request.body).toEqual({
      label: 'courses',
      scopeId: 'espace-a',
    });

    envoi.flush({
      id: 'trace-2',
      label: 'courses',
      scopeId: 'espace-a',
      createdAt: '2026-08-27T09:00:00.000Z',
    });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(element(fixture).textContent).toContain('courses');
  });

  it('retire la Trace supprimée de la liste', async () => {
    const fixture = await monter();

    (
      element(fixture).querySelector(
        '[data-test="supprimer"]',
      ) as HTMLButtonElement
    ).click();

    httpMock.expectOne(`${BASE}/traces/trace-1`).flush(null);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(element(fixture).textContent).not.toContain('vacances');
  });
});
