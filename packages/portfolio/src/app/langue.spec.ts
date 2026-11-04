import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  BASE,
  ouvrirLePortfolio,
  page,
  RELIURE_FR,
  resume,
  servirLAccueil,
} from '../testing/portfolio';

/**
 * La langue du portfolio : à la racine, celle du navigateur (son
 * `Accept-Language`, lu par `navigator.languages`), ou celle choisie la fois
 * d'avant ; puis le sélecteur, toujours visible, qui la change et la retient.
 */
describe('La langue du portfolio', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).match(() => true);
    jest.restoreAllMocks();
  });

  it.each([
    [['en-US', 'en', 'fr'], '/en'],
    [['fr-CA', 'en'], '/fr'],
    [['de-DE', 'fr', 'en'], '/fr'],
    [['de-DE', 'es'], '/en'],
  ])('à la racine, suit les langues du navigateur %j', async (langues, url) => {
    const { router } = await ouvrirLePortfolio('/', { langues });

    expect(router.url).toBe(url);
  });

  it('préfère le choix mémorisé aux langues du navigateur', async () => {
    const { router } = await ouvrirLePortfolio('/', {
      langues: ['en-US'],
      memorise: 'fr',
    });

    expect(router.url).toBe('/fr');
  });

  it('suit le navigateur quand le stockage refuse de servir', async () => {
    const { router } = await ouvrirLePortfolio('/', {
      langues: ['en-GB'],
      stockageIndisponible: true,
    });

    expect(router.url).toBe('/en');
  });

  it('ramène une langue inconnue à la racine', async () => {
    const { router } = await ouvrirLePortfolio('/de/projets/projet-1', {
      langues: ['fr'],
    });

    expect(router.url).toBe('/fr');
  });

  it('change de langue sur la même page, et retient le choix', async () => {
    const { harness, http, router, el } = await ouvrirLePortfolio('/fr', {
      langues: ['fr-FR'],
    });
    servirLAccueil(http, 'FR', {
      about: page('about', 'FR', 'Bonjour'),
      projets: [resume(RELIURE_FR)],
    });
    await harness.fixture.whenStable();

    const selecteur = el().querySelector('[data-test="langue"]');
    expect(selecteur?.getAttribute('aria-label')).toBe('Langue du site');
    await clic(el(), 'en');

    expect(router.url).toBe('/en');
    expect(localStorage.getItem('portfolio.langue')).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    servirLAccueil(http, 'EN', { about: page('about', 'EN', 'Hello') });
    await harness.fixture.whenStable();
    expect(el().textContent).toContain('Hello');
    expect(
      el().querySelector('[data-test="langue"]')?.getAttribute('aria-label'),
    ).toBe('Site language');
  });

  it('garde la page en changeant de langue, même sans pouvoir retenir', async () => {
    const { harness, http, router, el } = await ouvrirLePortfolio(
      '/fr/projets/projet-1',
      { stockageIndisponible: true },
    );
    http.expectOne(`${BASE}/public/FR/projects/projet-1`).flush(RELIURE_FR);
    servirLAccueil(http, 'FR', {});
    await harness.fixture.whenStable();

    await clic(el(), 'en');

    expect(router.url).toBe('/en/projets/projet-1');
  });
});

/** Un clic sur un segment du sélecteur, puis la navigation qu'il lance. */
async function clic(racine: HTMLElement, langue: 'fr' | 'en'): Promise<void> {
  const segment = racine.querySelector<HTMLButtonElement>(
    `[data-test="langue"] [data-langue="${langue}"]`,
  );
  if (!segment) {
    throw new Error(`Le segment ${langue} est introuvable.`);
  }
  segment.click();
  // Les lectures de l'autre langue restent en attente de l'API simulée :
  // `whenStable()` ne rendrait jamais la main.
  await new Promise((suite) => setTimeout(suite));
  TestBed.tick();
}
