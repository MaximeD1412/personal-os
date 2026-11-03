import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { NavigationEnd, type Router } from '@angular/router';
import { filter, firstValueFrom } from 'rxjs';
import {
  BASE,
  BEURRE,
  OIGNON,
  ouvrirLeCatalogue,
} from '../../testing/catalogue';

const POIREAU =
  '/repas/ingredients/nouveau?displayName=Poireau&canonicalUnit=GRAM&perishable=true';

/** La prochaine navigation achevée, quand la page suivante lit déjà l'API. */
function arrivee(router: Router): Promise<unknown> {
  return firstValueFrom(
    router.events.pipe(
      filter((evenement) => evenement instanceof NavigationEnd),
    ),
  );
}

function champ(el: HTMLElement, nom: string): HTMLInputElement {
  return el.querySelector(`[data-test="${nom}"]`) as HTMLInputElement;
}

function uniteChoisie(el: HTMLElement): string | null | undefined {
  return el
    .querySelector('[data-test="unite"] [aria-pressed="true"]')
    ?.getAttribute('data-unite');
}

function interrupteur(el: HTMLElement): HTMLElement {
  return el.querySelector('#ingredient-perissable') as HTMLElement;
}

function caseDe(el: HTMLElement, allergene: string): HTMLElement {
  return el.querySelector(`#allergene-${allergene}`) as HTMLElement;
}

