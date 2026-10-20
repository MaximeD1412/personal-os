import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  BASE,
  BEURRE,
  OIGNON,
  ouvrirLeCatalogue,
} from '../../testing/catalogue';

function texte(el: HTMLElement, nom: string): string {
  return (
    el
      .querySelector(`[data-test="${nom}"]`)
      ?.textContent?.replace(/\s+/g, ' ') ?? ''
  );
}

describe('La fiche d’un Ingrédient', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('montre son unité, ses Allergènes, sa conservation, et mène à sa modification', async () => {
    const { harness, http, el } = await ouvrirLeCatalogue(
      '/repas/ingredients/ingredient-1',
    );
    http.expectOne(`${BASE}/ingredients/ingredient-1`).flush(BEURRE);
    await harness.fixture.whenStable();

    expect(el().querySelector('h1')?.textContent).toContain('Beurre doux');
    expect(texte(el(), 'unite')).toContain('Gramme (g)');
    expect(texte(el(), 'allergenes')).toContain('Lait');
    expect(texte(el(), 'conservation')).toContain('Périssable');
    expect(texte(el(), 'poids')).toContain("Poids moyen d'une pièce");
    expect(texte(el(), 'poids')).toContain('Non renseigné');
    expect(texte(el(), 'poids')).toContain(
      'Utilisé pour additionner des recettes en pièces et en grammes',
    );
    expect(
      el().querySelector('[data-test="modifier"]')?.getAttribute('href'),
    ).toBe('/repas/ingredients/ingredient-1/modifier');
  });

  it('dit qu’un Ingrédient ne déclare aucun Allergène, et donne son poids à la pièce', async () => {
    const { harness, http, el } = await ouvrirLeCatalogue(
      '/repas/ingredients/ingredient-2',
    );
    http.expectOne(`${BASE}/ingredients/ingredient-2`).flush(OIGNON);
    await harness.fixture.whenStable();

    expect(texte(el(), 'allergenes')).toContain(
      "Aucun parmi les 14 familles de l'UE",
    );
    expect(texte(el(), 'conservation')).toContain('Non périssable');
    expect(texte(el(), 'poids')).toContain('150 g');
  });

  it('ne parle pas de poids à la pièce pour un Ingrédient compté en millilitres', async () => {
    const { harness, http, el } = await ouvrirLeCatalogue(
      '/repas/ingredients/ingredient-3',
    );
    http.expectOne(`${BASE}/ingredients/ingredient-3`).flush({
      ...BEURRE,
      id: 'ingredient-3',
      displayName: 'Lait entier',
      canonicalUnit: 'MILLILITER',
    });
    await harness.fixture.whenStable();

    expect(el().querySelector('[data-test="poids"]')).toBeNull();
  });

  it('affiche le message de l’API pour un Ingrédient introuvable', async () => {
    const { harness, http, el } = await ouvrirLeCatalogue(
      '/repas/ingredients/inconnu',
    );
    http.expectOne(`${BASE}/ingredients/inconnu`).flush(
      {
        status: 404,
        code: 'food.ingredient_not_found',
        message: 'Aucun Ingrédient de cet identifiant.',
      },
      { status: 404, statusText: 'Not Found' },
    );
    await harness.fixture.whenStable();

    expect(el().textContent).toContain('Aucun Ingrédient de cet identifiant.');
    expect(el().querySelector('[data-test="modifier"]')).toBeNull();
  });
});
