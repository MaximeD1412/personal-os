import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  BASE,
  ouvrirLePortfolio,
  page,
  PROJET_ABSENT,
  RELIURE_FR,
  servirLAccueil,
  servirLAutreLangue,
} from '../testing/portfolio';

/**
 * Les métadonnées de chaque page, dans sa langue : `title`, `description`,
 * Open Graph, l'URL canonique et les `hreflang` des versions qui existent.
 */
describe('Les métadonnées du portfolio', () => {
  const origine = document.location.origin;

  afterEach(() => {
    TestBed.inject(HttpTestingController).match(() => true);
    jest.restoreAllMocks();
  });

  it('décrivent l’accueil par sa Présentation, avec ses deux langues', async () => {
    const { harness, http } = await ouvrirLePortfolio('/fr');
    servirLAccueil(http, 'FR', {
      about: page(
        'about',
        'FR',
        'Bonjour',
        '## Qui\n\nJe fabrique des **outils** pour\nles [ateliers](https://exemple.test) & les `<cuisines>`.\n\nSecond paragraphe.',
      ),
    });
    await harness.fixture.whenStable();

    expect(document.title).toBe('Bonjour — Portfolio');
    expect(meta('name', 'description')).toBe(
      'Je fabrique des outils pour les ateliers & les <cuisines>.',
    );
    expect(meta('property', 'og:title')).toBe('Bonjour — Portfolio');
    expect(meta('property', 'og:description')).toBe(
      'Je fabrique des outils pour les ateliers & les <cuisines>.',
    );
    expect(meta('property', 'og:type')).toBe('website');
    expect(meta('property', 'og:site_name')).toBe('Portfolio');
    expect(meta('property', 'og:locale')).toBe('fr_FR');
    expect(meta('property', 'og:locale:alternate')).toBe('en_GB');
    expect(meta('property', 'og:url')).toBe(`${origine}/fr`);
    expect(lien('canonical')).toEqual([`${origine}/fr`]);
    expect(versions()).toEqual({
      fr: `${origine}/fr`,
      en: `${origine}/en`,
      'x-default': `${origine}/`,
    });
    expect(meta('name', 'robots')).toBeNull();
  });

  it('ramènent une Présentation longue à une description courte', async () => {
    const { harness, http } = await ouvrirLePortfolio('/en');
    servirLAccueil(http, 'EN', {
      about: page('about', 'EN', 'Hello', 'word '.repeat(80)),
    });
    await harness.fixture.whenStable();

    const description = meta('name', 'description') ?? '';
    expect(description.length).toBeLessThanOrEqual(160);
    expect(description).toMatch(/^word word .* word…$/);
  });

  it('gardent une description de l’interface quand la Présentation n’est pas publiée', async () => {
    const { harness, http } = await ouvrirLePortfolio('/en');
    servirLAccueil(http, 'EN', {});
    await harness.fixture.whenStable();

    expect(document.title).toBe('Portfolio');
    expect(meta('name', 'description')).toBe(
      'About, experience, skills and projects.',
    );
    expect(meta('property', 'og:locale')).toBe('en_GB');
    expect(meta('property', 'og:locale:alternate')).toBe('fr_FR');
  });

  it('décrivent un Projet par son résumé, et ne lient que les langues où il est publié', async () => {
    const { harness, http } = await ouvrirLePortfolio('/fr/projets/projet-1');
    http.expectOne(`${BASE}/public/FR/projects/projet-1`).flush(RELIURE_FR);
    servirLAccueil(http, 'FR', {});
    await servirLAutreLangue(http, 'EN', 'projet-1', false);
    await harness.fixture.whenStable();

    expect(document.title).toBe('Atelier de reliure — Portfolio');
    expect(meta('name', 'description')).toBe('Relier ses carnets à la main.');
    expect(meta('property', 'og:type')).toBe('article');
    expect(meta('property', 'og:url')).toBe(`${origine}/fr/projets/projet-1`);
    expect(lien('canonical')).toEqual([`${origine}/fr/projets/projet-1`]);
    expect(versions()).toEqual({ fr: `${origine}/fr/projets/projet-1` });
  });

  it('lient l’autre langue d’un Projet qui y est publié aussi', async () => {
    const { harness, http } = await ouvrirLePortfolio('/fr/projets/projet-1');
    http.expectOne(`${BASE}/public/FR/projects/projet-1`).flush(RELIURE_FR);
    servirLAccueil(http, 'FR', {});
    await servirLAutreLangue(http, 'EN', 'projet-1', true);
    await harness.fixture.whenStable();

    expect(versions()).toEqual({
      fr: `${origine}/fr/projets/projet-1`,
      en: `${origine}/en/projets/projet-1`,
    });
  });

  it('retirent de l’index un Projet absent de cette langue', async () => {
    const { harness, http } = await ouvrirLePortfolio('/en/projets/projet-1');
    http
      .expectOne(`${BASE}/public/EN/projects/projet-1`)
      .flush(...PROJET_ABSENT);
    servirLAccueil(http, 'EN', {});
    await harness.fixture.whenStable();

    expect(meta('name', 'robots')).toBe('noindex');
    expect(versions()).toEqual({});
    expect(lien('canonical')).toEqual([]);
  });

  it('se remplacent d’une page à l’autre, sans s’accumuler', async () => {
    const { harness, http, router } = await ouvrirLePortfolio(
      '/en/projets/projet-1',
    );
    http
      .expectOne(`${BASE}/public/EN/projects/projet-1`)
      .flush(...PROJET_ABSENT);
    servirLAccueil(http, 'EN', {});
    await harness.fixture.whenStable();

    await router.navigateByUrl('/en');
    await harness.fixture.whenStable();

    expect(meta('name', 'robots')).toBeNull();
    expect(lien('canonical')).toEqual([`${origine}/en`]);
    expect(Object.keys(versions())).toEqual(['fr', 'en', 'x-default']);
    expect(
      document.head.querySelectorAll('meta[name="description"]'),
    ).toHaveLength(1);
  });
});

function meta(attribut: 'name' | 'property', nom: string): string | null {
  return (
    document.head
      .querySelector(`meta[${attribut}="${nom}"]`)
      ?.getAttribute('content') ?? null
  );
}

function lien(rel: string): string[] {
  return [...document.head.querySelectorAll(`link[rel="${rel}"]`)].map(
    (element) => element.getAttribute('href') ?? '',
  );
}

function versions(): Record<string, string> {
  return Object.fromEntries(
    [...document.head.querySelectorAll('link[rel="alternate"][hreflang]')].map(
      (element) => [
        element.getAttribute('hreflang') ?? '',
        element.getAttribute('href') ?? '',
      ],
    ),
  );
}