describe('Le formulaire d’un Ingrédient', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  describe('en création', () => {
    it('se préremplit par son URL, sans rien enregistrer', async () => {
      const { harness, http, el } = await ouvrirLeCatalogue(POIREAU);
      await harness.fixture.whenStable();

      expect(champ(el(), 'libelle').value).toBe('Poireau');
      expect(uniteChoisie(el())).toBe('GRAM');
      expect(interrupteur(el()).getAttribute('aria-checked')).toBe('true');
      expect(el().querySelector('[data-test="ignores"]')).toBeNull();
      http.expectNone(() => true);
    });

    it('signale une valeur du lien qu’il n’a pas pu reprendre', async () => {
      const { harness, el } = await ouvrirLeCatalogue(
        '/repas/ingredients/nouveau?displayName=Poireau&canonicalUnit=KILO',
      );
      await harness.fixture.whenStable();

      expect(
        el().querySelector('[data-test="ignores"]')?.textContent,
      ).toContain('canonicalUnit=KILO');
      expect(uniteChoisie(el())).toBeUndefined();
    });

    it('ne demande un poids à la pièce qu’en grammes ou en pièces', async () => {
      const { harness, el } = await ouvrirLeCatalogue(POIREAU);
      await harness.fixture.whenStable();
      expect(champ(el(), 'poids')).not.toBeNull();
      expect(
        el().querySelector('label[for="ingredient-poids"]')?.textContent,
      ).toContain("Poids moyen d'une pièce (g)");
      expect(el().textContent).toContain(
        'Utilisé pour additionner des recettes en pièces et en grammes',
      );

      (
        el().querySelector('[data-unite="MILLILITER"]') as HTMLButtonElement
      ).click();
      await harness.fixture.whenStable();

      expect(champ(el(), 'poids')).toBeNull();
    });

    it('envoie la saisie à « Créer », puis ouvre la fiche', async () => {
      const { harness, http, el, router } = await ouvrirLeCatalogue(POIREAU);
      await harness.fixture.whenStable();

      caseDe(el(), 'CELERY').click();
      const poids = champ(el(), 'poids');
      poids.value = '250';
      poids.dispatchEvent(new Event('input'));
      (el().querySelector('form') as HTMLFormElement).requestSubmit();
      TestBed.tick();

      const creation = http.expectOne(`${BASE}/ingredients`);
      expect(creation.request.method).toBe('POST');
      expect(creation.request.body).toEqual({
        displayName: 'Poireau',
        canonicalUnit: 'GRAM',
        gramsPerPiece: 250,
        allergens: ['CELERY'],
        perishable: true,
      });
      const ouverte = arrivee(router);
      creation.flush({ ...OIGNON, id: 'ingredient-9', displayName: 'Poireau' });
      await ouverte;

      expect(router.url).toBe('/repas/ingredients/ingredient-9');
      // La fiche ouverte lit l'Ingrédient.
      TestBed.tick();
      http.expectOne(`${BASE}/ingredients/ingredient-9`);
    });

    it('affiche le refus de l’API : en bandeau un doublon, sous le champ une erreur de forme', async () => {
      const { harness, http, el } = await ouvrirLeCatalogue(POIREAU);
      await harness.fixture.whenStable();
      const formulaire = el().querySelector('form') as HTMLFormElement;

      formulaire.requestSubmit();
      TestBed.tick();
      http.expectOne(`${BASE}/ingredients`).flush(
        {
          status: 422,
          code: 'food.ingredient_duplicate',
          message: 'Un Ingrédient du catalogue porte déjà ce nom.',
        },
        { status: 422, statusText: 'Unprocessable Entity' },
      );
      await harness.fixture.whenStable();
      expect(el().querySelector('[data-test="refus"]')?.textContent).toContain(
        'Un Ingrédient du catalogue porte déjà ce nom.',
      );

      formulaire.requestSubmit();
      TestBed.tick();
      http.expectOne(`${BASE}/ingredients`).flush(
        {
          status: 400,
          code: 'request.invalid',
          message: 'La requête est invalide.',
          fields: [
            {
              path: 'displayName',
              code: 'custom',
              message:
                'Le libellé doit contenir au moins une lettre ou un chiffre.',
            },
          ],
        },
        { status: 400, statusText: 'Bad Request' },
      );
      await harness.fixture.whenStable();
      expect(el().querySelector('[data-test="refus"]')).toBeNull();
      expect(el().querySelector('hlm-field-error')?.textContent).toContain(
        'Le libellé doit contenir au moins une lettre ou un chiffre.',
      );
      expect(champ(el(), 'libelle').getAttribute('aria-invalid')).toBe('true');
    });
  });

  describe('en modification', () => {
    it('part de l’Ingrédient lu, et envoie la modification à « Enregistrer »', async () => {
      const { harness, http, el, router } = await ouvrirLeCatalogue(
        '/repas/ingredients/ingredient-1/modifier',
      );
      http.expectOne(`${BASE}/ingredients/ingredient-1`).flush(BEURRE);
      await harness.fixture.whenStable();

      expect(champ(el(), 'libelle').value).toBe('Beurre doux');
      expect(uniteChoisie(el())).toBe('GRAM');
      expect(caseDe(el(), 'MILK').getAttribute('aria-checked')).toBe('true');
      expect(el().textContent).toContain("Modifier l'ingrédient");

      caseDe(el(), 'MILK').click();
      (el().querySelector('form') as HTMLFormElement).requestSubmit();
      TestBed.tick();

      const modification = http.expectOne(`${BASE}/ingredients/ingredient-1`);
      expect(modification.request.method).toBe('PATCH');
      expect(modification.request.body).toEqual({
        displayName: 'Beurre doux',
        canonicalUnit: 'GRAM',
        gramsPerPiece: null,
        allergens: [],
        perishable: true,
      });
      const ouverte = arrivee(router);
      modification.flush({ ...BEURRE, allergens: [] });
      await ouverte;

      expect(router.url).toBe('/repas/ingredients/ingredient-1');
      TestBed.tick();
      http.expectOne(`${BASE}/ingredients/ingredient-1`);
    });

    it('affiche le message de l’API pour un Ingrédient introuvable', async () => {
      const { harness, http, el } = await ouvrirLeCatalogue(
        '/repas/ingredients/inconnu/modifier',
      );
      http.expectOne(`${BASE}/ingredients/inconnu`).flush(
        {
          status: 404,
          code: 'food.ingredient_not_found',
          message: 'Aucun Ingrédient de cet identifiant.',
        },
        { status: 404, statusText: 'Not Found' },
      );
      await harness.fixture.whenStable();

      expect(el().textContent).toContain(
        'Aucun Ingrédient de cet identifiant.',
      );
      expect(el().querySelector('form')).toBeNull();
    });
  });
});
