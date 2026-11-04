import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { Ingredient, Product } from '@personal-os/contracts';
import { BASE, ouvrirLeCatalogue } from '../../testing/catalogue';
import { choisirDansLeSelect, valeurAffichee } from '../../testing/hlm-select';

const TOMATES: Ingredient = {
  id: 'ingredient-tomates',
  name: 'tomates concassees',
  displayName: 'Tomates concassées',
  canonicalUnit: 'GRAM',
  gramsPerPiece: null,
  allergens: [],
  perishable: false,
  preferredProductId: 'produit-mutti',
  createdAt: '2026-10-19T08:00:00.000Z',
};

const MUTTI: Product = {
  id: 'produit-mutti',
  ingredientId: TOMATES.id,
  brand: 'Mutti',
  form: 'CANNED',
  packageQuantity: 400,
  packageLabel: 'boîte',
  createdAt: '2026-10-20T08:00:00.000Z',
};

const SANS_MARQUE: Product = {
  id: 'produit-surgele',
  ingredientId: TOMATES.id,
  brand: null,
  form: 'FROZEN',
  packageQuantity: 1000,
  packageLabel: 'sachet',
  createdAt: '2026-10-21T08:00:00.000Z',
};

const URL_DE_LA_FICHE = `/repas/ingredients/${TOMATES.id}`;
const PRODUITS = `${BASE}/ingredients/${TOMATES.id}/products`;
const PREFERE = `${BASE}/ingredients/${TOMATES.id}/preferred-product`;

type Ouvert = Awaited<ReturnType<typeof ouvrirLeCatalogue>>;

/** La fiche, devant cet Ingrédient et ces Produits. */
async function ouvrir(
  produits: Product[] = [MUTTI, SANS_MARQUE],
  ingredient: Ingredient = TOMATES,
  options?: Parameters<typeof ouvrirLeCatalogue>[1],
  requete = '',
): Promise<Ouvert> {
  const ouvert = await ouvrirLeCatalogue(URL_DE_LA_FICHE + requete, options);
  ouvert.http.expectOne(`${BASE}/ingredients/${TOMATES.id}`).flush(ingredient);
  await new Promise((resolve) => setTimeout(resolve));
  TestBed.tick();
  ouvert.http.expectOne(PRODUITS).flush(produits);
  await ouvert.harness.fixture.whenStable();
  return ouvert;
}

function section(el: HTMLElement): HTMLElement {
  return el.querySelector('[data-test="produits"]') as HTMLElement;
}

function ligne(el: HTMLElement, id: string): HTMLElement {
  return section(el).querySelector(`[data-produit="${id}"]`) as HTMLElement;
}

