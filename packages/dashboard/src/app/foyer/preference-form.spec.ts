import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { NavigationEnd, type Router } from '@angular/router';
import { filter, firstValueFrom } from 'rxjs';
import { BEURRE, OIGNON } from '../../testing/catalogue';
import { choisirDansLeSelect, valeurAffichee } from '../../testing/hlm-select';
import {
  BASE,
  CORIANDRE,
  FOYER,
  NOIX,
  ouvrirLesPreferences,
} from '../../testing/preferences';

const NOIX_POUR_MAXIME =
  '/foyer/preferences/nouvelle?userId=compte-a&kind=ALLERGY&target=ALLERGEN&allergen=TREE_NUTS';

/** La prochaine navigation achevée, quand la page suivante lit déjà l'API. */
function arrivee(router: Router): Promise<unknown> {
  return firstValueFrom(
    router.events.pipe(
      filter((evenement) => evenement instanceof NavigationEnd),
    ),
  );
}

/**
 * Le formulaire ouvert, devant le Foyer. Une lecture en attente (le
 * catalogue) retient la stabilité : sans `stable`, on ne fait que la détecter.
 */
async function ouvrir(url: string, { stable = true } = {}) {
  const ouvert = await ouvrirLesPreferences(url);
  ouvert.http.expectOne(`${BASE}/household`).flush(FOYER);
  if (stable) await ouvert.harness.fixture.whenStable();
  else TestBed.tick();
  return ouvert;
}

function choisi(el: HTMLElement, groupe: string, attribut: string) {
  return el
    .querySelector(`[data-test="${groupe}"] [aria-pressed="true"]`)
    ?.getAttribute(attribut);
}

function bouton(el: HTMLElement, selecteur: string): HTMLButtonElement {
  return el.querySelector(selecteur) as HTMLButtonElement;
}

function soumettre(el: HTMLElement): void {
  (el.querySelector('form') as HTMLFormElement).requestSubmit();
  TestBed.tick();
}

