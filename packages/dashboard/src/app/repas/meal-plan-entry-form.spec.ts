import {
  HttpTestingController,
  type TestRequest,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { MealPlanEntry } from '@personal-os/contracts';
import { choisirDansLeSelect, valeurAffichee } from '../../testing/hlm-select';
import {
  arrivee,
  BASE,
  DAHL_DU_LUNDI,
  FOYER,
  LUNDI,
  MAINTENANT,
  ouvrirLePlanning,
  PLANNING,
} from '../../testing/planning';
import { DAHL, OMELETTE } from '../../testing/recettes';

type Ouvert = Awaited<ReturnType<typeof ouvrirLePlanning>>;

const NOUVEAU = '/repas/planning/nouveau';

function lectureDe(ouvert: Ouvert, semaine: string): TestRequest {
  return ouvert.http.expectOne(
    (requete) =>
      requete.url === `${BASE}/meal-plans` &&
      requete.params.get('week') === semaine,
  );
}

/** Le formulaire ouvert, devant le Foyer, le planning et les recettes. */
async function ouvrir(url: string, semaine = LUNDI): Promise<Ouvert> {
  const ouvert = await ouvrirLePlanning(url);
  ouvert.http.expectOne(`${BASE}/household`).flush(FOYER);
  lectureDe(ouvert, semaine).flush({ ...PLANNING, week: semaine });
  ouvert.http
    .expectOne((requete) => requete.url === `${BASE}/recipes`)
    .flush([DAHL, OMELETTE]);
  await ouvert.harness.fixture.whenStable();
  return ouvert;
}

function choisi(el: HTMLElement, groupe: string, attribut: string) {
  return el
    .querySelector(`[data-test="${groupe}"] [aria-pressed="true"]`)
    ?.getAttribute(attribut);
}

function participant(el: HTMLElement, id: string): HTMLButtonElement {
  return el.querySelector(`#participant-${id}`) as HTMLButtonElement;
}

function soumettre(el: HTMLElement): void {
  (el.querySelector('form') as HTMLFormElement).requestSubmit();
  TestBed.tick();
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

describe('L’ajout d’un Repas planifié', () => {
  beforeEach(figerLHorloge);

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    jest.useRealTimers();
  });

  it('se préremplit par son URL, Participants cochés par défaut, sans rien enregistrer', async () => {
    const { el, harness } = await ouvrir(
      `${NOUVEAU}?semaine=${LUNDI}&day=2026-10-20&moment=LUNCH&guestCount=2`,
    );

    expect(valeurAffichee(harness.fixture, 'jour')).toBe('mardi 20 octobre');
    expect(choisi(el(), 'moment', 'data-moment')).toBe('LUNCH');
    expect(choisi(el(), 'plat', 'data-plat')).toBe('recette');
    expect(participant(el(), 'compte-a').getAttribute('aria-checked')).toBe(
      'true',
    );
    expect(participant(el(), 'compte-b').getAttribute('aria-checked')).toBe(
      'true',
    );
    expect(
      el().querySelector('[role="spinbutton"]')?.getAttribute('aria-valuenow'),
    ).toBe('2');
    expect(el().textContent).toContain('4 portions');
    expect(el().querySelector('[data-test="ignores"]')).toBeNull();
  });

  it('prend la semaine du jour demandé', async () => {
    const { harness } = await ouvrir(
      `${NOUVEAU}?day=2026-10-28&moment=DINNER`,
      '2026-10-26',
    );

    expect(valeurAffichee(harness.fixture, 'jour')).toBe('mercredi 28 octobre');
  });

  it('passe à l’intitulé quand le lien en donne un', async () => {
    const { el } = await ouvrir(`${NOUVEAU}?title=Restaurant`);

    expect(choisi(el(), 'plat', 'data-plat')).toBe('intitule');
    expect(
      (el().querySelector('[data-test="intitule"]') as HTMLInputElement).value,
    ).toBe('Restaurant');
  });

  it('signale une valeur du lien qu’il n’a pas pu reprendre', async () => {
    const { el } = await ouvrir(`${NOUVEAU}?moment=BRUNCH`);

    expect(el().querySelector('[data-test="ignores"]')?.textContent).toContain(
      'moment=BRUNCH',
    );
    expect(choisi(el(), 'moment', 'data-moment')).toBeUndefined();
  });

  it('envoie la recette choisie et les Participants cochés, puis revient au planning', async () => {
    const { el, http, router, harness } = await ouvrir(
      `${NOUVEAU}?semaine=${LUNDI}&day=2026-10-19&moment=DINNER&guestCount=2`,
    );

    (
      [...el().querySelectorAll('[data-test="recette"]')].find((bouton) =>
        bouton.textContent?.includes('Dahl'),
      ) as HTMLButtonElement
    ).click();
    participant(el(), 'compte-a').click();
    await harness.fixture.whenStable();
    expect(el().textContent).toContain('3 portions');
    soumettre(el());

    const ajout = http.expectOne(`${BASE}/meal-plans/planning-1/entries`);
    expect(ajout.request.method).toBe('POST');
    expect(ajout.request.body).toEqual({
      day: '2026-10-19',
      moment: 'DINNER',
      recipeId: DAHL.id,
      participantIds: ['compte-b'],
      guestCount: 2,
    });
    const revenu = arrivee(router);
    ajout.flush({
      ...DAHL_DU_LUNDI,
      participantIds: ['compte-b'],
      servings: 3,
    } satisfies MealPlanEntry);
    await revenu;

    expect(router.url).toBe(`/repas/planning?semaine=${LUNDI}`);
    TestBed.tick();
    http.expectOne(`${BASE}/household`).flush(FOYER);
    lectureDe({ http } as Ouvert, LUNDI).flush(PLANNING);
  });

  it('envoie un intitulé sans recette', async () => {
    const { el, http, harness } = await ouvrir(
      `${NOUVEAU}?day=2026-10-21&moment=LUNCH&title=Restes`,
    );

    soumettre(el());

    const ajout = http.expectOne(`${BASE}/meal-plans/planning-1/entries`);
    expect(ajout.request.body).toEqual({
      day: '2026-10-21',
      moment: 'LUNCH',
      title: 'Restes',
      participantIds: ['compte-a', 'compte-b'],
      guestCount: 0,
    });
    ajout.flush(
      {
        status: 422,
        code: 'food.plan_stopped',
        message: 'Le planning est arrêté : rouvrez-le pour modifier ses repas.',
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    await harness.fixture.whenStable();

    expect(el().textContent).toContain(
      'Le planning est arrêté : rouvrez-le pour modifier ses repas.',
    );
  });

  it('montre sous son champ l’erreur que l’API y rattache', async () => {
    const { el, http, harness } = await ouvrir(
      `${NOUVEAU}?day=2026-10-21&moment=LUNCH`,
    );

    await choisirDansLeSelect(harness.fixture, 'jour', 'jeudi 22 octobre');
    soumettre(el());

    http.expectOne(`${BASE}/meal-plans/planning-1/entries`).flush(
      {
        status: 400,
        code: 'validation_failed',
        message: 'La saisie est invalide.',
        fields: [
          {
            path: 'title',
            code: 'custom',
            message:
              'Un repas porte soit une recette, soit un intitulé : jamais les deux, ni aucun.',
          },
        ],
      },
      { status: 400, statusText: 'Bad Request' },
    );
    await harness.fixture.whenStable();

    expect(el().querySelector('[data-champ="plat"]')?.textContent).toContain(
      'Un repas porte soit une recette, soit un intitulé',
    );
  });
});
