import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { Ingredient } from '@personal-os/contracts';
import {
  BASE,
  BEURRE,
  OIGNON,
  ouvrirLeCatalogue,
} from '../../testing/catalogue';

/** Le doublon du beurre, compté comme lui en grammes. */
const BEURRE_DOUX: Ingredient = {
  ...BEURRE,
  id: 'ingredient-9',
  name: 'beurre',
  displayName: 'Beurre',
};

type Ouvert = Awaited<ReturnType<typeof ouvrirLeCatalogue>>;

/** L'écran ouvert sur le doublon `ingredient-9`, devant le catalogue. */
async function ouvrir(
  requete = '',
  options?: { confirme?: boolean; conserve?: Ingredient },
): Promise<Ouvert> {
  const ouvert = await ouvrirLeCatalogue(
    `/repas/ingredients/ingredient-9/fusionner${requete}`,
    options,
  );
  TestBed.tick();
  ouvert.http.expectOne(`${BASE}/ingredients/ingredient-9`).flush(BEURRE_DOUX);
  ouvert.http
    .expectOne(`${BASE}/ingredients`)
    .flush([BEURRE_DOUX, BEURRE, OIGNON]);
  // L'Ingrédient du lien, lu pour le nommer.
  if (options?.conserve) {
    ouvert.http
      .expectOne(`${BASE}/ingredients/${options.conserve.id}`)
      .flush(options.conserve);
  }
  await ouvert.harness.fixture.whenStable();
  return ouvert;
}

function texte(el: HTMLElement, nom: string): string {
  return (
    el
      .querySelector(`[data-test="${nom}"]`)
      ?.textContent?.replace(/\s+/g, ' ') ?? ''
  );
}

function trouves(el: HTMLElement): string[] {
  return [...el.querySelectorAll('[data-test="ingredient"]')].map(
    (b) => b.textContent?.trim() ?? '',
  );
}

function fusionner(el: HTMLElement): HTMLButtonElement {
  return [...el.querySelectorAll('button')].find(
    (b) => b.textContent?.trim() === 'Fusionner',
  ) as HTMLButtonElement;
}

/** Laisse la confirmation répondre, puis la requête partir. */
async function apresLaConfirmation(ouvert: Ouvert): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve));
  await ouvert.harness.fixture.whenStable();
}

describe('La fusion d’un Ingrédient en doublon', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('ne propose que les autres Ingrédients de la même unité, et n’envoie rien sans choix', async () => {
    const { el } = await ouvrir();

    expect(texte(el(), 'doublon')).toContain('Beurre');
    expect(texte(el(), 'doublon')).toContain('Sera supprimé');
    expect(trouves(el())).toEqual(['Beurre doux']);
    expect(fusionner(el()).disabled).toBe(true);
  });

  it('se préremplit par son URL, sans rien enregistrer', async () => {
    const { el } = await ouvrir('?intoId=ingredient-1', {
      conserve: BEURRE,
    });

    expect(texte(el(), 'conserve')).toContain('Beurre doux');
    expect(texte(el(), 'conserve')).toContain('Conservé');
    expect(texte(el(), 'alias')).toContain(
      // `texte()` ramène les espaces insécables à des espaces.
      '« Beurre » deviendra un Alias de « Beurre doux »',
    );
    expect(fusionner(el()).disabled).toBe(false);
  });

  it('fusionne après confirmation, puis mène à l’Ingrédient conservé', async () => {
    const ouvert = await ouvrir();
    const { el, http, confirmations, harness, router } = ouvert;

    (
      el().querySelector('[data-test="ingredient"]') as HTMLButtonElement
    ).click();
    await harness.fixture.whenStable();
    fusionner(el()).click();
    await apresLaConfirmation(ouvert);

    expect(confirmations).toEqual([
      expect.objectContaining({
        title: 'Fusionner «\u00a0Beurre\u00a0» avec «\u00a0Beurre doux\u00a0» ?',
        confirmLabel: 'Fusionner les ingrédients',
        destructive: true,
      }),
    ]);
    const envoi = http.expectOne(`${BASE}/ingredients/ingredient-9/merge`);
    expect(envoi.request.method).toBe('POST');
    expect(envoi.request.body).toEqual({ intoId: 'ingredient-1' });
    envoi.flush(BEURRE);
    await new Promise((resolve) => setTimeout(resolve));
    TestBed.tick();

    expect(router.url).toBe('/repas/ingredients/ingredient-1');
    http.expectOne(`${BASE}/ingredients/ingredient-1`).flush(BEURRE);
    await new Promise((resolve) => setTimeout(resolve));
    TestBed.tick();
    http.expectOne(`${BASE}/ingredients/ingredient-1/products`).flush([]);
  });

  it('n’envoie rien quand la confirmation est annulée', async () => {
    const ouvert = await ouvrir('', { confirme: false });
    const { el, harness, router } = ouvert;

    (
      el().querySelector('[data-test="ingredient"]') as HTMLButtonElement
    ).click();
    await harness.fixture.whenStable();
    fusionner(el()).click();
    await apresLaConfirmation(ouvert);

    expect(router.url).toBe('/repas/ingredients/ingredient-9/fusionner');
  });

  it('affiche le message de l’API quand la fusion est refusée', async () => {
    const ouvert = await ouvrir();
    const { el, http, harness } = ouvert;

    (
      el().querySelector('[data-test="ingredient"]') as HTMLButtonElement
    ).click();
    await harness.fixture.whenStable();
    fusionner(el()).click();
    await apresLaConfirmation(ouvert);
    http.expectOne(`${BASE}/ingredients/ingredient-9/merge`).flush(
      {
        status: 422,
        code: 'food.merge_busy',
        message: 'Ces Ingrédients changent en ce moment : relancez la fusion.',
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    await harness.fixture.whenStable();

    expect(el().textContent).toContain(
      'Ces Ingrédients changent en ce moment : relancez la fusion.',
    );
  });
});
