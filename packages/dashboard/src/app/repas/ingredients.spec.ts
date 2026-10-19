import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  BASE,
  BEURRE,
  OIGNON,
  ouvrirLeCatalogue,
} from '../../testing/catalogue';

describe('Le catalogue d’Ingrédients', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('liste tout le catalogue, chaque Ingrédient menant à sa fiche', async () => {
    const { harness, http, el } = await ouvrirLeCatalogue('/repas/ingredients');

    const lecture = http.expectOne(`${BASE}/ingredients`);
    expect(lecture.request.params.keys()).toEqual([]);
    lecture.flush([BEURRE, OIGNON]);
    await harness.fixture.whenStable();

    const lignes = el().querySelectorAll('[data-test="ingredient"]');
    expect(lignes).toHaveLength(2);
    expect(lignes[0].textContent).toContain('Beurre doux');
    expect(lignes[0].textContent).toContain('Gramme (g) · Lait');
    expect(lignes[0].textContent).toContain('Périssable');
    expect(lignes[0].getAttribute('href')).toBe(
      '/repas/ingredients/ingredient-1',
    );
    expect(lignes[1].textContent).toContain('Pièce · Sans allergène');
    expect(lignes[1].textContent).not.toContain('Périssable');
  });

  it('reprend la recherche de l’URL, et la suit à la frappe', async () => {
    const { harness, http, el, router } = await ouvrirLeCatalogue(
      '/repas/ingredients?q=beurre',
    );

    http
      .expectOne(
        ({ url, params }) =>
          url === `${BASE}/ingredients` && params.get('q') === 'beurre',
      )
      .flush([BEURRE]);
    await harness.fixture.whenStable();

    const champ = el().querySelector(
      '[data-test="recherche"]',
    ) as HTMLInputElement;
    expect(champ.value).toBe('beurre');

    champ.value = 'oignon';
    champ.dispatchEvent(new Event('input'));
    // La lecture part sans attendre : l'application ne sera stable qu'une
    // fois la réponse rendue.
    TestBed.tick();

    http
      .expectOne(({ params }) => params.get('q') === 'oignon')
      .flush([OIGNON]);
    await harness.fixture.whenStable();

    expect(router.url).toBe('/repas/ingredients?q=oignon');
    expect(el().querySelectorAll('[data-test="ingredient"]')).toHaveLength(1);
  });

  it('propose de créer l’Ingrédient qu’une recherche ne trouve pas', async () => {
    const { harness, http, el } = await ouvrirLeCatalogue(
      '/repas/ingredients?q=Poireau',
    );

    http.expectOne(({ params }) => params.get('q') === 'Poireau').flush([]);
    await harness.fixture.whenStable();

    expect(el().textContent).toContain(
      'Aucun Ingrédient ne correspond à « Poireau »',
    );
    expect(
      el().querySelector('[data-test="creer-cherche"]')?.getAttribute('href'),
    ).toBe('/repas/ingredients/nouveau?displayName=Poireau');
  });

  it('affiche le message de l’API quand la lecture échoue', async () => {
    const { harness, http, el } = await ouvrirLeCatalogue('/repas/ingredients');

    http
      .expectOne(`${BASE}/ingredients`)
      .flush(
        { status: 500, code: 'internal', message: 'La base ne répond pas.' },
        { status: 500, statusText: 'Internal Server Error' },
      );
    await harness.fixture.whenStable();

    expect(el().textContent).toContain('La base ne répond pas.');
  });
});
