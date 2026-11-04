import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import type { CookedMeal, MealPlanEntry } from '@personal-os/contracts';
import { API_BASE_URL } from '../api-base-url';
import { INTERCEPTEURS } from '../app.config';
import { appRoutes } from '../app.routes';
import { BEURRE } from '../../testing/catalogue';
import {
  arrivee,
  DAHL_DU_LUNDI,
  RESTES_DU_MERCREDI,
} from '../../testing/planning';
import { BASE, DAHL, OMELETTE } from '../../testing/recettes';

/** Le planning, où le formulaire revient : sa page n'est pas le sujet ici. */
@Component({ template: '' })
class PlanningVide {}

async function ouvrirLaCuisine(url: string) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        ...appRoutes.filter(({ path }) => path?.startsWith('repas/cuisine')),
        { path: 'repas/planning', component: PlanningVide },
      ]),
      provideHttpClient(withInterceptors(INTERCEPTEURS)),
      provideHttpClientTesting(),
      { provide: API_BASE_URL, useValue: BASE },
    ],
  });
  const harness = await RouterTestingHarness.create(url);
  const http = TestBed.inject(HttpTestingController);
  const el = () => harness.routeNativeElement as HTMLElement;
  return { harness, http, el, router: TestBed.inject(Router) };
}

/** Le formulaire d'un repas, devant le repas et sa recette lus. */
async function ouvrir(repas: MealPlanEntry = DAHL_DU_LUNDI, recette = DAHL) {
  const ouvert = await ouvrirLaCuisine(
    `/repas/cuisine/nouveau?mealPlanEntryId=${repas.id}`,
  );
  TestBed.tick();
  ouvert.http.expectOne(`${BASE}/meal-plan-entries/${repas.id}`).flush(repas);
  // La recette se lit une fois le repas reçu.
  await Promise.resolve();
  TestBed.tick();
  if (repas.recipe) {
    ouvert.http.expectOne(`${BASE}/recipes/${repas.recipe.id}`).flush(recette);
  }
  await ouvert.harness.fixture.whenStable();
  return ouvert;
}

