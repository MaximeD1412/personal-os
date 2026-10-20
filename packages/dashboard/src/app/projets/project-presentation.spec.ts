import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { PublicPresentation } from '@personal-os/contracts';
import {
  BASE,
  ouvrirLesProjets,
  RELIURE,
  RELIURE_EN_LIGNE,
} from '../../testing/projets';

const PRESENTATIONS = `${BASE}/projects/projet-1/presentations`;

/** Le texte d'un élément, espaces normalisés (y compris les insécables). */
function texte(el: Element | null | undefined): string {
  return el?.textContent?.replace(/[\s\u00a0\u202f]+/g, ' ').trim() ?? '';
}

function carte(el: HTMLElement, lang: 'FR' | 'EN'): HTMLElement {
  return el.querySelector(
    `[data-test="presentation"][data-lang="${lang}"]`,
  ) as HTMLElement;
}

function partie(el: Element, nom: string): HTMLElement | null {
  return el.querySelector(`[data-test="${nom}"]`);
}

function saisir(el: Element, nom: string, valeur: string): void {
  const champ = partie(el, nom) as HTMLInputElement | HTMLTextAreaElement;
  champ.value = valeur;
  champ.dispatchEvent(new Event('input'));
}

async function ouvrir(
  url: string,
  presentations: PublicPresentation[],
  options?: { confirme?: boolean },
) {
  const ouvert = await ouvrirLesProjets(url, options);
  ouvert.http.expectOne(`${BASE}/projects/projet-1`).flush(RELIURE);
  ouvert.http.expectOne(PRESENTATIONS).flush(presentations);
  await ouvert.harness.fixture.whenStable();
  return ouvert;
}

