import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  BASE,
  ouvrirLePortfolio,
  PROJET_ABSENT,
  RELIURE_FR,
  servirLAccueil,
} from '../testing/portfolio';

/** La page d'un Projet publié, dans la langue de son URL seulement. */
describe('La page d’un Projet', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).match(() => true);
    jest.restoreAllMocks();
  });

  it('montre le texte publié du Projet', async () => {
    const { harness, http, el } = await ouvrirLePortfolio(
      '/fr/projets/projet-1',
    );
    http.expectOne(`${BASE}/public/FR/projects/projet-1`).flush(RELIURE_FR);
    servirLAccueil(http, 'FR', {});
    await harness.fixture.whenStable();

    const projet = el().querySelector('[data-test="projet"]');
    expect(projet?.querySelector('h1')?.textContent).toContain(
      'Atelier de reliure',
    );
    expect(projet?.querySelector('h2')?.textContent).toBe('Étapes');
    expect(projet?.textContent).toContain('Relier ses carnets à la main.');
    expect(
      el().querySelector('[data-test="publie-le"]')?.textContent,
    ).toContain('Publié le 12 octobre 2026');
    expect(
      el().querySelector('[data-test="retour"]')?.getAttribute('href'),
    ).toBe('/fr#projets');
  });

  it('dit le Projet absent de cette langue, sans montrer celui de l’autre', async () => {
    const { harness, http, el } = await ouvrirLePortfolio(
      '/en/projets/projet-1',
    );
    http
      .expectOne(`${BASE}/public/EN/projects/projet-1`)
      .flush(...PROJET_ABSENT);
    servirLAccueil(http, 'EN', {});
    await harness.fixture.whenStable();

    http.expectNone(`${BASE}/public/FR/projects/projet-1`);
    expect(el().querySelector('[data-test="projet"]')).toBeNull();
    expect(
      el().querySelector('[data-test="projet-absent"]')?.textContent,
    ).toContain('This project is not published in English');
    expect(el().textContent).not.toContain('Atelier de reliure');
  });
});
