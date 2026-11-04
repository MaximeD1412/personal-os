import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  BASE,
  ouvrirLePortfolio,
  PROJET_ABSENT,
  RELIURE_FR,
  servirLAccueil,
  servirLAutreLangue,
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
    await servirLAutreLangue(http, 'EN', 'projet-1', false);
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

  it('charge la première image du texte tout de suite, les suivantes à l’approche', async () => {
    const { harness, http, el } = await ouvrirLePortfolio(
      '/fr/projets/projet-1',
    );
    http.expectOne(`${BASE}/public/FR/projects/projet-1`).flush({
      ...RELIURE_FR,
      body: '![Le <plan> "cousu"](https://exemple.test/plan.webp)\n\nCoudre.\n\n![Le dos](https://exemple.test/dos.webp)',
    });
    servirLAccueil(http, 'FR', {});
    await servirLAutreLangue(http, 'EN', 'projet-1', false);
    await harness.fixture.whenStable();

    const [premiere, suivante] = el().querySelectorAll(
      '[data-test="projet"] img',
    );
    expect(premiere?.getAttribute('src')).toBe(
      'https://exemple.test/plan.webp',
    );
    expect(premiere?.getAttribute('alt')).toBe('Le <plan> "cousu"');
    expect(premiere?.getAttribute('loading')).toBeNull();
    expect(premiere?.getAttribute('decoding')).toBe('async');
    expect(suivante?.getAttribute('src')).toBe('https://exemple.test/dos.webp');
    expect(suivante?.getAttribute('loading')).toBe('lazy');
    expect(suivante?.getAttribute('decoding')).toBe('async');
  });

  it('garde le texte assaini : ni HTML écrit, ni lien javascript', async () => {
    const { harness, http, el } = await ouvrirLePortfolio(
      '/fr/projets/projet-1',
    );
    http.expectOne(`${BASE}/public/FR/projects/projet-1`).flush({
      ...RELIURE_FR,
      body: '<img src=x onerror=alert(1)>\n\n[piège](javascript:alert(1)) ![x](javascript:alert(2))',
    });
    servirLAccueil(http, 'FR', {});
    await servirLAutreLangue(http, 'EN', 'projet-1', false);
    await harness.fixture.whenStable();

    const projet = el().querySelector('[data-test="projet"]');
    expect(projet?.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(projet?.querySelector('[onerror]')).toBeNull();
    expect(projet?.innerHTML).not.toMatch(/(href|src)="javascript:/);
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
