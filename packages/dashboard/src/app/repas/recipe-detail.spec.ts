import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { Recipe } from '@personal-os/contracts';
import {
  BASE,
  CURRY_GENERE,
  DAHL,
  OMELETTE,
  ouvrirLesRecettes,
} from '../../testing/recettes';

function garder(el: HTMLElement): HTMLButtonElement | null {
  return el.querySelector('[data-test="garder"]');
}

function textes(el: HTMLElement, nom: string): string[] {
  return [...el.querySelectorAll(`[data-test="${nom}"]`)].map(
    // Les espaces insécables du texte restent : seule la mise en page se replie.
    (noeud) => noeud.textContent?.replace(/[ \t\n]+/g, ' ').trim() ?? '',
  );
}

describe('La fiche d’une Recette', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('donne les ingrédients pour les portions de référence, dans leur unité saisie, puis les étapes', async () => {
    const { harness, http, el } = await ouvrirLesRecettes(
      '/repas/recettes/recette-1',
    );
    http.expectOne(`${BASE}/recipes/recette-1`).flush(DAHL);
    await harness.fixture.whenStable();

    expect(el().querySelector('h1')?.textContent).toContain(
      'Dahl de lentilles corail',
    );
    expect(textes(el(), 'portions')).toEqual(['Pour 4\u00a0portions']);
    expect(textes(el(), 'ligne')).toEqual([
      'Lentilles corail 250\u00a0g',
      'Oignon jaune 1\u00a0pièce',
      'Huile d’olive 1,5\u00a0c. à soupe',
    ]);
    expect(textes(el(), 'etape')).toEqual([
      '1 Rincer les lentilles.',
      '2 Mijoter 20 minutes.',
    ]);
  });

  it('dit qu’une recette ne décrit aucune étape', async () => {
    const { harness, http, el } = await ouvrirLesRecettes(
      '/repas/recettes/recette-2',
    );
    http.expectOne(`${BASE}/recipes/recette-2`).flush(OMELETTE);
    await harness.fixture.whenStable();

    expect(textes(el(), 'portions')).toEqual(['Pour 1\u00a0portion']);
    expect(textes(el(), 'etapes')[0]).toContain(
      'Cette recette ne décrit aucune étape.',
    );
  });

  it('affiche le message de l’API pour une recette introuvable', async () => {
    const { harness, http, el } = await ouvrirLesRecettes(
      '/repas/recettes/inconnue',
    );
    http.expectOne(`${BASE}/recipes/inconnue`).flush(
      {
        status: 404,
        code: 'food.recipe_not_found',
        message: 'Aucune Recette de cet identifiant.',
      },
      { status: 404, statusText: 'Not Found' },
    );
    await harness.fixture.whenStable();

    expect(el().textContent).toContain('Aucune Recette de cet identifiant.');
    expect(el().querySelector('[data-test="ingredients"]')).toBeNull();
  });

  it('garde une recette générée qui ne l’est pas encore, puis ne le propose plus', async () => {
    const { harness, http, el } = await ouvrirLesRecettes(
      '/repas/recettes/recette-3',
    );
    http.expectOne(`${BASE}/recipes/recette-3`).flush(CURRY_GENERE);
    await harness.fixture.whenStable();

    expect(garder(el())?.textContent).toContain('Garder la recette');
    garder(el())?.click();

    const garde = http.expectOne(`${BASE}/recipes/recette-3/keep`);
    expect(garde.request.method).toBe('POST');
    garde.flush({ ...CURRY_GENERE, kept: true } satisfies Recipe);
    await harness.fixture.whenStable();

    expect(garder(el())).toBeNull();
    expect(el().querySelector('h1')?.textContent).toContain(
      'Curry de pois chiches',
    );
  });

  it('ne propose pas de garder une recette déjà gardée', async () => {
    const { harness, http, el } = await ouvrirLesRecettes(
      '/repas/recettes/recette-1',
    );
    http.expectOne(`${BASE}/recipes/recette-1`).flush(DAHL);
    await harness.fixture.whenStable();

    expect(garder(el())).toBeNull();
  });

  it('dit pourquoi l’API refuse de garder la recette', async () => {
    const { harness, http, el } = await ouvrirLesRecettes(
      '/repas/recettes/recette-3',
    );
    http.expectOne(`${BASE}/recipes/recette-3`).flush(CURRY_GENERE);
    await harness.fixture.whenStable();

    garder(el())?.click();
    http.expectOne(`${BASE}/recipes/recette-3/keep`).flush(
      {
        status: 422,
        code: 'food.recipe_already_kept',
        message: 'Cette recette est déjà dans vos recettes.',
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    await harness.fixture.whenStable();

    expect(el().querySelector('[data-test="refus"]')?.textContent).toContain(
      'Cette recette est déjà dans vos recettes.',
    );
  });
});
