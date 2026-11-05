import { ViewportScroller } from '@angular/common';
import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  BASE,
  ouvrirLePortfolio,
  page,
  PAGE_ABSENTE,
  RELIURE_FR,
  resume,
  servirLAccueil,
} from '../testing/portfolio';

/**
 * L'accueil d'une langue : ce que cette langue a publié, et rien d'autre.
 * Une section absente n'est remplacée ni par l'autre langue, ni par un texte
 * de remplissage.
 */
describe('L’accueil du portfolio', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    jest.restoreAllMocks();
  });

  it('montre les pages publiées, les Projets publiés et le CV de la langue', async () => {
    const { harness, http, el } = await ouvrirLePortfolio('/fr');
    servirLAccueil(http, 'FR', {
      about: page('about', 'FR', 'Bonjour', 'Je fabrique des **outils**.'),
      experience: page('experience', 'FR', 'Parcours', '- Atelier'),
      skills: page('skills', 'FR', 'Savoir-faire', 'Angular, NestJS'),
      projets: [resume(RELIURE_FR)],
      cv: true,
    });
    await harness.fixture.whenStable();

    const texte = el().textContent ?? '';
    expect(el().querySelector('[data-test="marque"]')?.textContent).toContain(
      'Portfolio',
    );
    expect(texte).not.toContain('Tableau de bord');
    expect(el().querySelector('h1')?.textContent).toContain('Bonjour');
    expect(el().querySelector('#presentation strong')?.textContent).toBe(
      'outils',
    );
    expect(el().querySelector('#experiences')?.textContent).toContain(
      'Parcours',
    );
    expect(el().querySelector('#competences')?.textContent).toContain(
      'Angular, NestJS',
    );
    const projet = el().querySelector('[data-test="projet"]');
    expect(projet?.textContent).toContain('Atelier de reliure');
    expect(projet?.textContent).toContain('Relier ses carnets à la main.');
    expect(projet?.getAttribute('href')).toBe('/fr/projets/projet-1');
    expect(
      el().querySelector('[data-test="telecharger-cv"]')?.getAttribute('href'),
    ).toBe(`${BASE}/public/cv/FR`);
    expect(liensDeSection(el())).toEqual([
      'Expériences',
      'Compétences',
      'Projets',
      'CV',
    ]);
  });

  it('pose la suite de la page en une fois, sans la décaler au fil des lectures', async () => {
    const { harness, http, el } = await ouvrirLePortfolio('/fr');
    http
      .expectOne(`${BASE}/public/FR/pages/about`)
      .flush(page('about', 'FR', 'Bonjour', 'Je fabrique des outils.'));
    http.expectOne(`${BASE}/public/FR/projects`).flush([resume(RELIURE_FR)]);
    // Les autres lectures restent en vol : on rend sans attendre la stabilité.
    await new Promise(setTimeout);
    TestBed.tick();

    expect(el().querySelector('h1')?.textContent).toContain('Bonjour');
    expect(el().querySelector('#projets')).toBeNull();

    http
      .expectOne(`${BASE}/public/FR/pages/experience`)
      .flush(page('experience', 'FR', 'Parcours', '- Atelier'));
    http.expectOne(`${BASE}/public/FR/pages/skills`).flush(...PAGE_ABSENTE);
    http
      .expectOne((requete) => requete.method === 'HEAD')
      .flush(null, { status: 404, statusText: 'Not Found' });
    await harness.fixture.whenStable();

    expect(liensDeSection(el())).toEqual(['Expériences', 'Projets']);
    expect(el().querySelector('#projets [data-test="projet"]')).not.toBeNull();
  });

  it('défile jusqu’aux Projets d’une URL à fragment une fois la suite posée', async () => {
    const { harness, http } = await ouvrirLePortfolio('/fr#projets', {
      defilement: true,
    });
    const defilements = suivreLesDefilements();
    http
      .expectOne(`${BASE}/public/FR/pages/about`)
      .flush(page('about', 'FR', 'Bonjour'));
    await laisserPasserLeRouteur();

    servirLaSuite(http);
    await harness.fixture.whenStable();

    expect(defilements.at(-1)).toEqual({ ancre: 'projets', cible: true });
  });

  it('défile jusqu’aux Projets demandés pendant que la suite se charge', async () => {
    const { harness, http, el } = await ouvrirLePortfolio('/fr', {
      defilement: true,
    });
    const defilements = suivreLesDefilements();
    http
      .expectOne(`${BASE}/public/FR/pages/about`)
      .flush(page('about', 'FR', 'Bonjour'));
    await laisserPasserLeRouteur();

    el()
      .querySelector<HTMLElement>('[data-test="voir-les-projets"]')
      ?.click();
    await laisserPasserLeRouteur();
    expect(el().querySelector('#projets')).toBeNull();

    servirLaSuite(http);
    await harness.fixture.whenStable();

    expect(defilements.at(-1)).toEqual({ ancre: 'projets', cible: true });
  });

  it('omet ce que la langue n’a pas publié, sans jamais lire l’autre langue', async () => {
    const { harness, http, el } = await ouvrirLePortfolio('/en');
    servirLAccueil(http, 'EN', {
      about: page('about', 'EN', 'Hello'),
      skills: page('skills', 'EN', 'Skills', 'TypeScript'),
    });
    await harness.fixture.whenStable();

    http.expectNone((requete) => requete.url.includes('/public/FR/'));
    http.expectNone((requete) => requete.url.includes('/public/cv/FR'));
    expect(el().querySelector('#experiences')).toBeNull();
    expect(el().querySelector('[data-test="cv"]')).toBeNull();
    expect(
      el().querySelector('[data-test="aucun-projet"]')?.textContent,
    ).toContain('No published project yet.');
    expect(liensDeSection(el())).toEqual(['Skills', 'Projects']);
    expect(el().textContent).not.toContain('Expériences');
  });

  it('affiche le message de l’API quand une lecture échoue', async () => {
    const { harness, http, el } = await ouvrirLePortfolio('/fr');
    http
      .expectOne(`${BASE}/public/FR/pages/about`)
      .flush(
        { status: 500, code: 'internal', message: 'La base ne répond pas.' },
        { status: 500, statusText: 'Internal Server Error' },
      );
    http
      .match((requete) => requete.url.includes('/pages/'))
      .forEach((requete) =>
        requete.flush(page('skills', 'FR', 'Savoir-faire')),
      );
    http.expectOne(`${BASE}/public/FR/projects`).flush([]);
    http
      .expectOne(`${BASE}/public/cv/FR`)
      .flush(null, { status: 404, statusText: 'Not Found' });
    await harness.fixture.whenStable();

    expect(el().querySelector('[role="alert"]')?.textContent).toContain(
      'La base ne répond pas.',
    );
  });

  it('dit que le CV n’a pas pu être vérifié, au lieu de le taire comme absent', async () => {
    const { harness, http, el } = await ouvrirLePortfolio('/fr');
    for (const slug of ['about', 'experience', 'skills'] as const) {
      http
        .expectOne(`${BASE}/public/FR/pages/${slug}`)
        .flush(page(slug, 'FR', slug));
    }
    http.expectOne(`${BASE}/public/FR/projects`).flush([]);
    // Un HEAD n'a pas de corps : la panne n'apporte aucune enveloppe.
    http
      .expectOne(`${BASE}/public/cv/FR`)
      .flush(null, { status: 500, statusText: 'Internal Server Error' });
    await harness.fixture.whenStable();

    const cv = el().querySelector('[data-test="cv"]');
    expect(cv?.querySelector('[role="alert"]')?.textContent).toContain(
      'Le chargement a échoué',
    );
    expect(cv?.textContent).toContain("Le serveur n'a pas répondu.");
    expect(el().querySelector('[data-test="telecharger-cv"]')).toBeNull();
  });
});

