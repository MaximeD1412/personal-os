import {
  HttpTestingController,
  type TestRequest,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { MealPlan } from '@personal-os/contracts';
import {
  arrivee,
  BASE,
  FOYER,
  LUNDI,
  MAINTENANT,
  ouvrirLePlanning,
  PLANNING,
} from '../../testing/planning';

type Ouvert = Awaited<ReturnType<typeof ouvrirLePlanning>>;

function lectureDe(ouvert: Ouvert, semaine: string): TestRequest {
  return ouvert.http.expectOne(
    (requete) =>
      requete.url === `${BASE}/meal-plans` &&
      requete.params.get('week') === semaine,
  );
}

/** L'écran ouvert, devant le Foyer et le planning de sa semaine. */
async function ouvrir(
  url = `/repas/planning?semaine=${LUNDI}`,
  { planning = PLANNING, confirme = true } = {},
): Promise<Ouvert> {
  const ouvert = await ouvrirLePlanning(url, { confirme });
  ouvert.http.expectOne(`${BASE}/household`).flush(FOYER);
  lectureDe(ouvert, planning.week).flush(planning);
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
    await harness.fixture.whenStable();
    expect(el().textContent).toContain('Semaine du 26 octobre au 1 novembre');

    const retour = arrivee(router);
    bouton(el(), 'aujourdhui').click();
    await retour;
    TestBed.tick();
    expect(router.url).toBe(`/repas/planning?semaine=${LUNDI}`);
    lectureDe(ouvert, LUNDI).flush(PLANNING);
    await harness.fixture.whenStable();
    expect(el().textContent).toContain('Semaine du 19 au 25 octobre 2026');
  });

  it('arrête le planning après confirmation, puis ne propose plus d’ajout', async () => {
    const ouvert = await ouvrir();
    const { el, http, confirmations, harness } = ouvert;

    expect(bouton(el(), 'statut').textContent).toContain('Ouvert');
    bouton(el(), 'arreter').click();
    await apresLaConfirmation(ouvert);

    expect(confirmations[0].confirmLabel).toBe('Arrêter le planning');
    const arret = http.expectOne(`${BASE}/meal-plans/planning-1/stop`);
    expect(arret.request.method).toBe('POST');
    arret.flush({ ...PLANNING, status: 'STOPPED' } satisfies MealPlan);
    await harness.fixture.whenStable();

    expect(bouton(el(), 'statut').textContent).toContain('Arrêté');
    expect(bouton(el(), 'arreter')).toBeNull();
    expect(bouton(el(), 'rouvrir')).not.toBeNull();
    expect(el().querySelector('[data-test="ajouter"]')).toBeNull();
  });

  it('dit pourquoi l’API refuse d’arrêter le planning', async () => {
    const ouvert = await ouvrir();
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
    lectureDe(ouvert, LUNDI).flush(PLANNING);
    await harness.fixture.whenStable();

    expect(el().querySelector('[data-test="refus"]')?.textContent).toContain(
      'Un repas attend encore une décision.',
    );
    expect(bouton(el(), 'statut').textContent).toContain('Ouvert');
  });

  it('laisse la semaine affichée en paix quand l’arrêt d’une autre répond après', async () => {
    const ouvert = await ouvrir();
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
    const ouvert = await ouvrir();
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
    const ouvert = await ouvrir(undefined, { confirme: false });

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

  it('montre le message de l’API quand la lecture échoue', async () => {
    const ouvert = await ouvrirLePlanning(`/repas/planning?semaine=${LUNDI}`);
    ouvert.http.expectOne(`${BASE}/household`).flush(FOYER);
    lectureDe(ouvert, LUNDI).flush(
      { status: 503, code: 'unavailable', message: 'La base ne répond pas.' },
      { status: 503, statusText: 'Service Unavailable' },
    );
    await ouvert.harness.fixture.whenStable();

    expect(ouvert.el().textContent).toContain('La base ne répond pas.');
  });
});
