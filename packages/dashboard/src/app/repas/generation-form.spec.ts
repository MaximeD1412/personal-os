import {
  HttpTestingController,
  type TestRequest,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type {
  GenerationRound,
  MealPlan,
  MealPlanEntry,
} from '@personal-os/contracts';
import {
  arrivee,
  BASE,
  DAHL_DU_LUNDI,
  FOYER,
  LUNDI,
  MAINTENANT,
  NOIX_DU_JEUDI,
  ouvrirLePlanning,
  PLANNING,
  PLANNING_GENERE,
} from '../../testing/planning';

type Ouvert = Awaited<ReturnType<typeof ouvrirLePlanning>>;

const GENERER = '/repas/planning/generer';
const SEMAINE_SUIVANTE = '2026-10-26';

function lectureDe(ouvert: Pick<Ouvert, 'http'>, semaine: string): TestRequest {
  return ouvert.http.expectOne(
    (requete) =>
      requete.url === `${BASE}/meal-plans` &&
      requete.params.get('week') === semaine,
  );
}

function souhaitsDe(
  ouvert: Pick<Ouvert, 'http'>,
  semaine: string,
): TestRequest {
  return ouvert.http.expectOne(
    (requete) =>
      requete.url === `${BASE}/meal-wishes` &&
      requete.params.get('week') === semaine,
  );
}

/** Le formulaire ouvert, devant le Foyer et le planning de sa semaine. */
async function ouvrir(url: string, planning: MealPlan = PLANNING) {
  const ouvert = await ouvrirLePlanning(url);
  ouvert.http.expectOne(`${BASE}/household`).flush(FOYER);
  lectureDe(ouvert, planning.week).flush(planning);
  await ouvert.harness.fixture.whenStable();
  return ouvert;
}

function creneau(el: HTMLElement, day: string, moment: string): HTMLElement {
  return el.querySelector(`[data-creneau="${day}-${moment}"]`) as HTMLElement;
}

/** La case d'un créneau : cochée, il est à générer. */
function caseDe(el: HTMLElement, day: string, moment: string) {
  return creneau(el, day, moment).querySelector(
    '[data-test="a-generer"] [role="checkbox"]',
  ) as HTMLButtonElement | null;
}

function coches(el: HTMLElement): string[] {
  return [...el.querySelectorAll('[data-creneau]')]
    .filter(
      (un) =>
        un
          .querySelector('[data-test="a-generer"] [role="checkbox"]')
          ?.getAttribute('aria-checked') === 'true',
    )
    .map((un) => un.getAttribute('data-creneau') as string);
}

function participant(
  el: HTMLElement,
  day: string,
  moment: string,
  id: string,
): HTMLButtonElement {
  return creneau(el, day, moment).querySelector(
    `[data-participant="${id}"] [role="checkbox"]`,
  ) as HTMLButtonElement;
}

function invites(el: HTMLElement, day: string, moment: string): string | null {
  return (
    creneau(el, day, moment)
      .querySelector('[role="spinbutton"]')
      ?.getAttribute('aria-valuenow') ?? null
  );
}

function soumettre(el: HTMLElement): void {
  (el.querySelector('form') as HTMLFormElement).requestSubmit();
  TestBed.tick();
}

function bouton(el: HTMLElement, test: string): HTMLButtonElement {
  return el.querySelector(`[data-test="${test}"]`) as HTMLButtonElement;
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

const TOUR_1: GenerationRound = {
  id: 'tour-1',
  number: 1,
  traceId: 'trace-1',
  rejected: [],
  createdAt: '2026-10-20T10:00:00.000Z',
  entries: [],
};

describe('La génération de la semaine', () => {
  beforeEach(figerLHorloge);

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    jest.useRealTimers();
  });

  it('coche par défaut chaque créneau encore vide, avec tout le Foyer, sans rien envoyer', async () => {
    const { el } = await ouvrir(`${GENERER}?semaine=${LUNDI}`);

    expect(el().querySelector('h1')?.textContent).toContain(
      'Générer la semaine',
    );
    expect(coches(el())).toHaveLength(12);
    // Le dîner du lundi et le déjeuner du mercredi ont déjà leur repas.
    expect(caseDe(el(), LUNDI, 'DINNER')).toBeNull();
    expect(creneau(el(), LUNDI, 'DINNER').textContent).toContain(
      'Dahl de lentilles corail',
    );
    expect(caseDe(el(), '2026-10-21', 'LUNCH')).toBeNull();
    expect(
      participant(el(), '2026-10-20', 'LUNCH', 'compte-a').getAttribute(
        'aria-checked',
      ),
    ).toBe('true');
    expect(
      participant(el(), '2026-10-20', 'LUNCH', 'compte-b').getAttribute(
        'aria-checked',
      ),
    ).toBe('true');
    expect(invites(el(), '2026-10-20', 'LUNCH')).toBe('0');
    expect(el().querySelector('[data-test="compte"]')?.textContent).toContain(
      '12 créneaux à générer',
    );
  });

  it('se préremplit par son URL : le jour, le moment et les Invités du lien', async () => {
    const { el } = await ouvrir(
      `${GENERER}?semaine=${LUNDI}&day=2026-10-20&moment=DINNER&guestCount=2`,
    );

    expect(coches(el())).toEqual(['2026-10-20-DINNER']);
    expect(invites(el(), '2026-10-20', 'DINNER')).toBe('2');
    expect(el().querySelector('[data-test="ignores"]')).toBeNull();
  });

  it('prend la semaine du jour demandé', async () => {
    const { el } = await ouvrir(`${GENERER}?day=2026-10-28`, {
      ...PLANNING,
      week: '2026-10-26',
      entries: [],
    });

    expect(coches(el())).toEqual(['2026-10-28-LUNCH', '2026-10-28-DINNER']);
  });

  it('signale une valeur du lien qu’il n’a pas pu reprendre', async () => {
    const { el } = await ouvrir(`${GENERER}?semaine=${LUNDI}&moment=BRUNCH`);

    expect(el().querySelector('[data-test="ignores"]')?.textContent).toContain(
      'moment=BRUNCH',
    );
    expect(coches(el())).toHaveLength(12);
  });

  it('envoie les créneaux cochés et leur tablée, puis revient au planning', async () => {
    const { el, http, router, harness } = await ouvrir(
      `${GENERER}?semaine=${LUNDI}&day=2026-10-20`,
    );

    participant(el(), '2026-10-20', 'LUNCH', 'compte-b').click();
    caseDe(el(), '2026-10-22', 'DINNER')?.click();
    await harness.fixture.whenStable();
    expect(el().querySelector('[data-test="compte"]')?.textContent).toContain(
      '3 créneaux à générer',
    );
    soumettre(el());

    const tour = http.expectOne(
      `${BASE}/meal-plans/planning-1/generation-rounds`,
    );
    expect(tour.request.method).toBe('POST');
    expect(tour.request.body).toEqual({
      slots: [
        {
          day: '2026-10-20',
          moment: 'LUNCH',
          participantIds: ['compte-a'],
          guestCount: 0,
        },
        {
          day: '2026-10-20',
          moment: 'DINNER',
          participantIds: ['compte-a', 'compte-b'],
          guestCount: 0,
        },
        {
          day: '2026-10-22',
          moment: 'DINNER',
          participantIds: ['compte-a', 'compte-b'],
          guestCount: 0,
        },
      ],
    });
    const revenu = arrivee(router);
    tour.flush(TOUR_1);
    await revenu;

    expect(router.url).toBe(`/repas/planning?semaine=${LUNDI}`);
    TestBed.tick();
    http.expectOne(`${BASE}/household`).flush(FOYER);
    lectureDe({ http }, LUNDI).flush(PLANNING);
    souhaitsDe({ http }, LUNDI).flush([]);
  });

  it('ne ramène pas au planning de sa semaine quand le tour répond après qu’on a quitté le formulaire', async () => {
    const { el, http, router, harness } = await ouvrir(
      `${GENERER}?semaine=${LUNDI}&day=2026-10-20&moment=LUNCH`,
    );
    soumettre(el());
    const tour = http.expectOne(
      `${BASE}/meal-plans/planning-1/generation-rounds`,
    );

    const annule = arrivee(router);
    (
      [...el().querySelectorAll('button[type="button"]')].find((bouton) =>
        bouton.textContent?.includes('Annuler'),
      ) as HTMLButtonElement
    ).click();
    await annule;
    TestBed.tick();
    http.expectOne(`${BASE}/household`).flush(FOYER);
    lectureDe({ http }, LUNDI).flush(PLANNING);
    souhaitsDe({ http }, LUNDI).flush([]);
    TestBed.tick();

    await router.navigateByUrl(`/repas/planning?semaine=${SEMAINE_SUIVANTE}`);
    TestBed.tick();
    lectureDe({ http }, SEMAINE_SUIVANTE).flush({
      ...PLANNING,
      id: 'planning-2',
      week: SEMAINE_SUIVANTE,
      entries: [],
    });
    souhaitsDe({ http }, SEMAINE_SUIVANTE).flush([]);
    TestBed.tick();

    tour.flush(TOUR_1);
    await harness.fixture.whenStable();

    expect(router.url).toBe(`/repas/planning?semaine=${SEMAINE_SUIVANTE}`);
  });

  it('n’envoie rien sans créneau coché', async () => {
    const { el, harness } = await ouvrir(
      `${GENERER}?semaine=${LUNDI}&day=2026-10-20&moment=LUNCH`,
    );

    caseDe(el(), '2026-10-20', 'LUNCH')?.click();
    await harness.fixture.whenStable();

    expect(
      (el().querySelector('button[type="submit"]') as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it('montre tel quel le refus de l’API quand le plafond de l’IA est atteint', async () => {
    const { el, http, harness } = await ouvrir(
      `${GENERER}?semaine=${LUNDI}&day=2026-10-20&moment=LUNCH`,
    );

    soumettre(el());
    http.expectOne(`${BASE}/meal-plans/planning-1/generation-rounds`).flush(
      {
        status: 422,
        code: 'ai.budget_exceeded',
        message:
          'Le plafond mensuel de dépense en IA est atteint : plus aucun appel jusqu’au mois prochain.',
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    await harness.fixture.whenStable();

    expect(el().querySelector('[data-test="refus"]')?.textContent).toContain(
      'Le plafond mensuel de dépense en IA est atteint : plus aucun appel jusqu’au mois prochain.',
    );
  });

  it('montre sous son créneau l’erreur que l’API y rattache', async () => {
    const { el, http, harness } = await ouvrir(
      `${GENERER}?semaine=${LUNDI}&day=2026-10-20`,
    );

    soumettre(el());
    http.expectOne(`${BASE}/meal-plans/planning-1/generation-rounds`).flush(
      {
        status: 400,
        code: 'validation_failed',
        message: 'La saisie est invalide.',
        fields: [
          {
            path: 'slots.1.guestCount',
            code: 'too_big',
            message: 'Trop d’invités.',
          },
        ],
      },
      { status: 400, statusText: 'Bad Request' },
    );
    await harness.fixture.whenStable();

    expect(creneau(el(), '2026-10-20', 'DINNER').textContent).toContain(
      'Trop d’invités.',
    );
    expect(creneau(el(), '2026-10-20', 'LUNCH').textContent).not.toContain(
      'Trop d’invités.',
    );
  });

  it('renvoie au planning quand le premier tour est déjà lancé', async () => {
    const { el } = await ouvrir(`${GENERER}?semaine=${LUNDI}`, PLANNING_GENERE);

    expect(
      el().querySelector('[data-test="deja-genere"]')?.textContent,
    ).toContain('Le premier tour est lancé');
    expect(el().querySelector('[data-creneau]')).toBeNull();
    expect(
      (el().querySelector('button[type="submit"]') as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  /*
   * Le flux du ticket, devant une API qui répond comme le double de l'IA :
   * générer, statuer, relancer, arrêter.
   */
  it('mène de la génération à l’arrêt du planning', async () => {
    const vide: MealPlan = { ...PLANNING, entries: [DAHL_DU_LUNDI] };
    const ouvert = await ouvrirLePlanning(`/repas/planning?semaine=${LUNDI}`);
    const { http, router, harness, el, confirmations } = ouvert;
    http.expectOne(`${BASE}/household`).flush(FOYER);
    lectureDe(ouvert, LUNDI).flush(vide);
    souhaitsDe(ouvert, LUNDI).flush([]);
    await harness.fixture.whenStable();

    // Générer : le formulaire, prérempli de la semaine.
    let navigation = arrivee(router);
    bouton(el(), 'generer').click();
    await navigation;
    TestBed.tick();
    http.expectOne(`${BASE}/household`).flush(FOYER);
    lectureDe(ouvert, LUNDI).flush(vide);
    await harness.fixture.whenStable();
    expect(coches(el())).toHaveLength(13);

    const soupe: MealPlanEntry = {
      ...DAHL_DU_LUNDI,
      id: 'repas-10',
      day: '2026-10-20',
      moment: 'LUNCH',
      recipe: { id: 'recette-2', title: 'Soupe de potimarron' },
      guestCount: 0,
      servings: 2,
      decision: 'PROPOSED',
    };
    const curry: MealPlanEntry = {
      ...soupe,
      id: 'repas-11',
      moment: 'DINNER',
      recipe: { id: 'recette-3', title: 'Curry de pois chiches' },
    };
    navigation = arrivee(router);
    soumettre(el());
    http
      .expectOne(`${BASE}/meal-plans/planning-1/generation-rounds`)
      .flush({ ...TOUR_1, entries: [soupe, curry], rejected: [NOIX_DU_JEUDI] });
    await navigation;
    TestBed.tick();
    const genere: MealPlan = {
      ...vide,
      entries: [DAHL_DU_LUNDI, soupe, curry],
      rounds: [{ ...PLANNING_GENERE.rounds[0] }],
    };
    http.expectOne(`${BASE}/household`).flush(FOYER);
    lectureDe(ouvert, LUNDI).flush(genere);
    souhaitsDe(ouvert, LUNDI).flush([]);
    await harness.fixture.whenStable();

    const repasDu = (moment: string) =>
      el().querySelector(
        `[data-jour="2026-10-20"] [data-moment="${moment}"] [data-test="repas"]`,
      ) as HTMLElement;
    expect(bouton(el(), 'relancer').disabled).toBe(true);

    // Statuer : la soupe approuvée, le curry refusé.
    bouton(repasDu('LUNCH'), 'approuver').click();
    http
      .expectOne(`${BASE}/meal-plans/planning-1/entries/repas-10/decision`)
      .flush({ ...soupe, decision: 'APPROVED' });
    await harness.fixture.whenStable();
    expect(bouton(el(), 'relancer').disabled).toBe(true);
    bouton(repasDu('DINNER'), 'refuser').click();
    http
      .expectOne(`${BASE}/meal-plans/planning-1/entries/repas-11/decision`)
      .flush({ ...curry, decision: 'REFUSED' });
    await harness.fixture.whenStable();

    // Relancer : le tour 2 remplace le curry.
    expect(bouton(el(), 'relancer').disabled).toBe(false);
    bouton(el(), 'relancer').click();
    await new Promise((resolve) => setTimeout(resolve));
    await harness.fixture.whenStable();
    const tour = http.expectOne(
      `${BASE}/meal-plans/planning-1/generation-rounds`,
    );
    expect(tour.request.body).toEqual({ slots: [] });
    const gratin: MealPlanEntry = {
      ...curry,
      id: 'repas-12',
      recipe: { id: 'recette-4', title: 'Gratin de courge' },
    };
    tour.flush({
      ...TOUR_1,
      id: 'tour-2',
      number: 2,
      traceId: 'trace-2',
      entries: [gratin],
    });
    TestBed.tick();
    const relance: MealPlan = {
      ...genere,
      entries: [DAHL_DU_LUNDI, { ...soupe, decision: 'APPROVED' }, gratin],
      rounds: [
        ...genere.rounds,
        {
          id: 'tour-2',
          number: 2,
          traceId: 'trace-2',
          rejected: [],
          createdAt: '2026-10-20T10:05:00.000Z',
        },
      ],
    };
    lectureDe(ouvert, LUNDI).flush(relance);
    await harness.fixture.whenStable();
    expect(repasDu('DINNER').textContent).toContain('Gratin de courge');

    // Arrêter : une fois le gratin approuvé.
    expect(bouton(el(), 'arreter').disabled).toBe(true);
    bouton(repasDu('DINNER'), 'approuver').click();
    http
      .expectOne(`${BASE}/meal-plans/planning-1/entries/repas-12/decision`)
      .flush({ ...gratin, decision: 'APPROVED' });
    await harness.fixture.whenStable();
    bouton(el(), 'arreter').click();
    await new Promise((resolve) => setTimeout(resolve));
    await harness.fixture.whenStable();
    expect(confirmations.map(({ confirmLabel }) => confirmLabel)).toEqual([
      'Relancer un tour',
      'Arrêter le planning',
    ]);
    http
      .expectOne(`${BASE}/meal-plans/planning-1/stop`)
      .flush({ ...relance, status: 'STOPPED' } satisfies MealPlan);
    await harness.fixture.whenStable();

    expect(bouton(el(), 'statut').textContent).toContain('Arrêté');
    // Le flux entier, écran par écran : plus long que les 5 s par défaut quand
    // la machine est chargée.
  }, 20_000);
});