describe('La Présentation publique d’un Projet', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('montre chaque langue avec son État de publication', async () => {
    const { el } = await ouvrir('/projets/projet-1/presentation', [
      RELIURE_EN_LIGNE,
    ]);

    const fr = carte(el(), 'FR');
    expect(texte(partie(fr, 'etat'))).toBe('Publié');
    expect((partie(fr, 'titre') as HTMLInputElement).value).toBe(
      'Atelier de reliure',
    );
    expect(partie(fr, 'avertissement')).not.toBeNull();
    expect(partie(fr, 'depublier')).not.toBeNull();
    expect(partie(fr, 'publier')).toBeNull();

    const en = carte(el(), 'EN');
    expect(texte(partie(en, 'etat'))).toBe('Non publié');
    expect((partie(en, 'titre') as HTMLInputElement).value).toBe('');
    expect(partie(en, 'marquer-pret')).toBeNull();
    // Rien à enregistrer tant qu'aucun champ n'est rempli.
    expect((partie(en, 'enregistrer') as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(partie(en, 'a-enregistrer')).toBeNull();
    expect(
      partie(el(), 'onglet-presentation')?.getAttribute('aria-current'),
    ).toBe('page');
    expect(
      partie(el(), 'onglet-fiche')?.getAttribute('aria-current'),
    ).toBeNull();
  });

  it('enregistre un texte sans le publier, puis le marque prêt', async () => {
    const { harness, http, el } = await ouvrir(
      '/projets/projet-1/presentation',
      [],
    );
    const en = carte(el(), 'EN');

    saisir(en, 'titre', 'Bookbinding workshop');
    saisir(en, 'accroche', 'Hand-sewn notebooks.');
    await harness.fixture.whenStable();
    (partie(en, 'enregistrer') as HTMLButtonElement).click();

    const redaction = http.expectOne(`${PRESENTATIONS}/EN`);
    expect(redaction.request.method).toBe('PUT');
    expect(redaction.request.body).toEqual({
      title: 'Bookbinding workshop',
      summary: 'Hand-sewn notebooks.',
      body: '',
    });
    redaction.flush({
      ...RELIURE_EN_LIGNE,
      id: 'presentation-en',
      lang: 'EN',
      title: 'Bookbinding workshop',
      summary: 'Hand-sewn notebooks.',
      body: '',
      publicationState: 'UNPUBLISHED',
      publishedAt: null,
    } satisfies PublicPresentation);
    await harness.fixture.whenStable();

    expect(partie(en, 'publier')).toBeNull();
    (partie(en, 'marquer-pret') as HTMLButtonElement).click();
    await harness.fixture.whenStable();

    const pret = http.expectOne(`${PRESENTATIONS}/EN/ready`);
    expect(pret.request.method).toBe('POST');
    pret.flush({
      ...RELIURE_EN_LIGNE,
      ...redaction.request.body,
      id: 'presentation-en',
      lang: 'EN',
      publicationState: 'READY',
      publishedAt: null,
    } satisfies PublicPresentation);
    await harness.fixture.whenStable();

    expect(texte(partie(en, 'etat'))).toBe('Prêt à publier');
    expect(partie(en, 'publier')).not.toBeNull();
  });

  it('confirme la publication avant de la demander', async () => {
    const pret: PublicPresentation = {
      ...RELIURE_EN_LIGNE,
      publicationState: 'READY',
      publishedAt: null,
    };
    const { harness, http, el, confirmations } = await ouvrir(
      '/projets/projet-1/presentation',
      [pret],
    );

    (partie(carte(el(), 'FR'), 'publier') as HTMLButtonElement).click();
    await harness.fixture.whenStable();

    expect(confirmations.map(({ title }) => title)).toEqual([
      'Publier le texte en français ?',
    ]);
    http.expectOne(`${PRESENTATIONS}/FR/publish`).flush(RELIURE_EN_LIGNE);
    await harness.fixture.whenStable();

    expect(texte(partie(carte(el(), 'FR'), 'etat'))).toBe('Publié');
  });

  it('ne dépublie rien sans confirmation', async () => {
    const { harness, el, confirmations } = await ouvrir(
      '/projets/projet-1/presentation',
      [RELIURE_EN_LIGNE],
      { confirme: false },
    );

    (partie(carte(el(), 'FR'), 'depublier') as HTMLButtonElement).click();
    await harness.fixture.whenStable();

    expect(confirmations[0]).toMatchObject({
      title: 'Dépublier le texte en français ?',
      destructive: true,
    });
  });

  it('ne propose aucune transition tant que le texte modifié n’est pas enregistré', async () => {
    const { harness, http, el } = await ouvrir(
      '/projets/projet-1/presentation',
      [RELIURE_EN_LIGNE],
    );
    const fr = carte(el(), 'FR');

    saisir(fr, 'texte', 'Un texte relu.');
    await harness.fixture.whenStable();
    expect(partie(fr, 'depublier')).toBeNull();
    expect(partie(fr, 'a-enregistrer')).not.toBeNull();

    (partie(fr, 'enregistrer') as HTMLButtonElement).click();
    http.expectOne(`${PRESENTATIONS}/FR`).flush({
      ...RELIURE_EN_LIGNE,
      body: 'Un texte relu.',
      publicationState: 'READY',
      publishedAt: null,
    } satisfies PublicPresentation);
    await harness.fixture.whenStable();

    // Le texte publié qu'on modifie quitte le portfolio : il attend « Publier ».
    expect(texte(partie(fr, 'etat'))).toBe('Prêt à publier');
    expect(partie(fr, 'publier')).not.toBeNull();
  });

  it('montre le refus de l’API sur le champ visé, ou dans la carte', async () => {
    const { harness, http, el } = await ouvrir(
      '/projets/projet-1/presentation',
      [{ ...RELIURE_EN_LIGNE, publicationState: 'READY', publishedAt: null }],
    );
    const fr = carte(el(), 'FR');

    saisir(fr, 'titre', ' ');
    await harness.fixture.whenStable();
    (partie(fr, 'enregistrer') as HTMLButtonElement).click();
    http.expectOne(`${PRESENTATIONS}/FR`).flush(
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

    saisir(fr, 'titre', 'Atelier de reliure');
    await harness.fixture.whenStable();
    (partie(fr, 'publier') as HTMLButtonElement).click();
    await harness.fixture.whenStable();
    http.expectOne(`${PRESENTATIONS}/FR/publish`).flush(
      {
        status: 422,
        code: 'portfolio.not_ready',
        message: 'Seule une présentation prête à publier peut être publiée.',
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    await harness.fixture.whenStable();
    expect(texte(partie(fr, 'refus'))).toBe(
      'Seule une présentation prête à publier peut être publiée.',
    );
  });

  it('se préremplit depuis son lien, pour la langue visée, sans rien enregistrer', async () => {
    const { el } = await ouvrir(
      '/projets/projet-1/presentation?lang=EN&title=Bookbinding&summary=Hand-sewn%20notebooks.&couleur=violet',
      [RELIURE_EN_LIGNE],
    );

    const en = carte(el(), 'EN');
    expect((partie(en, 'titre') as HTMLInputElement).value).toBe('Bookbinding');
    expect((partie(en, 'accroche') as HTMLTextAreaElement).value).toBe(
      'Hand-sewn notebooks.',
    );
    expect((partie(carte(el(), 'FR'), 'titre') as HTMLInputElement).value).toBe(
      'Atelier de reliure',
    );
    expect(partie(en, 'a-enregistrer')).not.toBeNull();
    expect((partie(en, 'enregistrer') as HTMLButtonElement).disabled).toBe(
      false,
    );
    expect(partie(el(), 'ignores')).toBeNull();
    // Sur mobile, la langue du lien est celle qu'on voit.
    expect(carte(el(), 'FR').parentElement?.className).toContain(
      'max-lg:hidden',
    );
  });

  it('signale une langue du lien qu’il ne connaît pas', async () => {
    const { el } = await ouvrir('/projets/projet-1/presentation?lang=DE', []);

    expect(texte(partie(el(), 'ignores'))).toContain('lang=DE');
  });
});
