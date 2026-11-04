import {
  HttpTestingController,
  type TestRequest,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type {
  GenerationRound,
  MealPlan,
  MealPlanEntry,
  Recipe,
  ShoppingList,
} from '@personal-os/contracts';
import { CURRY_GENERE } from '../../testing/recettes';
import {
  arrivee,
  BASE,
  CURRY_DU_JEUDI,
  DAHL_DU_LUNDI,
  FOYER,
  LUNDI,
  MAINTENANT,
  ouvrirLePlanning,
  PLANNING,
  PLANNING_GENERE,
  PLANNING_STATUE,
  PREMIER_TOUR,
  RESTES_DU_MERCREDI,
} from '../../testing/planning';

type Ouvert = Awaited<ReturnType<typeof ouvrirLePlanning>>;

function lectureDe(ouvert: Ouvert, semaine: string): TestRequest {
  return ouvert.http.expectOne(
    (requete) =>
      requete.url === `${BASE}/meal-plans` &&
      requete.params.get('week') === semaine,
  );
}

/** Les Souhaits de la semaine, lus par leur panneau au-dessus de la grille. */
function souhaitsDe(ouvert: Ouvert, semaine: string): TestRequest {
  return ouvert.http.expectOne(
    (requete) =>
      requete.url === `${BASE}/meal-wishes` &&
      requete.params.get('week') === semaine,
  );
}

/** L'écran ouvert, devant le Foyer, le planning et les Souhaits de sa semaine. */
async function ouvrir(
  url = `/repas/planning?semaine=${LUNDI}`,
  { planning = PLANNING, confirme = true } = {},
): Promise<Ouvert> {
  const ouvert = await ouvrirLePlanning(url, { confirme });
  ouvert.http.expectOne(`${BASE}/household`).flush(FOYER);
  lectureDe(ouvert, planning.week).flush(planning);
  souhaitsDe(ouvert, planning.week).flush([]);
  await ouvert.harness.fixture.whenStable();
  return ouvert;
}

function jour(el: HTMLElement, date: string): HTMLElement {
  return el.querySelector(`[data-jour="${date}"]`) as HTMLElement;
}

function creneau(el: HTMLElement, date: string, moment: string): HTMLElement {
  return jour(el, date).querySelector(
    `[data-moment="${moment}"]`,
  ) as HTMLElement;
}

function bouton(el: HTMLElement, test: string): HTMLButtonElement {
  return el.querySelector(`[data-test="${test}"]`) as HTMLButtonElement;
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

describe('Le Planning de repas', () => {
  beforeEach(figerLHorloge);

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    jest.useRealTimers();
  });

  it('ouvre la semaine en cours sans semaine dans le lien, et y marque aujourd’hui', async () => {
    const { el } = await ouvrir('/repas/planning');

    expect(el().querySelector('h1')?.textContent).toContain(
      'Planning de repas',
    );
    expect(el().textContent).toContain('Semaine du 19 au 25 octobre 2026');
    expect(
      [...el().querySelectorAll('[data-jour]')].map((j) =>
        j.getAttribute('data-jour'),
      ),
    ).toEqual([
      '2026-10-19',
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
    ]);
    expect(jour(el(), '2026-10-20').getAttribute('aria-current')).toBe('date');
    expect(jour(el(), '2026-10-19').getAttribute('aria-current')).toBeNull();
  });

  it('ignore une semaine du lien qui n’est pas un lundi', async () => {
    const { el } = await ouvrir('/repas/planning?semaine=2026-10-21');

    expect(jour(el(), LUNDI)).not.toBeNull();
  });

  it('range chaque repas à son jour et à son moment, avec sa décision et ses portions', async () => {
    const { el } = await ouvrir();

    const diner = creneau(el(), LUNDI, 'DINNER');
    expect(diner.textContent).toContain('Dîner');
    const dahl = diner.querySelector('[data-test="repas"]') as HTMLElement;
    expect(dahl.textContent).toContain('Dahl de lentilles corail');
    expect(dahl.textContent).toContain('Approuvé');
    expect(dahl.textContent).toContain('4 portions');
    expect(dahl.textContent).toContain('dont 2 invités');
    // Les Participants se nomment par leur initiale, et en entier pour qui lit.
    expect(dahl.querySelector('[aria-label]')?.getAttribute('aria-label')).toBe(
      'Participants : Maxime, Léa',
    );

    const restes = creneau(el(), '2026-10-21', 'LUNCH').querySelector(
      '[data-test="repas"]',
    ) as HTMLElement;
    expect(restes.textContent).toContain('Restes du dahl');
    expect(restes.textContent).toContain('Proposé');
    expect(restes.textContent).toContain('1 portion');
    expect(restes.textContent).not.toContain('invité');
  });

  it('propose d’ajouter un repas à chaque créneau, par le formulaire prérempli', async () => {
    const { el } = await ouvrir();

    const ajout = creneau(el(), '2026-10-20', 'LUNCH').querySelector(
      '[data-test="ajouter"]',
    );
    expect(ajout?.getAttribute('href')).toBe(
      `/repas/planning/nouveau?semaine=${LUNDI}&day=2026-10-20&moment=LUNCH`,
    );
  });

  it('propose de déclarer cuisiné un repas approuvé, et lui seul, par son formulaire', async () => {
    const { el } = await ouvrir();

    const dahl = creneau(el(), LUNDI, 'DINNER').querySelector(
      '[data-test="repas"]',
    ) as HTMLElement;
    const cuisine = dahl.querySelector('[data-test="cuisine"]');
    expect(cuisine?.textContent).toContain('Cuisiné');
    expect(cuisine?.getAttribute('href')).toBe(
      '/repas/cuisine/nouveau?mealPlanEntryId=repas-1',
    );

    const restes = creneau(el(), '2026-10-21', 'LUNCH').querySelector(
      '[data-test="repas"]',
    ) as HTMLElement;
    expect(restes.querySelector('[data-test="cuisine"]')).toBeNull();
  });

  it('passe à la semaine suivante, puis revient à aujourd’hui', async () => {
    const ouvert = await ouvrir();
    const { el, router, harness } = ouvert;

    const suivante = arrivee(router);
    bouton(el(), 'semaine-suivante').click();
    await suivante;
    TestBed.tick();
    expect(router.url).toBe('/repas/planning?semaine=2026-10-26');
    lectureDe(ouvert, '2026-10-26').flush({
      ...PLANNING,
      id: 'planning-2',
      week: '2026-10-26',
      entries: [],
    } satisfies MealPlan);
    souhaitsDe(ouvert, '2026-10-26').flush([]);
    await harness.fixture.whenStable();
    expect(el().textContent).toContain('Semaine du 26 octobre au 1 novembre');

    const retour = arrivee(router);
    bouton(el(), 'aujourdhui').click();
    await retour;
    TestBed.tick();
    expect(router.url).toBe(`/repas/planning?semaine=${LUNDI}`);
    lectureDe(ouvert, LUNDI).flush(PLANNING);
    souhaitsDe(ouvert, LUNDI).flush([]);
    await harness.fixture.whenStable();
    expect(el().textContent).toContain('Semaine du 19 au 25 octobre 2026');
  });

  it('arrête le planning après confirmation, puis ne propose plus d’ajout', async () => {
    const ouvert = await ouvrir(undefined, { planning: PLANNING_STATUE });
    const { el, http, confirmations, harness } = ouvert;

    expect(bouton(el(), 'statut').textContent).toContain('Ouvert');
    bouton(el(), 'arreter').click();
    await apresLaConfirmation(ouvert);

    expect(confirmations[0].confirmLabel).toBe('Arrêter le planning');
    const arret = http.expectOne(`${BASE}/meal-plans/planning-1/stop`);
    expect(arret.request.method).toBe('POST');
    arret.flush({ ...PLANNING_STATUE, status: 'STOPPED' } satisfies MealPlan);
    await harness.fixture.whenStable();

    expect(bouton(el(), 'statut').textContent).toContain('Arrêté');
    expect(bouton(el(), 'arreter')).toBeNull();
    expect(bouton(el(), 'rouvrir')).not.toBeNull();
    expect(el().querySelector('[data-test="ajouter"]')).toBeNull();
  });

  it('dit pourquoi l’API refuse d’arrêter le planning', async () => {
    const ouvert = await ouvrir(undefined, { planning: PLANNING_STATUE });
    const { el, http, harness } = ouvert;

    bouton(el(), 'arreter').click();
    await apresLaConfirmation(ouvert);
    http.expectOne(`${BASE}/meal-plans/planning-1/stop`).flush(
      {
        status: 422,
        code: 'food.plan_has_pending',
        message: 'Un repas attend encore une décision.',
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    // Le refus relit le planning : un repas a pu changer entre-temps.
    TestBed.tick();
    lectureDe(ouvert, LUNDI).flush(PLANNING_STATUE);
    await harness.fixture.whenStable();

    expect(el().querySelector('[data-test="refus"]')?.textContent).toContain(
      'Un repas attend encore une décision.',
    );
    expect(bouton(el(), 'statut').textContent).toContain('Ouvert');
  });

  it('laisse la semaine affichée en paix quand l’arrêt d’une autre répond après', async () => {
    const ouvert = await ouvrir(undefined, { planning: PLANNING_STATUE });
    const { el, http, router, harness } = ouvert;

    bouton(el(), 'arreter').click();
    await apresLaConfirmation(ouvert);
    const arret = http.expectOne(`${BASE}/meal-plans/planning-1/stop`);

    const suivante = arrivee(router);
    bouton(el(), 'semaine-suivante').click();
    await suivante;
    TestBed.tick();
    lectureDe(ouvert, '2026-10-26').flush({
      ...PLANNING,
      id: 'planning-2',
      week: '2026-10-26',
      entries: [],
    } satisfies MealPlan);
    souhaitsDe(ouvert, '2026-10-26').flush([]);
    await harness.fixture.whenStable();

    arret.flush({ ...PLANNING, status: 'STOPPED' } satisfies MealPlan);
    await harness.fixture.whenStable();

    expect(el().textContent).toContain('Semaine du 26 octobre au 1 novembre');
    expect(bouton(el(), 'statut').textContent).toContain('Ouvert');
    bouton(el(), 'arreter').click();
    await apresLaConfirmation(ouvert);
    http.expectOne(`${BASE}/meal-plans/planning-2/stop`).flush({
      ...PLANNING,
      id: 'planning-2',
      week: '2026-10-26',
      entries: [],
      status: 'STOPPED',
    } satisfies MealPlan);
    await harness.fixture.whenStable();
  });

  it('ne montre pas sur une autre semaine le refus d’un arrêt', async () => {
    const ouvert = await ouvrir(undefined, { planning: PLANNING_STATUE });
    const { el, http, router, harness } = ouvert;

    bouton(el(), 'arreter').click();
    await apresLaConfirmation(ouvert);
    const arret = http.expectOne(`${BASE}/meal-plans/planning-1/stop`);

    const suivante = arrivee(router);
    bouton(el(), 'semaine-suivante').click();
    await suivante;
    TestBed.tick();
    lectureDe(ouvert, '2026-10-26').flush({
      ...PLANNING,
      id: 'planning-2',
      week: '2026-10-26',
      entries: [],
    } satisfies MealPlan);
    souhaitsDe(ouvert, '2026-10-26').flush([]);
    await harness.fixture.whenStable();

    arret.flush(
      {
        status: 422,
        code: 'food.plan_has_pending',
        message: 'Un repas attend encore une décision.',
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    TestBed.tick();
    await harness.fixture.whenStable();

    // Ni bandeau, ni relecture : `verify` refuserait une lecture en attente.
    expect(el().querySelector('[data-test="refus"]')).toBeNull();
    expect(el().textContent).toContain('Semaine du 26 octobre au 1 novembre');
  });

  it('n’arrête rien quand on renonce', async () => {
    const ouvert = await ouvrir(undefined, {
      planning: PLANNING_STATUE,
      confirme: false,
    });

    bouton(ouvert.el(), 'arreter').click();
    await apresLaConfirmation(ouvert);

    ouvert.http.expectNone(`${BASE}/meal-plans/planning-1/stop`);
  });

  it('rouvre un planning arrêté après confirmation', async () => {
    const ouvert = await ouvrir(undefined, {
      planning: { ...PLANNING, status: 'STOPPED' },
    });
    const { el, http, confirmations, harness } = ouvert;

    bouton(el(), 'rouvrir').click();
    await apresLaConfirmation(ouvert);

    expect(confirmations[0].confirmLabel).toBe('Rouvrir le planning');
    http
      .expectOne(`${BASE}/meal-plans/planning-1/reopen`)
      .flush({ ...PLANNING, status: 'OPEN' } satisfies MealPlan);
    await harness.fixture.whenStable();

    expect(bouton(el(), 'statut').textContent).toContain('Ouvert');
    expect(el().querySelector('[data-test="ajouter"]')).not.toBeNull();
  });

  describe('la liste de courses', () => {
    const ARRETE: MealPlan = { ...PLANNING, status: 'STOPPED' };

    it('ne se produit que d’un planning arrêté', async () => {
      const { el } = await ouvrir();

      expect(bouton(el(), 'produire')).toBeNull();
    });

    it('se produit après confirmation, puis s’ouvre', async () => {
      const ouvert = await ouvrir(undefined, { planning: ARRETE });
      const { el, http, confirmations, router } = ouvert;

      bouton(el(), 'produire').click();
      await apresLaConfirmation(ouvert);

      expect(confirmations[0].confirmLabel).toBe('Produire la liste');
      const production = http.expectOne(
        `${BASE}/meal-plans/planning-1/shopping-lists`,
      );
      expect(production.request.method).toBe('POST');
      const arrive = arrivee(router);
      production.flush({
        id: 'liste-1',
        mealPlan: { id: 'planning-1', week: LUNDI },
        status: 'OPEN',
        producedAt: '2026-10-20T10:00:00.000Z',
        closedAt: null,
        items: [],
      } satisfies ShoppingList);
      await arrive;

      expect(router.url).toBe('/courses/liste-1');
      // L'écran de la liste la lit, avec les autres listes ouvertes.
      http.match(({ url }) => url.startsWith(`${BASE}/shopping-lists`));
    });

    it('nomme chaque Ingrédient qui ne se convertit pas', async () => {
      const ouvert = await ouvrir(undefined, { planning: ARRETE });
      const { el, http, harness, router } = ouvert;

      bouton(el(), 'produire').click();
      await apresLaConfirmation(ouvert);
      http.expectOne(`${BASE}/meal-plans/planning-1/shopping-lists`).flush(
        {
          status: 422,
          code: 'food.conversion_missing',
          message:
            "Aucune liste n'est produite : 2 Ingrédients ne se convertissent pas en Unité canonique.",
          fields: [
            {
              path: 'ingredient-huile',
              code: 'dimension',
              message: 'Huile d’olive : une recette le donne en grammes.',
            },
            {
              path: 'ingredient-oeuf',
              code: 'facteur_manquant',
              message: 'Œuf : il faudrait son poids à la pièce.',
            },
          ],
        },
        { status: 422, statusText: 'Unprocessable Entity' },
      );
      await harness.fixture.whenStable();

      const refus = el().querySelector('[data-test="refus"]');
      expect(refus?.textContent).toContain("Aucune liste n'est produite");
      expect(
        [...(refus?.querySelectorAll('li') ?? [])].map((li) =>
          li.textContent?.trim(),
        ),
      ).toEqual([
        'Huile d’olive : une recette le donne en grammes.',
        'Œuf : il faudrait son poids à la pièce.',
      ]);
      expect(router.url).toBe(`/repas/planning?semaine=${LUNDI}`);
    });

    it('ne se produit pas quand on renonce', async () => {
      const ouvert = await ouvrir(undefined, {
        planning: ARRETE,
        confirme: false,
      });

      bouton(ouvert.el(), 'produire').click();
      await apresLaConfirmation(ouvert);

      ouvert.http.expectNone(`${BASE}/meal-plans/planning-1/shopping-lists`);
    });
  });

  it('montre le message de l’API quand la lecture échoue', async () => {
    const ouvert = await ouvrirLePlanning(`/repas/planning?semaine=${LUNDI}`);
    ouvert.http.expectOne(`${BASE}/household`).flush(FOYER);
    lectureDe(ouvert, LUNDI).flush(
      { status: 503, code: 'unavailable', message: 'La base ne répond pas.' },
      { status: 503, statusText: 'Service Unavailable' },
    );
    souhaitsDe(ouvert, LUNDI).flush([]);
    await ouvert.harness.fixture.whenStable();

    expect(ouvert.el().textContent).toContain('La base ne répond pas.');
  });
});

describe('La génération du Planning de repas', () => {
  beforeEach(figerLHorloge);

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    jest.useRealTimers();
  });

  /** Le repas proposé du mercredi midi. */
  function restes(el: HTMLElement): HTMLElement {
    return creneau(el, '2026-10-21', 'LUNCH').querySelector(
      '[data-test="repas"]',
    ) as HTMLElement;
  }

  const REFUSES: MealPlan = {
    ...PLANNING_GENERE,
    entries: [DAHL_DU_LUNDI, { ...RESTES_DU_MERCREDI, decision: 'REFUSED' }],
  };

  it('propose de générer la semaine tant qu’aucun tour n’est lancé', async () => {
    const { el } = await ouvrir();

    expect(bouton(el(), 'generer').getAttribute('href')).toBe(
      `/repas/planning/generer?semaine=${LUNDI}`,
    );
    expect(bouton(el(), 'relancer')).toBeNull();
    expect(el().querySelector('[data-test="tours"]')).toBeNull();
  });

  it('ne propose plus de générer une fois le premier tour lancé', async () => {
    const { el } = await ouvrir(undefined, { planning: PLANNING_GENERE });

    expect(bouton(el(), 'generer')).toBeNull();
    expect(bouton(el(), 'relancer')).not.toBeNull();
  });

  it('approuve un repas proposé', async () => {
    const { el, http, harness } = await ouvrir(undefined, {
      planning: PLANNING_GENERE,
    });

    expect(
      creneau(el(), LUNDI, 'DINNER').querySelector('[data-test="approuver"]'),
    ).toBeNull();
    bouton(restes(el()), 'approuver').click();

    const decision = http.expectOne(
      `${BASE}/meal-plans/planning-1/entries/repas-2/decision`,
    );
    expect(decision.request.method).toBe('POST');
    expect(decision.request.body).toEqual({ decision: 'APPROVED' });
    decision.flush({
      ...RESTES_DU_MERCREDI,
      decision: 'APPROVED',
    } satisfies MealPlanEntry);
    await harness.fixture.whenStable();

    expect(restes(el()).textContent).toContain('Approuvé');
    expect(bouton(restes(el()), 'approuver')).toBeNull();
    expect(bouton(restes(el()), 'refuser')).toBeNull();
  });

  it('refuse un repas proposé, qui reste au planning jusqu’au tour suivant', async () => {
    const { el, http, harness } = await ouvrir(undefined, {
      planning: PLANNING_GENERE,
    });

    bouton(restes(el()), 'refuser').click();
    const decision = http.expectOne(
      `${BASE}/meal-plans/planning-1/entries/repas-2/decision`,
    );
    expect(decision.request.body).toEqual({ decision: 'REFUSED' });
    decision.flush({
      ...RESTES_DU_MERCREDI,
      decision: 'REFUSED',
    } satisfies MealPlanEntry);
    await harness.fixture.whenStable();

    expect(restes(el()).textContent).toContain('Refusé');
    expect(restes(el()).textContent).toContain('Restes du dahl');
    expect(bouton(el(), 'relancer').disabled).toBe(false);
  });

  it('dit pourquoi l’API refuse une décision, et relit le planning', async () => {
    const ouvert = await ouvrir(undefined, { planning: PLANNING_GENERE });
    const { el, http, harness } = ouvert;

    bouton(restes(el()), 'approuver').click();
    http
      .expectOne(`${BASE}/meal-plans/planning-1/entries/repas-2/decision`)
      .flush(
        {
          status: 422,
          code: 'food.entry_not_proposed',
          message:
            "Ce repas n'est pas proposé : il est déjà approuvé ou refusé.",
        },
        { status: 422, statusText: 'Unprocessable Entity' },
      );
    TestBed.tick();
    lectureDe(ouvert, LUNDI).flush(REFUSES);
    await harness.fixture.whenStable();

    expect(el().querySelector('[data-test="refus"]')?.textContent).toContain(
      "Ce repas n'est pas proposé : il est déjà approuvé ou refusé.",
    );
    expect(restes(el()).textContent).toContain('Refusé');
  });

  it('ne relance pas un tour, ni n’arrête le planning, tant qu’un repas attend une décision', async () => {
    const { el, http, harness } = await ouvrir(undefined, {
      planning: PLANNING_GENERE,
    });

    expect(bouton(el(), 'relancer').disabled).toBe(true);
    expect(bouton(el(), 'arreter').disabled).toBe(true);
    expect(
      el().querySelector('[data-test="en-attente"]')?.textContent,
    ).toContain('1 repas attend une décision');

    bouton(restes(el()), 'approuver').click();
    http
      .expectOne(`${BASE}/meal-plans/planning-1/entries/repas-2/decision`)
      .flush({ ...RESTES_DU_MERCREDI, decision: 'APPROVED' });
    await harness.fixture.whenStable();

    // Le créneau écarté du jeudi reste à remplir : on peut relancer.
    expect(bouton(el(), 'relancer').disabled).toBe(false);
    expect(bouton(el(), 'arreter').disabled).toBe(false);
    expect(el().querySelector('[data-test="en-attente"]')).toBeNull();
  });

  it('n’a plus rien à relancer quand chaque créneau généré est approuvé', async () => {
    const { el } = await ouvrir(undefined, {
      planning: {
        ...PLANNING_STATUE,
        rounds: [{ ...PREMIER_TOUR, rejected: [] }],
      },
    });

    expect(bouton(el(), 'relancer').disabled).toBe(true);
    expect(bouton(el(), 'arreter').disabled).toBe(false);
  });

  it('relance un tour après confirmation, sans créneau, puis relit le planning', async () => {
    const ouvert = await ouvrir(undefined, { planning: REFUSES });
    const { el, http, confirmations, harness } = ouvert;

    bouton(el(), 'relancer').click();
    await apresLaConfirmation(ouvert);

    expect(confirmations[0].confirmLabel).toBe('Relancer un tour');
    const tour = http.expectOne(
      `${BASE}/meal-plans/planning-1/generation-rounds`,
    );
    expect(tour.request.method).toBe('POST');
    expect(tour.request.body).toEqual({ slots: [] });
    const nouveau: MealPlanEntry = {
      ...RESTES_DU_MERCREDI,
      id: 'repas-3',
      title: 'Soupe de potimarron',
    };
    tour.flush({
      id: 'tour-2',
      number: 2,
      traceId: 'trace-2',
      rejected: [],
      createdAt: '2026-10-20T10:00:00.000Z',
      entries: [nouveau],
    } satisfies GenerationRound);
    TestBed.tick();
    lectureDe(ouvert, LUNDI).flush({
      ...PLANNING,
      entries: [DAHL_DU_LUNDI, nouveau],
      rounds: [
        PREMIER_TOUR,
        {
          id: 'tour-2',
          number: 2,
          traceId: 'trace-2',
          rejected: [],
          createdAt: '2026-10-20T10:00:00.000Z',
        },
      ],
    } satisfies MealPlan);
    await harness.fixture.whenStable();

    expect(restes(el()).textContent).toContain('Soupe de potimarron');
    expect(restes(el()).textContent).toContain('Proposé');
    expect(el().querySelector('[data-test="tours"]')?.textContent).toContain(
      'Tour 2',
    );
  });

  it('montre tel quel le refus de l’API quand le plafond de l’IA est atteint', async () => {
    const ouvert = await ouvrir(undefined, { planning: REFUSES });
    const { el, http, harness } = ouvert;

    bouton(el(), 'relancer').click();
    await apresLaConfirmation(ouvert);
    http.expectOne(`${BASE}/meal-plans/planning-1/generation-rounds`).flush(
      {
        status: 422,
        code: 'ai.budget_exceeded',
        message:
          'Le plafond mensuel de dépense en IA est atteint : plus aucun appel jusqu’au mois prochain.',
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    TestBed.tick();
    lectureDe(ouvert, LUNDI).flush(REFUSES);
    await harness.fixture.whenStable();

    expect(el().querySelector('[data-test="refus"]')?.textContent).toContain(
      'Le plafond mensuel de dépense en IA est atteint : plus aucun appel jusqu’au mois prochain.',
    );
  });

  it('ne relance rien quand on renonce', async () => {
    const ouvert = await ouvrir(undefined, {
      planning: REFUSES,
      confirme: false,
    });

    bouton(ouvert.el(), 'relancer').click();
    await apresLaConfirmation(ouvert);

    ouvert.http.expectNone(`${BASE}/meal-plans/planning-1/generation-rounds`);
  });

  it('dit, à sa place, pourquoi le contrôle a vidé un créneau', async () => {
    const { el } = await ouvrir(undefined, { planning: PLANNING_GENERE });

    const ecarte = creneau(el(), '2026-10-22', 'DINNER').querySelector(
      '[data-test="ecarte"]',
    );
    expect(ecarte?.textContent).toContain(
      'Écarté : contient noix de cajou (fruits à coque), allergie de Maxime.',
    );
    expect(
      creneau(el(), '2026-10-22', 'LUNCH').querySelector(
        '[data-test="ecarte"]',
      ),
    ).toBeNull();
  });

  it('ne montre plus l’écart d’un créneau rempli depuis', async () => {
    const { el } = await ouvrir(undefined, {
      planning: {
        ...PLANNING_GENERE,
        entries: [
          ...PLANNING.entries,
          { ...DAHL_DU_LUNDI, id: 'repas-4', day: '2026-10-22' },
        ],
      },
    });

    expect(
      creneau(el(), '2026-10-22', 'DINNER').querySelector(
        '[data-test="ecarte"]',
      ),
    ).toBeNull();
  });

  it('mène à la trace de chaque tour', async () => {
    const { el } = await ouvrir(undefined, { planning: PLANNING_GENERE });

    const tours = el().querySelector('[data-test="tours"]') as HTMLElement;
    expect(tours.textContent).toContain('Tour 1');
    expect(tours.textContent).toContain('1 créneau écarté');
    expect(
      tours.querySelector('[data-test="trace"]')?.getAttribute('href'),
    ).toBe(`/repas/generation/traces/trace-1?semaine=${LUNDI}`);
  });

  it('prévient, avant d’arrêter, que les repas refusés seront retirés', async () => {
    const ouvert = await ouvrir(undefined, { planning: REFUSES });

    bouton(ouvert.el(), 'arreter').click();
    await apresLaConfirmation(ouvert);

    expect(ouvert.confirmations[0].description).toContain(
      'Le repas refusé est retiré.',
    );
    ouvert.http
      .expectOne(`${BASE}/meal-plans/planning-1/stop`)
      .flush({ ...PLANNING_STATUE, status: 'STOPPED' } satisfies MealPlan);
    await ouvert.harness.fixture.whenStable();
  });
});

describe('Garder la recette d’un repas', () => {
  beforeEach(figerLHorloge);

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    jest.useRealTimers();
  });

  /** Le curry approuvé du jeudi midi, puis un curry encore proposé le vendredi. */
  const AVEC_LE_CURRY: MealPlan = {
    ...PLANNING_STATUE,
    entries: [
      DAHL_DU_LUNDI,
      CURRY_DU_JEUDI,
      {
        ...CURRY_DU_JEUDI,
        id: 'repas-4',
        day: '2026-10-23',
        decision: 'PROPOSED',
      },
    ],
  };

  function repasDe(el: HTMLElement, date: string, moment: string): HTMLElement {
    return creneau(el, date, moment).querySelector(
      '[data-test="repas"]',
    ) as HTMLElement;
  }

  it('mène à la fiche de la recette de chaque repas', async () => {
    const { el } = await ouvrir(undefined, { planning: AVEC_LE_CURRY });

    expect(
      repasDe(el(), '2026-10-22', 'LUNCH')
        .querySelector('[data-test="fiche"]')
        ?.getAttribute('href'),
    ).toBe('/repas/recettes/recette-3');
    expect(
      repasDe(el(), LUNDI, 'DINNER')
        .querySelector('[data-test="fiche"]')
        ?.getAttribute('href'),
    ).toBe('/repas/recettes/recette-1');
  });

  it('ne propose de garder que la recette générée d’un repas approuvé', async () => {
    const { el } = await ouvrir(undefined, { planning: AVEC_LE_CURRY });

    expect(
      bouton(repasDe(el(), '2026-10-22', 'LUNCH'), 'garder')?.textContent,
    ).toContain('Garder la recette');
    expect(bouton(repasDe(el(), LUNDI, 'DINNER'), 'garder')).toBeNull();
    expect(bouton(repasDe(el(), '2026-10-23', 'LUNCH'), 'garder')).toBeNull();
  });

  it('garde la recette, puis ne le propose plus sur aucun de ses repas', async () => {
    const { el, http, harness } = await ouvrir(undefined, {
      planning: AVEC_LE_CURRY,
    });

    bouton(repasDe(el(), '2026-10-22', 'LUNCH'), 'garder').click();
    const garde = http.expectOne(`${BASE}/recipes/recette-3/keep`);
    expect(garde.request.method).toBe('POST');
    garde.flush({ ...CURRY_GENERE, kept: true } satisfies Recipe);
    await harness.fixture.whenStable();

    expect(el().querySelector('[data-test="garder"]')).toBeNull();
  });

  it('dit pourquoi l’API refuse de garder la recette', async () => {
    const ouvert = await ouvrir(undefined, { planning: AVEC_LE_CURRY });
    const { el, http, harness } = ouvert;

    bouton(repasDe(el(), '2026-10-22', 'LUNCH'), 'garder').click();
    http.expectOne(`${BASE}/recipes/recette-3/keep`).flush(
      {
        status: 422,
        code: 'food.recipe_already_kept',
        message: 'Cette recette est déjà dans vos recettes.',
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    // Le refus relit le planning : l'autre Compte a pu la garder entre-temps.
    TestBed.tick();
    lectureDe(ouvert, LUNDI).flush(AVEC_LE_CURRY);
    await harness.fixture.whenStable();

    expect(el().querySelector('[data-test="refus"]')?.textContent).toContain(
      'Cette recette est déjà dans vos recettes.',
    );
  });
});