/** Chaque défilement vers une ancre, et si sa cible était dans la page. */
function suivreLesDefilements(): { ancre: string; cible: boolean }[] {
  const defilements: { ancre: string; cible: boolean }[] = [];
  jest
    .spyOn(TestBed.inject(ViewportScroller), 'scrollToAnchor')
    .mockImplementation((ancre) => {
      defilements.push({ ancre, cible: document.getElementById(ancre) !== null });
    });
  return defilements;
}

/** Le routeur défile au tour suivant : on rend, sans attendre les lectures. */
async function laisserPasserLeRouteur(): Promise<void> {
  for (let tour = 0; tour < 2; tour++) {
    await new Promise(setTimeout);
    TestBed.tick();
  }
}

/** Ce que l'accueil lit après la Présentation. */
function servirLaSuite(http: HttpTestingController): void {
  http
    .expectOne(`${BASE}/public/FR/pages/experience`)
    .flush(page('experience', 'FR', 'Parcours'));
  http.expectOne(`${BASE}/public/FR/pages/skills`).flush(...PAGE_ABSENTE);
  http.expectOne(`${BASE}/public/FR/projects`).flush([resume(RELIURE_FR)]);
  http
    .expectOne((requete) => requete.method === 'HEAD')
    .flush(null, { status: 404, statusText: 'Not Found' });
}

function liensDeSection(racine: HTMLElement): string[] {
  return [...racine.querySelectorAll('[data-test="section"]')].map(
    (lien) => lien.textContent?.trim() ?? '',
  );
}
