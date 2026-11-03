import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { NavigationEnd, type Router } from '@angular/router';
import { filter, firstValueFrom } from 'rxjs';
import { BEURRE, OIGNON } from '../../testing/catalogue';
import { BASE, LAIT, ouvrirLeStock } from '../../testing/stock';

/** Le lait du stock, tel que le catalogue le connaît. */
const LAIT_DU_CATALOGUE = {
  ...BEURRE,
  id: LAIT.ingredient.id,
  name: 'lait demi-ecreme',
  displayName: LAIT.ingredient.displayName,
  canonicalUnit: LAIT.ingredient.canonicalUnit,
};

/** La prochaine navigation achevée, quand la page suivante lit déjà l'API. */
function arrivee(router: Router): Promise<unknown> {
  return firstValueFrom(
    router.events.pipe(
      filter((evenement) => evenement instanceof NavigationEnd),
    ),
  );
}

/** Le formulaire ouvert, devant le stock et le catalogue. */
async function ouvrir(url = '/repas/stock/nouveau') {
  const ouvert = await ouvrirLeStock(url);
  TestBed.tick();
  ouvert.http.expectOne(`${BASE}/pantry-items`).flush([LAIT]);
  ouvert.http
    .expectOne(`${BASE}/ingredients`)
    .flush([BEURRE, LAIT_DU_CATALOGUE, OIGNON]);
  return ouvert;
}

function champ(el: HTMLElement, nom: string): HTMLInputElement {
  return el.querySelector(`[data-test="${nom}"]`) as HTMLInputElement;
}

function saisir(input: HTMLInputElement, valeur: string): void {
  input.value = valeur;
  input.dispatchEvent(new Event('input'));
  TestBed.tick();
}

function trouve(el: HTMLElement, nom: string): HTMLButtonElement {
  return [...el.querySelectorAll('[data-test="ingredient"]')].find((b) =>
    b.textContent?.includes(nom),
  ) as HTMLButtonElement;
}

function soumettre(el: HTMLElement): void {
  (el.querySelector('form') as HTMLFormElement).requestSubmit();
  TestBed.tick();
}

describe('L’ajout d’un Ingrédient au stock', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('se préremplit par son URL, sans rien enregistrer', async () => {
    const { harness, http, el } = await ouvrir(
      '/repas/stock/nouveau?ingredientId=ingredient-1&quantity=250&expiresOn=2026-10-30',
    );
    http.expectOne(`${BASE}/ingredients/ingredient-1`).flush(BEURRE);
    await harness.fixture.whenStable();

    expect(el().querySelector('[data-test="choisi"]')?.textContent).toContain(
      'Beurre doux',
    );
    expect(champ(el(), 'quantite').value).toBe('250');
    expect(champ(el(), 'peremption').value).toBe('2026-10-30');
    expect(el().querySelector('[data-test="unite"]')?.textContent).toContain(
      'g',
    );
    expect(el().querySelector('[data-test="ignores"]')).toBeNull();
  });

  it('signale une valeur du lien qu’il n’a pas pu reprendre', async () => {
    const { harness, el } = await ouvrir('/repas/stock/nouveau?quantity=-2');
    await harness.fixture.whenStable();

    expect(el().querySelector('[data-test="ignores"]')?.textContent).toContain(
      'quantity=-2',
    );
    expect(champ(el(), 'quantite').value).toBe('');
  });

  it('n’envoie rien tant qu’aucun Ingrédient n’est choisi', async () => {
    const { harness, el } = await ouvrir();
    await harness.fixture.whenStable();

    const ajouter = [...el().querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Ajouter au stock'),
    ) as HTMLButtonElement;
    expect(ajouter.disabled).toBe(true);
  });

  it('cherche un Ingrédient, envoie sa ligne à « Ajouter », puis revient au stock', async () => {
    const { harness, http, el, router } = await ouvrir();
    await harness.fixture.whenStable();

    saisir(champ(el(), 'recherche'), 'oign');
    http
      .expectOne(
        ({ url, params }) =>
          url === `${BASE}/ingredients` && params.get('q') === 'oign',
      )
      .flush([OIGNON]);
    await harness.fixture.whenStable();

    trouve(el(), 'Oignon jaune').click();
    await harness.fixture.whenStable();
    expect(trouve(el(), 'Oignon jaune').getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(el().querySelector('[data-test="unite"]')?.textContent).toContain(
      'pièce',
    );
    saisir(champ(el(), 'quantite'), '3');
    soumettre(el());

    const ajout = http.expectOne(`${BASE}/pantry-items/ingredient-2`);
    expect(ajout.request.method).toBe('PUT');
    expect(ajout.request.body).toEqual({ quantity: 3, expiresOn: null });
    const revenu = arrivee(router);
    ajout.flush({
      ...LAIT,
      id: 'ligne-9',
      ingredient: {
        id: OIGNON.id,
        displayName: OIGNON.displayName,
        canonicalUnit: OIGNON.canonicalUnit,
      },
      quantity: 3,
      expiresOn: null,
    });
    await revenu;

    expect(router.url).toBe('/repas/stock');
    TestBed.tick();
    http.expectOne(`${BASE}/pantry-items`).flush([]);
  });

  it('dit la ligne en place d’un Ingrédient déjà en stock, que l’ajout remplacera', async () => {
    const { harness, el } = await ouvrir();
    await harness.fixture.whenStable();

    expect(trouve(el(), 'Lait demi-écrémé').textContent).toContain(
      'En stock : 1 000 ml',
    );
    expect(trouve(el(), 'Beurre doux').textContent).not.toContain('En stock');

    trouve(el(), 'Lait demi-écrémé').click();
    await harness.fixture.whenStable();
    expect(el().querySelector('[data-test="en-place"]')?.textContent).toContain(
      'remplace',
    );
  });

  it('affiche le refus de l’API : en bandeau une règle, sous le champ une erreur de forme', async () => {
    const { harness, http, el } = await ouvrir(
      '/repas/stock/nouveau?ingredientId=ingredient-1&quantity=250',
    );
    http.expectOne(`${BASE}/ingredients/ingredient-1`).flush(BEURRE);
    await harness.fixture.whenStable();

    soumettre(el());
    http.expectOne(`${BASE}/pantry-items/ingredient-1`).flush(
      {
        status: 422,
        code: 'food.unknown_ingredient',
        message: "Cet Ingrédient n'est pas au catalogue.",
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    await harness.fixture.whenStable();
    expect(el().textContent).toContain(
      "Cet Ingrédient n'est pas au catalogue.",
    );

    soumettre(el());
    http.expectOne(`${BASE}/pantry-items/ingredient-1`).flush(
      {
        status: 400,
        code: 'validation.failed',
        message: 'La saisie est invalide.',
        fields: [
          {
            path: 'quantity',
            code: 'too_small',
            message: 'La quantité ne peut pas être négative.',
          },
        ],
      },
      { status: 400, statusText: 'Bad Request' },
    );
    await harness.fixture.whenStable();
    expect(champ(el(), 'quantite').getAttribute('aria-invalid')).toBe('true');
    expect(el().textContent).toContain(
      'La quantité ne peut pas être négative.',
    );
  });
});
