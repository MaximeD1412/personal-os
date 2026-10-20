import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { PantryItem } from '@personal-os/contracts';
import {
  BASE,
  LAIT,
  MAINTENANT,
  ouvrirLeStock,
  SPAGHETTI,
  YAOURT,
} from '../../testing/stock';

/** Fige l'horloge sur `MAINTENANT`, en laissant les minuteries réelles dont `whenStable` a besoin. */
function figerLHorloge(): void {
  jest.useFakeTimers({
    now: MAINTENANT,
    doNotFake: [
      'nextTick',
      'setImmediate',
      'clearImmediate',
      'setInterval',
      'clearInterval',
      'setTimeout',
      'clearTimeout',
      'queueMicrotask',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'requestIdleCallback',
      'cancelIdleCallback',
      'performance',
      'hrtime',
    ],
  });
}

type Ouvert = Awaited<ReturnType<typeof ouvrirLeStock>>;

/** L'écran ouvert, devant ce stock. */
async function ouvrir(
  url = '/repas/stock',
  stock: PantryItem[] = [LAIT, SPAGHETTI, YAOURT],
  options?: Parameters<typeof ouvrirLeStock>[1],
): Promise<Ouvert> {
  const ouvert = await ouvrirLeStock(url, options);
  ouvert.http.expectOne(`${BASE}/pantry-items`).flush(stock);
  await ouvert.harness.fixture.whenStable();
  return ouvert;
}

function ligne(el: HTMLElement, ingredientId: string): HTMLElement {
  return el.querySelector(`[data-ingredient="${ingredientId}"]`) as HTMLElement;
}

function champ(
  el: HTMLElement,
  ingredientId: string,
  nom: 'quantite' | 'peremption',
): HTMLInputElement {
  return ligne(el, ingredientId).querySelector(
    `[data-test="${nom}"]`,
  ) as HTMLInputElement;
}

/** Saisit une valeur, puis quitte le champ : c'est là qu'elle s'enregistre. */
async function saisir(
  ouvert: Ouvert,
  input: HTMLInputElement,
  valeur: string,
): Promise<void> {
  input.value = valeur;
  input.dispatchEvent(new Event('input'));
  input.dispatchEvent(new Event('change'));
  await ouvert.harness.fixture.whenStable();
}

/** Laisse la confirmation répondre, puis la requête partir. */
async function apresLaConfirmation(ouvert: Ouvert): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve));
  await ouvert.harness.fixture.whenStable();
}

