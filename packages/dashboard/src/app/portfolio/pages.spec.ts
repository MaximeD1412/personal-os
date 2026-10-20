import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { PageContent, PageSlug } from '@personal-os/contracts';
import {
  BASE,
  ouvrirLePortfolio,
  PRESENTATION_EN_LIGNE,
} from '../../testing/portfolio';

const PAGES = `${BASE}/page-contents`;

/** Le texte d'un élément, espaces normalisés (y compris les insécables). */
function texte(el: Element | null | undefined): string {
  return el?.textContent?.replace(/[\s\u00a0\u202f]+/g, ' ').trim() ?? '';
}

function colonne(el: HTMLElement, slug: PageSlug, lang: 'FR' | 'EN') {
  return el.querySelector(
    `[data-test="page"][data-slug="${slug}"][data-lang="${lang}"]`,
  ) as HTMLElement;
}

function partie(el: Element, nom: string): HTMLElement | null {
  return el.querySelector(`[data-test="${nom}"]`);
}

function cliquer(el: Element, nom: string): void {
  (partie(el, nom) as HTMLButtonElement).click();
}

function saisir(el: Element, nom: string, valeur: string): void {
  const champ = partie(el, nom) as HTMLInputElement | HTMLTextAreaElement;
  champ.value = valeur;
  champ.dispatchEvent(new Event('input'));
}

async function ouvrir(
  url: string,
  pages: PageContent[],
  options?: { confirme?: boolean },
) {
  const ouvert = await ouvrirLePortfolio(url, options);
  ouvert.http.expectOne(PAGES).flush(pages);
  await ouvert.harness.fixture.whenStable();
  return ouvert;
}

