import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  BASE,
  CORIANDRE,
  FOYER,
  NOIX,
  ouvrirLesPreferences,
} from '../../testing/preferences';

type Ouvert = Awaited<ReturnType<typeof ouvrirLesPreferences>>;

/** L'écran ouvert, devant le Foyer et ses Préférences. */
async function ouvrir(options?: { confirme?: boolean }): Promise<Ouvert> {
  const ouvert = await ouvrirLesPreferences('/foyer/preferences', options);
  ouvert.http.expectOne(`${BASE}/household`).flush(FOYER);
  ouvert.http.expectOne(`${BASE}/food-preferences`).flush([NOIX, CORIANDRE]);
  await ouvert.harness.fixture.whenStable();
  return ouvert;
}

function colonne(el: HTMLElement, compte: string): HTMLElement {
  return el.querySelector(`[data-compte="${compte}"]`) as HTMLElement;
}

function section(el: HTMLElement, compte: string, kind: string): HTMLElement {
  return colonne(el, compte).querySelector(
    `[data-section="${kind}"]`,
  ) as HTMLElement;
}

/** Laisse la confirmation répondre, puis la requête partir. */
async function apresLaConfirmation(ouvert: Ouvert): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve));
  await ouvert.harness.fixture.whenStable();
}

describe('Les Préférences alimentaires du Foyer', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('donne une colonne à chaque Compte, ses Préférences rangées par type', async () => {
    const { el } = await ouvrir();

    const colonnes = el().querySelectorAll('[data-test="compte"]');
    expect(
      [...colonnes].map((c) => c.querySelector('h2')?.textContent?.trim()),
    ).toEqual(['Maxime', 'Léa']);

    const allergies = section(el(), 'compte-a', 'ALLERGY');
    expect(allergies.querySelector('h3')?.textContent).toContain('Allergies');
    expect(
      allergies.querySelector('[data-test="preference"]')?.textContent,
    ).toContain('Fruits à coque');
    expect(allergies.textContent).toContain('Allergène');
    expect(section(el(), 'compte-a', 'DISLIKED').textContent).toContain(
      'Aucun aliment peu apprécié.',
    );

    const aversions = section(el(), 'compte-b', 'DISLIKED');
    expect(aversions.textContent).toContain('Coriandre fraîche');
    expect(aversions.textContent).toContain('Ingrédient');
    expect(section(el(), 'compte-b', 'ALLERGY').textContent).toContain(
      'Aucune allergie.',
    );
    expect(section(el(), 'compte-b', 'EXCLUDED').textContent).toContain(
      'Aucun aliment exclu.',
    );
  });

  it('ouvre l’ajout prérempli pour le Compte de la colonne', async () => {
    const { el } = await ouvrir();

    const ajout = colonne(el(), 'compte-b').querySelector(
      '[data-test="ajouter"]',
    );
    expect(ajout?.textContent).toContain('Ajouter une préférence pour Léa');
    expect(ajout?.getAttribute('href')).toBe(
      '/foyer/preferences/nouvelle?userId=compte-b',
    );
  });

  it('retire une Préférence après confirmation, puis relit le Foyer', async () => {
    const ouvert = await ouvrir();
    const { el, http, confirmations } = ouvert;

    (
      colonne(el(), 'compte-b').querySelector(
        '[aria-label="Retirer Coriandre fraîche"]',
      ) as HTMLButtonElement
    ).click();
    await apresLaConfirmation(ouvert);

    expect(confirmations).toEqual([
      expect.objectContaining({
        title: 'Retirer «\u00a0Coriandre fraîche\u00a0» ?',
        confirmLabel: 'Retirer la préférence',
        destructive: true,
      }),
    ]);
    const suppression = http.expectOne(`${BASE}/food-preferences/preference-2`);
    expect(suppression.request.method).toBe('DELETE');
    suppression.flush(null, { status: 204, statusText: 'No Content' });
    TestBed.tick();

    http.expectOne(`${BASE}/food-preferences`).flush([NOIX]);
    await ouvert.harness.fixture.whenStable();
    expect(section(el(), 'compte-b', 'DISLIKED').textContent).toContain(
      'Aucun aliment peu apprécié.',
    );
  });

  it('ne retire rien quand la confirmation est annulée', async () => {
    const ouvert = await ouvrir({ confirme: false });

    (
      ouvert.el().querySelector('[data-test="retirer"]') as HTMLButtonElement
    ).click();
    await apresLaConfirmation(ouvert);

    expect(ouvert.confirmations).toHaveLength(1);
    ouvert.http.expectNone(() => true);
  });

  it('affiche en bandeau le refus de l’API, tel qu’elle le formule', async () => {
    const ouvert = await ouvrir();
    const { el, http } = ouvert;

    (el().querySelector('[data-test="retirer"]') as HTMLButtonElement).click();
    await apresLaConfirmation(ouvert);
    http.expectOne(`${BASE}/food-preferences/preference-1`).flush(
      {
        status: 404,
        code: 'food.preference_not_found',
        message: 'Aucune Préférence alimentaire de cet identifiant.',
      },
      { status: 404, statusText: 'Not Found' },
    );
    TestBed.tick();
    http.expectOne(`${BASE}/food-preferences`).flush([CORIANDRE]);
    await ouvert.harness.fixture.whenStable();

    expect(el().querySelector('[data-test="refus"]')?.textContent).toContain(
      'Aucune Préférence alimentaire de cet identifiant.',
    );
  });

  it('affiche le message de l’API quand la lecture échoue', async () => {
    const { harness, http, el } =
      await ouvrirLesPreferences('/foyer/preferences');
    http.expectOne(`${BASE}/household`).flush(FOYER);
    http.expectOne(`${BASE}/food-preferences`).flush(
      {
        status: 403,
        code: 'scope.forbidden',
        message: "Cet Espace n'est pas le vôtre.",
      },
      { status: 403, statusText: 'Forbidden' },
    );
    await harness.fixture.whenStable();

    expect(el().textContent).toContain("Cet Espace n'est pas le vôtre.");
    expect(el().querySelector('[data-test="compte"]')).toBeNull();
  });
});