describe('L’ajout d’une Préférence alimentaire', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('se préremplit par son URL, sans rien enregistrer ni chercher', async () => {
    const { harness, http, el } = await ouvrir(NOIX_POUR_MAXIME);

    expect(choisi(el(), 'compte', 'data-compte')).toBe('compte-a');
    expect(choisi(el(), 'type', 'data-type')).toBe('ALLERGY');
    expect(choisi(el(), 'cible', 'data-cible')).toBe('ALLERGEN');
    expect(valeurAffichee(harness.fixture, 'allergene')).toBe('Fruits à coque');
    expect(el().querySelector('[data-test="ignores"]')).toBeNull();
    // Le catalogue n'est lu que pour viser un Ingrédient.
    http.expectNone(() => true);
  });

  it('signale une valeur du lien qu’il n’a pas pu reprendre', async () => {
    const { el } = await ouvrir(
      '/foyer/preferences/nouvelle?userId=compte-a&kind=VEGAN',
    );

    expect(el().querySelector('[data-test="ignores"]')?.textContent).toContain(
      'kind=VEGAN',
    );
    expect(choisi(el(), 'type', 'data-type')).toBeUndefined();
  });

  it('envoie un Allergène à « Ajouter », sans nommer d’Ingrédient, puis revient aux Préférences', async () => {
    const { harness, http, el, router } = await ouvrir(
      '/foyer/preferences/nouvelle?userId=compte-b',
    );

    bouton(el(), '[data-type="EXCLUDED"]').click();
    await choisirDansLeSelect(harness.fixture, 'allergene', 'Lait');
    soumettre(el());

    const creation = http.expectOne(`${BASE}/food-preferences`);
    expect(creation.request.method).toBe('POST');
    expect(creation.request.body).toEqual({
      userId: 'compte-b',
      kind: 'EXCLUDED',
      target: 'ALLERGEN',
      allergen: 'MILK',
    });
    const revenu = arrivee(router);
    creation.flush({
      ...NOIX,
      userId: 'compte-b',
      kind: 'EXCLUDED',
      allergen: 'MILK',
    });
    await revenu;

    expect(router.url).toBe('/foyer/preferences');
    TestBed.tick();
    http.expectOne(`${BASE}/household`).flush(FOYER);
    http.expectOne(`${BASE}/food-preferences`).flush([]);
  });

  it('cherche un Ingrédient dans le catalogue, et n’envoie que lui', async () => {
    const { harness, http, el } = await ouvrir(
      '/foyer/preferences/nouvelle?userId=compte-a&kind=DISLIKED',
    );

    bouton(el(), '[data-cible="INGREDIENT"]').click();
    TestBed.tick();
    http.expectOne(`${BASE}/ingredients`).flush([BEURRE, OIGNON]);
    await harness.fixture.whenStable();

    const recherche = el().querySelector(
      '[data-test="recherche"]',
    ) as HTMLInputElement;
    recherche.value = 'oign';
    recherche.dispatchEvent(new Event('input'));
    TestBed.tick();
    http
      .expectOne(
        ({ url, params }) =>
          url === `${BASE}/ingredients` && params.get('q') === 'oign',
      )
      .flush([OIGNON]);
    await harness.fixture.whenStable();

    const trouves = el().querySelectorAll('[data-test="ingredient"]');
    expect(trouves).toHaveLength(1);
    (trouves[0] as HTMLButtonElement).click();
    await harness.fixture.whenStable();
    expect(trouves[0].getAttribute('aria-pressed')).toBe('true');
    expect(el().querySelector('[data-test="choisi"]')?.textContent).toContain(
      'Oignon jaune',
    );

    soumettre(el());
    expect(http.expectOne(`${BASE}/food-preferences`).request.body).toEqual({
      userId: 'compte-a',
      kind: 'DISLIKED',
      target: 'INGREDIENT',
      ingredientId: 'ingredient-2',
    });
  });

  it('dit l’échec de la lecture du catalogue, et la reprend sur « Réessayer »', async () => {
    const { harness, http, el } = await ouvrir(
      '/foyer/preferences/nouvelle?userId=compte-a&kind=DISLIKED',
    );

    bouton(el(), '[data-cible="INGREDIENT"]').click();
    TestBed.tick();
    http.expectOne(`${BASE}/ingredients`).flush(
      {
        status: 503,
        code: 'database.unavailable',
        message: 'La base de données ne répond pas.',
      },
      { status: 503, statusText: 'Service Unavailable' },
    );
    await harness.fixture.whenStable();

    const trouves = el().querySelector('[data-test="trouves"]') as HTMLElement;
    expect(trouves.textContent).toContain('La base de données ne répond pas.');
    const reessayer = [...trouves.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Réessayer'),
    ) as HTMLButtonElement;
    expect(reessayer.type).toBe('button');

    reessayer.click();
    TestBed.tick();
    http.expectOne(`${BASE}/ingredients`).flush([BEURRE, OIGNON]);
    await harness.fixture.whenStable();

    expect(el().querySelectorAll('[data-test="ingredient"]')).toHaveLength(2);
    http.expectNone(`${BASE}/food-preferences`);
  });

  it('nomme l’Ingrédient que le lien désigne, la cible en découlant', async () => {
    const { harness, http, el } = await ouvrir(
      '/foyer/preferences/nouvelle?userId=compte-b&kind=DISLIKED&ingredientId=ingredient-3',
      { stable: false },
    );

    http.expectOne(`${BASE}/ingredients`).flush([BEURRE]);
    http.expectOne(`${BASE}/ingredients/ingredient-3`).flush({
      ...BEURRE,
      id: 'ingredient-3',
      displayName: CORIANDRE.ingredientDisplayName,
    });
    await harness.fixture.whenStable();

    expect(choisi(el(), 'cible', 'data-cible')).toBe('INGREDIENT');
    expect(el().querySelector('[data-test="choisi"]')?.textContent).toContain(
      'Coriandre fraîche',
    );
  });

  it('affiche le refus de l’API : en bandeau un doublon, sous le champ une erreur de forme', async () => {
    const { harness, http, el } = await ouvrir(NOIX_POUR_MAXIME);

    soumettre(el());
    http.expectOne(`${BASE}/food-preferences`).flush(
      {
        status: 422,
        code: 'food.preference_duplicate',
        message: 'Ce Compte a déjà cette Préférence alimentaire.',
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    await harness.fixture.whenStable();
    expect(el().querySelector('[data-test="refus"]')?.textContent).toContain(
      'Ce Compte a déjà cette Préférence alimentaire.',
    );

    soumettre(el());
    http.expectOne(`${BASE}/food-preferences`).flush(
      {
        status: 400,
        code: 'request.invalid',
        message: 'La requête est invalide.',
        fields: [
          {
            path: 'allergen',
            code: 'invalid_value',
            message: 'Choisissez un Allergène de la liste.',
          },
        ],
      },
      { status: 400, statusText: 'Bad Request' },
    );
    await harness.fixture.whenStable();
    expect(el().querySelector('[data-test="refus"]')).toBeNull();
    expect(el().querySelector('hlm-field-error')?.textContent).toContain(
      'Choisissez un Allergène de la liste.',
    );
  });
});
