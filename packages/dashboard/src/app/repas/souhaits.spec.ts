import {
  HttpTestingController,
  type TestRequest,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { MealPlan, MealWish } from '@personal-os/contracts';
import {
  arrivee,
  BASE,
  DAHL_SOUHAITE,
  ENVIE_DE_POISSON,
  FOYER,
  LUNDI,
  MAINTENANT,
  ouvrirLePlanning,
  PLANNING,
  SOUHAITS,
} from '../../testing/planning';
import { DAHL, OMELETTE } from '../../testing/recettes';

type Ouvert = Awaited<ReturnType<typeof ouvrirLePlanning>>;

function souhaitsDe(ouvert: Ouvert, semaine: string): TestRequest {
  return ouvert.http.expectOne(
    (requete) =>
      requete.method === 'GET' &&
      requete.url === `${BASE}/meal-wishes` &&
      requete.params.get('week') === semaine,
  );
}

/** Le Planning ouvert, devant le Foyer, le planning et les Souhaits de sa semaine. */
async function ouvrir({
  souhaits = SOUHAITS,
  confirme = true,
  lien = '',
} = {}): Promise<Ouvert> {
  const ouvert = await ouvrirLePlanning(
    `/repas/planning?semaine=${LUNDI}${lien}`,
    { confirme },
  );
  ouvert.http.expectOne(`${BASE}/household`).flush(FOYER);
  ouvert.http
    .expectOne((requete) => requete.url === `${BASE}/meal-plans`)
    .flush(PLANNING);
  souhaitsDe(ouvert, LUNDI).flush(souhaits);
  await ouvert.harness.fixture.whenStable();
  return ouvert;
}

function panneau(el: HTMLElement): HTMLElement {
  return el.querySelector('[data-test="souhaits"]') as HTMLElement;
}

function lignes(el: HTMLElement): HTMLElement[] {
  return [
    ...panneau(el).querySelectorAll<HTMLElement>('[data-test="souhait"]'),
  ];
}

function trouver<T extends HTMLElement>(el: HTMLElement, test: string): T {
  return panneau(el).querySelector(`[data-test="${test}"]`) as T;
}

function saisir(el: HTMLElement, texte: string): void {
  const champ = trouver<HTMLInputElement>(el, 'envie');
  champ.value = texte;
  champ.dispatchEvent(new Event('input'));
}

function soumettre(el: HTMLElement): void {
  (panneau(el).querySelector('form') as HTMLFormElement).requestSubmit();
  TestBed.tick();
}

/** Laisse la confirmation répondre, puis la requête partir. */
async function apresLaConfirmation(ouvert: Ouvert): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve));
  await ouvert.harness.fixture.whenStable();
}

/** Seule l'horloge est figée : `whenStable` a besoin des vraies minuteries. */
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