describe('Les Pages de contenu du portfolio', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('montre les trois pages, chacune dans ses deux langues avec son État de publication', async () => {
    const { el } = await ouvrir('/portfolio/pages', [PRESENTATION_EN_LIGNE]);

    expect(
      [...el().querySelectorAll('[data-test="page-de-contenu"] h2')].map(texte),
    ).toEqual(['1. Présentation', '2. Expériences', '3. Compétences']);
    expect(el().querySelectorAll('[data-test="page"]')).toHaveLength(6);

    const fr = colonne(el(), 'about', 'FR');
    expect(texte(partie(fr, 'etat'))).toBe('Publiée');
    expect((partie(fr, 'titre') as HTMLInputElement).value).toBe('Qui je suis');
    expect(partie(fr, 'avertissement')).not.toBeNull();
    expect(partie(fr, 'depublier')).not.toBeNull();
    expect(partie(fr, 'publier')).toBeNull();

    const en = colonne(el(), 'about', 'EN');
    expect(texte(partie(en, 'etat'))).toBe('Non publiée');
    expect((partie(en, 'titre') as HTMLInputElement).value).toBe('');
    expect(partie(en, 'marquer-prete')).toBeNull();
    // Rien à enregistrer tant qu'aucun champ n'est rempli.
    expect((partie(en, 'enregistrer') as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('enregistre un texte sans le publier, puis le marque prêt', async () => {
    const { harness, http, el, confirmations } = await ouvrir(
      '/portfolio/pages',
      [],
    );
    const en = colonne(el(), 'skills', 'EN');

    saisir(en, 'titre', 'Skills');
    saisir(en, 'texte', '- Java\n- Angular');
    await harness.fixture.whenStable();
    cliquer(en, 'enregistrer');

    const redaction = http.expectOne(`${PAGES}/skills/EN`);
    expect(redaction.request.method).toBe('PUT');
    expect(redaction.request.body).toEqual({
      title: 'Skills',
      body: '- Java\n- Angular',
    });
    const ecrite: PageContent = {
      id: 'page-skills-en',
      slug: 'skills',
      lang: 'EN',
      title: 'Skills',
      body: '- Java\n- Angular',
      publicationState: 'UNPUBLISHED',
      updatedAt: '2026-10-21T08:00:00.000Z',
    };
    redaction.flush(ecrite);
    await harness.fixture.whenStable();

    expect(partie(en, 'publier')).toBeNull();
    cliquer(en, 'marquer-prete');
    await harness.fixture.whenStable();

    expect(confirmations.map(({ title }) => title)).toEqual([
      'Marquer la page Compétences en anglais prête à publier ?',
    ]);
    const prete = http.expectOne(`${PAGES}/skills/EN/ready`);
    expect(prete.request.method).toBe('POST');
    prete.flush({ ...ecrite, publicationState: 'READY' });
    await harness.fixture.whenStable();

    expect(texte(partie(en, 'etat'))).toBe('Prête à publier');
    expect(partie(en, 'publier')).not.toBeNull();
    // L'autre langue de la page n'a pas bougé.
    expect(texte(partie(colonne(el(), 'skills', 'FR'), 'etat'))).toBe(
      'Non publiée',
    );
  });

  it('confirme la publication d’une langue avant de la demander', async () => {
    const { harness, http, el, confirmations } = await ouvrir(
      '/portfolio/pages',
      [{ ...PRESENTATION_EN_LIGNE, publicationState: 'READY' }],
    );

    cliquer(colonne(el(), 'about', 'FR'), 'publier');
    await harness.fixture.whenStable();

    expect(confirmations.map(({ title }) => title)).toEqual([
      'Publier la page Présentation en français ?',
    ]);
    http.expectOne(`${PAGES}/about/FR/publish`).flush(PRESENTATION_EN_LIGNE);
    await harness.fixture.whenStable();

    expect(texte(partie(colonne(el(), 'about', 'FR'), 'etat'))).toBe('Publiée');
  });

  it('ne dépublie rien sans confirmation', async () => {
    const { harness, el, confirmations } = await ouvrir(
      '/portfolio/pages',
      [PRESENTATION_EN_LIGNE],
      { confirme: false },
    );

    cliquer(colonne(el(), 'about', 'FR'), 'depublier');
    await harness.fixture.whenStable();

    // Aucune requête ne part : `verify()` le vérifie après le test.
    expect(confirmations[0]).toMatchObject({
      title: 'Dépublier la page Présentation en français ?',
      destructive: true,
    });
  });

  it('ne propose aucune transition tant que le texte modifié n’est pas enregistré', async () => {
    const { harness, http, el } = await ouvrir('/portfolio/pages', [
      PRESENTATION_EN_LIGNE,
    ]);
    const fr = colonne(el(), 'about', 'FR');

    saisir(fr, 'texte', 'Un texte relu.');
    await harness.fixture.whenStable();
    expect(partie(fr, 'depublier')).toBeNull();
    expect(partie(fr, 'a-enregistrer')).not.toBeNull();

    cliquer(fr, 'enregistrer');
    http.expectOne(`${PAGES}/about/FR`).flush({
      ...PRESENTATION_EN_LIGNE,
      body: 'Un texte relu.',
      publicationState: 'READY',
    } satisfies PageContent);
    await harness.fixture.whenStable();

    // Le texte publié qu'on modifie quitte le portfolio : il attend « Publier ».
    expect(texte(partie(fr, 'etat'))).toBe('Prête à publier');
    expect(partie(fr, 'publier')).not.toBeNull();
  });

  it('montre l’aperçu du rendu, texte saisi compris', async () => {
    const { harness, el } = await ouvrir('/portfolio/pages', [
      PRESENTATION_EN_LIGNE,
    ]);
    const fr = colonne(el(), 'about', 'FR');
    expect(partie(fr, 'apercu')).toBeNull();

    saisir(
      fr,
      'texte',
      '## Parcours\n\nUn texte **Relu**.\n\n<script>alert(1)</script>',
    );
    await harness.fixture.whenStable();
    cliquer(fr, 'vue-apercu');
    await harness.fixture.whenStable();

    const apercu = partie(fr, 'apercu');
    expect(texte(apercu?.querySelector('h2'))).toBe('Parcours');
    expect(texte(apercu?.querySelector('strong'))).toBe('Relu');
    expect(apercu?.querySelector('script')).toBeNull();
    expect(partie(fr, 'texte')?.classList).toContain('hidden');

    // Une langue vide le dit, plutôt qu'un cadre vide.
    const en = colonne(el(), 'about', 'EN');
    cliquer(en, 'vue-apercu');
    await harness.fixture.whenStable();
    expect(partie(en, 'apercu-vide')).not.toBeNull();

    cliquer(fr, 'vue-texte');
    await harness.fixture.whenStable();
    expect(partie(fr, 'apercu')).toBeNull();
    expect(partie(fr, 'texte')?.classList).not.toContain('hidden');
  });

  it('montre le refus de l’API sur le champ visé, ou dans la colonne', async () => {
    const { harness, http, el } = await ouvrir('/portfolio/pages', [
      { ...PRESENTATION_EN_LIGNE, publicationState: 'READY' },
    ]);
    const fr = colonne(el(), 'about', 'FR');

    saisir(fr, 'titre', ' ');
    await harness.fixture.whenStable();
    cliquer(fr, 'enregistrer');
    http.expectOne(`${PAGES}/about/FR`).flush(
      {
        status: 400,
        code: 'request.invalid',
        message: 'La requête est invalide.',
        fields: [
          { path: 'title', code: 'too_small', message: 'Le titre est requis.' },
        ],
      },
      { status: 400, statusText: 'Bad Request' },
    );
    await harness.fixture.whenStable();
    expect(texte(fr.querySelector('hlm-field-error'))).toBe(
      'Le titre est requis.',
    );

    saisir(fr, 'titre', 'Qui je suis');
    await harness.fixture.whenStable();
    cliquer(fr, 'publier');
    await harness.fixture.whenStable();
    http.expectOne(`${PAGES}/about/FR/publish`).flush(
      {
        status: 422,
        code: 'portfolio.not_ready',
        message: 'Seule une page prête à publier peut être publiée.',
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    await harness.fixture.whenStable();
    expect(texte(partie(fr, 'refus'))).toBe(
      'Seule une page prête à publier peut être publiée.',
    );
  });

  it('se préremplit depuis son lien, pour la page et la langue visées, sans rien enregistrer', async () => {
    const { el } = await ouvrir(
      '/portfolio/pages?slug=skills&lang=EN&title=Skills&body=-%20Java&couleur=violet',
      [PRESENTATION_EN_LIGNE],
    );

    const en = colonne(el(), 'skills', 'EN');
    expect((partie(en, 'titre') as HTMLInputElement).value).toBe('Skills');
    expect((partie(en, 'texte') as HTMLTextAreaElement).value).toBe('- Java');
    expect(partie(en, 'a-enregistrer')).not.toBeNull();
    expect(
      (partie(colonne(el(), 'skills', 'FR'), 'titre') as HTMLInputElement)
        .value,
    ).toBe('');
    expect(
      (partie(colonne(el(), 'about', 'FR'), 'titre') as HTMLInputElement).value,
    ).toBe('Qui je suis');
    expect(partie(el(), 'ignores')).toBeNull();
    // Sur mobile, la langue du lien est celle qu'on voit pour sa page.
    expect(colonne(el(), 'skills', 'FR').parentElement?.className).toContain(
      'max-lg:hidden',
    );
    expect(colonne(el(), 'about', 'EN').parentElement?.className).toContain(
      'max-lg:hidden',
    );
  });

  it('signale une page ou une langue du lien qu’il ne connaît pas', async () => {
    const { el } = await ouvrir('/portfolio/pages?slug=contact&lang=DE', []);

    expect(texte(partie(el(), 'ignores'))).toContain('slug=contact, lang=DE');
  });

  it('montre une langue à la fois sur mobile, page par page', async () => {
    const { harness, el } = await ouvrir('/portfolio/pages', []);
    const page = el().querySelector(
      '[data-test="page-de-contenu"][data-slug="experience"]',
    ) as HTMLElement;

    expect(
      colonne(el(), 'experience', 'EN').parentElement?.className,
    ).toContain('max-lg:hidden');
    (
      page.querySelector('[data-test="langue"] [data-lang="EN"]') as HTMLElement
    ).click();
    await harness.fixture.whenStable();

    expect(
      colonne(el(), 'experience', 'FR').parentElement?.className,
    ).toContain('max-lg:hidden');
    expect(
      colonne(el(), 'experience', 'EN').parentElement?.className,
    ).not.toContain('max-lg:hidden');
    expect(colonne(el(), 'about', 'EN').parentElement?.className).toContain(
      'max-lg:hidden',
    );
  });

  it('montre l’erreur de lecture, et la reprend', async () => {
    const { harness, http, el } = await ouvrirLePortfolio('/portfolio/pages');
    http.expectOne(PAGES).flush(
      {
        status: 503,
        code: 'database.unavailable',
        message: 'La base de données ne répond pas.',
      },
      { status: 503, statusText: 'Service Unavailable' },
    );
    await harness.fixture.whenStable();

    expect(texte(el())).toContain('La base de données ne répond pas.');
    expect(el().querySelector('[data-test="page"]')).toBeNull();
  });
});
