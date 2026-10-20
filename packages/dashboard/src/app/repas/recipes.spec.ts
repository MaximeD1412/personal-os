import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  BASE,
  DAHL,
  OMELETTE,
  ouvrirLesRecettes,
} from '../../testing/recettes';

describe('Les recettes', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('liste les recettes du Foyer, chacune menant à sa fiche', async () => {
    const { harness, http, el } = await ouvrirLesRecettes('/repas/recettes');

    const lecture = http.expectOne(`${BASE}/recipes`);
    expect(lecture.request.params.keys()).toEqual([]);
    lecture.flush([DAHL, OMELETTE]);
    await harness.fixture.whenStable();

    const lignes = el().querySelectorAll('[data-test="recette"]');
    expect(lignes).toHaveLength(2);
    expect(lignes[0].textContent).toContain('Dahl de lentilles corail');
    expect(lignes[0].textContent).toContain('4\u00a0portions · 3\u00a0ingrédients');
    expect(lignes[0].getAttribute('href')).toBe('/repas/recettes/recette-1');
    expect(lignes[1].textContent).toContain('1\u00a0portion · 1\u00a0ingrédient');
  });

  it('ne propose pas encore de créer une recette : le formulaire viendra avec CUISINE-6', async () => {
    const { harness, http, el } = await ouvrirLesRecettes('/repas/recettes');

    http.expectOne(`${BASE}/recipes`).flush([]);
    await harness.fixture.whenStable();

    expect(el().textContent).toContain("Le Foyer n'a encore aucune recette");
    expect(el().querySelector('a[href*="nouvelle"]')).toBeNull();
  });

  it('reprend la recherche de l’URL, et la suit à la frappe', async () => {
    const { harness, http, el, router } = await ouvrirLesRecettes(
      '/repas/recettes?q=dahl',
    );

    http
      .expectOne(
        ({ url, params }) =>
          url === `${BASE}/recipes` && params.get('q') === 'dahl',
      )
      .flush([DAHL]);
    await harness.fixture.whenStable();

    const champ = el().querySelector(
      '[data-test="recherche"]',
    ) as HTMLInputElement;
    expect(champ.value).toBe('dahl');

    champ.value = 'omelette';
    champ.dispatchEvent(new Event('input'));
    TestBed.tick();

    http
      .expectOne(({ params }) => params.get('q') === 'omelette')
      .flush([OMELETTE]);
    await harness.fixture.whenStable();

    expect(router.url).toBe('/repas/recettes?q=omelette');
    expect(el().querySelectorAll('[data-test="recette"]')).toHaveLength(1);
  });

  it('dit qu’une recherche ne trouve rien', async () => {
    const { harness, http, el } = await ouvrirLesRecettes(
      '/repas/recettes?q=Bortsch',
    );

    http.expectOne(({ params }) => params.get('q') === 'Bortsch').flush([]);
    await harness.fixture.whenStable();

    expect(el().textContent).toContain(
      'Aucune recette ne correspond à «\u00a0Bortsch\u00a0»',
    );
  });

  it('affiche le message de l’API quand la lecture échoue', async () => {
    const { harness, http, el } = await ouvrirLesRecettes('/repas/recettes');

    http
      .expectOne(`${BASE}/recipes`)
      .flush(
        { status: 500, code: 'internal', message: 'La base ne répond pas.' },
        { status: 500, statusText: 'Internal Server Error' },
      );
    await harness.fixture.whenStable();

    expect(el().textContent).toContain('La base ne répond pas.');
  });
});