describe('Les Souhaits de la semaine', () => {
  beforeEach(figerLHorloge);

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    jest.useRealTimers();
  });

  it('montre les Souhaits de la semaine, chacun avec son auteur', async () => {
    const { el } = await ouvrir();

    expect(panneau(el()).textContent).toContain('Souhaits de la semaine');
    expect(trouver(el(), 'compte').textContent?.trim()).toBe('2 souhaits');
    const [envie, recette] = lignes(el());
    expect(envie.textContent).toContain('Un plat de poisson');
    expect(envie.textContent).toContain('Léa');
    expect(envie.textContent).not.toContain('Recette');
    expect(recette.textContent).toContain('Dahl de lentilles corail');
    expect(recette.textContent).toContain('Maxime');
    expect(recette.textContent).toContain('Recette');
  });

  it('dit qu’une semaine n’a pas encore de Souhait', async () => {
    const { el } = await ouvrir({ souhaits: [] });

    expect(lignes(el())).toEqual([]);
    expect(panneau(el()).textContent).toContain(
      'Aucun souhait pour cette semaine',
    );
  });

  it('dépose une envie pour la semaine affichée, puis relit les Souhaits', async () => {
    const ouvert = await ouvrir({ souhaits: [] });
    const { el, http, harness } = ouvert;

    saisir(el(), '  Des pâtes fraîches ');
    soumettre(el());

    const depot = http.expectOne(
      (requete) =>
        requete.method === 'POST' && requete.url === `${BASE}/meal-wishes`,
    );
    expect(depot.request.body).toEqual({
      week: LUNDI,
      text: 'Des pâtes fraîches',
    });
    const depose: MealWish = {
      ...ENVIE_DE_POISSON,
      id: 'souhait-3',
      text: 'Des pâtes fraîches',
      authorId: 'compte-a',
    };
    depot.flush(depose);
    TestBed.tick();
    souhaitsDe(ouvert, LUNDI).flush([depose]);
    await harness.fixture.whenStable();

    expect(lignes(el()).map((ligne) => ligne.textContent)).toEqual([
      expect.stringContaining('Des pâtes fraîches'),
    ]);
    expect(trouver<HTMLInputElement>(el(), 'envie').value).toBe('');
  });

  it('garde la saisie reprise pendant l’envoi de l’envie précédente', async () => {
    const ouvert = await ouvrir({ souhaits: [] });
    const { el, http, harness } = ouvert;

    saisir(el(), 'Des pâtes fraîches');
    soumettre(el());
    const depot = http.expectOne(
      (requete) =>
        requete.method === 'POST' && requete.url === `${BASE}/meal-wishes`,
    );
    saisir(el(), 'Un gratin');
    TestBed.tick();
    depot.flush({
      ...ENVIE_DE_POISSON,
      id: 'souhait-3',
      text: 'Des pâtes fraîches',
    } satisfies MealWish);
    TestBed.tick();
    souhaitsDe(ouvert, LUNDI).flush([]);
    await harness.fixture.whenStable();

    expect(trouver<HTMLInputElement>(el(), 'envie').value).toBe('Un gratin');
  });

  it('garde l’envie quand la semaine change avant la réponse', async () => {
    const ouvert = await ouvrir({ souhaits: [] });
    const { el, http, router, harness } = ouvert;

    saisir(el(), 'Des pâtes fraîches');
    soumettre(el());
    const depot = http.expectOne(
      (requete) =>
        requete.method === 'POST' && requete.url === `${BASE}/meal-wishes`,
    );
    const suivante = arrivee(router);
    (
      el().querySelector('[data-test="semaine-suivante"]') as HTMLButtonElement
    ).click();
    await suivante;
    TestBed.tick();
    http
      .expectOne((requete) => requete.url === `${BASE}/meal-plans`)
      .flush({
        ...PLANNING,
        id: 'planning-2',
        week: '2026-10-26',
        entries: [],
      } satisfies MealPlan);
    souhaitsDe(ouvert, '2026-10-26').flush([]);
    await harness.fixture.whenStable();

    depot.flush({
      ...ENVIE_DE_POISSON,
      id: 'souhait-3',
      text: 'Des pâtes fraîches',
    } satisfies MealWish);
    TestBed.tick();
    souhaitsDe(ouvert, '2026-10-26').flush([]);
    await harness.fixture.whenStable();

    expect(trouver<HTMLInputElement>(el(), 'envie').value).toBe(
      'Des pâtes fraîches',
    );
  });

  it('préremplit l’envie depuis le lien, sans rien déposer', async () => {
    const { el, http } = await ouvrir({ lien: '&text=Des%20cr%C3%AApes' });

    expect(trouver<HTMLInputElement>(el(), 'envie').value).toBe('Des crêpes');
    expect(trouver(el(), 'ignores')).toBeNull();
    http.expectNone(
      (requete) =>
        requete.method === 'POST' && requete.url === `${BASE}/meal-wishes`,
    );
  });

  it('propose la Recette du lien, et la dépose sur un geste', async () => {
    const ouvert = await ouvrirLePlanning(
      `/repas/planning?semaine=${LUNDI}&recipeId=${OMELETTE.id}`,
    );
    const { el, http, harness } = ouvert;
    http.expectOne(`${BASE}/household`).flush(FOYER);
    http
      .expectOne((requete) => requete.url === `${BASE}/meal-plans`)
      .flush(PLANNING);
    souhaitsDe(ouvert, LUNDI).flush(SOUHAITS);
    TestBed.tick();
    http.expectOne(`${BASE}/recipes/${OMELETTE.id}`).flush(OMELETTE);
    http
      .expectOne((requete) => requete.url === `${BASE}/recipes`)
      .flush([DAHL, OMELETTE]);
    await harness.fixture.whenStable();

    const proposee = trouver<HTMLButtonElement>(el(), 'recette-proposee');
    expect(proposee.textContent).toContain(OMELETTE.title);
    http.expectNone(
      (requete) =>
        requete.method === 'POST' && requete.url === `${BASE}/meal-wishes`,
    );

    proposee.click();
    TestBed.tick();
    const depot = http.expectOne(
      (requete) =>
        requete.method === 'POST' && requete.url === `${BASE}/meal-wishes`,
    );
    expect(depot.request.body).toEqual({ week: LUNDI, recipeId: OMELETTE.id });
    depot.flush({
      ...DAHL_SOUHAITE,
      id: 'souhait-3',
      recipe: { id: OMELETTE.id, title: OMELETTE.title },
    } satisfies MealWish);
    TestBed.tick();
    souhaitsDe(ouvert, LUNDI).flush(SOUHAITS);
    await harness.fixture.whenStable();
  });

  it('signale une valeur du lien qu’il ne reprend pas', async () => {
    const trop = 'x'.repeat(161);
    const { el } = await ouvrir({ lien: `&text=${trop}` });

    expect(trouver<HTMLInputElement>(el(), 'envie').value).toBe('');
    expect(trouver(el(), 'ignores').textContent).toContain(`text=${trop}`);
  });

  it('signale une Recette du lien qui n’existe pas', async () => {
    const ouvert = await ouvrirLePlanning(
      `/repas/planning?semaine=${LUNDI}&recipeId=inconnue`,
    );
    const { el, http, harness } = ouvert;
    http.expectOne(`${BASE}/household`).flush(FOYER);
    http
      .expectOne((requete) => requete.url === `${BASE}/meal-plans`)
      .flush(PLANNING);
    souhaitsDe(ouvert, LUNDI).flush(SOUHAITS);
    TestBed.tick();
    http.expectOne(`${BASE}/recipes/inconnue`).flush(
      {
        status: 404,
        code: 'food.recipe_not_found',
        message: "Cette recette n'existe pas.",
      },
      { status: 404, statusText: 'Not Found' },
    );
    http
      .expectOne((requete) => requete.url === `${BASE}/recipes`)
      .flush([DAHL, OMELETTE]);
    await harness.fixture.whenStable();

    expect(trouver(el(), 'recette-proposee')).toBeNull();
    expect(trouver(el(), 'ignores').textContent).toContain('recipeId=inconnue');
  });

  it('ne dépose pas une envie vide', async () => {
    const { el, http } = await ouvrir();

    saisir(el(), '   ');
    soumettre(el());

    http.expectNone(`${BASE}/meal-wishes`);
  });

  it('montre sous le champ le message de l’API qui refuse l’envie', async () => {
    const ouvert = await ouvrir();
    const { el, http, harness } = ouvert;

    saisir(el(), 'x'.repeat(161));
    soumettre(el());
    http
      .expectOne(
        (requete) =>
          requete.method === 'POST' && requete.url === `${BASE}/meal-wishes`,
      )
      .flush(
        {
          status: 400,
          code: 'request.invalid',
          message: 'La requête est invalide.',
          fields: [
            {
              path: 'text',
              code: 'too_big',
              message: 'Au plus 160 caractères.',
            },
          ],
        },
        { status: 400, statusText: 'Bad Request' },
      );
    await harness.fixture.whenStable();

    expect(trouver(el(), 'erreur-envie').textContent).toContain(
      'Au plus 160 caractères.',
    );
  });

  it('dépose une Recette cherchée par son titre', async () => {
    const ouvert = await ouvrir();
    const { el, http, harness } = ouvert;

    trouver<HTMLButtonElement>(el(), 'mode-recette').click();
    TestBed.tick();
    http
      .expectOne((requete) => requete.url === `${BASE}/recipes`)
      .flush([DAHL, OMELETTE]);
    await harness.fixture.whenStable();

    const omelette = [
      ...panneau(el()).querySelectorAll<HTMLButtonElement>(
        '[data-test="recette"]',
      ),
    ].find((bouton) => bouton.textContent?.includes(OMELETTE.title));
    omelette?.click();
    TestBed.tick();

    const depot = http.expectOne(
      (requete) =>
        requete.method === 'POST' && requete.url === `${BASE}/meal-wishes`,
    );
    expect(depot.request.body).toEqual({ week: LUNDI, recipeId: OMELETTE.id });
    depot.flush({
      ...DAHL_SOUHAITE,
      id: 'souhait-3',
      recipe: { id: OMELETTE.id, title: OMELETTE.title },
    } satisfies MealWish);
    TestBed.tick();
    souhaitsDe(ouvert, LUNDI).flush(SOUHAITS);
    await harness.fixture.whenStable();
  });

  it('ne propose pas une Recette déjà souhaitée pour la semaine', async () => {
    const ouvert = await ouvrir();
    const { el, http, harness } = ouvert;

    trouver<HTMLButtonElement>(el(), 'mode-recette').click();
    TestBed.tick();
    http
      .expectOne((requete) => requete.url === `${BASE}/recipes`)
      .flush([DAHL, OMELETTE]);
    await harness.fixture.whenStable();

    const [dahl, omelette] = [
      ...panneau(el()).querySelectorAll<HTMLButtonElement>(
        '[data-test="recette"]',
      ),
    ];
    expect(dahl.disabled).toBe(true);
    expect(dahl.textContent).toContain('Déjà souhaitée');
    expect(omelette.disabled).toBe(false);
  });

  it('dit pourquoi l’API refuse une Recette', async () => {
    const ouvert = await ouvrir();
    const { el, http, harness } = ouvert;

    trouver<HTMLButtonElement>(el(), 'mode-recette').click();
    TestBed.tick();
    http
      .expectOne((requete) => requete.url === `${BASE}/recipes`)
      .flush([OMELETTE]);
    await harness.fixture.whenStable();
    trouver<HTMLButtonElement>(el(), 'recette').click();
    TestBed.tick();
    http
      .expectOne(
        (requete) =>
          requete.method === 'POST' && requete.url === `${BASE}/meal-wishes`,
      )
      .flush(
        {
          status: 422,
          code: 'food.wish_unknown_recipe',
          message: "Ce Souhait cite une Recette qui n'existe pas.",
        },
        { status: 422, statusText: 'Unprocessable Entity' },
      );
    await harness.fixture.whenStable();

    expect(trouver(el(), 'refus').textContent).toContain(
      "Ce Souhait cite une Recette qui n'existe pas.",
    );
  });

  it('retire un Souhait après confirmation', async () => {
    const ouvert = await ouvrir();
    const { el, http, confirmations, harness } = ouvert;

    lignes(el())[0]
      .querySelector<HTMLButtonElement>('[data-test="retirer"]')
      ?.click();
    await apresLaConfirmation(ouvert);

    expect(confirmations[0]).toMatchObject({
      title: 'Retirer «\u00a0Un plat de poisson\u00a0» ?',
      confirmLabel: 'Retirer le souhait',
      destructive: true,
    });
    const retrait = http.expectOne(`${BASE}/meal-wishes/souhait-1`);
    expect(retrait.request.method).toBe('DELETE');
    retrait.flush(null, { status: 204, statusText: 'No Content' });
    TestBed.tick();
    souhaitsDe(ouvert, LUNDI).flush([DAHL_SOUHAITE]);
    await harness.fixture.whenStable();

    expect(lignes(el())).toHaveLength(1);
  });

  it('ne retire rien quand on renonce', async () => {
    const ouvert = await ouvrir({ confirme: false });

    lignes(ouvert.el())[0]
      .querySelector<HTMLButtonElement>('[data-test="retirer"]')
      ?.click();
    await apresLaConfirmation(ouvert);

    ouvert.http.expectNone(`${BASE}/meal-wishes/souhait-1`);
  });

  it('suit la semaine affichée', async () => {
    const ouvert = await ouvrir();
    const { el, router, harness } = ouvert;

    const suivante = arrivee(router);
    (
      el().querySelector('[data-test="semaine-suivante"]') as HTMLButtonElement
    ).click();
    await suivante;
    TestBed.tick();
    ouvert.http
      .expectOne((requete) => requete.url === `${BASE}/meal-plans`)
      .flush({
        ...PLANNING,
        id: 'planning-2',
        week: '2026-10-26',
        entries: [],
      } satisfies MealPlan);
    souhaitsDe(ouvert, '2026-10-26').flush([]);
    await harness.fixture.whenStable();

    expect(lignes(el())).toEqual([]);
  });
});