/** Le texte d'un nœud, ses espaces insécables (des nombres formatés) ramenés à de simples espaces. */
function texte(noeud: Element | null | undefined): string {
  return (noeud?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function lignes(el: HTMLElement): HTMLElement[] {
  return [...el.querySelectorAll<HTMLElement>('[data-test="ligne"]')];
}

function ligne(el: HTMLElement, nom: string): HTMLElement {
  return lignes(el).find((l) => l.textContent?.includes(nom)) as HTMLElement;
}

function quantite(ligne: HTMLElement): HTMLInputElement {
  return ligne.querySelector('[data-test="quantite"]') as HTMLInputElement;
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

const DECLARE: CookedMeal = {
  id: 'cuisine-1',
  mealPlanEntryId: DAHL_DU_LUNDI.id,
  cookedAt: '2026-10-19T19:00:00.000Z',
  lines: [],
  shortfalls: [],
};

describe('La déclaration d’un Repas cuisiné', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('se préremplit des lignes de la recette, et dit le repas', async () => {
    const { el } = await ouvrir();

    const repas = texte(el().querySelector('[data-test="repas"]'));
    expect(repas).toContain('Dîner · lundi 19 octobre');
    expect(repas).toContain('Dahl de lentilles corail');
    expect(repas).toContain('Prévu pour 4 portions.');
    expect(lignes(el())).toHaveLength(3);
    expect(quantite(ligne(el(), 'Lentilles corail')).value).toBe('250');
    expect(
      texte(
        ligne(el(), 'Lentilles corail').querySelector('[data-test="prevu"]'),
      ),
    ).toBe('Recette : 250 g');
    expect(
      ligne(el(), 'Oignon jaune').querySelector('[data-test="unite"]')
        ?.textContent,
    ).toContain('pièce');
    expect(quantite(ligne(el(), 'Huile d’olive')).value).toBe('1.5');
  });

  it('ajuste les quantités de la recette aux portions du repas', async () => {
    const { el } = await ouvrir(
      {
        ...DAHL_DU_LUNDI,
        recipe: { id: OMELETTE.id, title: OMELETTE.title },
      },
      OMELETTE,
    );

    expect(texte(el().querySelector('[data-test="repas"]'))).toContain(
      'La recette, pour 1 portion, est ajustée.',
    );
    expect(quantite(ligne(el(), 'Oignon jaune')).value).toBe('4');
  });

  it('envoie les quantités déclarées, pas celles de la recette, puis revient au planning de la semaine', async () => {
    const { el, http, router } = await ouvrir();

    saisir(quantite(ligne(el(), 'Lentilles corail')), '200');
    (
      ligne(el(), 'Huile d’olive').querySelector(
        '[data-test="retirer"]',
      ) as HTMLButtonElement
    ).click();
    TestBed.tick();
    expect(lignes(el())).toHaveLength(2);
    soumettre(el());

    const envoi = http.expectOne(`${BASE}/cooked-meals`);
    expect(envoi.request.method).toBe('POST');
    expect(envoi.request.body).toEqual({
      mealPlanEntryId: 'repas-1',
      lines: [
        { ingredientId: 'ingredient-1', quantity: 200, unit: 'G' },
        { ingredientId: 'ingredient-2', quantity: 1, unit: 'PIECE' },
      ],
    });
    const revenu = arrivee(router);
    envoi.flush(DECLARE);
    await revenu;

    expect(router.url).toBe('/repas/planning?semaine=2026-10-19');
  });

  it('ajoute une ligne libre du catalogue, dans son Unité canonique', async () => {
    const { el, http, harness } = await ouvrir(RESTES_DU_MERCREDI);

    expect(lignes(el())).toHaveLength(0);
    expect(el().querySelector('[data-test="aucune-ligne"]')).not.toBeNull();
    saisir(
      el().querySelector('[data-test="recherche"]') as HTMLInputElement,
      'beur',
    );
    http
      .expectOne(
        ({ url, params }) =>
          url === `${BASE}/ingredients` && params.get('q') === 'beur',
      )
      .flush([BEURRE]);
    await harness.fixture.whenStable();
    (
      el().querySelector('[data-test="ingredient"]') as HTMLButtonElement
    ).click();
    TestBed.tick();

    expect(lignes(el())).toHaveLength(1);
    const beurre = ligne(el(), 'Beurre doux');
    expect(beurre.querySelector('[data-test="prevu"]')).toBeNull();
    expect(beurre.querySelector('[data-test="unite"]')?.textContent).toContain(
      'g',
    );
    saisir(quantite(beurre), '30');
    soumettre(el());

    expect(http.expectOne(`${BASE}/cooked-meals`).request.body).toEqual({
      mealPlanEntryId: 'repas-2',
      lines: [{ ingredientId: 'ingredient-1', quantity: 30, unit: 'G' }],
    });
  });

  it('dit, après l’enregistrement, ce que le stock n’avait pas', async () => {
    const { el, http, harness } = await ouvrir();

    soumettre(el());
    http.expectOne(`${BASE}/cooked-meals`).flush({
      ...DECLARE,
      shortfalls: [
        {
          ingredient: {
            id: 'ingredient-1',
            displayName: 'Lentilles corail',
            canonicalUnit: 'GRAM',
          },
          available: 200,
          missing: 50,
        },
      ],
    });
    await harness.fixture.whenStable();

    expect(el().querySelector('form')).toBeNull();
    expect(
      [...el().querySelectorAll('[data-test="manque"]')].map(texte),
    ).toEqual(["Le stock n'avait que 200 g de lentilles corail."]);
    expect(
      el().querySelector('[data-test="retour"]')?.getAttribute('href'),
    ).toBe('/repas/planning?semaine=2026-10-19');
  });

  it('affiche le refus de l’API : en bandeau une règle, sous la ligne une erreur de forme', async () => {
    const { el, http, harness } = await ouvrir();

    soumettre(el());
    http.expectOne(`${BASE}/cooked-meals`).flush(
      {
        status: 422,
        code: 'food.meal_already_cooked',
        message:
          'Ce repas est déjà déclaré cuisiné : une erreur se corrige dans le stock.',
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    await harness.fixture.whenStable();
    expect(el().textContent).toContain('Ce repas est déjà déclaré cuisiné');

    saisir(quantite(ligne(el(), 'Oignon jaune')), '');
    soumettre(el());
    http.expectOne(`${BASE}/cooked-meals`).flush(
      {
        status: 400,
        code: 'validation.failed',
        message: 'La saisie est invalide.',
        fields: [
          {
            path: 'lines.1.quantity',
            code: 'invalid_type',
            message: 'La quantité est un nombre.',
          },
        ],
      },
      { status: 400, statusText: 'Bad Request' },
    );
    await harness.fixture.whenStable();
    const oignon = ligne(el(), 'Oignon jaune');
    expect(quantite(oignon).getAttribute('aria-invalid')).toBe('true');
    expect(oignon.textContent).toContain('La quantité est un nombre.');
  });

  it('sans repas désigné, ne lit rien et dit d’où il s’ouvre', async () => {
    const { el, harness } = await ouvrirLaCuisine('/repas/cuisine/nouveau');
    await harness.fixture.whenStable();

    expect(el().textContent).toContain('Aucun repas à déclarer');
    expect(el().querySelector('form')).toBeNull();
  });
});
