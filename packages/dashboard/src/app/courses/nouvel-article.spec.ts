import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { NavigationEnd, type Router } from '@angular/router';
import type { ShoppingList, ShoppingListItem } from '@personal-os/contracts';
import { filter, firstValueFrom } from 'rxjs';
import {
  BASE,
  EPONGES,
  LISTE,
  LISTE_PRECEDENTE,
  ouvrirLesCourses,
} from '../../testing/courses';

const OUVERTES = `${BASE}/shopping-lists?status=OPEN`;

/** La prochaine navigation achevée, quand la page suivante lit déjà l'API. */
function arrivee(router: Router): Promise<unknown> {
  return firstValueFrom(
    router.events.pipe(
      filter((evenement) => evenement instanceof NavigationEnd),
    ),
  );
}

/** Le formulaire ouvert par son URL, devant ces listes ouvertes. */
async function ouvrir(
  url = '/courses/articles/nouveau',
  listes: ShoppingList[] = [LISTE],
) {
  const ouvert = await ouvrirLesCourses(url);
  TestBed.tick();
  ouvert.http.expectOne(OUVERTES).flush(listes);
  await ouvert.harness.fixture.whenStable();
  return ouvert;
}

function champ(el: HTMLElement, nom: string): HTMLInputElement {
  return el.querySelector(`[data-test="${nom}"]`) as HTMLInputElement;
}

function saisir(input: HTMLInputElement, valeur: string): void {
  input.value = valeur;
  input.dispatchEvent(new Event('input'));
  TestBed.tick();
}

function soumettre(el: HTMLElement): void {
  (el.querySelector('form') as HTMLFormElement).requestSubmit();
  TestBed.tick();
}

function listesProposees(el: HTMLElement): HTMLButtonElement[] {
  return [
    ...el.querySelectorAll('[data-test="liste"]'),
  ] as HTMLButtonElement[];
}