describe('Le Stock domestique', () => {
  beforeEach(() => figerLHorloge());

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    jest.useRealTimers();
  });

  it('montre chaque ligne, sa quantité dans son unité et sa péremption, éditables en place', async () => {
    const { el } = await ouvrir();

    const lignes = [...el().querySelectorAll('[data-test="ligne"]')];
    expect(
      lignes.map((l) =>
        l.querySelector('[data-test="nom"]')?.textContent?.trim(),
      ),
    ).toEqual(['Lait demi-écrémé', 'Spaghetti', 'Yaourt nature']);

    expect(champ(el(), 'ingredient-lait', 'quantite').value).toBe('1000');
    expect(ligne(el(), 'ingredient-lait').textContent).toContain('ml');
    expect(champ(el(), 'ingredient-lait', 'peremption').value).toBe(
      '2026-10-21',
    );
    expect(champ(el(), 'ingredient-spaghetti', 'peremption').value).toBe('');
    expect(ligne(el(), 'ingredient-yaourt').textContent).toContain('pièce');
    expect(
      champ(el(), 'ingredient-lait', 'quantite').getAttribute('aria-label'),
    ).toBe('Quantité de Lait demi-écrémé, en ml');
  });

  it('met en avant la ligne qui périme dans les trois jours, et elle seule', async () => {
    const { el } = await ouvrir();

    const alerte = ligne(el(), 'ingredient-lait').querySelector(
      '[data-test="alerte"]',
    );
    expect(alerte?.textContent?.trim()).toBe('Périme demain');
    expect(alerte?.getAttribute('tone')).toBe('warning');
    expect(
      ligne(el(), 'ingredient-yaourt').querySelector('[data-test="alerte"]'),
    ).toBeNull();
    expect(
      ligne(el(), 'ingredient-spaghetti').querySelector('[data-test="alerte"]'),
    ).toBeNull();
  });

  it('enregistre une quantité à la sortie du champ, sans bouton, avec la péremption en place', async () => {
    const ouvert = await ouvrir();
    const { el, http } = ouvert;

    await saisir(ouvert, champ(el(), 'ingredient-lait', 'quantite'), '250');

    const correction = http.expectOne(`${BASE}/pantry-items/ingredient-lait`);
    expect(correction.request.method).toBe('PUT');
    expect(correction.request.body).toEqual({
      quantity: 250,
      expiresOn: '2026-10-21',
    });
    correction.flush({ ...LAIT, quantity: 250 });
    await ouvert.harness.fixture.whenStable();

    expect(champ(el(), 'ingredient-lait', 'quantite').value).toBe('250');
  });

  it('enregistre une péremption, ou son effacement, avec la quantité en place', async () => {
    const ouvert = await ouvrir();
    const { el, http } = ouvert;

    await saisir(
      ouvert,
      champ(el(), 'ingredient-yaourt', 'peremption'),
      '2026-10-22',
    );
    const datee = http.expectOne(`${BASE}/pantry-items/ingredient-yaourt`);
    expect(datee.request.body).toEqual({
      quantity: 4,
      expiresOn: '2026-10-22',
    });
    datee.flush({ ...YAOURT, expiresOn: '2026-10-22' });
    await ouvert.harness.fixture.whenStable();
    expect(
      ligne(el(), 'ingredient-yaourt').querySelector('[data-test="alerte"]')
        ?.textContent,
    ).toContain('Périme dans 2');

    await saisir(ouvert, champ(el(), 'ingredient-lait', 'peremption'), '');
    const effacee = http.expectOne(`${BASE}/pantry-items/ingredient-lait`);
    expect(effacee.request.body).toEqual({ quantity: 1000, expiresOn: null });
    effacee.flush({ ...LAIT, expiresOn: null });
  });

  it('garde les deux corrections d’une ligne modifiée deux fois avant la première réponse', async () => {
    const ouvert = await ouvrir();
    const { el, http } = ouvert;

    await saisir(ouvert, champ(el(), 'ingredient-lait', 'quantite'), '250');
    await saisir(
      ouvert,
      champ(el(), 'ingredient-lait', 'peremption'),
      '2026-10-25',
    );

    // Une seule correction part à la fois : la seconde attend la première.
    const premiere = http.expectOne(`${BASE}/pantry-items/ingredient-lait`);
    expect(premiere.request.body).toEqual({
      quantity: 250,
      expiresOn: '2026-10-21',
    });
    premiere.flush({ ...LAIT, quantity: 250 });
    await ouvert.harness.fixture.whenStable();

    const seconde = http.expectOne(`${BASE}/pantry-items/ingredient-lait`);
    expect(seconde.request.body).toEqual({
      quantity: 250,
      expiresOn: '2026-10-25',
    });
    seconde.flush({ ...LAIT, quantity: 250, expiresOn: '2026-10-25' });
    await ouvert.harness.fixture.whenStable();

    expect(champ(el(), 'ingredient-lait', 'quantite').value).toBe('250');
    expect(champ(el(), 'ingredient-lait', 'peremption').value).toBe(
      '2026-10-25',
    );
  });

  it('après un refus, renvoie la saisie reprise avec l’autre champ modifié entre-temps', async () => {
    const ouvert = await ouvrir();
    const { el, http } = ouvert;

    await saisir(ouvert, champ(el(), 'ingredient-lait', 'quantite'), '-3');
    await saisir(
      ouvert,
      champ(el(), 'ingredient-lait', 'peremption'),
      '2026-10-25',
    );
    http.expectOne(`${BASE}/pantry-items/ingredient-lait`).flush(
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
    TestBed.tick();
    http.expectOne(`${BASE}/pantry-items`).flush([LAIT, SPAGHETTI, YAOURT]);
    await ouvert.harness.fixture.whenStable();

    await saisir(ouvert, champ(el(), 'ingredient-lait', 'quantite'), '300');
    const reprise = http.expectOne(`${BASE}/pantry-items/ingredient-lait`);
    expect(reprise.request.body).toEqual({
      quantity: 300,
      expiresOn: '2026-10-25',
    });
    reprise.flush({ ...LAIT, quantity: 300, expiresOn: '2026-10-25' });
  });

  it("dit le refus de l'API sous le champ, qui garde la saisie à reprendre", async () => {
    const ouvert = await ouvrir();
    const { el, http } = ouvert;
    const quantite = champ(el(), 'ingredient-lait', 'quantite');

    await saisir(ouvert, quantite, '-3');
    http.expectOne(`${BASE}/pantry-items/ingredient-lait`).flush(
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
    // Le stock est relu : un autre Compte a pu le changer entre-temps.
    TestBed.tick();
    http.expectOne(`${BASE}/pantry-items`).flush([LAIT, SPAGHETTI, YAOURT]);
    await ouvert.harness.fixture.whenStable();

    const refus = ligne(el(), 'ingredient-lait').querySelector(
      '[data-test="refus"]',
    );
    expect(refus?.textContent).toContain(
      'La quantité ne peut pas être négative.',
    );
    expect(quantite.value).toBe('-3');
    expect(quantite.getAttribute('aria-invalid')).toBe('true');
    expect(quantite.getAttribute('aria-describedby')).toBe(refus?.id);

    await saisir(ouvert, quantite, '300');
    http
      .expectOne(`${BASE}/pantry-items/ingredient-lait`)
      .flush({ ...LAIT, quantity: 300 });
    await ouvert.harness.fixture.whenStable();
    expect(
      ligne(el(), 'ingredient-lait').querySelector('[data-test="refus"]'),
    ).toBeNull();
    expect(quantite.getAttribute('aria-invalid')).toBeNull();
  });

  it('retire une ligne après confirmation, puis relit le stock', async () => {
    const ouvert = await ouvrir();
    const { el, http, confirmations } = ouvert;

    (
      ligne(el(), 'ingredient-spaghetti').querySelector(
        '[data-test="retirer"]',
      ) as HTMLButtonElement
    ).click();
    await apresLaConfirmation(ouvert);

    expect(confirmations).toEqual([
      expect.objectContaining({
        title: 'Retirer « Spaghetti » du stock ?',
        destructive: true,
      }),
    ]);
    const suppression = http.expectOne(
      `${BASE}/pantry-items/ingredient-spaghetti`,
    );
    expect(suppression.request.method).toBe('DELETE');
    suppression.flush(null, { status: 204, statusText: 'No Content' });
    TestBed.tick();

    http.expectOne(`${BASE}/pantry-items`).flush([LAIT, YAOURT]);
    await ouvert.harness.fixture.whenStable();
    expect(ligne(el(), 'ingredient-spaghetti')).toBeNull();
  });

  it('ne retire rien quand la confirmation est annulée', async () => {
    const ouvert = await ouvrir('/repas/stock', undefined, { confirme: false });

    (
      ouvert.el().querySelector('[data-test="retirer"]') as HTMLButtonElement
    ).click();
    await apresLaConfirmation(ouvert);

    expect(ouvert.confirmations).toHaveLength(1);
  });

  it("cherche dans le stock par le nom de l'Ingrédient, sans casse ni accents, et garde la recherche dans l'URL", async () => {
    const ouvert = await ouvrir('/repas/stock?q=lait');
    const { el, router } = ouvert;

    expect(
      (el().querySelector('[data-test="recherche"]') as HTMLInputElement).value,
    ).toBe('lait');
    expect(el().querySelectorAll('[data-test="ligne"]')).toHaveLength(1);

    const recherche = el().querySelector(
      '[data-test="recherche"]',
    ) as HTMLInputElement;
    recherche.value = 'YAÖURT';
    recherche.dispatchEvent(new Event('input'));
    await ouvert.harness.fixture.whenStable();

    expect(
      [...el().querySelectorAll('[data-test="ligne"]')].map((l) =>
        l.getAttribute('data-ingredient'),
      ),
    ).toEqual(['ingredient-yaourt']);
    expect(router.url).toBe('/repas/stock?q=YA%C3%96URT');
  });

  it("dit qu'aucune ligne ne correspond à la recherche", async () => {
    const { el } = await ouvrir('/repas/stock?q=beurre');

    expect(el().textContent).toContain(
      'Aucune ligne du stock ne correspond à « beurre »',
    );
  });

  it('propose d’ajouter un premier Ingrédient à un stock vide', async () => {
    const { el } = await ouvrir('/repas/stock', []);

    expect(el().textContent).toContain('Le stock est vide');
    const ajouts = [...el().querySelectorAll('a')].filter(
      (lien) => lien.getAttribute('href') === '/repas/stock/nouveau',
    );
    expect(ajouts.length).toBeGreaterThan(0);
  });

  it('en mobile, fait de chaque ligne une carte, éditable de même', async () => {
    const ouvert = await ouvrir('/repas/stock', undefined, { largeur: 390 });
    const { el, http } = ouvert;

    expect(el().querySelector('table')).toBeNull();
    expect(el().querySelectorAll('[data-test="ligne"]')).toHaveLength(3);

    await saisir(ouvert, champ(el(), 'ingredient-yaourt', 'quantite'), '6');
    const correction = http.expectOne(`${BASE}/pantry-items/ingredient-yaourt`);
    expect(correction.request.body).toEqual({
      quantity: 6,
      expiresOn: '2026-11-02',
    });
    correction.flush({ ...YAOURT, quantity: 6 });
  });
});
