import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { BASE, CV_FR, ouvrirLePortfolio } from '../../testing/portfolio';
import { formaterTaille } from './cv';

/** Choisit un fichier dans le champ caché d'une langue. */
function choisir(carte: Element, fichier: File): void {
  const champ = carte.querySelector<HTMLInputElement>('[data-test="fichier"]');
  if (!champ) throw new Error('pas de champ de fichier');
  Object.defineProperty(champ, 'files', {
    value: [fichier],
    configurable: true,
  });
  champ.dispatchEvent(new Event('change'));
}

const UN_PDF = new File(['%PDF-1.7'], 'cv.pdf', { type: 'application/pdf' });

describe('Le CV du portfolio', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('montre le CV de chaque langue, à télécharger ou à téléverser', async () => {
    const { harness, http, el } = await ouvrirLePortfolio('/portfolio/cv');

    http.expectOne(`${BASE}/cv`).flush([CV_FR]);
    await harness.fixture.whenStable();

    const fr = el().querySelector('[data-test="cv-FR"]');
    const en = el().querySelector('[data-test="cv-EN"]');
    expect(fr?.textContent).toContain('Français');
    expect(fr?.textContent).toContain('480 Ko · Téléversé le 15 mai 2026');
    expect(
      fr?.querySelector('[data-test="telecharger"]')?.getAttribute('href'),
    ).toBe(`${BASE}/cv/FR`);
    expect(
      fr?.querySelector('[data-test="televerser"]')?.textContent,
    ).toContain('Remplacer');

    expect(en?.textContent).toContain('Anglais');
    expect(en?.textContent).toContain('Aucun CV téléversé.');
    expect(en?.querySelector('[data-test="telecharger"]')).toBeNull();
    expect(
      en?.querySelector('[data-test="televerser"]')?.textContent,
    ).toContain('Téléverser');
  });

  it('téléverse le fichier choisi, puis relit les CV', async () => {
    const { harness, http, el } = await ouvrirLePortfolio('/portfolio/cv');
    http.expectOne(`${BASE}/cv`).flush([]);
    await harness.fixture.whenStable();

    choisir(el().querySelector('[data-test="cv-EN"]') as Element, UN_PDF);

    const envoi = http.expectOne(`${BASE}/cv/EN`);
    expect(envoi.request.method).toBe('PUT');
    expect((envoi.request.body as FormData).get('file')).toBe(UN_PDF);
    envoi.flush({ ...CV_FR, lang: 'EN' });
    TestBed.tick();

    http.expectOne(`${BASE}/cv`).flush([{ ...CV_FR, lang: 'EN' }]);
    await harness.fixture.whenStable();
    expect(
      el().querySelector('[data-test="cv-EN"] [data-test="detail"]')
        ?.textContent,
    ).toContain('480 Ko');
  });

  it("affiche le refus de l'API quand le fichier n'est pas un PDF", async () => {
    const { harness, http, el } = await ouvrirLePortfolio('/portfolio/cv');
    http.expectOne(`${BASE}/cv`).flush([]);
    await harness.fixture.whenStable();

    choisir(
      el().querySelector('[data-test="cv-FR"]') as Element,
      new File(['<html>'], 'cv.html', { type: 'text/html' }),
    );
    http.expectOne(`${BASE}/cv/FR`).flush(
      {
        status: 422,
        code: 'portfolio.cv_invalid',
        message: 'Le CV doit être un fichier PDF.',
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    await harness.fixture.whenStable();

    expect(el().querySelector('[data-test="refus"]')?.textContent).toContain(
      'Le CV doit être un fichier PDF.',
    );
  });

  it('affiche le message de l’API quand la lecture échoue', async () => {
    const { harness, http, el } = await ouvrirLePortfolio('/portfolio/cv');

    http
      .expectOne(`${BASE}/cv`)
      .flush(
        {
          status: 500,
          code: 'internal',
          message: 'Le stockage ne répond pas.',
        },
        { status: 500, statusText: 'Internal Server Error' },
      );
    await harness.fixture.whenStable();

    expect(el().textContent).toContain('Le stockage ne répond pas.');
  });
});

describe('formaterTaille', () => {
  it.each([
    [200, '1 Ko'],
    [480 * 1024, '480 Ko'],
    [1.25 * 1024 * 1024, '1,3 Mo'],
    [5 * 1024 * 1024, '5 Mo'],
  ])('%d octets se lisent « %s »', (octets, attendu) => {
    expect(formaterTaille(octets)).toBe(attendu);
  });
});