function texte(element: Element | null | undefined): string {
  return (element?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function bouton(racine: HTMLElement, nom: string): HTMLButtonElement {
  return racine.querySelector(`[data-test="${nom}"]`) as HTMLButtonElement;
}

function saisir(el: HTMLElement, nom: string, valeur: string): void {
  const input = el.querySelector(`[data-test="${nom}"]`) as HTMLInputElement;
  input.value = valeur;
  input.dispatchEvent(new Event('input'));
  TestBed.tick();
}

function valeurDe(el: HTMLElement, nom: string): string {
  return (el.querySelector(`[data-test="${nom}"]`) as HTMLInputElement).value;
}

function envoyer(el: HTMLElement): void {
  el.querySelector('[data-test="ajout-produit"]')?.dispatchEvent(
    new Event('submit', { cancelable: true }),
  );
  TestBed.tick();
}

describe('Les Produits d’un Ingrédient', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('les liste avec leur conditionnement, et marque le Produit préféré', async () => {
    const { el } = await ouvrir();

    expect(texte(ligne(el(), MUTTI.id))).toContain('Mutti');
    expect(texte(ligne(el(), MUTTI.id))).toContain('Conserve · boîte de 400 g');
    expect(texte(ligne(el(), MUTTI.id))).toContain('Produit préféré');
    // Sans marque, la ligne se nomme par sa forme.
    expect(texte(ligne(el(), SANS_MARQUE.id))).toContain(
      'Surgelé · sachet de 1 000 g',
    );
    expect(texte(ligne(el(), SANS_MARQUE.id))).not.toContain('Produit préféré');
    expect(bouton(ligne(el(), MUTTI.id), 'preferer')).toBeNull();
  });

  it('dit qu’aucun Produit n’est rattaché', async () => {
    const { el } = await ouvrir([], { ...TOMATES, preferredProductId: null });

    expect(texte(section(el()))).toContain('Aucun produit');
  });

  it('fait d’un autre Produit le préféré', async () => {
    const { el, http, harness } = await ouvrir();

    bouton(ligne(el(), SANS_MARQUE.id), 'preferer').click();
    TestBed.tick();
    const envoi = http.expectOne(PREFERE);
    expect(envoi.request.method).toBe('POST');
    expect(envoi.request.body).toEqual({ productId: SANS_MARQUE.id });
    envoi.flush({ ...TOMATES, preferredProductId: SANS_MARQUE.id });
    await harness.fixture.whenStable();

    expect(texte(ligne(el(), SANS_MARQUE.id))).toContain('Produit préféré');
    expect(texte(ligne(el(), MUTTI.id))).not.toContain('Produit préféré');
  });

  it('retire la préférence', async () => {
    const { el, http, harness } = await ouvrir();

    bouton(ligne(el(), MUTTI.id), 'ne-plus-preferer').click();
    TestBed.tick();
    const envoi = http.expectOne(PREFERE);
    expect(envoi.request.body).toEqual({ productId: null });
    envoi.flush({ ...TOMATES, preferredProductId: null });
    await harness.fixture.whenStable();

    expect(texte(section(el()))).not.toContain('Produit préféré');
  });

  it('ajoute un Produit, dans l’Unité canonique de l’Ingrédient', async () => {
    const { el, http, harness } = await ouvrir([MUTTI]);

    expect(texte(section(el()).querySelector('[data-test="unite"]'))).toBe('g');
    saisir(el(), 'marque', 'Cirio');
    await choisirDansLeSelect(harness.fixture, 'forme', 'Conserve');
    saisir(el(), 'contenance', '800');
    saisir(el(), 'conditionnement', 'boîte');
    envoyer(el());

    const envoi = http.expectOne(`${BASE}/products`);
    expect(envoi.request.method).toBe('POST');
    expect(envoi.request.body).toEqual({
      ingredientId: TOMATES.id,
      brand: 'Cirio',
      form: 'CANNED',
      packageQuantity: 800,
      packageLabel: 'boîte',
    });
    envoi.flush({
      ...MUTTI,
      id: 'produit-cirio',
      brand: 'Cirio',
      packageQuantity: 800,
    });
    await harness.fixture.whenStable();

    expect(texte(ligne(el(), 'produit-cirio'))).toContain('boîte de 800 g');
    expect(
      (el().querySelector('[data-test="marque"]') as HTMLInputElement).value,
    ).toBe('');
  });

  it('se préremplit par son URL, sans rien enregistrer', async () => {
    const { el, http, harness } = await ouvrir(
      [MUTTI],
      TOMATES,
      undefined,
      '?brand=Cirio&form=CANNED&packageQuantity=800&packageLabel=bo%C3%AEte',
    );

    expect(valeurDe(el(), 'marque')).toBe('Cirio');
    expect(valeurAffichee(harness.fixture, 'forme')).toBe('Conserve');
    expect(valeurDe(el(), 'contenance')).toBe('800');
    expect(valeurDe(el(), 'conditionnement')).toBe('boîte');
    expect(section(el()).querySelector('[data-test="ignores"]')).toBeNull();
    http.expectNone(`${BASE}/products`);

    envoyer(el());
    expect(http.expectOne(`${BASE}/products`).request.body).toEqual({
      ingredientId: TOMATES.id,
      brand: 'Cirio',
      form: 'CANNED',
      packageQuantity: 800,
      packageLabel: 'boîte',
    });
  });

  it('signale une valeur du lien qu’il n’a pas pu reprendre', async () => {
    const { el, harness } = await ouvrir(
      [MUTTI],
      TOMATES,
      undefined,
      '?form=VRAC&packageQuantity=-3&packageLabel=sachet',
    );

    const ignores = texte(section(el()).querySelector('[data-test="ignores"]'));
    expect(ignores).toContain('form=VRAC');
    expect(ignores).toContain('packageQuantity=-3');
    expect(valeurAffichee(harness.fixture, 'forme')).toBe('Choisir une forme');
    expect(valeurDe(el(), 'contenance')).toBe('');
    expect(valeurDe(el(), 'conditionnement')).toBe('sachet');
  });

  it('montre le refus sous le champ en cause', async () => {
    const { el, http, harness } = await ouvrir([MUTTI]);

    saisir(el(), 'conditionnement', 'boîte');
    envoyer(el());
    const envoi = http.expectOne(`${BASE}/products`);
    expect(envoi.request.body).toEqual({
      ingredientId: TOMATES.id,
      brand: null,
      packageLabel: 'boîte',
    });
    envoi.flush(
      {
        status: 400,
        code: 'request.invalid',
        message: 'La requête ne respecte pas le contrat.',
        fields: [
          {
            path: 'packageQuantity',
            code: 'invalid_type',
            message: 'La contenance est un nombre.',
          },
        ],
      },
      { status: 400, statusText: 'Bad Request' },
    );
    await harness.fixture.whenStable();

    expect(texte(section(el()))).toContain('La contenance est un nombre.');
  });

  it('retire un Produit après confirmation, et sa préférence avec lui', async () => {
    const { el, http, harness, confirmations } = await ouvrir();

    bouton(ligne(el(), MUTTI.id), 'retirer').click();
    await new Promise((resolve) => setTimeout(resolve));
    TestBed.tick();

    expect(confirmations).toEqual([
      expect.objectContaining({ destructive: true }),
    ]);
    const envoi = http.expectOne(`${BASE}/products/${MUTTI.id}`);
    expect(envoi.request.method).toBe('DELETE');
    envoi.flush(null, { status: 204, statusText: 'No Content' });
    await harness.fixture.whenStable();

    expect(ligne(el(), MUTTI.id)).toBeNull();
    expect(texte(section(el()))).not.toContain('Produit préféré');
  });

  it('ne retire rien si l’on renonce', async () => {
    const { el } = await ouvrir([MUTTI], TOMATES, { confirme: false });

    bouton(ligne(el(), MUTTI.id), 'retirer').click();
    await new Promise((resolve) => setTimeout(resolve));
    TestBed.tick();

    expect(ligne(el(), MUTTI.id)).not.toBeNull();
  });
});