function texte(element: Element | null | undefined): string {
  return (element?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

const AJOUTE: ShoppingListItem = {
  ...EPONGES,
  id: 'article-9',
  label: 'Lait',
  quantity: 2,
};

describe('L’ajout d’un Article à la Liste de courses ouverte', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('se préremplit par son URL, sans rien enregistrer', async () => {
    const { el } = await ouvrir('/courses/articles/nouveau?label=Lait&quantity=2');

    expect(champ(el(), 'libelle').value).toBe('Lait');
    expect(champ(el(), 'quantite').value).toBe('2');
    expect(el().querySelector('[data-test="ignores"]')).toBeNull();
  });

  it('signale une valeur du lien qu’il n’a pas pu reprendre', async () => {
    const { el } = await ouvrir('/courses/articles/nouveau?label=Lait&quantity=-2');

    expect(texte(el().querySelector('[data-test="ignores"]'))).toContain(
      'quantity=-2',
    );
    expect(champ(el(), 'quantite').value).toBe('');
  });

  it('vise la liste ouverte, qu’il nomme', async () => {
    const { el } = await ouvrir('/courses/articles/nouveau?label=Lait');

    expect(texte(el().querySelector('[data-test="liste-visee"]'))).toContain(
      'Semaine du 2 novembre',
    );
    expect(listesProposees(el())).toHaveLength(0);
  });

  it('envoie l’Article à la liste ouverte, puis ouvre cette liste', async () => {
    const { harness, http, el, router } = await ouvrir(
      '/courses/articles/nouveau?label=Lait&quantity=2',
    );

    soumettre(el());
    const ajout = http.expectOne(`${BASE}/shopping-lists/liste-1/items`);
    expect(ajout.request.method).toBe('POST');
    expect(ajout.request.body).toEqual({ label: 'Lait', quantity: 2 });
    const revenu = arrivee(router);
    ajout.flush(AJOUTE);
    await revenu;

    expect(router.url).toBe('/courses/liste-1');
    // La liste s'ouvre, puis lit l'écart de son planning.
    TestBed.tick();
    http.expectOne(OUVERTES).flush([LISTE]);
    http
      .expectOne(`${BASE}/shopping-lists/liste-1`)
      .flush({ ...LISTE, items: [...LISTE.items, AJOUTE] });
    await new Promise((resolve) => setTimeout(resolve));
    TestBed.tick();
    http
      .match(({ url }) => url.endsWith('/shopping-gap'))
      .forEach((lecture) => lecture.flush({ missing: [] }));
    await harness.fixture.whenStable();
  });

  it('n’envoie pas de quantité quand elle est vide', async () => {
    const { http, el } = await ouvrir('/courses/articles/nouveau');

    saisir(champ(el(), 'libelle'), 'Éponges');
    soumettre(el());
    const ajout = http.expectOne(`${BASE}/shopping-lists/liste-1/items`);
    expect(ajout.request.body).toEqual({ label: 'Éponges' });
    ajout.flush(
      { status: 422, code: 'x', message: 'Refusé.' },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
  });

  it('parmi plusieurs listes ouvertes, propose la plus récente et laisse en choisir une autre', async () => {
    const { harness, http, el } = await ouvrir(
      '/courses/articles/nouveau?label=Lait',
      [LISTE, LISTE_PRECEDENTE],
    );

    const proposees = listesProposees(el());
    expect(proposees.map(texte)).toEqual([
      expect.stringContaining('Semaine du 2 novembre'),
      expect.stringContaining('Semaine du 26 octobre'),
    ]);
    expect(proposees[0].getAttribute('aria-pressed')).toBe('true');

    proposees[1].click();
    await harness.fixture.whenStable();
    expect(listesProposees(el())[1].getAttribute('aria-pressed')).toBe('true');

    soumettre(el());
    http.expectOne(`${BASE}/shopping-lists/liste-0/items`).flush(
      { status: 422, code: 'x', message: 'Refusé.' },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
  });

  it('sans liste ouverte, n’envoie rien et mène au planning pour en produire une', async () => {
    const { el } = await ouvrir('/courses/articles/nouveau?label=Lait', []);

    expect(el().textContent).toContain('Aucune liste de courses ouverte');
    const lien = el().querySelector(
      'a[href="/repas/planning"]',
    ) as HTMLAnchorElement;
    expect(lien).not.toBeNull();
    const ajouter = [...el().querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Ajouter à la liste'),
    ) as HTMLButtonElement;
    expect(ajouter.disabled).toBe(true);
  });

  it('affiche le refus de l’API : en bandeau une règle, sous le champ une erreur de forme', async () => {
    const { harness, http, el } = await ouvrir(
      '/courses/articles/nouveau?label=Lait',
    );

    soumettre(el());
    http.expectOne(`${BASE}/shopping-lists/liste-1/items`).flush(
      {
        status: 422,
        code: 'food.list_already_closed',
        message: 'Cette liste est close : elle ne se modifie plus.',
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    await harness.fixture.whenStable();
    expect(el().textContent).toContain(
      'Cette liste est close : elle ne se modifie plus.',
    );

    soumettre(el());
    http.expectOne(`${BASE}/shopping-lists/liste-1/items`).flush(
      {
        status: 400,
        code: 'validation.failed',
        message: 'La saisie est invalide.',
        fields: [
          {
            path: 'label',
            code: 'too_big',
            message: 'Le libellé dépasse 120 caractères.',
          },
        ],
      },
      { status: 400, statusText: 'Bad Request' },
    );
    await harness.fixture.whenStable();
    expect(champ(el(), 'libelle').getAttribute('aria-invalid')).toBe('true');
    expect(el().textContent).toContain('Le libellé dépasse 120 caractères.');
  });

  it('revient aux courses sur « Annuler »', async () => {
    const { harness, http, el, router } = await ouvrir();

    const annuler = [...el().querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Annuler'),
    ) as HTMLButtonElement;
    const revenu = arrivee(router);
    annuler.click();
    await revenu;

    expect(router.url).toBe('/courses');
    TestBed.tick();
    http.match(() => true).forEach((lecture) => lecture.flush([]));
    await harness.fixture.whenStable();
  });
});
